'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/store';
import { Button, Card, Empty, PageHeader, Status } from '@/components/ui';
import { Icon, type IconName } from '@/components/icons';
import { CarArt, RoadLoader } from '@/components/car-art';
import { Plate } from '@/components/vehicle-identity';
import { can, latestEstimate, serviceName } from '@/lib/rules';
import { detailHref } from '@/lib/routes';
import { money } from '@/lib/format';
import type { Job } from '@/lib/types';

type Tool = 'ask' | 'message' | 'explain' | 'technical';
interface Status_ { configured: boolean; model: string; usedToday: number; limit: number }
interface Usage { calls: number; ok: number; input: number; output: number; avg_ms: number }

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'İstek tamamlanamadı.');
  return data;
}

export default function AiPage() {
  const { state, actor } = useApp();
  const [status, setStatus] = useState<Status_ | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const tools = useMemo(() => ([
    { id: 'ask', icon: 'sparkle', title: 'Atölyeye sor', sub: 'Gecikmeler, gelir, iş yükü hakkında soru sorun', ok: can(actor, 'reports.read') },
    { id: 'message', icon: 'mail', title: 'Müşteri mesajı', sub: 'SMS, WhatsApp veya e-posta taslağı', ok: can(actor, 'estimate.write') },
    { id: 'explain', icon: 'receipt', title: 'Teklifi sade anlat', sub: 'Teknik kalemleri müşterinin anlayacağı dille', ok: can(actor, 'estimate.write') },
    { id: 'technical', icon: 'wrench', title: 'Teknik ön değerlendirme', sub: 'Şikâyete göre muayene kontrol listesi', ok: can(actor, 'inspection.write') },
  ] as { id: Tool; icon: IconName; title: string; sub: string; ok: boolean }[]).filter(t => t.ok), [actor]);
  const [tool, setTool] = useState<Tool>(tools[0]?.id ?? 'technical');
  const refresh = () => { fetch('/api/ai/status').then(r => r.ok ? r.json() : null).then(setStatus).catch(() => {}) };
  useEffect(() => {
    refresh();
    if (actor.role === 'admin') fetch('/api/ai/usage').then(r => r.ok ? r.json() : null).then(setUsage).catch(() => {});
  }, [actor.role]);

  return <>
    <PageHeader title="Yapay zekâ asistanı" sub="Servis danışmanı ve teknisyen için taslak üretir. Son karar her zaman personelindir; müşteri adı, telefonu ve iç notlar modele gönderilmez." />
    <section className="ai-hero">
      <div className="ai-hero-text">
        <span className={'ai-state ' + (status?.configured ? 'on' : 'off')}><i />{status ? status.configured ? 'Claude bağlı' : 'Kural/şablon motoru' : 'Kontrol ediliyor…'}</span>
        <h2>Atölyenin verisiyle çalışan asistan</h2>
        <p>{status?.configured ? `${status.model} modeli kullanılıyor. Bugün ${status.usedToday} / ${status.limit} çağrı yaptınız.` : 'Anahtar tanımlanana kadar her araç, kural ve şablon motoruyla yine çalışır; ekranda hangi motorun cevap verdiği yazar.'}</p>
        {status?.configured && <div className="quota"><i style={{ width: `${Math.min(100, status.usedToday / status.limit * 100)}%` }} /></div>}
      </div>
      <div className="ai-hero-art" aria-hidden="true"><div className="scan" /><CarArt color="#d9480f" type="hatch" /></div>
      {usage && <dl className="ai-usage">
        <div><dt>30 gün çağrı</dt><dd>{usage.calls}</dd></div>
        <div><dt>Başarılı</dt><dd>{usage.calls ? `%${Math.round(usage.ok / usage.calls * 100)}` : '—'}</dd></div>
        <div><dt>Token (giriş/çıkış)</dt><dd>{(usage.input / 1000).toFixed(1)}k / {(usage.output / 1000).toFixed(1)}k</dd></div>
        <div><dt>Ort. süre</dt><dd>{usage.avg_ms ? `${(usage.avg_ms / 1000).toFixed(1)} sn` : '—'}</dd></div>
      </dl>}
    </section>

    <div className="ai-layout">
      <nav className="ai-tools" aria-label="Asistan araçları">
        {tools.map(t => <button key={t.id} className={tool === t.id ? 'active' : ''} onClick={() => setTool(t.id)} aria-pressed={tool === t.id}>
          <span className="rk-icon"><Icon name={t.icon} size={17} /></span><span><b>{t.title}</b><small>{t.sub}</small></span>
        </button>)}
      </nav>
      <div className="ai-work">
        {tool === 'ask' && <Ask onDone={refresh} />}
        {tool === 'message' && <MessageTool onDone={refresh} />}
        {tool === 'explain' && <Explain onDone={refresh} />}
        {tool === 'technical' && <Technical onDone={refresh} />}
      </div>
    </div>
    <p className="small muted">Yapay zekâ çıktıları taslaktır; tutar, tarih ve teknik kararlar gönderilmeden önce personel tarafından kontrol edilmelidir. {state.settings.company.name}</p>
  </>;
}

function Engine({ engine, ai, notice }: { engine: string; ai: boolean; notice?: string }) {
  return <>{notice && <div className="banner warn"><Icon name="alert" size={15} />{notice}</div>}<div className="ai-meta"><span className={'tag ' + (ai ? 'ai' : '')}>{ai ? 'Yapay zekâ' : 'Şablon'}</span>{engine}</div></>;
}

function JobPicker({ jobs, value, onChange }: { jobs: Job[]; value: string; onChange: (id: string) => void }) {
  const { state } = useApp();
  if (!jobs.length) return <Empty icon="wrench" title="Uygun iş emri yok" />;
  return <div className="job-pick" role="radiogroup" aria-label="İş emri seçin">{jobs.map(j => {
    const v = state.vehicles.find(x => x.id === j.vehicleId);
    return <button key={j.id} role="radio" aria-checked={value === j.id} className={value === j.id ? 'active' : ''} onClick={() => onChange(j.id)}>
      <span className="jp-art">{v && <CarArt vehicle={v} />}</span>
      <span className="jp-text"><b>{v ? `${v.brand} ${v.model}` : j.no}</b><span>{v && <Plate value={v.plate} size="sm" />}<small className="mono">{j.no}</small></span></span>
      <Status value={j.status} />
    </button>;
  })}</div>;
}

function useRunner<T>(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<T | null>(null);
  const [error, setError] = useState('');
  const go = async (path: string, body: unknown) => {
    setBusy(true); setError(''); setOut(null);
    try { setOut(await post<T>(path, body)); onDone() } catch (e) { setError(e instanceof Error ? e.message : 'İstek tamamlanamadı.') } finally { setBusy(false) }
  };
  return { busy, out, error, go };
}

const examples = ['Bugün hangi işler gecikmede ve neden önemli?', 'Son 30 günde en çok gelir getiren hizmet hangisi?', 'Teknisyenlerin iş yükü dengeli mi?', 'Onay bekleyen teklifler için ne yapmalıyım?'];
function Ask({ onDone }: { onDone: () => void }) {
  const [q, setQ] = useState('');
  const r = useRunner<{ answer: string; highlights: string[]; actions: string[]; engine: string; ai: boolean; notice?: string }>(onDone);
  const send = (text = q) => { if (text.trim().length >= 4) { setQ(text); void r.go('ai/assist', { task: 'ask', question: text }) } };
  return <Card title="Atölyeye sor" sub="Cevaplar yalnız sistemdeki özet veriye dayanır.">
    <form className="ask-box" onSubmit={e => { e.preventDefault(); send() }}>
      <Icon name="sparkle" size={17} />
      <input value={q} onChange={e => setQ(e.target.value)} maxLength={500} placeholder="Ör. Bu hafta kaç araç gecikti?" aria-label="Soru" />
      <Button type="submit" variant="primary" disabled={r.busy || q.trim().length < 4}>Sor</Button>
    </form>
    <div className="chips">{examples.map(x => <button key={x} className="chip" onClick={() => send(x)} disabled={r.busy}>{x}</button>)}</div>
    {r.busy && <RoadLoader label="Veriler okunuyor…" />}
    {r.error && <div className="banner bad">{r.error}</div>}
    {r.out && <div className="ai-answer">
      <Engine {...r.out} />
      <p className="ai-lead">{r.out.answer}</p>
      {r.out.highlights.length > 0 && <ul className="ai-points">{r.out.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>}
      {r.out.actions.length > 0 && <><h3>Öneriler</h3><ol className="ai-points">{r.out.actions.map((h, i) => <li key={i}>{h}</li>)}</ol></>}
    </div>}
  </Card>;
}

const purposes = [['teklif', 'Teklif onayı'], ['hazir', 'Teslime hazır'], ['parca', 'Parça gecikmesi'], ['durum', 'Durum bilgisi'], ['bakim', 'Bakım hatırlatma']] as const;
function MessageTool({ onDone }: { onDone: () => void }) {
  const { state, notify } = useApp();
  const jobs = state.jobs.filter(j => j.status !== 'İptal').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);
  const [jobId, setJobId] = useState(jobs[0]?.id ?? '');
  const [purpose, setPurpose] = useState<string>('durum');
  const [channel, setChannel] = useState('WhatsApp');
  const [tone, setTone] = useState('Resmî');
  const [text, setText] = useState('');
  const r = useRunner<{ message: string; engine: string; ai: boolean; notice?: string }>(onDone);
  const job = state.jobs.find(j => j.id === jobId);
  const customer = job && state.customers.find(c => c.id === job.customerId);
  useEffect(() => { if (r.out) setText(r.out.message.replaceAll('{MUSTERI}', customer?.name.split(' ')[0] ?? 'Değerli müşterimiz')) }, [r.out, customer]);
  return <Card title="Müşteri mesajı" sub="Ad, mesaj üretildikten sonra cihazınızda eklenir; modele gönderilmez.">
    <div className="ai-steps">
      <div><span className="eyebrow">1 · İş emri</span><JobPicker jobs={jobs} value={jobId} onChange={setJobId} /></div>
      <div className="ai-opts">
        <span className="eyebrow">2 · Amaç ve kanal</span>
        <div className="chips">{purposes.map(([k, l]) => <button key={k} className={'chip ' + (purpose === k ? 'on' : '')} onClick={() => setPurpose(k)}>{l}</button>)}</div>
        <div className="chips">{['SMS', 'WhatsApp', 'E-posta'].map(k => <button key={k} className={'chip ' + (channel === k ? 'on' : '')} onClick={() => setChannel(k)}>{k}</button>)}<span className="sep" />{['Resmî', 'Samimi'].map(k => <button key={k} className={'chip ' + (tone === k ? 'on' : '')} onClick={() => setTone(k)}>{k}</button>)}</div>
        <Button variant="primary" icon="sparkle" disabled={!jobId || r.busy} onClick={() => r.go('ai/assist', { task: 'message', jobId, purpose, channel, tone })}>Mesaj taslağı oluştur</Button>
      </div>
    </div>
    {r.busy && <RoadLoader label="Mesaj yazılıyor…" />}
    {r.error && <div className="banner bad">{r.error}</div>}
    {r.out && <div className="ai-answer">
      <Engine {...r.out} />
      <div className={'bubble ' + channel.toLowerCase().replace('-', '')}><textarea value={text} onChange={e => setText(e.target.value)} rows={channel === 'E-posta' ? 7 : 5} aria-label="Mesaj metni" /><small>{text.length} karakter{channel === 'SMS' && ` · ${Math.ceil(text.length / 153) || 1} SMS`}</small></div>
      <div className="btn-row"><Button icon="clipboard" onClick={() => navigator.clipboard.writeText(text).then(() => notify('Mesaj panoya kopyalandı'))}>Kopyala</Button>
        {channel === 'WhatsApp' && customer && <a className="btn" href={`https://wa.me/90${customer.phone.replace(/\D/g, '').replace(/^0/, '')}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><Icon name="phone" size={15} />WhatsApp’ta aç</a>}
        {channel === 'E-posta' && customer?.email && <a className="btn" href={`mailto:${customer.email}?subject=${encodeURIComponent('Aracınız hakkında')}&body=${encodeURIComponent(text)}`}><Icon name="mail" size={15} />E-postada aç</a>}
      </div>
    </div>}
  </Card>;
}

function Explain({ onDone }: { onDone: () => void }) {
  const { state } = useApp();
  const jobs = state.jobs.filter(j => latestEstimate(j) && latestEstimate(j)!.lines.length).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);
  const [jobId, setJobId] = useState(jobs[0]?.id ?? '');
  const r = useRunner<{ intro: string; items: { name: string; plain: string; why: string; urgency: 'Hemen' | 'Yakında' | 'Planlı' }[]; closing: string; total: number; version: number; engine: string; ai: boolean; notice?: string }>(onDone);
  const tone = { Hemen: 'bad', Yakında: 'warn', Planlı: 'ok' } as const;
  return <Card title="Teklifi sade anlat" sub="Teklif kalemleri ve muayene bulgularından müşteriye açıklama hazırlar.">
    <div className="ai-steps">
      <div><span className="eyebrow">İş emri</span><JobPicker jobs={jobs} value={jobId} onChange={setJobId} /></div>
      <div className="ai-opts"><Button variant="primary" icon="sparkle" disabled={!jobId || r.busy} onClick={() => r.go('ai/assist', { task: 'explain', jobId })}>Açıklama oluştur</Button></div>
    </div>
    {r.busy && <RoadLoader label="Teklif okunuyor…" />}
    {r.error && <div className="banner bad">{r.error}</div>}
    {r.out && <div className="ai-answer">
      <Engine {...r.out} />
      <p className="ai-lead">{r.out.intro}</p>
      <ul className="plain-list">{r.out.items.map((it, i) => <li key={i} className={tone[it.urgency]}><span className="tl-dot" /><div><b>{it.name}</b><p>{it.plain}</p><small>{it.why}</small></div><em>{it.urgency}</em></li>)}</ul>
      <div className="row-between"><p className="small muted">{r.out.closing}</p><strong>Teklif v{r.out.version}: {money(r.out.total)}</strong></div>
    </div>}
  </Card>;
}

function Technical({ onDone }: { onDone: () => void }) {
  const { state } = useApp();
  const jobs = state.jobs.filter(j => ['Kabul edildi', 'İnceleniyor', 'Onay bekliyor', 'İşlemde'].includes(j.status)).slice(0, 12);
  const [jobId, setJobId] = useState(jobs[0]?.id ?? '');
  const r = useRunner<{ suggestions: { item: string; reason: string; priority: string }[]; explanation: string; causes: string[]; engine: string; ai: boolean; notice?: string }>(onDone);
  const job = state.jobs.find(j => j.id === jobId);
  return <Card title="Teknik ön değerlendirme" sub="Kabul şikâyeti, kilometre ve araç geçmişinden muayene listesi önerir.">
    <div className="ai-steps">
      <div><span className="eyebrow">Açık iş emri</span><JobPicker jobs={jobs} value={jobId} onChange={setJobId} /></div>
      <div className="ai-opts">
        {job && <blockquote className="complaint">“{job.intake.complaint}”<small>{serviceName(state, job.serviceId)} · {job.intake.km.toLocaleString('tr-TR')} km</small></blockquote>}
        <Button variant="primary" icon="sparkle" disabled={!jobId || r.busy} onClick={() => r.go('ai/technical', { jobId })}>Kontrol listesi öner</Button>
      </div>
    </div>
    {r.busy && <RoadLoader label="Araç inceleniyor…" vehicle={job && state.vehicles.find(v => v.id === job.vehicleId)} />}
    {r.error && <div className="banner bad">{r.error}</div>}
    {r.out && <div className="ai-answer">
      <Engine engine={r.out.engine} ai={r.out.ai} notice={r.out.notice} />
      <p className="ai-lead">{r.out.explanation}</p>
      {r.out.causes.length > 0 && <><h3>Olası nedenler</h3><ul className="ai-points">{r.out.causes.map((c, i) => <li key={i}>{c}</li>)}</ul></>}
      <table className="table"><thead><tr><th>Kontrol</th><th>Öncelik</th><th className="hide-sm">Gerekçe</th></tr></thead><tbody>{r.out.suggestions.map(s => <tr key={s.item}><td>{s.item}</td><td><Status value={s.priority} /></td><td className="hide-sm small muted">{s.reason}</td></tr>)}</tbody></table>
      <Link className="btn" href={detailHref('/is-emirleri/detay', jobId)}>İş emrinde bulgulara ekle <Icon name="arrow" size={13} /></Link>
    </div>}
  </Card>;
}
