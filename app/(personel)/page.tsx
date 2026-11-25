'use client';
import { detailHref } from '@/lib/routes';
import Link from 'next/link';
import { useApp } from '@/components/store';
import { Card, Cue, Empty, PageHeader, Status } from '@/components/ui';
import { JobTable, isLate } from '@/components/job-table';
import { Icon } from '@/components/icons';
import { Plate } from '@/components/vehicle-identity';
import { balance, can, dueReminders, estimateTotals, latestEstimate, roleLabel, serviceName, technicians } from '@/lib/rules';
import { fmtDate, fmtLongDate, fmtTime, isoDay, money, moneyShort, today } from '@/lib/format';

const openStatuses = ['Kabul edildi', 'İnceleniyor', 'Onay bekliyor', 'İşlemde', 'Parça bekliyor', 'Son kontrol', 'Teslime hazır'];

/** Rol merkezi: sayaç kutucukları (her biri filtrelenmiş listeyi açar) ve altında "bugün" listeleri. */
export default function Home() {
  const { state, actor } = useApp();
  const day = today();
  const v = (id: string) => state.vehicles.find(x => x.id === id);
  const c = (id: string) => state.customers.find(x => x.id === id);
  const open = state.jobs.filter(j => openStatuses.includes(j.status));
  const tech = actor.role === 'technician';
  const mine = tech ? open.filter(j => j.technicianId === actor.userId) : open;
  const dueToday = mine.filter(j => isoDay(j.promisedAt) === day || j.status === 'Teslime hazır').sort((a, b) => a.promisedAt.localeCompare(b.promisedAt));
  const head = <PageHeader title="Ana Sayfa" sub={`${roleLabel[actor.role]} · ${state.settings.company.branch} · ${fmtLongDate(day)}`}
    actions={!tech && <>
      {can(actor, 'job.create') && <Link className="btn primary" href="/is-emirleri?yeni=1"><Icon name="plus" size={15} />Yeni iş emri</Link>}
      {can(actor, 'appointment.manage') && <Link className="btn" href="/randevular?yeni=1"><Icon name="calendar" size={15} />Yeni randevu</Link>}
      {can(actor, 'customer.write') && <Link className="btn" href="/musteriler?yeni=1"><Icon name="user" size={15} />Yeni müşteri</Link>}
      <Link className="btn" href="/is-emirleri"><Icon name="wrench" size={15} />İş emri listesi</Link>
    </>} />

  if (tech) {
    const q = (d: string) => `/is-emirleri?durum=${d}&benim=1`;
    return <>
      {head}
      <section className="cue-group" aria-label="İşlerim">
        <h2 className="cue-title">İşlerim</h2>
        <div className="cues">
          <Cue label="Açık işlerim" value={mine.length} href={q('acik')} />
          <Cue label="İncelenecek" value={mine.filter(j => ['Kabul edildi', 'İnceleniyor'].includes(j.status)).length} href={q('inceleme')} />
          <Cue label="İşlemde" value={mine.filter(j => j.status === 'İşlemde').length} href={q('islemde')} />
          <Cue label="Parça bekleyen" value={mine.filter(j => j.status === 'Parça bekliyor').length} href={q('parca')} tone={mine.some(j => j.status === 'Parça bekliyor') ? 'warn' : undefined} />
          <Cue label="Gecikmede" value={mine.filter(isLate).length} href={q('gecikme')} tone={mine.some(isLate) ? 'bad' : undefined} />
        </div>
      </section>
      <Card title="Bugün teslim edilecek işlerim" sub={`${dueToday.length} kayıt`} flush><JobTable jobs={dueToday} sortable={false} emptyText="Bugün teslim edilecek iş yok" /></Card>
      <Card title="İş listem" flush actions={<Link className="btn sm" href={q('acik')}>Tümü</Link>}><JobTable jobs={mine} emptyText="Size atanmış açık iş yok" /></Card>
    </>;
  }

  const todays = state.appointments.filter(a => a.date === day && a.status !== 'İptal').sort((a, b) => a.time.localeCompare(b.time));
  const requests = state.appointments.filter(a => a.status === 'Bekliyor');
  const pending = state.jobs.filter(j => latestEstimate(j)?.status === 'Gönderildi');
  const payments = state.jobs.flatMap(j => j.payments);
  const todayCash = payments.filter(p => isoDay(p.at) === day).reduce((s, p) => s + p.amount, 0);
  const openBalance = state.jobs.filter(j => j.status !== 'İptal').reduce((s, j) => s + Math.max(0, balance(j)), 0);
  const ready = state.jobs.filter(j => j.status === 'Teslime hazır');
  const reminders = dueReminders(state).filter(r => !r.hasAppointment);
  const recent = [...state.jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  const alerts: { tone: 'bad' | 'warn'; text: React.ReactNode; href: string }[] = [
    ...open.filter(isLate).map(j => ({ tone: 'bad' as const, text: <><b className="mono">{j.no}</b> teslim sözü geçti ({fmtDate(j.promisedAt)} {fmtTime(j.promisedAt)})</>, href: detailHref('/is-emirleri/detay', j.id) })),
    ...open.flatMap(j => j.inspections.some(i => i.result === 'Acil') && latestEstimate(j)?.status !== 'Onaylandı' ? [{ tone: 'bad' as const, text: <><b className="mono">{j.no}</b> acil bulgu: {j.inspections.find(i => i.result === 'Acil')!.item}</>, href: detailHref('/is-emirleri/detay', j.id) }] : []),
    ...requests.map(a => ({ tone: 'warn' as const, text: <><b className="mono">{a.no}</b> randevu talebi onay bekliyor · {fmtDate(a.date)} {a.time}</>, href: '/randevular?tarih=' + a.date })),
    ...open.filter(j => j.status === 'Parça bekliyor').map(j => ({ tone: 'warn' as const, text: <><b className="mono">{j.no}</b> parça bekliyor</>, href: detailHref('/is-emirleri/detay', j.id) })),
  ];

  return <>
    {head}
    <div className="cue-groups">
      <section className="cue-group" aria-label="Ön büro">
        <h2 className="cue-title">Ön büro</h2>
        <div className="cues">
          <Cue label="Bugünkü randevu" value={todays.length} href={'/randevular?tarih=' + day} />
          <Cue label="Randevu talebi" value={requests.length} href="/randevular" tone={requests.length ? 'warn' : undefined} />
          {can(actor, 'reminder.write') && <Cue label="Bakım hatırlatması" value={reminders.length} href="/hatirlatmalar" />}
        </div>
      </section>
      <section className="cue-group" aria-label="Atölye">
        <h2 className="cue-title">Atölye</h2>
        <div className="cues">
          <Cue label="Açık iş emri" value={open.length} href="/is-emirleri?durum=acik" />
          <Cue label="Onay bekleyen teklif" value={pending.length} href="/teklifler" tone={pending.length ? 'warn' : undefined} foot={money(pending.reduce((s, j) => s + estimateTotals(latestEstimate(j)!).total, 0))} />
          <Cue label="Parça bekleyen" value={open.filter(j => j.status === 'Parça bekliyor').length} href="/is-emirleri?durum=parca" />
          <Cue label="Teslime hazır" value={ready.length} href="/is-emirleri?durum=hazir" tone={ready.length ? 'ok' : undefined} />
          <Cue label="Gecikmede" value={open.filter(isLate).length} href="/is-emirleri?durum=gecikme" tone={open.some(isLate) ? 'bad' : undefined} />
        </div>
      </section>
      {can(actor, 'payment.read') && <section className="cue-group" aria-label="Finans">
        <h2 className="cue-title">Finans</h2>
        <div className="cues">
          <Cue label="Bugünkü tahsilat" value={moneyShort(todayCash)} href="/tahsilat" foot={`${payments.filter(p => isoDay(p.at) === day).length} işlem`} />
          <Cue label="Açık bakiye" value={moneyShort(openBalance)} href="/is-emirleri?durum=bakiye" />
        </div>
      </section>}
    </div>

    <div className="grid-main">
      <div className="stack">
        <Card title="Bugünkü randevular" sub={fmtDate(day, { day: 'numeric', month: 'long', weekday: 'long' })} flush actions={<Link className="btn sm" href="/randevular">Takvim</Link>}>
          {todays.length ? <div className="table-wrap"><table className="table dense">
            <thead><tr><th>Saat</th><th>No</th><th>Plaka</th><th className="hide-sm">Müşteri</th><th className="hide-md">Hizmet</th><th>Durum</th></tr></thead>
            <tbody>{todays.map(a => { const job = state.jobs.find(j => j.appointmentId === a.id); return <tr key={a.id}>
              <td className="mono">{a.time}</td>
              <td className="mono small">{job ? <Link href={detailHref('/is-emirleri/detay', job.id)}>{job.no}</Link> : <Link href={'/randevular?tarih=' + a.date}>{a.no}</Link>}</td>
              <td>{v(a.vehicleId) ? <Plate value={v(a.vehicleId)!.plate} size="sm" /> : '—'}</td>
              <td className="hide-sm">{c(a.customerId)?.name}</td>
              <td className="hide-md">{serviceName(state, a.serviceId)}</td>
              <td><Status value={a.status} /></td>
            </tr> })}</tbody>
          </table></div> : <Empty icon="calendar" title="Bugün randevu yok" />}
        </Card>
        <Card title="Bugün teslim edilecekler" sub={`${dueToday.length} iş emri · söz verilen teslim bugün veya teslime hazır`} flush><JobTable jobs={dueToday} sortable={false} emptyText="Bugün teslim edilecek araç yok" /></Card>
      </div>
      <div className="stack">
        <Card title="Dikkat gerektirenler" sub={`${alerts.length} kayıt`} flush>
          {alerts.length ? <ul className="alert-list">{alerts.slice(0, 9).map((a, i) => <li key={i}><Link href={a.href}><span className={'dot ' + a.tone} /><span>{a.text}</span><Icon name="right" size={14} /></Link></li>)}</ul>
            : <Empty icon="check" title="Bekleyen uyarı yok" />}
        </Card>
        <Card title="Teknisyen iş yükü" flush>
          <table className="table dense">
            <thead><tr><th>Teknisyen</th><th className="num">Açık</th><th className="num">İşlemde</th><th className="num">Gecikme</th></tr></thead>
            <tbody>{technicians(state).map(t => {
              const tj = open.filter(j => j.technicianId === t.id);
              return <tr key={t.id}><td>{t.name}</td><td className="num">{tj.length}</td><td className="num">{tj.filter(j => j.status === 'İşlemde').length}</td><td className={'num ' + (tj.some(isLate) ? 'text-bad strong' : '')}>{tj.filter(isLate).length}</td></tr>;
            })}</tbody>
          </table>
        </Card>
      </div>
    </div>

    <Card title="Son iş emirleri" flush actions={<Link className="btn sm" href="/is-emirleri?durum=tumu">Tüm iş emirleri</Link>}>
      <JobTable jobs={recent} sortable={false} />
    </Card>
  </>;
}
