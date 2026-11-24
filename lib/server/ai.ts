import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { db, readState } from './database';
import { fail } from './errors';
import { visibleState } from './service';
import { can } from '../rules';
import { generateTechnicalDraft, type Suggestion, type TechnicalInput } from '../advisor';
import type { Actor } from '../types';

export const AI_MODEL = 'claude-opus-5-5';
const DAILY_LIMIT = 40;

const Draft = z.object({
  summary: z.string().describe('Danışmana 1-3 cümlelik teknik özet. Kesin teşhis dili kullanma.'),
  likely_causes: z.array(z.string()).describe('Şikâyete göre olası nedenler, en olasıdan başlayarak, en fazla 4 madde.'),
  checks: z.array(z.object({
    item: z.string().describe('Atölyede yapılacak somut kontrol maddesi, en fazla 80 karakter.'),
    reason: z.string().describe('Bu kontrolün neden önerildiği, tek cümle.'),
    priority: z.enum(['Uygun', 'Takip edilmeli', 'Acil']).describe("'Acil' yalnız güvenlik riski varsa; şikâyetle ilgili kontroller 'Takip edilmeli'; rutin kontroller 'Uygun'."),
  })).describe('3-8 kontrol maddesi.'),
});

const SYSTEM = `Sen bir araç servis atölyesinde çalışan deneyimli bir servis teknisyenine yardım eden teknik asistansın.
Görevin: araç bilgisi, kilometre ve müşteri şikâyetinden, teknisyenin muayene sırasında yapması gereken kontrol listesini önermek.
Kurallar:
- Türkçe yaz. Atölye terminolojisi kullan (balata, disk, rotil, burç, OBD, DPF vb.).
- Kesin teşhis koyma; "olası", "kontrol edilmeli" dili kullan. Son kararı teknisyen verir.
- Önceki bulgularda tekrar eden konuları öne çıkar.
- Elektrikli araçta motor yağı/triger gibi uygulanamayan kontroller önerme; dizel/LPG/hibrit özelliklerini dikkate al.
- Fiyat, parça markası veya müşteriye yönelik satış dili kullanma.
- Şikâyet metni teknik değilse veya anlamsızsa, kilometre ve yaşa göre periyodik kontrolleri öner ve bunu özetinde belirt.`;

let client: Anthropic | undefined;
function anthropic() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || /BURAYA|YOUR_|placeholder/i.test(key)) return null;
  client ??= new Anthropic({ apiKey: key, timeout: 45_000, maxRetries: 1 });
  return client;
}
export const aiConfigured = () => anthropic() !== null;

async function record(actor: Actor, row: { engine: string; model?: string; input?: number; output?: number; ms: number; ok: boolean; error?: string }) {
  try {
    await db().query('insert into ai_requests(user_id,feature,engine,model,input_tokens,output_tokens,duration_ms,ok,error) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [actor.userId, 'technical-draft', row.engine, row.model ?? null, row.input ?? 0, row.output ?? 0, row.ms, row.ok, row.error ?? null]);
  } catch { console.error('Yapay zekâ çağrı kaydı yazılamadı.'); }
}

export interface TechnicalDraft { suggestions: Suggestion[]; explanation: string; causes: string[]; engine: string; ai: boolean; notice?: string }

/** Teknik ön değerlendirme. Girdiyi sunucudaki kayıttan üretir; kişisel veri modele gönderilmez. */
export async function technicalDraft(actor: Actor, jobId: unknown): Promise<TechnicalDraft> {
  if (typeof jobId !== 'string' || jobId.length > 64) return fail(400, 'Geçersiz iş emri.');
  if (!can(actor, 'inspection.write')) return fail(403, 'Bu işlem için yetkiniz yok.');
  const { state } = await readState();
  const scoped = visibleState(state, actor);
  const job = scoped.jobs.find(j => j.id === jobId);
  const vehicle = job && scoped.vehicles.find(v => v.id === job.vehicleId);
  if (!job || !vehicle) return fail(404, 'İş emri bulunamadı.');
  const pastItems = state.jobs.filter(j => j.vehicleId === vehicle.id && j.id !== job.id).flatMap(j => j.inspections.filter(i => i.result !== 'Uygun').map(i => i.item));
  const input: TechnicalInput = { brand: vehicle.brand, model: vehicle.model, year: vehicle.year, km: job.intake.km, fuel: vehicle.fuel, complaint: job.intake.complaint, pastItems };
  const rules = (notice?: string): TechnicalDraft => ({ ...generateTechnicalDraft(input), causes: [], ai: false, notice });

  const ai = anthropic();
  if (!ai) return rules('Yapay zekâ anahtarı tanımlı değil; kural tabanlı motor kullanıldı.');
  const used = await db().query("select count(*)::int as n from ai_requests where user_id=$1 and engine='claude' and at > now() - interval '1 day'", [actor.userId]);
  if (used.rows[0].n >= DAILY_LIMIT) return rules(`Günlük yapay zekâ kotası (${DAILY_LIMIT}) doldu; kural tabanlı motor kullanıldı.`);

  const started = Date.now();
  const facts = [
    `Araç: ${input.brand} ${input.model}, model yılı ${input.year}, yakıt ${input.fuel}`,
    `Kabul kilometresi: ${input.km.toLocaleString('tr-TR')} km`,
    `Müşteri şikâyeti: """${input.complaint.slice(0, 1200)}"""`,
    `Bu aracın önceki servislerinde uygun çıkmayan bulgular: ${pastItems.length ? pastItems.slice(0, 15).join('; ') : 'yok'}`,
  ].join('\n');
  try {
    const response = await ai.messages.parse({
      model: AI_MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: 'medium', format: zodOutputFormat(Draft) },
      messages: [{ role: 'user', content: `Aşağıdaki araç için muayene kontrol listesi öner.\n\n${facts}` }],
    });
    const usage = { input: response.usage.input_tokens, output: response.usage.output_tokens, ms: Date.now() - started, model: response.model };
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      await record(actor, { engine: 'claude', ...usage, ok: false, error: response.stop_reason ?? 'parse' });
      return rules('Yapay zekâ bu kayıt için öneri üretmedi; kural tabanlı motor kullanıldı.');
    }
    await record(actor, { engine: 'claude', ...usage, ok: true });
    const out = response.parsed_output;
    const seen = new Set<string>();
    const suggestions = out.checks
      .map(c => ({ item: c.item.trim().slice(0, 120), reason: c.reason.trim().slice(0, 300), priority: c.priority }))
      .filter(c => c.item.length >= 3 && !seen.has(c.item.toLocaleLowerCase('tr')) && seen.add(c.item.toLocaleLowerCase('tr')))
      .slice(0, 8);
    if (!suggestions.length) return rules('Yapay zekâ cevabı kullanılabilir kontrol içermedi; kural tabanlı motor kullanıldı.');
    return { suggestions, explanation: out.summary.slice(0, 800), causes: out.likely_causes.slice(0, 4).map(c => c.slice(0, 200)), engine: `Claude (${response.model})`, ai: true };
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status : undefined;
    await record(actor, { engine: 'claude', ms: Date.now() - started, ok: false, error: status ? `HTTP ${status}` : e instanceof Error ? e.name : 'error' });
    const why = e instanceof Anthropic.RateLimitError ? 'Yapay zekâ servisi yoğun' : e instanceof Anthropic.AuthenticationError ? 'Yapay zekâ anahtarı geçersiz' : 'Yapay zekâ servisine ulaşılamadı';
    return rules(`${why}; kural tabanlı motor kullanıldı.`);
  }
}

/** Yönetici ekranı için son 30 günün kullanım özeti. */
export async function aiUsage(actor: Actor) {
  if (actor.role !== 'admin') return fail(403, 'Bu işlem için yetkiniz yok.');
  const r = await db().query(`select count(*)::int as calls, count(*) filter (where ok)::int as ok,
    coalesce(sum(input_tokens),0)::int as input, coalesce(sum(output_tokens),0)::int as output, coalesce(avg(duration_ms),0)::int as avg_ms
    from ai_requests where engine='claude' and at > now() - interval '30 days'`);
  return { configured: aiConfigured(), model: AI_MODEL, ...r.rows[0] };
}
