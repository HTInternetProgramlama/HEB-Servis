import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { db, readState } from './database';
import { fail } from './errors';
import { visibleState } from './service';
import { amountDue, approvedEstimate, balance, can, estimateTotals, latestEstimate, lineTotals, serviceName, staffName, technicians } from '../rules';
import { plateText, today } from '../format';
import { generateTechnicalDraft, type Suggestion, type TechnicalInput } from '../advisor';
import { maskPersonal } from '../privacy';
import type { Actor } from '../types';

const CLAUDE_MODEL = 'claude-opus-5-5';
const DAILY_LIMIT = 40;
const AI_ENGINES = "engine in ('claude','deepseek')";

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

/* ───────── Sağlayıcılar: DeepSeek (öncelikli) veya Claude ─────────
   Anahtarlar yalnız sunucu ortam değişkenlerinde durur; istemciye hiçbir zaman gitmez. */
const realKey = (key: string | undefined) => key && !/BURAYA|YOUR_|placeholder/i.test(key) ? key.trim() : null;
type Failure = 'auth' | 'balance' | 'busy' | 'network' | 'invalid';
class AiFailure extends Error { constructor(public kind: Failure, public status?: number) { super(kind) } }
const failureText: Record<Failure, string> = {
  auth: 'Yapay zekâ anahtarı geçersiz', balance: 'Yapay zekâ hesabında bakiye yok', busy: 'Yapay zekâ servisi yoğun',
  network: 'Yapay zekâ servisine ulaşılamadı', invalid: 'Yapay zekâ cevabı beklenen biçimde değildi',
};
interface Run<T> { data: T | null; input: number; output: number; model: string; stop?: string }
interface Provider { engine: 'deepseek' | 'claude'; label: string; model: string; run<T>(system: string, prompt: string, schema: z.ZodType<T>, maxTokens: number, effort: 'low' | 'medium'): Promise<Run<T>> }

export function deepseek(): Provider | null {
  const key = realKey(process.env.DEEPSEEK_API_KEY);
  if (!key) return null;
  const base = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  const once = async <T,>(system: string, prompt: string, schema: z.ZodType<T>, maxTokens: number, timeoutMs: number): Promise<Run<T>> => {
    let res: Response;
    try {
      res = await fetch(`${base}/chat/completions`, {
        method: 'POST', signal: AbortSignal.timeout(timeoutMs),
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, max_tokens: maxTokens, stream: false, response_format: { type: 'json_object' },
          ...(/reasoner/i.test(model) ? {} : { temperature: 0.3 }),
          messages: [
            { role: 'system', content: `${system}\n\nCevabını yalnız aşağıdaki JSON şemasına uyan tek bir JSON nesnesi olarak ver; açıklama veya kod bloğu ekleme.\n${JSON.stringify(z.toJSONSchema(schema))}` },
            { role: 'user', content: prompt },
          ],
        }),
      });
    } catch { throw new AiFailure('network') }
    if (!res.ok) throw new AiFailure(res.status === 401 || res.status === 403 ? 'auth' : res.status === 402 ? 'balance' : res.status === 429 || res.status >= 500 ? 'busy' : 'invalid', res.status);
    const body = await res.json().catch(() => null) as { model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number }; choices?: { finish_reason?: string; message?: { content?: string } }[] } | null;
    const choice = body?.choices?.[0];
    const usage = { input: body?.usage?.prompt_tokens ?? 0, output: body?.usage?.completion_tokens ?? 0, model: body?.model ?? model, stop: choice?.finish_reason };
    let parsed: unknown = null;
    try { parsed = JSON.parse(choice?.message?.content ?? '') } catch { /* geçersiz JSON */ }
    const checked = schema.safeParse(parsed);
    return { ...usage, data: choice?.finish_reason === 'stop' && checked.success ? checked.data : null };
  };
  return {
    engine: 'deepseek', label: 'DeepSeek', model,
    // JSON kipinde nadiren boş/eksik cevap döner; süre kalırsa bir kez yeniden denenir.
    // İki deneme birlikte API rotasının 60 sn sınırının altında kalır; ikinci deneme hata verirse ilk denemenin token kullanımı kaybolmaz.
    async run<T>(system: string, prompt: string, schema: z.ZodType<T>, maxTokens: number) {
      const deadline = Date.now() + 50_000;
      const first = await once(system, prompt, schema, maxTokens, 40_000);
      const left = deadline - Date.now();
      if (first.data || left < 12_000) return first;
      try {
        const second = await once(system, prompt, schema, maxTokens, left);
        return { ...second, input: first.input + second.input, output: first.output + second.output };
      } catch (e) { return { ...first, stop: `retry-${e instanceof AiFailure ? e.kind : 'error'}` } }
    },
  };
}

let anthropicClient: Anthropic | undefined;
function claude(): Provider | null {
  const key = realKey(process.env.ANTHROPIC_API_KEY);
  if (!key) return null;
  anthropicClient ??= new Anthropic({ apiKey: key, timeout: 45_000, maxRetries: 1 });
  const ai = anthropicClient;
  return {
    engine: 'claude', label: 'Claude', model: CLAUDE_MODEL,
    async run<T>(system: string, prompt: string, schema: z.ZodType<T>, maxTokens: number, effort: 'low' | 'medium') {
      try {
        const r = await ai.messages.parse({ model: CLAUDE_MODEL, max_tokens: maxTokens, system, output_config: { effort, format: zodOutputFormat(schema) }, messages: [{ role: 'user', content: prompt }] });
        return { data: r.stop_reason === 'refusal' ? null : (r.parsed_output as T | null), input: r.usage.input_tokens, output: r.usage.output_tokens, model: r.model, stop: r.stop_reason ?? undefined };
      } catch (e) {
        if (e instanceof Anthropic.AuthenticationError) throw new AiFailure('auth', 401);
        if (e instanceof Anthropic.RateLimitError) throw new AiFailure('busy', 429);
        throw new AiFailure(e instanceof Anthropic.APIError ? 'busy' : 'network', e instanceof Anthropic.APIError ? e.status : undefined);
      }
    },
  };
}
const provider = () => deepseek() ?? claude();
export const aiConfigured = () => provider() !== null;
const usedToday = async (actor: Actor) => (await db().query(`select count(*)::int as n from ai_requests where user_id=$1 and ${AI_ENGINES} and at > now() - interval '1 day'`, [actor.userId])).rows[0].n as number;

async function record(actor: Actor, row: { feature?: string; engine: string; model?: string; input?: number; output?: number; ms: number; ok: boolean; error?: string }) {
  try {
    await db().query('insert into ai_requests(user_id,feature,engine,model,input_tokens,output_tokens,duration_ms,ok,error) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [actor.userId, row.feature ?? 'technical-draft', row.engine, row.model ?? null, row.input ?? 0, row.output ?? 0, row.ms, row.ok, row.error ?? null]);
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
  const pastItems = scoped.jobs.filter(j => j.vehicleId === vehicle.id && j.id !== job.id).flatMap(j => j.inspections.filter(i => i.result !== 'Uygun').map(i => i.item));
  const names = [state.customers.find(c => c.id === job.customerId)?.name ?? '', ...state.users.map(u => u.name)];
  const input: TechnicalInput = { brand: vehicle.brand, model: vehicle.model, year: vehicle.year, km: job.intake.km, fuel: vehicle.fuel, complaint: job.intake.complaint, pastItems };
  const rules = (notice?: string): TechnicalDraft => ({ ...generateTechnicalDraft(input), causes: [], ai: false, notice });

  const facts = [
    `Araç: ${input.brand} ${input.model}, model yılı ${input.year}, yakıt ${input.fuel}`,
    `Kabul kilometresi: ${input.km.toLocaleString('tr-TR')} km`,
    `Müşteri şikâyeti (kişisel veriler maskelenmiştir): """${maskPersonal(input.complaint.slice(0, 1200), names)}"""`,
    `Bu aracın önceki servislerinde uygun çıkmayan bulgular: ${pastItems.length ? pastItems.slice(0, 15).map(i => maskPersonal(i, names)).join('; ') : 'yok'}`,
  ].join('\n');
  const result = await callModel(actor, 'technical-draft', SYSTEM, `Aşağıdaki araç için muayene kontrol listesi öner.\n\n${facts}`, Draft, 4000, 'medium');
  if (!result.ok) return rules(result.notice.replace('şablon/kural motoru', 'kural tabanlı motor'));
  const out = result.data;
  const seen = new Set<string>();
  const suggestions = out.checks
    .map(c => ({ item: c.item.trim().slice(0, 120), reason: c.reason.trim().slice(0, 300), priority: c.priority }))
    .filter(c => c.item.length >= 3 && !seen.has(c.item.toLocaleLowerCase('tr')) && seen.add(c.item.toLocaleLowerCase('tr')))
    .slice(0, 8);
  if (!suggestions.length) return rules('Yapay zekâ cevabı kullanılabilir kontrol içermedi; kural tabanlı motor kullanıldı.');
  return { suggestions, explanation: out.summary.slice(0, 800), causes: out.likely_causes.slice(0, 4).map(c => c.slice(0, 200)), engine: result.engine, ai: true };
}

/** Yönetici ekranı için son 30 günün kullanım özeti. */
export async function aiUsage(actor: Actor) {
  if (actor.role !== 'admin') return fail(403, 'Bu işlem için yetkiniz yok.');
  const r = await db().query(`select count(*)::int as calls, count(*) filter (where ok)::int as ok,
    coalesce(sum(input_tokens),0)::int as input, coalesce(sum(output_tokens),0)::int as output, coalesce(avg(duration_ms),0)::int as avg_ms
    from ai_requests where ${AI_ENGINES} and at > now() - interval '30 days'`);
  const p = provider();
  return { configured: p !== null, provider: p?.label ?? null, model: p?.model ?? null, ...r.rows[0] };
}

/* ───────── Ortak çağrı: kota, kayıt, hata eşleme ───────── */
type Outcome<T> = { ok: true; data: T; engine: string } | { ok: false; notice: string };
async function callModel<T>(actor: Actor, feature: string, system: string, prompt: string, schema: z.ZodType<T>, maxTokens = 3000, effort: 'low' | 'medium' = 'low'): Promise<Outcome<T>> {
  const p = provider();
  if (!p) return { ok: false, notice: 'Yapay zekâ anahtarı tanımlı değil; şablon/kural motoru kullanıldı.' };
  if (await usedToday(actor) >= DAILY_LIMIT) return { ok: false, notice: `Günlük yapay zekâ kotası (${DAILY_LIMIT}) doldu; şablon/kural motoru kullanıldı.` };
  const started = Date.now();
  try {
    const r = await p.run(system, prompt, schema, maxTokens, effort);
    const usage = { feature, engine: p.engine, input: r.input, output: r.output, ms: Date.now() - started, model: r.model };
    if (!r.data) {
      await record(actor, { ...usage, ok: false, error: r.stop ?? 'parse' });
      return { ok: false, notice: 'Yapay zekâ bu istek için kullanılabilir cevap üretmedi; şablon/kural motoru kullanıldı.' };
    }
    await record(actor, { ...usage, ok: true });
    return { ok: true, data: r.data, engine: `${p.label} (${r.model})` };
  } catch (e) {
    const f = e instanceof AiFailure ? e : new AiFailure('network');
    await record(actor, { feature, engine: p.engine, model: p.model, ms: Date.now() - started, ok: false, error: f.status ? `HTTP ${f.status}` : f.kind });
    return { ok: false, notice: `${failureText[f.kind]}; şablon/kural motoru kullanıldı.` };
  }
}

const TL = (k: number) => (k / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
const fmtDay = (iso: string) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Personelin görebileceği durum: bağlı mı, bugün kaç çağrı yapıldı. */
export async function aiStatus(actor: Actor) {
  if (!can(actor, 'inspection.write')) return fail(403, 'Bu işlem için yetkiniz yok.');
  const p = provider();
  return { configured: p !== null, provider: p?.label ?? null, model: p?.model ?? null, usedToday: await usedToday(actor), limit: DAILY_LIMIT };
}

/* ───────── 1) Atölye verisine soru ───────── */
const Answer = z.object({
  answer: z.string().describe('Soruya doğrudan, 2-5 cümlelik Türkçe cevap. Rakamları verilen veriden al.'),
  highlights: z.array(z.string()).describe('Cevabı destekleyen en fazla 4 kısa madde (rakamlı).'),
  actions: z.array(z.string()).describe('Servis müdürü için en fazla 3 somut öneri.'),
});
type St = Awaited<ReturnType<typeof readState>>['state'];
function snapshotFacts(state: St) {
  const day = today();
  const openJobs = state.jobs.filter(j => !['Teslim edildi', 'İptal'].includes(j.status));
  const since = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString() };
  const delivered30 = state.jobs.filter(j => j.deliveredAt && j.deliveredAt >= since(30));
  const pay30 = state.jobs.flatMap(j => j.payments).filter(p => p.at >= since(30));
  const pending = state.jobs.filter(j => latestEstimate(j)?.status === 'Gönderildi');
  return [
    `Bugün: ${day}. Şube: ${state.settings.company.branch}.`,
    `Açık iş emri: ${openJobs.length}. Durumlara göre: ${[...new Set(openJobs.map(j => j.status))].map(s => `${s} ${openJobs.filter(j => j.status === s).length}`).join(', ') || 'yok'}.`,
    `Geciken açık iş (söz verilen saat geçti): ${openJobs.filter(j => j.status !== 'Teslime hazır' && new Date(j.promisedAt) < new Date()).length}.`,
    `Son 30 gün: teslim ${delivered30.length}, işlem tutarı ${TL(delivered30.reduce((s, j) => s + amountDue(j), 0))}, tahsilat ${TL(pay30.reduce((s, p) => s + p.amount, 0))}.`,
    `Son 30 gün hizmet kırılımı: ${state.settings.services.map(sv => { const js = delivered30.filter(j => j.serviceId === sv.id); return js.length ? `${sv.name} ${js.length} iş / ${TL(js.reduce((s, j) => s + amountDue(j), 0))}` : '' }).filter(Boolean).join('; ') || 'yok'}.`,
    `Teknisyen yükü (açık iş / son 30 gün teslim): ${technicians(state).map(t => `${t.name} ${openJobs.filter(j => j.technicianId === t.id).length}/${delivered30.filter(j => j.technicianId === t.id).length}`).join(', ')}.`,
    `Onay bekleyen teklif: ${pending.length} adet, toplam ${TL(pending.reduce((s, j) => s + estimateTotals(latestEstimate(j)!).total, 0))}.`,
    `Açık bakiye: ${TL(state.jobs.filter(j => j.status !== 'İptal').reduce((s, j) => s + Math.max(0, balance(j)), 0))}.`,
    `Bekleyen randevu talebi: ${state.appointments.filter(a => a.status === 'Bekliyor').length}; bugünkü randevu: ${state.appointments.filter(a => a.date === day && a.status !== 'İptal').length}.`,
    'Açık işler (no | araç | hizmet | durum | teknisyen | söz verilen teslim):',
    ...openJobs.slice(0, 25).map(j => { const v = state.vehicles.find(x => x.id === j.vehicleId); return `- ${j.no} | ${v ? `${v.brand} ${v.model} ${v.year}` : '?'} | ${serviceName(state, j.serviceId)} | ${j.status} | ${staffName(state, j.technicianId)} | ${fmtDay(j.promisedAt)}` }),
  ];
}
async function ask(actor: Actor, question: unknown) {
  if (!can(actor, 'reports.read')) return fail(403, 'Bu işlem için yetkiniz yok.');
  if (typeof question !== 'string' || question.trim().length < 4 || question.length > 500) return fail(400, 'Soru 4-500 karakter olmalı.');
  const { state } = await readState();
  const facts = snapshotFacts(state);
  const out = await callModel(actor, 'ask', `Sen bir araç servisinin operasyon asistanısın. Yalnız verilen özet veriye dayanarak Türkçe cevap ver.
Veride olmayan bir şeyi uydurma; bilinmiyorsa açıkça söyle. Müşteri kişisel verisi sana verilmez ve isteme. Kısa ve iş odaklı yaz.`, `Atölye verisi:\n${facts.join('\n')}\n\nSoru: """${maskPersonal(question.trim(), state.customers.map(c => c.name))}"""`, Answer, 1500);
  if (out.ok) return { ...out.data, engine: out.engine, ai: true };
  return { answer: 'Yapay zekâ bağlı olmadığı için soruyu yorumlayamadım; atölyenin güncel özeti aşağıda.', highlights: facts.slice(1, 9), actions: [], engine: 'Özet motoru', ai: false, notice: out.notice };
}

/* ───────── 2) Müşteri mesajı ───────── */
const purposes = { teklif: 'Teklif hazırlandı, onay bekleniyor', hazir: 'Araç teslime hazır', parca: 'Parça bekleniyor, teslim gecikebilir', bakim: 'Periyodik bakım zamanı yaklaştı', durum: 'İşlem durumu bilgilendirmesi' } as const;
const Message = z.object({ message: z.string().describe('Gönderime hazır mesaj. Müşteri adı yerine {MUSTERI} yer tutucusunu kullan.') });
function templateMessage(purpose: keyof typeof purposes, f: { car: string; plate: string; total?: string; promised: string; company: string; phone: string; balance?: string }) {
  const hi = 'Merhaba {MUSTERI},';
  const t = {
    teklif: `${hi} ${f.plate} plakalı ${f.car} aracınızın servis teklifi hazırlandı${f.total ? ` (${f.total})` : ''}. Teklifi müşteri portalından inceleyip onaylayabilirsiniz. Sorularınız için: ${f.phone}. ${f.company}`,
    hazir: `${hi} ${f.plate} plakalı ${f.car} aracınızın işlemleri tamamlandı, teslime hazırdır.${f.balance ? ` Ödenecek tutar: ${f.balance}.` : ''} Çalışma saatlerimizde teslim alabilirsiniz. ${f.company} · ${f.phone}`,
    parca: `${hi} ${f.plate} plakalı ${f.car} aracınız için gereken parça tedarikçiden bekleniyor. Parça gelir gelmez işleme devam edip sizi bilgilendireceğiz. Anlayışınız için teşekkür ederiz. ${f.company} · ${f.phone}`,
    bakim: `${hi} ${f.plate} plakalı ${f.car} aracınızın periyodik bakım zamanı yaklaşıyor. Size uygun gün ve saat için randevu oluşturmak isterseniz bize ulaşabilirsiniz: ${f.phone}. ${f.company}`,
    durum: `${hi} ${f.plate} plakalı ${f.car} aracınız serviste işlemdedir. Tahmini teslim: ${f.promised}. Gelişmeleri size bildireceğiz. ${f.company} · ${f.phone}`,
  };
  return t[purpose];
}
async function message(actor: Actor, body: Record<string, unknown>) {
  if (!can(actor, 'estimate.write')) return fail(403, 'Bu işlem için yetkiniz yok.');
  const purpose = String(body.purpose) as keyof typeof purposes;
  if (!(purpose in purposes)) return fail(400, 'Geçersiz mesaj amacı.');
  const channel = ['SMS', 'WhatsApp', 'E-posta'].includes(String(body.channel)) ? String(body.channel) : 'SMS';
  const tone = body.tone === 'Samimi' ? 'samimi' : 'resmî';
  const { state } = await readState();
  const job = state.jobs.find(j => j.id === body.jobId);
  const vehicle = job && state.vehicles.find(v => v.id === job.vehicleId);
  if (!job || !vehicle) return fail(404, 'İş emri bulunamadı.');
  const est = latestEstimate(job);
  const f = { car: `${vehicle.brand} ${vehicle.model}`, plate: plateText(vehicle.plate), total: est && est.status !== 'Taslak' ? TL(estimateTotals(est).total) : undefined, promised: fmtDay(job.promisedAt), company: state.settings.company.name, phone: state.settings.company.phone, balance: approvedEstimate(job) && balance(job) > 0 ? TL(balance(job)) : undefined };
  const limit = channel === 'SMS' ? 'en fazla 320 karakter' : channel === 'WhatsApp' ? 'en fazla 500 karakter, emoji kullanma' : 'konu satırı olmadan, 2 kısa paragraf';
  const out = await callModel(actor, 'message', `Araç servisi adına müşteriye gidecek kısa bir ${channel} mesajı yaz. Türkçe, ${tone} üslup.
Kurallar: müşteri adı yerine {MUSTERI}, plaka yerine {PLAKA} yer tutucusunu yaz; verilen bilgiler dışında tarih, tutar veya söz verme; satış baskısı yapma; ${limit}; servis adı ve telefonla bitir.`,
    [`Amaç: ${purposes[purpose]}`, `Araç: ${f.car} (plaka: {PLAKA})`, `İş durumu: ${job.status}`, `Tahmini teslim: ${f.promised}`, f.total ? `Teklif toplamı: ${f.total}` : '', f.balance ? `Kalan bakiye: ${f.balance}` : '', `Servis: ${f.company}, telefon ${f.phone}`].filter(Boolean).join('\n'), Message, 800);
  if (out.ok) return { message: out.data.message.replaceAll('{PLAKA}', f.plate).slice(0, 1200), engine: out.engine, ai: true };
  return { message: templateMessage(purpose, f), engine: 'Şablon', ai: false, notice: out.notice };
}

/* ───────── 3) Teklifi müşteri diline çevir ───────── */
const Plain = z.object({
  intro: z.string().describe('Müşteriye 1-2 cümlelik giriş.'),
  items: z.array(z.object({ name: z.string(), plain: z.string().describe('Kalemin ne olduğu, teknik olmayan dille tek cümle.'), why: z.string().describe('Neden gerektiği, tek cümle; bulgulara dayan.'), urgency: z.enum(['Hemen', 'Yakında', 'Planlı']) })),
  closing: z.string().describe('Kısa kapanış; kararın müşteriye ait olduğunu belirt.'),
});
async function explain(actor: Actor, jobId: unknown) {
  if (!can(actor, 'estimate.write')) return fail(403, 'Bu işlem için yetkiniz yok.');
  const { state } = await readState();
  const job = state.jobs.find(j => j.id === jobId);
  const est = job && (approvedEstimate(job) ?? latestEstimate(job));
  const vehicle = job && state.vehicles.find(v => v.id === job.vehicleId);
  if (!job || !est || !vehicle) return fail(404, 'Bu iş emrinde teklif bulunamadı.');
  const names = [state.customers.find(c => c.id === job.customerId)?.name ?? '', ...state.users.map(u => u.name)];
  const findings = job.inspections.filter(i => i.result !== 'Uygun').map(i => `${maskPersonal(i.item, names)} (${i.result})`);
  const lines = est.lines.map(l => `- ${maskPersonal(l.name, names)} | ${l.kind} | ${TL(lineTotals(l).net)}`);
  const total = estimateTotals(est).total;
  const out = await callModel(actor, 'explain', `Araç servisinde teknik teklif kalemlerini, teknik bilgisi olmayan bir araç sahibine açıklıyorsun. Türkçe, sade, dürüst ve kısa yaz.
Korkutma, satış baskısı yapma. Aciliyeti yalnız bulgulara göre belirle: güvenlikle ilgili 'Acil' bulgu varsa 'Hemen', 'Takip edilmeli' ise 'Yakında', diğerleri 'Planlı'.`,
    `Araç: ${vehicle.brand} ${vehicle.model} ${vehicle.year}, ${job.intake.km} km\nTeklif kalemleri:\n${lines.join('\n')}\nMuayene bulguları: ${findings.join('; ') || 'yok'}\nTeklif toplamı: ${TL(total)}`, Plain, 2500);
  if (out.ok) return { ...out.data, total, version: est.version, engine: out.engine, ai: true };
  return {
    intro: `${vehicle.brand} ${vehicle.model} aracınız için hazırlanan teklifteki kalemler aşağıda sade bir dille özetlenmiştir.`,
    items: est.lines.map(l => ({ name: l.name, plain: l.kind === 'İşçilik' ? 'Ustalarımızın bu iş için harcayacağı çalışma süresi.' : 'Aracınıza takılacak yeni parça veya sarf malzemesi.', why: findings.length ? `Muayenede görülen bulgular: ${findings.slice(0, 2).join(', ')}.` : 'Periyodik bakım kapsamında önerilmektedir.', urgency: job.inspections.some(i => i.result === 'Acil') ? 'Yakında' as const : 'Planlı' as const })),
    closing: 'Kalemlerden hangisinin yapılacağına siz karar verirsiniz; sorularınızı servis danışmanınıza iletebilirsiniz.',
    total, version: est.version, engine: 'Şablon', ai: false, notice: out.notice,
  };
}

export async function assist(actor: Actor, body: Record<string, unknown>) {
  if (body.task === 'ask') return ask(actor, body.question);
  if (body.task === 'message') return message(actor, body);
  if (body.task === 'explain') return explain(actor, body.jobId);
  return fail(400, 'Geçersiz yapay zekâ görevi.');
}
