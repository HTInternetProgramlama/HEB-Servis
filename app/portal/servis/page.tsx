'use client';
import { detailHref } from '@/lib/routes';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/store';
import { Button, Card, Empty, KV, Modal, Status } from '@/components/ui';
import { Icon } from '@/components/icons';
import { Plate } from '@/components/vehicle-identity';
import { amountDue, amountPaid, balance, decideEstimate, estimateTotals, lineTotals, portalView } from '@/lib/rules';
import { fmtDateTime, km, money, qtyText } from '@/lib/format';

export default function Page() {
  return <Suspense><PortalJob /></Suspense>;
}

function PortalJob() {
  const id = useSearchParams().get('id');
  const { state, actor, run } = useApp();
  const [confirm, setConfirm] = useState<null | 'Onaylandı' | 'Reddedildi'>(null);
  const view = portalView(state, actor);
  const job = view.jobs.find(j => j.id === id);
  if (!job) return <Empty icon="lock" title="Kayıt bulunamadı">Bu servis kaydı hesabınıza ait değil veya silinmiş. <Link href="/portal">Ana sayfaya dön</Link></Empty>;
  const v = view.vehicles.find(x => x.id === job.vehicleId)!;
  const e = job.estimates.at(-1);
  const t = e ? estimateTotals(e) : null;

  return <>
    <Link href="/portal" className="back-link"><Icon name="left" size={14} />Araçlarım ve servis</Link>
    <div className="portal-head"><div><div className="title-row"><Plate value={v.plate} /><h1>{v.brand} {v.model}</h1></div><p className="muted">İş emri {job.no} · kabul {fmtDateTime(job.createdAt)} · {km(job.intake.km)}</p></div><Status value={job.status} /></div>

    {e && t && <Card title={`Teklif · sürüm ${e.version}`} sub={e.sentAt ? `Gönderim ${fmtDateTime(e.sentAt)}` : undefined} className={e.status === 'Gönderildi' ? 'attention' : ''} flush>
      {e.note && <p className="quote pad">{e.note}</p>}
      <div className="table-wrap"><table className="table lines">
        <thead><tr><th>Kalem</th><th className="num">Miktar</th><th className="num hide-sm">Birim fiyat</th><th className="num">Tutar</th></tr></thead>
        <tbody>{e.lines.map(l => <tr key={l.id}><td>{l.name}<small className="cell-sub">{l.kind}{l.discountPct ? ` · %${l.discountPct} indirim` : ''}</small></td><td className="num">{qtyText(l.qty)} {l.unit}</td><td className="num hide-sm">{money(l.unitPrice)}</td><td className="num">{money(lineTotals(l).net)}</td></tr>)}</tbody>
      </table></div>
      <div className="totals"><div /><dl className="sum">
        <div><dt>Ara toplam</dt><dd>{money(t.subtotal)}</dd></div>
        <div><dt>KDV %{e.vatRate}</dt><dd>{money(t.vat)}</dd></div>
        <div className="total"><dt>Genel toplam</dt><dd>{money(t.total)}</dd></div>
      </dl></div>
      {e.status === 'Gönderildi' ? <div className="action-bar"><span className="small">Onayınızla birlikte yalnız bu teklifteki işlemler yapılır. Ek bir işlem gerekirse yeni teklif gönderilir.</span>
        <div className="btn-row"><Button onClick={() => setConfirm('Reddedildi')}>Reddet</Button><Button variant="primary" icon="check" onClick={() => setConfirm('Onaylandı')}>Teklifi onayla</Button></div></div>
        : e.decision && <div className={'banner ' + (e.decision.result === 'Onaylandı' ? 'ok' : 'bad')}><Icon name={e.decision.result === 'Onaylandı' ? 'check' : 'x'} size={15} />{e.decision.result} · {e.decision.channel} · {fmtDateTime(e.decision.at)}</div>}
    </Card>}

    <div className="grid-main">
      <Card title="Kontrol sonuçları" sub="Teknisyenin sizinle paylaştığı bulgular" flush>
        {job.inspections.length ? <ul className="finding-list">{job.inspections.map(i => <li key={i.id}><Status value={i.result} /><div><strong>{i.item}</strong>{i.note && <p>{i.note}</p>}</div></li>)}</ul> : <Empty icon="clipboard" title="Henüz paylaşılan bulgu yok" />}
      </Card>
      <Card title="Ödeme özeti">
        <dl className="sum">
          <div><dt>Onaylı iş tutarı</dt><dd>{money(amountDue(job))}</dd></div>
          <div><dt>Ödenen</dt><dd>{money(amountPaid(job))}</dd></div>
          <div className="total"><dt>Kalan</dt><dd>{money(balance(job))}</dd></div>
        </dl>
        <p className="small muted mt">Ödemeler serviste nakit, kart veya havale ile alınır.</p>
        {job.status === 'Teslim edildi' && <Link className="btn mt" href={detailHref('/servis-formu', job.id)} target="_blank"><Icon name="printer" size={14} />Servis formunu yazdır</Link>}
      </Card>
    </div>
    <Card title="Kabul bilgileri">
      <KV cols={3} items={[['Şikâyet / talep', job.intake.complaint], ['Kabul km', km(job.intake.km)], ['Tahmini teslim', fmtDateTime(job.promisedAt)], ['Kabulde not edilen hasarlar', job.intake.damages.length ? job.intake.damages.map(d => `${d.area} (${d.kind})`).join(', ') : 'Yok']]} />
    </Card>

    {confirm && e && <Modal open title={confirm === 'Onaylandı' ? 'Teklifi onaylıyor musunuz?' : 'Teklifi reddediyor musunuz?'} onClose={() => setConfirm(null)} width={440}
      footer={<><Button onClick={() => setConfirm(null)}>Vazgeç</Button><Button variant={confirm === 'Onaylandı' ? 'primary' : 'danger'} onClick={() => { run((s, a) => decideEstimate(s, a, job.id, e.id, confirm, 'Portal', ''), confirm === 'Onaylandı' ? 'Teklif onaylandı; işlemlere başlanacak' : 'Teklif reddedildi; servis danışmanı sizinle iletişime geçecek', job.no); setConfirm(null) }}>{confirm === 'Onaylandı' ? `${money(t!.total)} onayla` : 'Reddet'}</Button></>}>
      <p>{confirm === 'Onaylandı' ? `Sürüm ${e.version} teklifindeki ${e.lines.length} kalem için ${money(t!.total)} (KDV dahil) onay vermiş olacaksınız. Onay zamanı ve kanalı kayda alınır.` : 'İşlemler yapılmayacak. Aracınızı teslim almak için servis danışmanı sizi arayacak.'}</p>
    </Modal>}
  </>;
}
