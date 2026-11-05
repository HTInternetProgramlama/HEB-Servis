'use client';
import { useState } from 'react';
import { useApp } from '@/components/store';
import { Button, Card, Empty, Status } from '@/components/ui';
import { Plate } from '@/components/vehicle-identity';
import { AppointmentForm } from '@/components/forms';
import { portalView, serviceName, setAppointmentStatus } from '@/lib/rules';
import { fmtDate } from '@/lib/format';

export default function PortalAppointments() {
  const { state, actor, run } = useApp();
  const [open, setOpen] = useState(false);
  const view = portalView(state, actor);
  const list = [...view.appointments].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const canCancel = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`).getTime() - Date.now() > 2 * 3600000;
  return <>
    <div className="portal-head"><div><h1>Randevularım</h1><p className="muted">Talepleriniz servis danışmanı onayıyla kesinleşir. Onaylanan randevular için bilgilendirme tercihinize göre ({view.customer?.preference}) aranırsınız.</p></div>
      <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>Randevu talep et</Button></div>
    <Card flush>{list.length ? <div className="table-wrap"><table className="table">
      <thead><tr><th>Tarih</th><th>Araç</th><th className="hide-sm">Hizmet</th><th>Durum</th><th /></tr></thead>
      <tbody>{list.map(a => <tr key={a.id}>
        <td>{fmtDate(a.date, { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' })}<small className="cell-sub">{a.time} · {a.no}</small></td>
        <td><Plate value={view.vehicles.find(v => v.id === a.vehicleId)?.plate ?? ''} size="sm" /></td>
        <td className="hide-sm">{serviceName(state, a.serviceId)}</td>
        <td><Status value={a.status === 'Bekliyor' ? 'Onay bekliyor' : a.status === 'İş emri açıldı' ? 'Serviste' : a.status} tone={a.status === 'Bekliyor' ? 'amber' : a.status === 'Onaylı' ? 'blue' : undefined} /></td>
        <td className="actions">{['Bekliyor', 'Onaylı'].includes(a.status) && (canCancel(a.date, a.time)
          ? <Button size="sm" variant="ghost" onClick={() => { if (confirm('Randevunuz iptal edilsin mi?')) run((s, ac) => setAppointmentStatus(s, ac, a.id, 'İptal'), 'Randevunuz iptal edildi', a.no) }}>İptal et</Button>
          : <small className="muted">İptal için servisi arayın</small>)}</td>
      </tr>)}</tbody>
    </table></div> : <Empty icon="calendar" title="Randevu kaydınız yok" />}</Card>
    {open && <AppointmentForm open portal preset={{ customerId: actor.customerId }} onClose={() => setOpen(false)} />}
  </>;
}
