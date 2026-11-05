'use client';
import { detailHref } from '@/lib/routes';
import Link from 'next/link';
import { useApp } from '@/components/store';
import { Card, Empty, PageHeader, Stat, Status } from '@/components/ui';
import { JobTable } from '@/components/job-table';
import { Icon } from '@/components/icons';
import { VehicleCell } from '@/components/vehicle-identity';
import { amountDue, balance, estimateTotals, latestEstimate, resourceName, serviceName, staffName, technicians } from '@/lib/rules';
import { addDays, fmtDate, fmtTime, isoDay, money, moneyShort, today } from '@/lib/format';
import type { Job } from '@/lib/types';

const openStatuses = ['Kabul edildi', 'İnceleniyor', 'Onay bekliyor', 'İşlemde', 'Parça bekliyor', 'Son kontrol', 'Teslime hazır'];

export default function Overview() {
  const { state, actor } = useApp();
  const day = today();
  const v = (id: string) => state.vehicles.find(x => x.id === id);
  const c = (id: string) => state.customers.find(x => x.id === id);
  const open = state.jobs.filter(j => openStatuses.includes(j.status));
  const mine = actor.role === 'technician' ? open.filter(j => j.technicianId === actor.userId) : open;
  const overdue = (j: Job) => j.status !== 'Teslime hazır' && new Date(j.promisedAt).getTime() < Date.now();

  if (actor.role === 'technician') {
    return <>
      <PageHeader title={`İyi çalışmalar, ${actor.name.split(' ')[0]}`} sub="Size atanan açık iş emirleri" />
      <div className="stats">
        <Stat label="Açık işlerim" value={mine.length} />
        <Stat label="İncelenecek" value={mine.filter(j => ['Kabul edildi', 'İnceleniyor'].includes(j.status)).length} />
        <Stat label="İşlemde" value={mine.filter(j => j.status === 'İşlemde').length} />
        <Stat label="Parça bekleyen" value={mine.filter(j => j.status === 'Parça bekliyor').length} tone={mine.some(j => j.status === 'Parça bekliyor') ? 'warn' : undefined} />
      </div>
      <Card title="İş listem" flush actions={<Link className="btn sm" href="/atolye">Atölye panosu</Link>}>
        <JobTable jobs={mine} />
      </Card>
    </>;
  }

  const todays = state.appointments.filter(a => a.date === day && !['İptal'].includes(a.status)).sort((a, b) => a.time.localeCompare(b.time));
  const pendingEstimates = state.jobs.filter(j => latestEstimate(j)?.status === 'Gönderildi');
  const pendingValue = pendingEstimates.reduce((s, j) => s + estimateTotals(latestEstimate(j)!).total, 0);
  const payments = state.jobs.flatMap(j => j.payments.map(p => ({ ...p, job: j })));
  const todayCash = payments.filter(p => isoDay(p.at) === day).reduce((s, p) => s + p.amount, 0);
  const openBalance = state.jobs.filter(j => j.status !== 'İptal').reduce((s, j) => s + Math.max(0, balance(j)), 0);
  const ready = state.jobs.filter(j => j.status === 'Teslime hazır');

  const alerts: { tone: 'bad' | 'warn'; text: React.ReactNode; href: string }[] = [
    ...open.filter(overdue).map(j => ({ tone: 'bad' as const, text: <><b>{j.no}</b> tahmini teslim süresi geçti ({fmtDate(j.promisedAt)} {fmtTime(j.promisedAt)})</>, href: detailHref('/is-emirleri/detay', j.id) })),
    ...state.appointments.filter(a => a.status === 'Bekliyor').map(a => ({ tone: 'warn' as const, text: <><b>{a.no}</b> randevu talebi onay bekliyor · {fmtDate(a.date)} {a.time}</>, href: '/randevular?tarih=' + a.date })),
    ...open.flatMap(j => j.inspections.filter(i => i.result === 'Acil').length && latestEstimate(j)?.status !== 'Onaylandı' ? [{ tone: 'bad' as const, text: <><b>{j.no}</b> acil bulgu var: {j.inspections.find(i => i.result === 'Acil')!.item}</>, href: detailHref('/is-emirleri/detay', j.id) }] : []),
    ...open.filter(j => j.status === 'Parça bekliyor').map(j => ({ tone: 'warn' as const, text: <><b>{j.no}</b> parça bekliyor</>, href: detailHref('/is-emirleri/detay', j.id) })),
  ];

  const days = Array.from({ length: 14 }, (_, i) => addDays(day, i - 13));
  const series = days.map(d => ({ d, value: payments.filter(p => isoDay(p.at) === d).reduce((s, p) => s + p.amount, 0) }));
  const max = Math.max(...series.map(s => s.value), 1);
  const total14 = series.reduce((s, x) => s + x.value, 0);

  return <>
    <PageHeader title="Genel bakış" sub={`${state.settings.company.branch} · günlük operasyon özeti`}
      actions={<><Link href="/randevular" className="btn"><Icon name="calendar" size={15} />Takvim</Link><Link href="/is-emirleri?yeni=1" className="btn primary"><Icon name="plus" size={15} />Araç kabul</Link></>} />
    <div className="stats six">
      <Stat label="Bugünkü randevu" value={todays.length} foot={`${todays.filter(a => a.status === 'Bekliyor').length} talep onay bekliyor`} href="/randevular" />
      <Stat label="Atölyedeki araç" value={open.length} foot={`${open.filter(overdue).length} gecikmede`} tone={open.some(overdue) ? 'bad' : undefined} href="/atolye" />
      <Stat label="Onay bekleyen teklif" value={pendingEstimates.length} foot={money(pendingValue)} tone={pendingEstimates.length ? 'warn' : undefined} href="/teklifler" />
      <Stat label="Teslime hazır" value={ready.length} foot={money(ready.reduce((s, j) => s + Math.max(0, balance(j)), 0)) + ' tahsil edilecek'} href="/atolye" />
      <Stat label="Bugünkü tahsilat" value={moneyShort(todayCash)} foot={`${payments.filter(p => isoDay(p.at) === day).length} işlem`} href="/tahsilat" />
      <Stat label="Açık bakiye" value={moneyShort(openBalance)} foot="Onaylı iş − tahsilat" href="/tahsilat" />
    </div>

    <div className="grid-main">
      <Card title="Bugünün randevuları" sub={fmtDate(day, { day: 'numeric', month: 'long', weekday: 'long' })} flush actions={<Link className="btn sm" href="/randevular">Takvime git</Link>}>
        {todays.length ? <table className="table">
          <thead><tr><th>Saat</th><th>Araç</th><th className="hide-sm">Müşteri</th><th className="hide-sm">Hizmet / alan</th><th>Durum</th></tr></thead>
          <tbody>{todays.map(a => <tr key={a.id}>
            <td className="mono">{a.time}</td>
            <td><VehicleCell vehicle={v(a.vehicleId)} /></td>
            <td className="hide-sm">{c(a.customerId)?.name}</td>
            <td className="hide-sm"><span>{serviceName(state, a.serviceId)}</span><small className="cell-sub">{resourceName(state, a.resourceId)} · {a.duration} dk</small></td>
            <td><Status value={a.status} /></td>
          </tr>)}</tbody>
        </table> : <Empty icon="calendar" title="Bugün randevu yok" />}
      </Card>
      <Card title="Dikkat gerektirenler" sub={`${alerts.length} kayıt`} flush>
        {alerts.length ? <ul className="alert-list">{alerts.slice(0, 8).map((a, i) => <li key={i}><Link href={a.href}><span className={'dot ' + a.tone} /><span>{a.text}</span><Icon name="right" size={14} /></Link></li>)}</ul>
          : <Empty icon="check" title="Bekleyen uyarı yok" />}
      </Card>
    </div>

    <div className="grid-main">
      <Card title="Günlük tahsilat" sub={`Son 14 gün · toplam ${money(total14)}`}>
        <div className="bars" role="img" aria-label={`Son 14 günde toplam ${money(total14)} tahsilat`}>
          <div className="bars-grid"><span>{moneyShort(max)}</span><span>{moneyShort(max / 2)}</span><span>0 ₺</span></div>
          <div className="bars-plot">{series.map(s => <div key={s.d} className="bar-col" tabIndex={0}>
            <div className="bar" style={{ height: `${(s.value / max) * 100}%` }} />
            <span className="bar-tip">{fmtDate(s.d, { day: 'numeric', month: 'short', weekday: 'short' })}<b>{money(s.value)}</b></span>
            <span className="bar-x">{s.d === day ? 'Bugün' : fmtDate(s.d, { day: 'numeric' })}</span>
          </div>)}</div>
        </div>
      </Card>
      <Card title="Teknisyen iş yükü" sub="Açık iş emirleri" flush>
        <table className="table">
          <thead><tr><th>Teknisyen</th><th className="num">Açık</th><th className="num">İşlemde</th><th className="num">Bu ay teslim</th></tr></thead>
          <tbody>{technicians(state).map(t => {
            const tj = state.jobs.filter(j => j.technicianId === t.id);
            return <tr key={t.id}><td>{t.name}</td><td className="num">{tj.filter(j => openStatuses.includes(j.status)).length}</td><td className="num">{tj.filter(j => j.status === 'İşlemde').length}</td><td className="num">{tj.filter(j => j.deliveredAt && j.deliveredAt.slice(0, 7) === day.slice(0, 7)).length}</td></tr>;
          })}</tbody>
        </table>
      </Card>
    </div>

    <Card title="Atölyedeki iş emirleri" flush actions={<Link className="btn sm" href="/is-emirleri">Tümü</Link>}>
      <JobTable jobs={open} />
    </Card>
  </>;
}
