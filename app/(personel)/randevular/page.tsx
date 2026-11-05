'use client';
import { detailHref } from '@/lib/routes';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/store';
import { Button, Card, Empty, KV, Modal, PageHeader, Status } from '@/components/ui';
import { Icon } from '@/components/icons';
import { Plate, VehicleCell } from '@/components/vehicle-identity';
import { AppointmentForm, IntakeForm } from '@/components/forms';
import { confirmAppointment, findClash, resourceName, serviceName, setAppointmentStatus } from '@/lib/rules';
import { addDays, fmtDate, fmtDateTime, fmtLongDate, hhmm, minutes, today, weekday } from '@/lib/format';
import type { Appointment } from '@/lib/types';

const SLOT = 30, ROW = 44;

export default function AppointmentsPage() {
  const { state, run } = useApp();
  const router = useRouter();
  const [day, setDay] = useState(today());
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<null | { preset?: Partial<Appointment>; editing?: Appointment }>(null);
  const [intake, setIntake] = useState<Appointment | null>(null);
  useEffect(() => { const d = new URLSearchParams(location.search).get('tarih'); if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setDay(d) }, []);

  const s = state.settings;
  const start = minutes(s.workStart), end = minutes(s.workEnd);
  const rows = Array.from({ length: (end - start) / SLOT }, (_, i) => start + i * SLOT);
  const resources = s.resources.filter(r => r.active);
  const list = state.appointments.filter(a => a.date === day);
  const placed = list.filter(a => !['İptal', 'Gelmedi', 'Bekliyor'].includes(a.status));
  const requests = state.appointments.filter(a => a.status === 'Bekliyor').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const closedDay = !s.workDays.includes(weekday(day));
  const sel = state.appointments.find(a => a.id === selected);
  const v = (id: string) => state.vehicles.find(x => x.id === id);
  const c = (id: string) => state.customers.find(x => x.id === id);
  const nowMin = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() })();
  const occupancy = resources.map(r => ({ r, used: placed.filter(a => a.resourceId === r.id).reduce((t, a) => t + a.duration, 0) }));
  const capacity = end - start - (minutes(s.breakEnd) - minutes(s.breakStart));

  return <>
    <PageHeader title="Randevu takvimi" sub="Servis alanlarına göre günlük plan. Onaylı randevular kapasiteyi bloke eder; talepler sağda listelenir."
      actions={<Button variant="primary" icon="plus" onClick={() => setForm({ preset: { date: day } })}>Yeni randevu</Button>} />
    <div className="toolbar">
      <div className="btn-group">
        <Button icon="left" aria-label="Önceki gün" onClick={() => setDay(addDays(day, -1))} />
        <Button onClick={() => setDay(today())} disabled={day === today()}>Bugün</Button>
        <Button icon="right" aria-label="Sonraki gün" onClick={() => setDay(addDays(day, 1))} />
      </div>
      <input type="date" value={day} onChange={e => e.target.value && setDay(e.target.value)} aria-label="Tarih seç" className="date-input" />
      <strong className="toolbar-title">{fmtLongDate(day)}</strong>
      <div className="toolbar-end legend">
        <span><i className="lg blue" />Onaylı</span><span><i className="lg teal" />Geldi</span><span><i className="lg slate" />İş emri açıldı</span>
      </div>
    </div>

    <div className="schedule-layout">
      <Card flush className="schedule-card">
        {closedDay ? <Empty icon="calendar" title="Servis bu gün kapalı">Çalışma günleri ayarlardan değiştirilebilir.</Empty> :
          <div className="schedule-scroll">
            <div className="schedule" style={{ gridTemplateColumns: `56px repeat(${resources.length}, minmax(150px, 1fr))` }}>
              <div className="sch-corner" />
              {occupancy.map(({ r, used }) => <div key={r.id} className="sch-head"><strong>{r.name}</strong><small>Doluluk %{Math.round(used / capacity * 100)}</small></div>)}
              <div className="sch-times">{rows.map(m => <span key={m} style={{ height: ROW }}>{m % 60 === 0 ? hhmm(m) : ''}</span>)}</div>
              {resources.map(r => <div key={r.id} className="sch-col" style={{ height: rows.length * ROW }}>
                {rows.map(m => {
                  const inBreak = m >= minutes(s.breakStart) && m < minutes(s.breakEnd);
                  const past = new Date(`${day}T${hhmm(m)}:00+03:00`).getTime() < Date.now();
                  return <button key={m} className={'sch-slot ' + (inBreak ? 'break' : '') + (past ? ' past' : '')} style={{ height: ROW }} disabled={inBreak || past}
                    aria-label={`${r.name} ${hhmm(m)} için randevu oluştur`} onClick={() => setForm({ preset: { date: day, time: hhmm(m), resourceId: r.id } })}>{inBreak && m === minutes(s.breakStart) ? 'Öğle arası' : ''}</button>;
                })}
                {placed.filter(a => a.resourceId === r.id).map(a => {
                  const top = (minutes(a.time) - start) / SLOT * ROW, h = a.duration / SLOT * ROW;
                  const veh = v(a.vehicleId);
                  return <button key={a.id} className={'sch-item ' + (a.status === 'Onaylı' ? 'blue' : a.status === 'Geldi' ? 'teal' : 'slate') + (selected === a.id ? ' sel' : '')} style={{ top: top + 2, height: h - 4 }} onClick={() => setSelected(a.id)}>
                    <span className="sch-time">{a.time}–{hhmm(minutes(a.time) + a.duration)}</span>
                    <strong>{veh ? veh.plate.replace(/^(\d{2})([A-ZÇĞİÖŞÜ]+)(\d+)$/, '$1 $2 $3') : ''}</strong>
                    {h > 50 && <span>{serviceName(state, a.serviceId)}</span>}
                    {h > 80 && <span className="muted">{c(a.customerId)?.name}</span>}
                  </button>;
                })}
                {day === today() && nowMin > start && nowMin < end && <div className="sch-now" style={{ top: (nowMin - start) / SLOT * ROW }} />}
              </div>)}
            </div>
          </div>}
      </Card>

      <div className="schedule-side">
        {sel ? <AppointmentDetail a={sel} onClose={() => setSelected(null)} onEdit={() => setForm({ editing: sel })} onIntake={() => setIntake(sel)} /> : null}
        <Card title="Onay bekleyen talepler" sub={`${requests.length} talep`} flush>
          {requests.length ? <ul className="req-list">{requests.map(a => {
            const clash = findClash(state, a);
            return <li key={a.id} className={selected === a.id ? 'sel' : ''}>
              <button className="req-main" onClick={() => { setDay(a.date); setSelected(a.id) }}>
                <span className="req-when"><b>{fmtDate(a.date, { day: '2-digit', month: 'short' })}</b>{a.time}</span>
                <span><VehicleCell vehicle={v(a.vehicleId)} sub={`${serviceName(state, a.serviceId)} · ${resourceName(state, a.resourceId)}`} /></span>
              </button>
              {clash ? <small className="text-bad"><Icon name="alert" size={12} /> {clash.no} ile çakışıyor</small> : <small className="muted">{a.source} · {a.createdBy}</small>}
              <div className="req-actions">
                <Button size="sm" variant="primary" disabled={!!clash} onClick={() => run((s, ac) => confirmAppointment(s, ac, a.id), `${a.no} randevusu onaylandı`, a.no)}>Onayla</Button>
                <Button size="sm" onClick={() => setForm({ editing: a })}>Saat değiştir</Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm(`${a.no} talebi iptal edilsin mi?`)) run((s, ac) => setAppointmentStatus(s, ac, a.id, 'İptal'), `${a.no} talebi iptal edildi`, a.no) }}>İptal</Button>
              </div>
            </li>;
          })}</ul> : <Empty icon="check" title="Bekleyen talep yok" />}
        </Card>
        {list.some(a => ['İptal', 'Gelmedi'].includes(a.status)) && <Card title="İptal / gelmedi" flush>
          <ul className="req-list compact">{list.filter(a => ['İptal', 'Gelmedi'].includes(a.status)).map(a => <li key={a.id}><span className="mono">{a.time}</span> <Plate value={v(a.vehicleId)?.plate ?? ''} size="sm" /> <Status value={a.status} /></li>)}</ul>
        </Card>}
      </div>
    </div>

    {form && <AppointmentForm open onClose={() => setForm(null)} preset={form.preset} editing={form.editing} />}
    {intake && <IntakeForm open appointment={intake} onClose={() => setIntake(null)} onDone={id => router.push(detailHref('/is-emirleri/detay', id))} />}
  </>;
}

function AppointmentDetail({ a, onClose, onEdit, onIntake }: { a: Appointment; onClose: () => void; onEdit: () => void; onIntake: () => void }) {
  const { state, run } = useApp();
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const veh = state.vehicles.find(x => x.id === a.vehicleId), cus = state.customers.find(x => x.id === a.customerId);
  const job = state.jobs.find(j => j.appointmentId === a.id);
  return <Card title={<>Randevu <span className="mono">{a.no}</span></>} actions={<button className="icon-btn" aria-label="Kapat" onClick={onClose}><Icon name="x" size={15} /></button>}>
    <div className="stack">
      <div className="row-between"><VehicleCell vehicle={veh} /><Status value={a.status} /></div>
      <KV items={[['Müşteri', cus ? <Link href={detailHref('/musteriler/detay', cus.id)}>{cus.name}</Link> : '—'], ['Telefon', cus?.phone ?? '—'], ['Hizmet', serviceName(state, a.serviceId)], ['Alan', resourceName(state, a.resourceId)], ['Zaman', `${fmtDate(a.date)} ${a.time} · ${a.duration} dk`], ['Kanal', a.source], ['Oluşturan', `${a.createdBy} · ${fmtDateTime(a.createdAt)}`]]} />
      {a.note && <p className="quote">{a.note}</p>}
      <div className="btn-row">
        {a.status === 'Bekliyor' && <Button variant="primary" onClick={() => run((s, ac) => confirmAppointment(s, ac, a.id), `${a.no} onaylandı`, a.no)}>Onayla</Button>}
        {a.status === 'Onaylı' && <>
          <Button variant="primary" icon="clipboard" onClick={onIntake}>Araç geldi · kabul</Button>
          <Button onClick={() => setConfirmNoShow(true)}>Gelmedi</Button>
        </>}
        {['Bekliyor', 'Onaylı'].includes(a.status) && <>
          <Button icon="edit" onClick={onEdit}>Değiştir</Button>
          <Button variant="ghost" onClick={() => { if (confirm('Randevu iptal edilsin mi?')) run((s, ac) => setAppointmentStatus(s, ac, a.id, 'İptal'), `${a.no} iptal edildi`, a.no) }}>İptal et</Button>
        </>}
        {job && <Link className="btn" href={detailHref('/is-emirleri/detay', job.id)}>İş emri {job.no}</Link>}
      </div>
    </div>
    <Modal open={confirmNoShow} onClose={() => setConfirmNoShow(false)} title="Gelmedi olarak işaretle" width={420}
      footer={<><Button onClick={() => setConfirmNoShow(false)}>Vazgeç</Button><Button variant="danger" onClick={() => { run((s, ac) => setAppointmentStatus(s, ac, a.id, 'Gelmedi'), `${a.no} gelmedi olarak işaretlendi`, a.no); setConfirmNoShow(false) }}>Gelmedi</Button></>}>
      <p>Randevu kapasitesi serbest bırakılır ve müşteri geçmişine “gelmedi” olarak işlenir.</p>
    </Modal>
  </Card>;
}
