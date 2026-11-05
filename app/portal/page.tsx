'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/store';
import { Button, Card, Empty, Status } from '@/components/ui';
import { Icon } from '@/components/icons';
import { CarDrawing, Plate } from '@/components/vehicle-identity';
import { AppointmentForm } from '@/components/forms';
import { amountDue, balance, estimateTotals, portalView, serviceName } from '@/lib/rules';
import { fmtDate, fmtDateTime, km, money, today } from '@/lib/format';

const steps = ['Kabul edildi', 'İnceleniyor', 'Onay bekliyor', 'İşlemde', 'Son kontrol', 'Teslime hazır', 'Teslim edildi'];
const customerText: Record<string, string> = {
  'Kabul edildi': 'Aracınız teslim alındı, kontrol sırasına alındı.',
  'İnceleniyor': 'Teknisyenimiz aracınızı inceliyor.',
  'Onay bekliyor': 'Teklif onayınızı bekliyoruz.',
  'İşlemde': 'Onayladığınız işlemler yapılıyor.',
  'Parça bekliyor': 'Gerekli parçanın gelmesi bekleniyor.',
  'Son kontrol': 'İşlemler tamamlandı, son kontroller yapılıyor.',
  'Teslime hazır': 'Aracınız teslime hazır.',
};

export default function PortalHome() {
  const { state, actor } = useApp();
  const [book, setBook] = useState<string | null>(null);
  const view = portalView(state, actor);
  const active = view.jobs.filter(j => !['Teslim edildi', 'İptal'].includes(j.status));
  const past = view.jobs.filter(j => j.status === 'Teslim edildi').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const upcoming = view.appointments.filter(a => ['Bekliyor', 'Onaylı'].includes(a.status) && a.date >= today()).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return <>
    <div className="portal-head"><div><h1>Merhaba {view.customer?.name.split(' ')[0]}</h1><p className="muted">{view.vehicles.length} kayıtlı araç · {active.length ? `${active.length} araç serviste` : 'serviste aracınız yok'}</p></div>
      <Button variant="primary" icon="calendar" onClick={() => setBook('')}>Randevu talep et</Button></div>

    {active.map(j => {
      const v = view.vehicles.find(x => x.id === j.vehicleId)!;
      const e = j.estimates.at(-1);
      const step = j.status === 'Parça bekliyor' ? 3 : steps.indexOf(j.status);
      return <Card key={j.id} className={'portal-active ' + (e?.status === 'Gönderildi' ? 'attention' : '')}>
        <div className="row-between wrap"><div className="title-row"><Plate value={v.plate} /><strong>{v.brand} {v.model}</strong></div><Status value={j.status} /></div>
        <p className="lead">{customerText[j.status]}</p>
        <ol className="stepper compact">{steps.map((s, i) => <li key={s} className={i < step ? 'done' : i === step ? 'current' : ''}><span>{i < step ? <Icon name="check" size={11} /> : i + 1}</span>{s}</li>)}</ol>
        <div className="row-between wrap mt">
          <span className="muted small">İş emri {j.no} · tahmini teslim {fmtDateTime(j.promisedAt)}</span>
          {e?.status === 'Gönderildi' ? <Link className="btn primary" href={`/portal/servis/${j.id}`}>Teklifi incele · {money(estimateTotals(e).total)}<Icon name="arrow" size={14} /></Link>
            : <Link className="btn" href={`/portal/servis/${j.id}`}>Ayrıntılar<Icon name="arrow" size={14} /></Link>}
        </div>
        {j.status === 'Teslime hazır' && balance(j) > 0 && <p className="small mt">Teslimde ödenecek tutar: <b>{money(balance(j))}</b></p>}
      </Card>;
    })}

    {upcoming.length > 0 && <Card title="Yaklaşan randevular" flush actions={<Link className="btn sm" href="/portal/randevular">Tümü</Link>}>
      <ul className="req-list compact">{upcoming.map(a => <li key={a.id}><span className="mono">{fmtDate(a.date, { day: '2-digit', month: 'short' })} {a.time}</span><span>{serviceName(state, a.serviceId)}</span><Plate value={view.vehicles.find(v => v.id === a.vehicleId)?.plate ?? ''} size="sm" /><Status value={a.status === 'Bekliyor' ? 'Bekliyor' : 'Onaylı'} /></li>)}</ul>
    </Card>}

    <h2 className="section-title">Araçlarım</h2>
    <div className="vehicle-grid">{view.vehicles.map(v => {
      const last = view.jobs.filter(j => j.vehicleId === v.id && j.status === 'Teslim edildi').at(-1);
      const due = (v.nextServiceDate && v.nextServiceDate <= today()) || (v.nextServiceKm && v.km >= v.nextServiceKm - 1500);
      return <Card key={v.id} className="vehicle-tile">
        <CarDrawing vehicle={v} />
        <div className="row-between"><div><strong>{v.brand} {v.model}</strong><small className="cell-sub">{v.year} · {km(v.km)}</small></div><Plate value={v.plate} size="sm" /></div>
        <dl className="mini-kv"><div><dt>Son servis</dt><dd>{last ? fmtDate(last.deliveredAt) : '—'}</dd></div><div><dt>Sonraki bakım</dt><dd className={due ? 'text-bad' : ''}>{v.nextServiceDate ? fmtDate(v.nextServiceDate) : '—'}{v.nextServiceKm ? ` / ${km(v.nextServiceKm)}` : ''}</dd></div></dl>
        <Button size="sm" onClick={() => setBook(v.id)}>Bu araç için randevu</Button>
      </Card>;
    })}</div>

    <h2 className="section-title">Servis geçmişi</h2>
    <Card flush>{past.length ? <table className="table">
      <thead><tr><th>Tarih</th><th>Araç</th><th className="hide-sm">Hizmet</th><th className="num">Tutar</th><th /></tr></thead>
      <tbody>{past.map(j => <tr key={j.id}><td>{fmtDate(j.deliveredAt)}</td><td><Plate value={view.vehicles.find(v => v.id === j.vehicleId)?.plate ?? ''} size="sm" /></td><td className="hide-sm">{serviceName(state, j.serviceId)}</td><td className="num">{money(amountDue(j))}</td>
        <td className="actions"><div className="btn-row nowrap"><Link className="btn sm" href={`/portal/servis/${j.id}`}>Ayrıntı</Link><Link className="btn sm" href={`/servis-formu/${j.id}`} target="_blank"><Icon name="printer" size={13} />Form</Link></div></td></tr>)}</tbody>
    </table> : <Empty icon="wrench" title="Tamamlanmış servis kaydı yok" />}</Card>

    {book !== null && <AppointmentForm open portal preset={{ vehicleId: book || undefined, customerId: actor.customerId }} onClose={() => setBook(null)} />}
  </>;
}
