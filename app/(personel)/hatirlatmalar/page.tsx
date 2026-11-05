'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/store';
import { Button, Card, Empty, Field, FormError, Modal, PageHeader, useFormRunner } from '@/components/ui';
import { VehicleCell } from '@/components/vehicle-identity';
import { AppointmentForm } from '@/components/forms';
import { dueReminders, logReminder } from '@/lib/rules';
import { fmtDate, fmtDateTime } from '@/lib/format';
import type { ReminderResult, Vehicle } from '@/lib/types';

export default function RemindersPage() {
  const { state, run } = useApp();
  const [log, setLog] = useState<Vehicle | null>(null);
  const [book, setBook] = useState<Vehicle | null>(null);
  const [showAll, setShowAll] = useState(false);
  const { error, busy, submit } = useFormRunner();
  const list = dueReminders(state).filter(r => showAll || !r.hasAppointment);

  return <>
    <PageHeader title="Bakım hatırlatmaları" sub="Teslimde planlanan tarih veya kilometreye 30 gün / 1.500 km kalan araçlar. Mesaj otomatik gönderilmez; arama sonucu kayda alınır." />
    <div className="toolbar"><label className="check inline"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Randevusu olanları da göster</label></div>
    <Card flush>{list.length ? <div className="table-wrap"><table className="table">
      <thead><tr><th>Araç</th><th className="hide-sm">Sahibi</th><th>Planlanan</th><th className="hide-sm">Son temas</th><th /></tr></thead>
      <tbody>{list.map(r => {
        const c = state.customers.find(c => c.id === r.vehicle.customerId);
        return <tr key={r.vehicle.id}>
          <td><Link href={`/araclar/${r.vehicle.id}`}><VehicleCell vehicle={r.vehicle} /></Link></td>
          <td className="hide-sm">{c?.name}<small className="cell-sub">{c?.phone} · {c?.preference}</small></td>
          <td className={r.overdue ? 'text-bad' : ''}>{r.vehicle.nextServiceDate ? fmtDate(r.vehicle.nextServiceDate) : '—'}
            <small className="cell-sub">{r.daysLeft !== null && (r.daysLeft < 0 ? `${-r.daysLeft} gün geçti` : `${r.daysLeft} gün kaldı`)}{r.kmLeft !== null && ` · ${r.kmLeft < 0 ? `${(-r.kmLeft).toLocaleString('tr-TR')} km aşıldı` : `${r.kmLeft.toLocaleString('tr-TR')} km kaldı`}`}</small></td>
          <td className="hide-sm small">{r.hasAppointment ? <span className="tag green">Randevusu var</span> : r.last ? <>{r.last.result}<small className="cell-sub">{r.last.by} · {fmtDateTime(r.last.at)}</small></> : <span className="muted">Aranmadı</span>}</td>
          <td className="actions"><div className="btn-row nowrap"><Button size="sm" onClick={() => setLog(r.vehicle)}>Arama kaydı</Button><Button size="sm" variant="primary" onClick={() => setBook(r.vehicle)}>Randevu</Button></div></td>
        </tr>;
      })}</tbody>
    </table></div> : <Empty icon="bell" title="Hatırlatılacak araç yok" />}</Card>
    {log && <Modal open title="Arama sonucunu kaydet" sub={log.plate} onClose={() => setLog(null)} width={440}>
      <form className="form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); submit(() => run((s, a) => logReminder(s, a, { vehicleId: log.id, result: String(f.get('result')) as ReminderResult, note: String(f.get('note')) }), 'Bakım hatırlatma araması kaydedildi', log.plate), () => setLog(null)) }}>
        <FormError error={error} />
        <Field label="Sonuç"><select name="result">{['Randevu alındı', 'Ulaşılamadı', 'Daha sonra aranacak', 'İstemiyor'].map(x => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Not"><input name="note" maxLength={200} /></Field>
        <div className="form-actions"><Button onClick={() => setLog(null)}>Vazgeç</Button><button className="btn primary" disabled={busy}>Kaydet</button></div>
      </form>
    </Modal>}
    {book && <AppointmentForm open preset={{ customerId: book.customerId, vehicleId: book.id, serviceId: 's-maint' }} onClose={() => setBook(null)} />}
  </>;
}
