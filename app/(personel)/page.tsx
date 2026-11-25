'use client';
import { detailHref } from '@/lib/routes';
import { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/store';
import { Avatar, PageHeader, Stat } from '@/components/ui';
import { Icon } from '@/components/icons';
import { CarImage, Plate } from '@/components/vehicle-identity';
import { amountDue, balance, can, dueReminders, estimateTotals, latestEstimate, staffName, technicians } from '@/lib/rules';
import { fmtDate, fmtTime, isoDay, money, today } from '@/lib/format';
import type { Job, JobStatus } from '@/lib/types';

/** Panodaki 5 ana durum. "Parça bekliyor" ve "Son kontrol" ayrı sütun değil, Serviste kartında etikettir. */
const columns: { key: string; title: string; statuses: JobStatus[] }[] = [
  { key: 'intake', title: 'Kabul / Teklif', statuses: ['Kabul edildi', 'İnceleniyor'] },
  { key: 'approval', title: 'Onay bekliyor', statuses: ['Onay bekliyor'] },
  { key: 'work', title: 'Serviste', statuses: ['İşlemde', 'Parça bekliyor', 'Son kontrol'] },
  { key: 'ready', title: 'Hazır', statuses: ['Teslime hazır'] },
  { key: 'done', title: 'Teslim (bugün)', statuses: ['Teslim edildi'] },
];

export default function Board() {
  const { state, actor } = useApp();
  const isTech = actor.role === 'technician';
  const [tech, setTech] = useState(isTech ? actor.userId : '');
  const day = today();
  const showMoney = can(actor, 'payment.read');
  const jobs = state.jobs.filter(j => (!tech || j.technicianId === tech) && (j.status !== 'Teslim edildi' || (!!j.deliveredAt && isoDay(j.deliveredAt) === day)));
  const of = (st: JobStatus[]) => jobs.filter(j => st.includes(j.status));
  const late = (j: Job) => !['Teslime hazır', 'Teslim edildi', 'İptal'].includes(j.status) && new Date(j.promisedAt).getTime() < Date.now();
  const open = jobs.filter(j => !['Teslim edildi', 'İptal'].includes(j.status));
  const deliveredToday = of(['Teslim edildi']).length;

  const notes: { href: string; text: string; tone?: 'bad' | 'warn' }[] = [];
  if (!isTech) {
    const requests = state.appointments.filter(a => a.status === 'Bekliyor').length;
    const reminders = can(actor, 'reminder.write') ? dueReminders(state).filter(r => !r.hasAppointment).length : 0;
    const openBalance = state.jobs.filter(j => j.status !== 'İptal').reduce((s, j) => s + Math.max(0, balance(j)), 0);
    if (open.some(late)) notes.push({ href: '/is-emirleri?filtre=gecikme', text: `${open.filter(late).length} iş söz verilen saati geçti`, tone: 'bad' });
    if (requests) notes.push({ href: '/randevular', text: `${requests} randevu talebi onay bekliyor`, tone: 'warn' });
    if (reminders) notes.push({ href: '/hatirlatmalar', text: `${reminders} araç bakım hatırlatması bekliyor` });
    if (showMoney && openBalance > 0) notes.push({ href: '/is-emirleri?filtre=bakiye', text: `Açık bakiye ${money(openBalance)}` });
  }

  return <>
    <PageHeader title={isTech ? 'Panom' : 'Pano'}
      actions={<>
        {!isTech && <select className="select" value={tech} onChange={e => setTech(e.target.value)} aria-label="Teknisyen"><option value="">Tüm teknisyenler</option>{technicians(state).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
        <div className="seg" role="tablist" aria-label="Görünüm"><button className="active" role="tab" aria-selected>Pano</button><Link href="/is-emirleri" role="tab" aria-selected={false}>Liste</Link></div>
      </>} />

    <div className="stats">
      <Stat label="Bugün kabul" value={jobs.filter(j => isoDay(j.createdAt) === day).length} href="/is-emirleri" />
      <Stat label="Onay bekleyen" value={of(['Onay bekliyor']).length} tone={of(['Onay bekliyor']).length ? 'warn' : undefined} href="/is-emirleri?filtre=onay" />
      <Stat label="Serviste" value={of(columns[2].statuses).length} foot={of(['Parça bekliyor']).length ? `${of(['Parça bekliyor']).length} parça bekliyor` : undefined} href="/is-emirleri?filtre=serviste" />
      <Stat label="Teslime hazır" value={of(['Teslime hazır']).length} tone={of(['Teslime hazır']).length ? 'ok' : undefined} href="/is-emirleri?filtre=hazir" />
    </div>

    {notes.length > 0 && <ul className="pano-notes">{notes.map(n => <li key={n.href}><Link href={n.href}><span className={'dot ' + (n.tone ?? '')} />{n.text}<Icon name="right" size={13} /></Link></li>)}</ul>}

    <div className="kanban">
      {columns.map(col => {
        const items = of(col.statuses).sort((a, b) => a.promisedAt.localeCompare(b.promisedAt));
        return <section key={col.key} className={'kb-col kb-' + col.key} aria-label={col.title}>
          <header><span className="kb-dot" />{col.title}<em>{items.length}</em></header>
          <div className="kb-items">
            {items.map(j => <JobCard key={j.id} job={j} late={late(j)} showMoney={showMoney} />)}
            {!items.length && <p className="kb-empty">Boş</p>}
          </div>
        </section>;
      })}
    </div>
    <p className="kb-done-note"><Link href="/is-emirleri?filtre=teslim">Bugün {deliveredToday} araç teslim edildi</Link></p>
  </>;
}

function JobCard({ job: j, late, showMoney }: { job: Job; late: boolean; showMoney: boolean }) {
  const { state } = useApp();
  const v = state.vehicles.find(x => x.id === j.vehicleId);
  const c = state.customers.find(x => x.id === j.customerId);
  const tech = staffName(state, j.technicianId);
  const latest = latestEstimate(j);
  const amount = amountDue(j) || (latest ? estimateTotals(latest).total : 0);
  const urgent = j.inspections.some(i => i.result === 'Acil') && latest?.status !== 'Onaylandı' && !['Teslime hazır', 'Teslim edildi'].includes(j.status);
  const when = isoDay(j.promisedAt) === today() ? fmtTime(j.promisedAt) : fmtDate(j.promisedAt, { day: '2-digit', month: '2-digit' }) + ' ' + fmtTime(j.promisedAt);
  const tags: [string, string][] = [];
  if (j.status === 'Parça bekliyor') tags.push(['Parça bekliyor', 'orange']);
  if (j.status === 'Son kontrol') tags.push(['Son kontrol', 'blue']);
  if (j.status === 'Kabul edildi') tags.push(['Muayene bekliyor', 'slate']);
  if (j.status === 'İnceleniyor' && latest?.status === 'Taslak') tags.push(['Teklif taslağı', 'slate']);
  if (urgent) tags.push(['Acil bulgu', 'red']);
  if (late) tags.push(['Gecikti', 'red']);
  return <Link href={detailHref('/is-emirleri/detay', j.id)} className={'job-card ' + (late ? 'late' : '')}>
    <div className="jc-head">{v ? <Plate value={v.plate} /> : <span className="mono">{j.no}</span>}<span className="jc-tech" title={`Teknisyen: ${tech}`}><Avatar name={tech} size={22} /></span></div>
    <div className="jc-main">
      {v && <span className="jc-art" aria-hidden="true"><CarImage vehicle={v} /></span>}
      <div className="jc-text"><strong title={v ? `${v.brand} ${v.model}` : undefined}>{v ? `${v.brand} ${v.model}` : '—'}</strong><span>{c?.name}</span><small className="jc-no">{j.no}</small></div>
    </div>
    {tags.length > 0 && <div className="jc-tags">{tags.map(([t, tone]) => <span key={t} className={'tag ' + tone}>{t}</span>)}</div>}
    <div className="jc-foot">
      <span className={'jc-time ' + (late ? 'text-bad' : '')}><Icon name="clock" size={12} />{j.status === 'Teslim edildi' && j.deliveredAt ? fmtTime(j.deliveredAt) : when}</span>
      {showMoney && amount > 0 && <b className="jc-amount">{money(amount)}</b>}
    </div>
  </Link>;
}
