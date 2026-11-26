'use client';
import { Suspense, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { detailHref } from '@/lib/routes';
import { useApp } from '@/components/store';
import { Button, Modal } from '@/components/ui';
import { Icon } from '@/components/icons';
import { Plate } from '@/components/vehicle-identity';
import { AppointmentForm } from '@/components/forms';
import { portalView, serviceName, setAppointmentStatus } from '@/lib/commands';
import { fmtDate, fold } from '@/lib/format';
import type { Appointment, JobStatus } from '@/lib/types';
import styles from '@/components/portal-appointments.module.css';

type Filter = 'upcoming' | 'past' | 'all';
const filters: { id: Filter; label: string }[] = [
  { id: 'upcoming', label: 'Yaklaşan' }, { id: 'past', label: 'Geçmiş' }, { id: 'all', label: 'Tümü' },
];
const startsAt = (a: Appointment) => new Date(`${a.date}T${a.time}:00+03:00`).getTime();
const canCancel = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`).getTime() - Date.now() > 2 * 3600000;
const statusLabel = (a: Appointment) => a.status === 'Bekliyor' ? 'Onay bekliyor' : a.status === 'İş emri açıldı' ? 'Servis kaydı açıldı' : a.status === 'İptal' ? 'İptal edildi' : a.status;

const jobSummary: Record<JobStatus, string> = {
  'Kabul edildi': 'Aracınız teslim alındı; servis kontrolleri sırada.',
  'İnceleniyor': 'Aracınızın kontrolleri devam ediyor.',
  'Onay bekliyor': 'Servis teklifiniz kararınızı bekliyor.',
  'İşlemde': 'Onaylanan servis işlemleri devam ediyor.',
  'Parça bekliyor': 'Servis işlemleri için gerekli parça bekleniyor.',
  'Son kontrol': 'İşlemler tamamlandı; aracınızın son kontrolleri yapılıyor.',
  'Teslime hazır': 'Aracınız hazır; teslim planı için servise ulaşabilirsiniz.',
  'Teslim edildi': 'Servis ziyaretiniz tamamlandı ve aracınız teslim edildi.',
  'İptal': 'Bu servis kaydı iptal edildi.',
};
const validDate = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : '';
};

export default function Page() {
  return <Suspense fallback={<div className={styles.page} role="status"><h1>Randevularım</h1><p>Randevular hazırlanıyor…</p></div>}><PortalAppointments /></Suspense>;
}

function PortalAppointments() {
  const { state, actor, run } = useApp();
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();
  const requestedView = searchParams.get('gorunum');
  const filter: Filter = requestedView === 'gecmis' ? 'past' : requestedView === 'tumu' ? 'all' : 'upcoming';
  const search = (searchParams.get('arama') ?? '').slice(0, 200);
  const from = validDate(searchParams.get('baslangic'));
  const to = validDate(searchParams.get('bitis'));
  const hasFilters = !!(search.trim() || from || to);
  const invalidRange = !!(from && to && from > to);
  const returnTo = '/portal/randevular' + (searchParams.size ? `?${searchParams.toString()}` : '');
  function updateFilters(values: Record<string, string>, push = false) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(values)) { if (value) params.set(key, value); else params.delete(key); }
    const query = params.toString();
    const url = window.location.pathname + (query ? `?${query}` : '');
    if (push) window.history.pushState(null, '', url); else window.history.replaceState(null, '', url);
  }
  function setFilter(value: Filter) {
    updateFilters({ gorunum: value === 'past' ? 'gecmis' : value === 'all' ? 'tumu' : '' }, true);
  }
  function clearFilters() { updateFilters({ arama: '', baslangic: '', bitis: '' }); }
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
  const needle = fold(search).replace(/\s/g, '');
  const matching = view.appointments.filter(a => {
    const vehicle = view.vehicles.find(v => v.id === a.vehicleId);
    const haystack = fold(`${vehicle?.brand ?? ''} ${vehicle?.model ?? ''} ${vehicle?.plate ?? ''} ${serviceName(state, a.serviceId)}`).replace(/\s/g, '');
    return !invalidRange && (!needle || haystack.includes(needle)) && (!from || a.date >= from) && (!to || a.date <= to);
  });
  const next = matching.filter(upcoming).sort((a, b) => startsAt(a) - startsAt(b));
  const previous = matching.filter(a => !upcoming(a)).sort((a, b) => startsAt(b) - startsAt(a));
  const counts = { upcoming: next.length, past: previous.length, all: matching.length };
  const list = filter === 'upcoming' ? next : filter === 'past' ? previous : [...matching].sort((a, b) => startsAt(b) - startsAt(a));
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
      <div className={styles.filterBar} role="search" aria-label="Randevularda ara">
        <label className={styles.searchField} htmlFor={`${listId}-search`}><span>Araç, plaka veya hizmet ara</span><span className={styles.searchInput}><Icon name="search" size={17} /><input id={`${listId}-search`} type="search" value={search} maxLength={200} placeholder="Örn. Clio, 58 ABC 123, bakım" onChange={e => updateFilters({ arama: e.target.value })} /></span></label>
        <label className={styles.dateField} htmlFor={`${listId}-from`}><span>Başlangıç tarihi</span><input id={`${listId}-from`} type="date" value={from} max={to || undefined} aria-invalid={invalidRange || undefined} aria-describedby={invalidRange ? `${listId}-range-error` : undefined} onChange={e => updateFilters({ baslangic: e.target.value })} /></label>
        <label className={styles.dateField} htmlFor={`${listId}-to`}><span>Bitiş tarihi</span><input id={`${listId}-to`} type="date" value={to} min={from || undefined} aria-invalid={invalidRange || undefined} aria-describedby={invalidRange ? `${listId}-range-error` : undefined} onChange={e => updateFilters({ bitis: e.target.value })} /></label>
        <button type="button" className={styles.clearFilters} disabled={!hasFilters} onClick={clearFilters}>Filtreleri temizle</button>
        {invalidRange && <p id={`${listId}-range-error`} className={styles.rangeError} role="alert">Başlangıç tarihi bitiş tarihinden sonra olamaz. Tarih aralığını düzeltin veya filtreleri temizleyin.</p>}
      </div>
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
            const job = view.jobs.find(j => j.appointmentId === a.id && j.customerId === actor.customerId && j.vehicleId === a.vehicleId);
            const cancellableStatus = ['Bekliyor', 'Onaylı'].includes(a.status);
            const isPast = startsAt(a) < clock;
            const tone = a.status === 'Bekliyor' ? styles.pending : a.status === 'Onaylı' ? styles.confirmed : ['İptal', 'Gelmedi'].includes(a.status) ? styles.inactive : styles.inService;
            return <li key={a.id}><article className={styles.card} aria-label={`${fmtDate(a.date)} ${a.time} randevusu`}>
              <time dateTime={`${a.date}T${a.time}:00+03:00`} className={styles.date}>
                <span className={styles.month}>{fmtDate(a.date, { month: 'long' })}</span><strong>{a.date.slice(8, 10)}</strong><span className={styles.weekday}>{fmtDate(a.date, { weekday: 'long' })}</span><span className={styles.time}><Icon name="clock" size={14} />{a.time}</span>
              </time>
              <div className={styles.details}>
                <div className={styles.cardTop}><span className={styles.year}>{a.date.slice(0, 4)}{isPast ? ' · Geçmiş randevu' : ''}</span><span className={`${styles.badge} ${tone}`}><span aria-hidden="true" />{job?.status === 'Teslim edildi' ? 'Servis tamamlandı' : statusLabel(a)}</span></div>
                <h2>{serviceName(state, a.serviceId)}</h2>
                <div className={styles.vehicle}><Icon name="car" size={18} /><span>{vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Araç bilgisi mevcut değil'}</span>{vehicle && <Plate value={vehicle.plate} size="sm" />}</div>
                {job && <div className={styles.jobSummary}><div><strong>Servis durumu: {job.status}</strong><span>{job.no}</span></div><p>{jobSummary[job.status]}</p><Link href={detailHref('/portal/servis', job.id)} aria-label={`${job.no} servis kaydını incele`}>Servis kaydını incele<Icon name="right" size={14} /></Link></div>}
                <Link className={styles.detailLink} href={detailHref('/portal/randevular/detay', a.id) + '&' + new URLSearchParams({ donus: returnTo }).toString()} aria-label={`${fmtDate(a.date)} ${a.time} randevusunun ayrıntılarını incele`}>Ayrıntıları incele<Icon name="arrow" size={16} /></Link>
                <div className={styles.cardBottom}><p><Icon name="clock" size={14} />Planlanan süre: {a.duration} dk</p>
                  {cancellableStatus && (canCancel(a.date, a.time)
                    ? <button type="button" className={styles.cancel} aria-label={`${fmtDate(a.date)} ${a.time} randevusunu iptal et`} onClick={() => { setError(''); setCancel(a); }}>Randevuyu iptal et</button>
                    : <span className={styles.callHint}>{isPast ? 'Randevu tarihi geçti.' : <>Değişiklik veya iptal için <a href={phoneHref}>servisi arayın</a>.</>}</span>)}
                </div>
              </div>
            </article></li>;
          })}
        </ul> : hasFilters ? <div className={styles.empty}><span className={styles.emptyIcon}><Icon name="search" size={30} /></span><h2>{invalidRange ? 'Tarih aralığını kontrol edin' : 'Bu filtrelerle randevu bulunamadı'}</h2><p>{invalidRange ? 'Başlangıç tarihi bitiş tarihinden önce veya aynı gün olmalı.' : 'Araç, plaka veya hizmet aramanızı değiştirin; daha geniş bir tarih aralığı seçin ya da filtreleri temizleyin.'}</p><button type="button" className={styles.clearFilters} onClick={clearFilters}>Filtreleri temizle</button>{filter !== 'all' && <button type="button" className={styles.textButton} onClick={() => setFilter('all')}>Bu filtrelerle tüm randevularda ara</button>}</div> : <div className={styles.empty}><span className={styles.emptyIcon}><Icon name="calendar" size={30} /></span><h2>{empty.title}</h2><p>{empty.text}</p><Button variant="primary" icon="plus" className={styles.primary} onClick={() => setOpen(true)}>Randevu talep et</Button>{filter === 'upcoming' && view.appointments.length > 0 && <button type="button" className={styles.textButton} onClick={() => setFilter('all')}>Tüm randevularımı göster</button>}</div>}
      </div>
    </section>
    <div className={styles.help}><Icon name="phone" size={18} /><div><strong>Planınız değişti mi?</strong><p>Randevunuza 2 saatten fazla varsa buradan iptal edebilirsiniz. Daha yakın bir saat için <a href={phoneHref}>{phone}</a> numarasından bize ulaşın.</p></div></div>
    {open && <AppointmentForm open portal preset={{ customerId: actor.customerId }} onClose={() => setOpen(false)} />}
    {cancel && <Modal open title="Randevuyu iptal et" onClose={() => { if (!busy) setCancel(null); }} width={460} footer={<><Button disabled={busy} onClick={() => setCancel(null)}>Randevuyu koru</Button><Button variant="danger" disabled={busy || !canCancel(cancel.date, cancel.time)} onClick={() => void cancelAppointment()}>{busy ? 'İptal ediliyor…' : 'Randevuyu iptal et'}</Button></>}>
      <div className={styles.cancelDialog}><p><strong>{fmtDate(cancel.date, { day: 'numeric', month: 'long', year: 'numeric' })} · {cancel.time}</strong> tarihindeki {serviceName(state, cancel.serviceId)} randevunuzu iptal etmek üzeresiniz.</p><p>Dilerseniz daha sonra yeni bir randevu talebi oluşturabilirsiniz.</p>{error && <p role="alert" className={styles.error}>{error}</p>}{!canCancel(cancel.date, cancel.time) && !error && <p role="alert" className={styles.error}>Çevrimiçi iptal süresi doldu. Lütfen servisi arayın.</p>}</div>
    </Modal>}
  </div>;
}
