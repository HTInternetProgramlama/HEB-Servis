'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { Loading, Logo } from '@/components/shell';
import { Icon } from '@/components/icons';
import { Modal } from '@/components/ui';
import { ShareSheet } from '@/components/share-sheet';
import { serviceFormMessage } from '@/lib/share';
import { amountDue, amountPaid, approvedEstimate, balance, estimateTotals, lineTotals, serviceName, staffName } from '@/lib/rules';
import { fmtDate, fmtDateTime, km, money, plateText, qtyText } from '@/lib/format';

/** Servis formu: iç notlar, değerlendirmeler ve müşteriye kapalı bulgular yer almaz. */
export default function ServiceForm() {
  const { id } = useParams<{ id: string }>();
  const { state, actor, ready } = useStore();
  const router = useRouter();
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<'printing' | 'done'>('printing');
  const [share, setShare] = useState(false);
  useEffect(() => { if (ready && !actor) router.replace('/giris') }, [ready, actor, router]);
  useEffect(() => {
    if (!ready) return;
    setPhase('printing');
    const fast = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setPhase('done'), fast ? 0 : 3600);
    return () => clearTimeout(t);
  }, [ready, run]);
  if (!ready || !state || !actor) return <Loading />;
  const job = state.jobs.find(j => j.id === id);
  if (!job || (actor.role === 'customer' && job.customerId !== actor.customerId)) return <div className="boot"><Icon name="lock" /><span>Bu servis formuna erişiminiz yok.</span></div>;
  const v = state.vehicles.find(x => x.id === job.vehicleId)!, c = state.customers.find(x => x.id === job.customerId)!, co = state.settings.company;
  const e = approvedEstimate(job) ?? job.estimates.filter(x => x.status !== 'Taslak').at(-1);
  const t = e ? estimateTotals(e) : null;

  return <div className="print-page">
    <div className="print-toolbar no-print">
      <button className="btn" onClick={() => history.length > 1 ? history.back() : window.close()}><Icon name="left" size={14} />Geri</button>
      <div className="btn-row">
        <button className="btn" onClick={() => { setPhase('printing'); setRun(r => r + 1) }} disabled={phase === 'printing'}><Icon name="refresh" size={14} />Yeniden yazdır</button>
        {actor.role !== 'customer' && <button className="btn" onClick={() => setShare(true)}><Icon name="mail" size={14} />Müşteriye gönder</button>}
        <button className="btn primary" onClick={() => print()}><Icon name="printer" size={14} />Yazdır / PDF kaydet</button>
      </div>
    </div>
    <div className={'printjob ' + phase} key={run}>
      <div className="printer no-print" aria-hidden="true">
        <div className="printer-top"><span className="printer-tray" /></div>
        <div className="printer-face"><span className="printer-brand">HEB · LaserJet</span><span className="printer-screen">{phase === 'printing' ? 'Yazdırılıyor…' : 'Hazır'}</span><span className="printer-led" /></div>
        <div className="printer-slot" />
      </div>
      <div className="paper-clip">
    <article className="sheet">
      {phase === 'done' && job.status === 'Teslim edildi' && <div className="stamp" aria-hidden="true"><b>TESLİM EDİLDİ</b><small>{fmtDate(job.deliveredAt)}</small></div>}
      <header className="sheet-head">
        <div><Logo /><p>{co.name}<br />{co.address}<br />Tel {co.phone} · {co.email}<br />{co.taxOffice} · VKN {co.taxNo}</p></div>
        <div className="sheet-title"><h1>Servis Formu</h1><table><tbody><tr><th>Form no</th><td>{job.no}</td></tr><tr><th>Kabul</th><td>{fmtDateTime(job.createdAt)}</td></tr><tr><th>Teslim</th><td>{job.deliveredAt ? fmtDateTime(job.deliveredAt) : '—'}</td></tr><tr><th>Durum</th><td>{job.status}</td></tr></tbody></table></div>
      </header>
      <section className="sheet-grid">
        <div><h2>Müşteri</h2><dl><dt>Ad / unvan</dt><dd>{c.name}</dd><dt>Telefon</dt><dd>{c.phone}</dd>{c.kind === 'Kurumsal' && <><dt>Vergi no</dt><dd>{c.taxNo}</dd></>}<dt>Adres</dt><dd>{c.address || '—'}</dd></dl></div>
        <div><h2>Araç</h2><dl><dt>Plaka</dt><dd className="strong">{plateText(v.plate)}</dd><dt>Marka / model</dt><dd>{v.brand} {v.model} ({v.year})</dd><dt>Şasi no</dt><dd className="mono">{v.vin || '—'}</dd><dt>Kabul km</dt><dd>{km(job.intake.km)}</dd><dt>Yakıt</dt><dd>{job.intake.fuel}/8</dd></dl></div>
      </section>
      <section><h2>Müşteri talebi</h2><p>{job.intake.complaint}</p>
        <p className="small"><b>Kabulde mevcut hasarlar:</b> {job.intake.damages.length ? job.intake.damages.map(d => `${d.area} – ${d.kind}${d.note ? ` (${d.note})` : ''}`).join('; ') : 'Yok'}. <b>Hizmet:</b> {serviceName(state, job.serviceId)}. <b>Teknisyen:</b> {staffName(state, job.technicianId)}.</p></section>
      {job.inspections.some(i => i.customerVisible) && <section><h2>Kontrol sonuçları</h2><table className="sheet-table"><thead><tr><th>Kontrol</th><th>Sonuç</th><th>Açıklama</th></tr></thead>
        <tbody>{job.inspections.filter(i => i.customerVisible).map(i => <tr key={i.id}><td>{i.item}</td><td>{i.result}</td><td>{i.note}</td></tr>)}</tbody></table></section>}
      {e && t && <section><h2>Yapılan işlemler ve ücretler <small>(teklif v{e.version} · {e.status}{e.decision ? ` · ${e.decision.channel} ${fmtDate(e.decision.at)}` : ''})</small></h2>
        <table className="sheet-table"><thead><tr><th>Kod</th><th>Açıklama</th><th>Tür</th><th className="num">Miktar</th><th className="num">Birim fiyat</th><th className="num">İnd.</th><th className="num">Tutar</th></tr></thead>
          <tbody>{e.lines.map(l => <tr key={l.id}><td>{l.code}</td><td>{l.name}</td><td>{l.kind}</td><td className="num">{qtyText(l.qty)} {l.unit}</td><td className="num">{money(l.unitPrice)}</td><td className="num">{l.discountPct ? `%${l.discountPct}` : ''}</td><td className="num">{money(lineTotals(l).net)}</td></tr>)}</tbody></table>
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
    </article>
      </div>
    </div>
    {share && <Modal open title="Servis formunu müşteriye gönder" sub={`${c.name} · ${c.preference} tercih ediyor`} onClose={() => setShare(false)} width={760}>
      <ShareSheet name={c.name} phone={c.phone} email={c.email || undefined} subject={`${job.no} servis formu`} text={serviceFormMessage(state, job, location.origin)} />
    </Modal>}
  </div>;
}
