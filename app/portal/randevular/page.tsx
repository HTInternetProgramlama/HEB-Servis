'use client';
import { useEffect, useId, useState } from 'react';
import { useApp } from '@/components/store';
import { Button, Modal } from '@/components/ui';
import { Icon } from '@/components/icons';
import { Plate } from '@/components/vehicle-identity';
import { AppointmentForm } from '@/components/forms';
import { portalView, serviceName, setAppointmentStatus } from '@/lib/commands';
import { fmtDate } from '@/lib/format';
import type { Appointment } from '@/lib/types';
import styles from '@/components/portal-appointments.module.css';

type Filter = 'upcoming' | 'past' | 'all';
const filters: { id: Filter; label: string }[] = [
  { id: 'upcoming', label: 'Yaklaşan' }, { id: 'past', label: 'Geçmiş' }, { id: 'all', label: 'Tümü' },
];
const startsAt = (a: Appointment) => new Date(`${a.date}T${a.time}:00+03:00`).getTime();
const canCancel = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`).getTime() - Date.now() > 2 * 3600000;
const statusLabel = (a: Appointment) => a.status === 'Bekliyor' ? 'Onay bekliyor' : a.status === 'İş emri açıldı' ? 'Serviste' : a.status === 'İptal' ? 'İptal edildi' : a.status;

export default function PortalAppointments() {
  const { state, actor, run } = useApp();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [clock, setClock] = useState<number | null>(null);
  const [cancel, setCancel] = useState<Appointment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const listId = useId();
  // Keep server/client first render identical and refresh time-sensitive actions.
  useEffect(() => {
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const view = portalView(state, actor);
  const upcoming = (a: Appointment) => clock !== null && startsAt(a) >= clock && !['İptal', 'Gelmedi'].includes(a.status);
  const next = view.appointments.filter(upcoming).sort((a, b) => startsAt(a) - startsAt(b));
  const previous = view.appointments.filter(a => !upcoming(a)).sort((a, b) => startsAt(b) - startsAt(a));
  const counts = { upcoming: next.length, past: previous.length, all: view.appointments.length };
  const list = filter === 'upcoming' ? next : filter === 'past' ? previous : [...view.appointments].sort((a, b) => startsAt(b) - startsAt(a));
  const phone = state.settings.company.phone;
  const phoneHref = `tel:${phone.replace(/[^+0-9]/g, '')}`;
  const empty = filter === 'upcoming'
    ? { title: 'Yeni bakımınıza yer açalım', text: 'Yaklaşan bir randevunuz yok. Aracınıza uygun hizmeti seçin, size uygun gün ve saat için talebinizi iletin.' }
    : filter === 'past'
      ? { title: 'Geçmiş randevunuz bulunmuyor', text: 'Tarihi geçen, iptal edilen veya katılamadığınız randevular burada listelenir.' }
      : { title: 'İlk randevunuzla başlayalım', text: 'Randevularınızı, onay durumlarını ve ziyaret tarihlerinizi bu ekrandan takip edebilirsiniz.' };

  async function cancelAppointment() {
    if (!cancel || busy) return;
    if (!canCancel(cancel.date, cancel.time)) { setError('Çevrimiçi iptal süresi doldu. Lütfen servisi arayın.'); setClock(Date.now()); return; }
    setBusy(true); setError('');
    try {
      const result = await run((s, ac) => setAppointmentStatus(s, ac, cancel.id, 'İptal'), 'Randevunuz iptal edildi', cancel.no);
      if (result) setError(result); else setCancel(null);
    } finally { setBusy(false); }
  }

  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>SERVİS PLANINIZ</span><h1>Randevularım</h1><p>Aracınız için ayırdığınız zaman, tek bir yerde.</p></div>
      <Button variant="primary" icon="plus" className={styles.primary} onClick={() => setOpen(true)}>Yeni randevu talebi</Button>
    </header>
    <aside className={styles.notice} aria-label="Randevu onay bilgisi"><span className={styles.noticeIcon}><Icon name="calendar" size={20} /></span><div><strong>Talebiniz, servis onayıyla kesinleşir.</strong><p>Gün ve saat seçiminizi iletin; servis danışmanımız talebinizi değerlendirsin. Onay durumunu buradan takip edebilirsiniz.</p></div></aside>
    <section className={styles.section} aria-label="Randevu kayıtları">
      <div className={styles.listHeader}>
        <div className={styles.tabs} role="tablist" aria-label="Randevuları filtrele">
          {filters.map((f, index) => <button type="button" role="tab" id={`${listId}-${f.id}`} aria-controls={listId} aria-selected={filter === f.id} tabIndex={filter === f.id ? 0 : -1} className={filter === f.id ? styles.activeTab : styles.tab} key={f.id} onClick={() => setFilter(f.id)} onKeyDown={e => {
            const target = e.key === 'ArrowRight' ? (index + 1) % filters.length : e.key === 'ArrowLeft' ? (index + filters.length - 1) % filters.length : e.key === 'Home' ? 0 : e.key === 'End' ? filters.length - 1 : null;
            if (target !== null) { e.preventDefault(); setFilter(filters[target].id); e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target]?.focus(); }
          }}>{f.label}<span>{clock === null ? '—' : counts[f.id]}</span></button>)}
        </div>
        <p className={styles.resultCount} role="status">{clock === null ? 'Randevular hazırlanıyor…' : `${list.length} randevu${filter === 'upcoming' ? ' · en yakın tarih önce' : ' · en yeni tarih önce'}`}</p>
      </div>
      <div id={listId} role="tabpanel" aria-labelledby={`${listId}-${filter}`} tabIndex={0} className={styles.panel}>
        {clock === null ? <div className={styles.empty}><Icon name="calendar" size={28} /><h2>Randevularınız hazırlanıyor</h2><p>Servis planınızı getiriyoruz.</p></div> : list.length ? <ul className={styles.cards}>
          {list.map(a => {
            // Never look up another customer's vehicle or show internal appointment fields.
            const vehicle = view.vehicles.find(v => v.id === a.vehicleId);
            const cancellableStatus = ['Bekliyor', 'Onaylı'].includes(a.status);
            const isPast = startsAt(a) < clock;
            const tone = a.status === 'Bekliyor' ? styles.pending : a.status === 'Onaylı' ? styles.confirmed : ['İptal', 'Gelmedi'].includes(a.status) ? styles.inactive : styles.inService;
            return <li key={a.id}><article className={styles.card} aria-label={`${fmtDate(a.date)} ${a.time} randevusu`}>
              <time dateTime={`${a.date}T${a.time}:00+03:00`} className={styles.date}>
                <span className={styles.month}>{fmtDate(a.date, { month: 'long' })}</span><strong>{a.date.slice(8, 10)}</strong><span className={styles.weekday}>{fmtDate(a.date, { weekday: 'long' })}</span><span className={styles.time}><Icon name="clock" size={14} />{a.time}</span>
              </time>
              <div className={styles.details}>
                <div className={styles.cardTop}><span className={styles.year}>{a.date.slice(0, 4)}{isPast ? ' · Geçmiş randevu' : ''}</span><span className={`${styles.badge} ${tone}`}><span aria-hidden="true" />{statusLabel(a)}</span></div>
                <h2>{serviceName(state, a.serviceId)}</h2>
                <div className={styles.vehicle}><Icon name="car" size={18} /><span>{vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Araç bilgisi mevcut değil'}</span>{vehicle && <Plate value={vehicle.plate} size="sm" />}</div>
                <div className={styles.cardBottom}><p><Icon name="clock" size={14} />Planlanan süre: {a.duration} dk</p>
                  {cancellableStatus && (canCancel(a.date, a.time)
                    ? <button type="button" className={styles.cancel} aria-label={`${fmtDate(a.date)} ${a.time} randevusunu iptal et`} onClick={() => { setError(''); setCancel(a); }}>Randevuyu iptal et</button>
                    : <span className={styles.callHint}>{isPast ? 'Randevu tarihi geçti.' : <>Değişiklik veya iptal için <a href={phoneHref}>servisi arayın</a>.</>}</span>)}
                </div>
              </div>
            </article></li>;
          })}
        </ul> : <div className={styles.empty}><span className={styles.emptyIcon}><Icon name="calendar" size={30} /></span><h2>{empty.title}</h2><p>{empty.text}</p><Button variant="primary" icon="plus" className={styles.primary} onClick={() => setOpen(true)}>Randevu talep et</Button>{filter === 'upcoming' && view.appointments.length > 0 && <button type="button" className={styles.textButton} onClick={() => setFilter('all')}>Tüm randevularımı göster</button>}</div>}
      </div>
    </section>
    <div className={styles.help}><Icon name="phone" size={18} /><div><strong>Planınız değişti mi?</strong><p>Randevunuza 2 saatten fazla varsa buradan iptal edebilirsiniz. Daha yakın bir saat için <a href={phoneHref}>{phone}</a> numarasından bize ulaşın.</p></div></div>
    {open && <AppointmentForm open portal preset={{ customerId: actor.customerId }} onClose={() => setOpen(false)} />}
    {cancel && <Modal open title="Randevuyu iptal et" onClose={() => { if (!busy) setCancel(null); }} width={460} footer={<><Button disabled={busy} onClick={() => setCancel(null)}>Randevuyu koru</Button><Button variant="danger" disabled={busy || !canCancel(cancel.date, cancel.time)} onClick={() => void cancelAppointment()}>{busy ? 'İptal ediliyor…' : 'Randevuyu iptal et'}</Button></>}>
      <div className={styles.cancelDialog}><p><strong>{fmtDate(cancel.date, { day: 'numeric', month: 'long', year: 'numeric' })} · {cancel.time}</strong> tarihindeki {serviceName(state, cancel.serviceId)} randevunuzu iptal etmek üzeresiniz.</p><p>Dilerseniz daha sonra yeni bir randevu talebi oluşturabilirsiniz.</p>{error && <p role="alert" className={styles.error}>{error}</p>}{!canCancel(cancel.date, cancel.time) && !error && <p role="alert" className={styles.error}>Çevrimiçi iptal süresi doldu. Lütfen servisi arayın.</p>}</div>
    </Modal>}
  </div>;
}
