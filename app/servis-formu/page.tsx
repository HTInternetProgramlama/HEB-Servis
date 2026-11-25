'use client';
import { detailHref } from '@/lib/routes';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { Loading, Logo } from '@/components/shell';
import { Icon } from '@/components/icons';
import { Modal } from '@/components/ui';
import { ShareSheet } from '@/components/share-sheet';
import { estimateMessage, serviceFormMessage } from '@/lib/share';
import { amountDue, amountPaid, approvedEstimate, balance, estimateTotals, lineTotals, serviceName, staffName } from '@/lib/rules';
import { fmtDate, fmtDateTime, km, money, plateText, qtyText } from '@/lib/format';
import type { Estimate, Job, State } from '@/lib/types';

type Doc = 'kabul' | 'teklif' | 'servis';
const titles: Record<Doc, string> = { kabul: 'Araç Kabul Formu', teklif: 'Servis Teklifi', servis: 'Servis Formu' };

/**
 * Yazdırılabilir belgeler: araç kabul formu, teklif çıktısı ve servis (teslim) formu.
 * İç notlar, değerlendirmeler ve müşteriye kapalı bulgular hiçbir belgede yer almaz.
 */
export default function Page() {
  return <Suspense><PrintDocument /></Suspense>;
}

function PrintDocument() {
  const sp = useSearchParams();
  const id = sp.get('id');
  const doc: Doc = sp.get('belge') === 'kabul' ? 'kabul' : sp.get('belge') === 'teklif' ? 'teklif' : 'servis';
  const { state, actor, ready } = useStore();
  const router = useRouter();
  const [share, setShare] = useState(false);
  useEffect(() => { if (ready && !actor) router.replace('/giris') }, [ready, actor, router]);
  if (!ready || !state || !actor) return <Loading />;
  const job = state.jobs.find(j => j.id === id);
  if (!job || (actor.role === 'customer' && job.customerId !== actor.customerId)) return <div className="boot"><Icon name="lock" /><span>Bu belgeye erişiminiz yok.</span></div>;
  const c = state.customers.find(x => x.id === job.customerId)!;
  const staff = actor.role !== 'customer';
  // Teklif çıktısı: müşteri yalnız gönderilmiş sürümleri görür; personel taslağı da önizleyebilir.
  const offer = staff ? job.estimates.at(-1) : job.estimates.filter(x => x.status !== 'Taslak').at(-1);
  const go = (d: Doc) => router.replace(detailHref('/servis-formu', job.id) + (d === 'servis' ? '' : '&belge=' + d));
  const shareText = doc === 'teklif' && offer && offer.status !== 'Taslak' ? estimateMessage(state, job, offer, location.origin) : serviceFormMessage(state, job, location.origin);

  return <div className="print-page">
    <div className="print-toolbar no-print">
      <button className="btn" onClick={() => history.length > 1 ? history.back() : window.close()}><Icon name="left" size={14} />Geri</button>
      <div className="seg small" role="group" aria-label="Belge türü">{(['kabul', 'teklif', 'servis'] as Doc[]).map(d => <button key={d} className={doc === d ? 'active' : ''} onClick={() => go(d)}>{titles[d]}</button>)}</div>
      <div className="btn-row">
        {staff && <button className="btn" onClick={() => setShare(true)}><Icon name="send" size={14} />Gönder</button>}
        <button className="btn primary" onClick={() => print()}><Icon name="printer" size={14} />Yazdır / PDF</button>
      </div>
    </div>
    <article className="sheet">
      <SheetHead state={state} job={job} doc={doc} />
      {doc === 'kabul' && <IntakeSheet state={state} job={job} />}
      {doc === 'teklif' && (offer ? <OfferSheet state={state} job={job} e={offer} /> : <section><p>Bu iş emri için henüz teklif hazırlanmadı.</p></section>)}
      {doc === 'servis' && <ServiceSheet state={state} job={job} />}
    </article>
    {share && <Modal open title={`${titles[doc]} müşteriye iletilsin`} sub={`${c.name} · ${c.preference} tercih ediyor`} onClose={() => setShare(false)} width={760}>
      <ShareSheet name={c.name} phone={c.phone} email={c.email || undefined} subject={`${job.no} ${titles[doc].toLocaleLowerCase('tr')}`} text={shareText} />
    </Modal>}
  </div>;
}

function SheetHead({ state, job, doc }: { state: State; job: Job; doc: Doc }) {
  const co = state.settings.company;
  const v = state.vehicles.find(x => x.id === job.vehicleId)!, c = state.customers.find(x => x.id === job.customerId)!;
  return <>
    <header className="sheet-head">
      <div><Logo /><p>{co.name}<br />{co.address}<br />Tel {co.phone} · {co.email}<br />{co.taxOffice} · VKN {co.taxNo}</p></div>
      <div className="sheet-title"><h1>{titles[doc]}</h1><table><tbody>
        <tr><th>İş emri no</th><td>{job.no}</td></tr>
        <tr><th>Kabul</th><td>{fmtDateTime(job.createdAt)}</td></tr>
        {doc === 'servis' && <tr><th>Teslim</th><td>{job.deliveredAt ? fmtDateTime(job.deliveredAt) : '—'}</td></tr>}
        {doc === 'kabul' && <tr><th>Teslim sözü</th><td>{fmtDateTime(job.promisedAt)}</td></tr>}
        <tr><th>Durum</th><td>{job.status}</td></tr>
      </tbody></table></div>
    </header>
    <section className="sheet-grid">
      <div><h2>Müşteri</h2><dl><dt>Ad / unvan</dt><dd>{c.name}</dd><dt>Telefon</dt><dd>{c.phone}</dd>{c.kind === 'Kurumsal' && <><dt>Vergi no</dt><dd>{c.taxNo}</dd></>}<dt>Adres</dt><dd>{c.address || '—'}</dd></dl></div>
      <div><h2>Araç</h2><dl><dt>Plaka</dt><dd className="strong">{plateText(v.plate)}</dd><dt>Marka / model</dt><dd>{v.brand} {v.model} ({v.year})</dd><dt>Şasi no</dt><dd className="mono">{v.vin || '—'}</dd><dt>Kabul km</dt><dd>{km(job.intake.km)}</dd><dt>Yakıt</dt><dd>{job.intake.fuel}/8</dd></dl></div>
    </section>
  </>;
}

function IntakeSheet({ state, job }: { state: State; job: Job }) {
  return <>
    <section><h2>Müşteri talebi / şikâyet</h2><p>{job.intake.complaint}</p>
      <p className="small"><b>Hizmet:</b> {serviceName(state, job.serviceId)}. <b>Servis danışmanı:</b> {staffName(state, job.advisorId)}. <b>Teknisyen:</b> {staffName(state, job.technicianId)}.</p></section>
    <section><h2>Kabulde mevcut hasarlar</h2>
      {job.intake.damages.length ? <table className="sheet-table"><thead><tr><th>Bölge</th><th>Tür</th><th>Açıklama</th></tr></thead>
        <tbody>{job.intake.damages.map(d => <tr key={d.area}><td>{d.area}</td><td>{d.kind}</td><td>{d.note}</td></tr>)}</tbody></table> : <p>Kabulde hasar kaydı yok.</p>}</section>
    <section className="sheet-grid"><div><h2>Araçta bırakılanlar</h2><p>{job.intake.belongings || '—'}</p></div>
      <div><h2>Kabul kontrolü</h2><p>{job.intake.customerAck ? 'Araç müşteri ile birlikte kontrol edildi.' : 'Müşteri teyidi alınmadı.'} Kabulü yapan: {job.intake.by}, {fmtDateTime(job.intake.at)}.</p></div></section>
    <p className="small">Teklif onaylanmadan ücretli işlem yapılmaz. Araçta bırakılan değerli eşyalardan servis sorumlu değildir. Tahmini teslim zamanı bilgi amaçlıdır.</p>
    <footer className="sheet-sign"><div><span>Aracı teslim eden (müşteri)</span><b>&nbsp;</b></div><div><span>Aracı teslim alan (servis)</span><b>{job.intake.by}</b></div></footer>
    <p className="sheet-foot">Belge {fmtDateTime(new Date().toISOString())} tarihinde oluşturuldu.</p>
  </>;
}

function Lines({ e }: { e: Estimate }) {
  return <table className="sheet-table"><thead><tr><th>Kod</th><th>Açıklama</th><th>Tür</th><th className="num">Miktar</th><th className="num">Birim fiyat</th><th className="num">İnd.</th><th className="num">Tutar</th></tr></thead>
    <tbody>{e.lines.map(l => <tr key={l.id}><td>{l.code}</td><td>{l.name}</td><td>{l.kind}</td><td className="num">{qtyText(l.qty)} {l.unit}</td><td className="num">{money(l.unitPrice)}</td><td className="num">{l.discountPct ? `%${l.discountPct}` : ''}</td><td className="num">{money(lineTotals(l).net)}</td></tr>)}</tbody></table>;
}

function OfferSheet({ state, job, e }: { state: State; job: Job; e: Estimate }) {
  const t = estimateTotals(e);
  const visible = job.inspections.filter(i => i.customerVisible && i.result !== 'Uygun');
  return <>
    {e.status === 'Taslak' && <p className="sheet-draft">TASLAK — müşteriye gönderilmemiş sürüm</p>}
    {visible.length > 0 && <section><h2>Tespit edilen bulgular</h2><table className="sheet-table"><thead><tr><th>Kontrol</th><th>Sonuç</th><th>Açıklama</th></tr></thead>
      <tbody>{visible.map(i => <tr key={i.id}><td>{i.item}</td><td>{i.result}</td><td>{i.note}</td></tr>)}</tbody></table></section>}
    <section><h2>Teklif kalemleri <small>(sürüm {e.version} · {e.status}{e.sentAt ? ` · ${fmtDate(e.sentAt)}` : ''})</small></h2>
      <Lines e={e} />
      <div className="sheet-totals"><table><tbody>
        <tr><th>Parça</th><td>{money(t.parts)}</td></tr><tr><th>İşçilik</th><td>{money(t.labor)}</td></tr>
        {t.discount > 0 && <tr><th>İndirim</th><td>−{money(t.discount)}</td></tr>}
        <tr><th>Ara toplam</th><td>{money(t.subtotal)}</td></tr><tr><th>KDV %{e.vatRate}</th><td>{money(t.vat)}</td></tr>
        <tr className="grand"><th>Genel toplam</th><td>{money(t.total)}</td></tr>
      </tbody></table></div></section>
    {e.note && <section><h2>Açıklama</h2><p>{e.note}</p></section>}
    {e.decision && <section><h2>Müşteri kararı</h2><p>{e.decision.result} · {e.decision.channel} · {fmtDateTime(e.decision.at)}</p></section>}
    <p className="small">Fiyatlara KDV dahildir. Yalnız onaylanan kalemler uygulanır; ek işlem gerekirse yeni teklif sürümü hazırlanır. Teklif {fmtDate(e.createdAt)} tarihinden itibaren 15 gün geçerlidir.</p>
    <footer className="sheet-sign"><div><span>Hazırlayan</span><b>{e.createdBy}</b></div><div><span>Müşteri onayı (ad, imza)</span><b>&nbsp;</b></div></footer>
    <p className="sheet-foot">Servis: {state.settings.company.name}. Belge {fmtDateTime(new Date().toISOString())} tarihinde oluşturuldu.</p>
  </>;
}

function ServiceSheet({ state, job }: { state: State; job: Job }) {
  const v = state.vehicles.find(x => x.id === job.vehicleId)!;
  const e = approvedEstimate(job) ?? job.estimates.filter(x => x.status !== 'Taslak').at(-1);
  const t = e ? estimateTotals(e) : null;
  return <>
    {job.status === 'Teslim edildi' && <div className="stamp" aria-hidden="true"><b>TESLİM EDİLDİ</b><small>{fmtDate(job.deliveredAt)}</small></div>}
    <section><h2>Müşteri talebi</h2><p>{job.intake.complaint}</p>
      <p className="small"><b>Kabulde mevcut hasarlar:</b> {job.intake.damages.length ? job.intake.damages.map(d => `${d.area} – ${d.kind}${d.note ? ` (${d.note})` : ''}`).join('; ') : 'Yok'}. <b>Hizmet:</b> {serviceName(state, job.serviceId)}. <b>Teknisyen:</b> {staffName(state, job.technicianId)}.</p></section>
    {job.inspections.some(i => i.customerVisible) && <section><h2>Kontrol sonuçları</h2><table className="sheet-table"><thead><tr><th>Kontrol</th><th>Sonuç</th><th>Açıklama</th></tr></thead>
      <tbody>{job.inspections.filter(i => i.customerVisible).map(i => <tr key={i.id}><td>{i.item}</td><td>{i.result}</td><td>{i.note}</td></tr>)}</tbody></table></section>}
    {e && t && <section><h2>Yapılan işlemler ve ücretler <small>(teklif v{e.version} · {e.status}{e.decision ? ` · ${e.decision.channel} ${fmtDate(e.decision.at)}` : ''})</small></h2>
      <Lines e={e} />
      <div className="sheet-totals"><table><tbody>
        <tr><th>Parça</th><td>{money(t.parts)}</td></tr><tr><th>İşçilik</th><td>{money(t.labor)}</td></tr>
        {t.discount > 0 && <tr><th>İndirim</th><td>−{money(t.discount)}</td></tr>}
        <tr><th>Ara toplam</th><td>{money(t.subtotal)}</td></tr><tr><th>KDV %{e.vatRate}</th><td>{money(t.vat)}</td></tr>
        <tr className="grand"><th>Genel toplam</th><td>{money(t.total)}</td></tr>
        <tr><th>Tahsil edilen</th><td>{money(amountPaid(job))}</td></tr><tr><th>Kalan bakiye</th><td>{money(balance(job))}</td></tr>
      </tbody></table></div></section>}
    {job.payments.length > 0 && <section><h2>Tahsilatlar</h2><table className="sheet-table"><thead><tr><th>Tarih</th><th>Yöntem</th><th className="num">Tutar</th></tr></thead><tbody>{job.payments.map(p => <tr key={p.id}><td>{fmtDateTime(p.at)}</td><td>{p.method}</td><td className="num">{money(p.amount)}</td></tr>)}</tbody></table></section>}
    <section className="sheet-grid"><div><h2>Sonraki bakım</h2><p>{v.nextServiceDate ? fmtDate(v.nextServiceDate) : '—'} {v.nextServiceKm ? `veya ${km(v.nextServiceKm)}` : ''} (hangisi önce gelirse)</p></div><div><h2>Teslim notu</h2><p>{job.deliveryNote || '—'}</p></div></section>
    <footer className="sheet-sign"><div><span>Teslim eden</span><b>{staffName(state, job.advisorId)}</b></div><div><span>Teslim alan (müşteri)</span><b>&nbsp;</b></div></footer>
    <p className="sheet-foot">Bu form fatura yerine geçmez. İşlem tutarı {money(amountDue(job))}. Belge {fmtDateTime(new Date().toISOString())} tarihinde oluşturuldu.</p>
  </>;
}
