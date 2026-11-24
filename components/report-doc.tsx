import { Logo } from './shell';
import { Delta, Donut, HBars, TrendChart } from './charts';
import { delta, reportKinds, type Report, type ReportKind } from '@/lib/report';
import { fmtDate, fmtDateTime, fmtTime, money, moneyShort, plateText } from '@/lib/format';
import { amountDue, serviceName, staffName } from '@/lib/rules';
import type { State } from '@/lib/types';

const pct = (v: number) => `%${Math.round(v * 100)}`;
const dur = (h: number) => !h ? '—' : h < 24 ? `${h.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} sa` : `${(h / 24).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} gün`;

function Kpi({ label, value, d, invert, note }: { label: string; value: string; d?: number | null; invert?: boolean; note?: string }) {
  return <div className="rp-kpi"><span>{label}</span><strong>{value}</strong>{d !== undefined ? <Delta value={d} invert={invert} /> : note && <small>{note}</small>}</div>;
}

/** A4 rapor şablonu: ekranda önizleme, yazdırmada PDF. */
export function ReportDoc({ kind, r, state, by }: { kind: ReportKind; r: Report; state: State; by: string }) {
  const co = state.settings.company;
  const meta = reportKinds.find(k => k.id === kind)!;
  const { cur, prev } = r;
  const no = `RPR-${r.to.replaceAll('-', '')}-${kind.slice(0, 3).toUpperCase()}`;
  const veh = (id: string) => state.vehicles.find(v => v.id === id);
  const job = (id: string) => state.jobs.find(j => j.id === id);
  const periodText = r.from === r.to ? fmtDate(r.from, { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }) : `${fmtDate(r.from)} – ${fmtDate(r.to)} (${r.span} gün)`;

  return <article className="report-paper" aria-label={meta.title}>
    <header className="rp-head">
      <div className="rp-brand"><Logo /><p>{co.name}<br />{co.address}<br />{co.phone} · VKN {co.taxNo}</p></div>
      <div className="rp-title">
        <span className="rp-eyebrow">{co.branch}</span>
        <h1>{meta.title}</h1>
        <table><tbody>
          <tr><th>Dönem</th><td>{periodText}</td></tr>
          <tr><th>Rapor no</th><td className="mono">{no}</td></tr>
          <tr><th>Hazırlayan</th><td>{by}</td></tr>
          <tr><th>Oluşturma</th><td>{fmtDateTime(new Date().toISOString())}</td></tr>
        </tbody></table>
      </div>
    </header>

    {kind === 'yonetim' && <>
      <div className="rp-kpis">
        <Kpi label="Teslim edilen araç" value={String(cur.delivered.length)} d={delta(cur.delivered.length, prev.delivered.length)} />
        <Kpi label="İşlem tutarı (KDV dahil)" value={moneyShort(cur.revenue)} d={delta(cur.revenue, prev.revenue)} />
        <Kpi label="Ort. iş emri tutarı" value={moneyShort(cur.aro)} d={delta(cur.aro, prev.aro)} />
        <Kpi label="Tahsilat" value={moneyShort(cur.collected)} d={delta(cur.collected, prev.collected)} />
        <Kpi label="Teklif kapanma oranı" value={cur.decided ? pct(cur.closeRate) : '—'} note={`${cur.decided} karar`} />
        <Kpi label="Zamanında teslim" value={cur.delivered.length ? pct(cur.onTimeRate) : '—'} note={`ort. ${dur(cur.avgHours)}`} />
      </div>
      <section className="rp-section">
        <h2>Günlük eğilim <small><i className="sw bar" />işlem tutarı <i className="sw line" />tahsilat</small></h2>
        <TrendChart data={r.daily} />
      </section>
      <div className="rp-cols">
        <section className="rp-section">
          <h2>Gelir kırılımı</h2>
          <Donut data={[{ label: 'Parça', value: cur.parts }, { label: 'İşçilik', value: cur.labor }]} center={moneyShort(cur.parts + cur.labor)} sub="KDV hariç" size={128} />
          <table className="rp-table compact"><tbody>
            <tr><td>Parça</td><td className="num">{money(cur.parts)}</td></tr>
            <tr><td>İşçilik</td><td className="num">{money(cur.labor)}</td></tr>
            <tr><td>İndirim</td><td className="num">−{money(cur.discount)}</td></tr>
            <tr><td>KDV</td><td className="num">{money(cur.vat)}</td></tr>
            <tr className="total"><td>Toplam</td><td className="num">{money(cur.revenue)}</td></tr>
          </tbody></table>
        </section>
        <section className="rp-section">
          <h2>Hizmet türüne göre</h2>
          {r.byService.length ? <HBars data={r.byService.map(s => ({ label: s.label, value: s.value, note: `${s.count} iş emri` }))} format={moneyShort} /> : <p className="rp-empty">Bu dönemde teslim yok.</p>}
        </section>
      </div>
      <section className="rp-section">
        <h2>En yüksek tutarlı iş emirleri</h2>
        <JobsTable rows={r.topJobs.map(x => x.j)} state={state} />
      </section>
    </>}

    {kind === 'gunsonu' && <>
      <div className="rp-kpis">
        <Kpi label="Toplam tahsilat" value={moneyShort(cur.collected)} d={delta(cur.collected, prev.collected)} />
        <Kpi label="Tahsilat işlemi" value={String(cur.payments.length)} note="POS + nakit + havale" />
        <Kpi label="Teslim edilen" value={String(cur.delivered.length)} note={moneyShort(cur.revenue)} />
        <Kpi label="Açılan iş emri" value={String(cur.opened.length)} d={delta(cur.opened.length, prev.opened.length)} />
        <Kpi label="Açık bakiye (toplam)" value={moneyShort(r.openBalance)} note="Onaylı iş − tahsilat" />
        <Kpi label="Gelmeyen randevu" value={`${cur.noShow} / ${cur.appts}`} note="randevu" />
      </div>
      <div className="rp-cols">
        <section className="rp-section">
          <h2>Tahsilat yöntemleri</h2>
          <Donut data={r.methods} center={moneyShort(cur.collected)} sub={`${cur.payments.length} işlem`} size={128} />
        </section>
        <section className="rp-section">
          <h2>Kasa özeti</h2>
          <table className="rp-table compact"><thead><tr><th>Yöntem</th><th className="num">Adet</th><th className="num">Tutar</th></tr></thead><tbody>
            {r.methods.map(m => <tr key={m.label}><td>{m.label}</td><td className="num">{m.count}</td><td className="num">{money(m.value)}</td></tr>)}
            <tr className="total"><td>Toplam</td><td className="num">{cur.payments.length}</td><td className="num">{money(cur.collected)}</td></tr>
          </tbody></table>
        </section>
      </div>
      <section className="rp-section">
        <h2>Tahsilat hareketleri</h2>
        {cur.payments.length ? <table className="rp-table"><thead><tr><th>Tarih</th><th>İş emri</th><th>Plaka</th><th>Yöntem</th><th>Alan</th><th className="num">Tutar</th></tr></thead><tbody>
          {cur.payments.slice().sort((a, b) => a.at.localeCompare(b.at)).map(p => { const j = job(p.jobId)!; const v = veh(j.vehicleId); return <tr key={p.id}><td>{fmtDate(p.at, { day: '2-digit', month: '2-digit' })} {fmtTime(p.at)}</td><td className="mono">{j.no}</td><td>{v ? plateText(v.plate) : '—'}</td><td>{p.method}</td><td>{p.by}</td><td className="num">{money(p.amount)}</td></tr> })}
        </tbody></table> : <p className="rp-empty">Bu dönemde tahsilat yok.</p>}
      </section>
      <section className="rp-section">
        <h2>Teslim edilen araçlar</h2>
        <JobsTable rows={cur.delivered} state={state} />
      </section>
      <div className="rp-sign"><div>Kasayı teslim eden<span>Ad soyad · imza</span></div><div>Kontrol eden<span>Ad soyad · imza</span></div></div>
    </>}

    {kind === 'teknisyen' && <>
      <div className="rp-kpis">
        <Kpi label="Teslim edilen iş" value={String(cur.delivered.length)} d={delta(cur.delivered.length, prev.delivered.length)} />
        <Kpi label="İşçilik geliri" value={moneyShort(cur.labor)} d={delta(cur.labor, prev.labor)} />
        <Kpi label="Ort. servis süresi" value={dur(cur.avgHours)} d={delta(cur.avgHours, prev.avgHours)} invert />
        <Kpi label="Zamanında teslim" value={cur.delivered.length ? pct(cur.onTimeRate) : '—'} note="söz verilen saat + 30 dk" />
        <Kpi label="Aktif teknisyen" value={String(r.byTech.length)} note={`${r.byTech.reduce((s, t) => s + t.open, 0)} açık iş`} />
        <Kpi label="Girilen bulgu" value={String(r.health.reduce((s, h) => s + h.value, 0))} note="kontrol kaydı" />
      </div>
      <section className="rp-section">
        <h2>Teknisyen özeti</h2>
        <table className="rp-table"><thead><tr><th>Teknisyen</th><th className="num">Teslim</th><th className="num">Açık</th><th className="num">Ort. süre</th><th className="num">Zamanında</th><th className="num">Bulgu</th><th className="num">İşçilik</th><th className="num">İş tutarı</th></tr></thead><tbody>
          {r.byTech.map(t => <tr key={t.name}><td>{t.name}</td><td className="num">{t.count}</td><td className="num">{t.open}</td><td className="num">{dur(t.avg)}</td><td className="num">{t.count ? pct(t.onTime) : '—'}</td><td className="num">{t.findings}</td><td className="num">{money(t.labor)}</td><td className="num">{money(t.revenue)}</td></tr>)}
        </tbody></table>
      </section>
      <div className="rp-cols">
        <section className="rp-section"><h2>İşçilik gelirine göre</h2><HBars data={r.byTech.map(t => ({ label: t.name, value: t.labor, note: `${t.count} teslim` }))} format={moneyShort} /></section>
        <section className="rp-section"><h2>Zamanında teslim oranı</h2><HBars data={r.byTech.map(t => ({ label: t.name, value: Math.round(t.onTime * 100) }))} format={v => `%${v}`} max={100} /></section>
      </div>
    </>}

    {kind === 'musteri' && <>
      <div className="rp-kpis">
        <Kpi label="Hizmet alan müşteri" value={String(r.customers)} />
        <Kpi label="Yeni müşteri" value={String(r.newCustomers)} note="ilk ziyaret bu dönemde" />
        <Kpi label="Dönen müşteri" value={String(r.returning)} note={r.customers ? pct(r.returning / r.customers) + ' sadakat' : '—'} />
        <Kpi label="Ort. iş emri tutarı" value={moneyShort(cur.aro)} d={delta(cur.aro, prev.aro)} />
        <Kpi label="Teklif kapanma" value={cur.decided ? pct(cur.closeRate) : '—'} note={`${cur.decided} karar`} />
        <Kpi label="Gelmeyen randevu" value={cur.appts ? pct(cur.noShow / cur.appts) : '—'} note={`${cur.noShow} / ${cur.appts}`} />
      </div>
      <div className="rp-cols">
        <section className="rp-section"><h2>Yeni ve dönen müşteri</h2><Donut data={[{ label: 'Dönen', value: r.returning }, { label: 'Yeni', value: r.newCustomers }]} center={String(r.customers)} sub="müşteri" size={128} /></section>
        <section className="rp-section"><h2>Marka dağılımı</h2>{r.byBrand.length ? <HBars data={r.byBrand.slice(0, 6).map(b => ({ label: b.label, value: b.value }))} format={v => `${v} araç`} /> : <p className="rp-empty">Kayıt yok.</p>}</section>
      </div>
      <div className="rp-cols">
        <section className="rp-section"><h2>Araç sağlığı (bulgular)</h2><div className="rp-traffic">{r.health.map(h => <div key={h.label} className={'tl ' + (h.label === 'Uygun' ? 'ok' : h.label === 'Acil' ? 'bad' : 'warn')}><i /><b>{h.value}</b><span>{h.label}</span></div>)}</div></section>
        <section className="rp-section"><h2>En sık bulgular</h2>{r.topFindings.length ? <HBars data={r.topFindings} format={v => `${v} kez`} /> : <p className="rp-empty">Takip gerektiren bulgu yok.</p>}</section>
      </div>
    </>}

    <footer className="rp-foot">
      <p><b>Tanımlar.</b> İşlem tutarı: dönemde teslim edilen işlerin onaylı teklif toplamı (KDV dahil). Tahsilat: dönemde alınan ödemeler. Ortalama iş emri tutarı: işlem tutarı ÷ teslim edilen araç. Değişim oranları aynı uzunluktaki önceki döneme göredir.</p>
      <p>İç notlar, müşteri puanları ve kişisel iletişim bilgileri bu rapora dahil edilmez. {co.name} · HEB Servis tarafından oluşturuldu · {no}</p>
    </footer>
  </article>;
}

function JobsTable({ rows, state }: { rows: State['jobs']; state: State }) {
  if (!rows.length) return <p className="rp-empty">Bu dönemde kayıt yok.</p>;
  return <table className="rp-table"><thead><tr><th>İş emri</th><th>Teslim</th><th>Plaka</th><th>Araç</th><th>Hizmet</th><th>Teknisyen</th><th className="num">Tutar</th></tr></thead><tbody>
    {rows.map(j => { const v = state.vehicles.find(x => x.id === j.vehicleId); return <tr key={j.id}><td className="mono">{j.no}</td><td>{j.deliveredAt ? fmtDate(j.deliveredAt, { day: '2-digit', month: '2-digit' }) : '—'}</td><td>{v ? plateText(v.plate) : '—'}</td><td>{v ? `${v.brand} ${v.model}` : '—'}</td><td>{serviceName(state, j.serviceId)}</td><td>{staffName(state, j.technicianId)}</td><td className="num">{money(amountDue(j))}</td></tr> })}
  </tbody></table>;
}
