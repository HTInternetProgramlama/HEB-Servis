'use client';
import { detailHref } from '@/lib/routes';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/components/store';
import { Button, Card, FastTab, FilterBar, PageHeader, Search } from '@/components/ui';
import { JobTable, isLate } from '@/components/job-table';
import { IntakeForm } from '@/components/forms';
import { Icon } from '@/components/icons';
import { amountDue, balance, can, staffName, technicians } from '@/lib/rules';
import { fmtDate, fmtDateTime, fold, isoDay, normalizePlate, plateText } from '@/lib/format';
import type { Job, JobStatus } from '@/lib/types';

const openStatuses: JobStatus[] = ['Kabul edildi', 'İnceleniyor', 'Onay bekliyor', 'İşlemde', 'Parça bekliyor', 'Son kontrol', 'Teslime hazır'];
const filters: [string, string, (j: Job) => boolean][] = [
  ['acik', 'Açık iş emirleri', j => openStatuses.includes(j.status)],
  ['inceleme', 'Kabul / inceleme', j => ['Kabul edildi', 'İnceleniyor'].includes(j.status)],
  ['onay', 'Onay bekliyor', j => j.status === 'Onay bekliyor'],
  ['islemde', 'İşlemde', j => j.status === 'İşlemde'],
  ['parca', 'Parça bekliyor', j => j.status === 'Parça bekliyor'],
  ['kontrol', 'Son kontrol', j => j.status === 'Son kontrol'],
  ['hazir', 'Teslime hazır', j => j.status === 'Teslime hazır'],
  ['gecikme', 'Gecikmede', isLate],
  ['bakiye', 'Bakiyesi açık', j => j.status !== 'İptal' && balance(j) > 0],
  ['teslim', 'Teslim edildi', j => j.status === 'Teslim edildi'],
  ['iptal', 'İptal', j => j.status === 'İptal'],
  ['tumu', 'Tümü', () => true],
];

export default function Page() {
  return <Suspense><JobsPage /></Suspense>;
}

function JobsPage() {
  const { state, actor } = useApp();
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState('');
  const durum = filters.some(f => f[0] === sp.get('durum')) ? sp.get('durum')! : 'acik';
  const view = sp.get('gorunum') === 'durum' ? 'durum' : 'liste';
  const tech = actor.role === 'technician' ? (sp.get('benim') === '0' ? '' : actor.userId) : (sp.get('teknisyen') ?? '');
  const from = sp.get('bas') ?? '', to = sp.get('bit') ?? '';
  const intake = sp.get('yeni') === '1' && can(actor, 'job.create');

  function set(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === '') next.delete(k); else next.set(k, v) }
    const s = next.toString();
    router.replace('/is-emirleri' + (s ? '?' + s : ''), { scroll: false });
  }

  const term = fold(q.trim()), plate = normalizePlate(q);
  const test = filters.find(f => f[0] === durum)![2];
  const jobs = state.jobs.filter(j => {
    if (!test(j)) return false;
    if (tech && j.technicianId !== tech) return false;
    if (from && isoDay(j.createdAt) < from) return false;
    if (to && isoDay(j.createdAt) > to) return false;
    if (!term) return true;
    const v = state.vehicles.find(v => v.id === j.vehicleId), c = state.customers.find(c => c.id === j.customerId);
    return fold(j.no).includes(term) || (!!v && normalizePlate(v.plate).includes(plate)) || (!!c && fold(c.name).includes(term)) || fold(j.intake.complaint).includes(term);
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function exportCsv() {
    const head = ['İE No', 'Tarih', 'Plaka', 'Araç', 'Müşteri', 'Teknisyen', 'Durum', 'Teslim sözü', 'Onaylı tutar (TL)', 'Kalan (TL)'];
    const money = (k: number) => (k / 100).toFixed(2).replace('.', ',');
    const rows = jobs.map(j => {
      const v = state.vehicles.find(x => x.id === j.vehicleId);
      return [j.no, fmtDate(j.createdAt), v ? plateText(v.plate) : '', v ? `${v.brand} ${v.model}` : '', state.customers.find(c => c.id === j.customerId)?.name ?? '', staffName(state, j.technicianId), j.status, fmtDateTime(j.promisedAt), money(amountDue(j)), money(balance(j))];
    });
    const csv = '﻿' + [head, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `is-emirleri-${durum}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  const label = filters.find(f => f[0] === durum)![1];
  return <>
    <PageHeader title="İş Emirleri" sub={`${label} · ${jobs.length} kayıt${tech ? ` · ${staffName(state, tech)}` : ''}`}
      actions={<>
        {can(actor, 'job.create') && <Button variant="primary" icon="plus" onClick={() => set({ yeni: '1' })}>Yeni iş emri</Button>}
        <Button icon="download" onClick={exportCsv} disabled={!jobs.length}>Excel'e aktar</Button>
        <Button icon="printer" onClick={() => print()}>Listeyi yazdır</Button>
        <span className="action-sep" />
        <div className="seg small" role="group" aria-label="Görünüm">
          <button className={view === 'liste' ? 'active' : ''} onClick={() => set({ gorunum: null })}>Liste</button>
          <button className={view === 'durum' ? 'active' : ''} onClick={() => set({ gorunum: 'durum' })}>Duruma göre</button>
        </div>
      </>} />
    <FilterBar>
      <label className="filter-field">Durum
        <select className="select" value={durum} onChange={e => set({ durum: e.target.value === 'acik' ? null : e.target.value })}>
          {filters.map(([k, l, f]) => <option key={k} value={k}>{l} ({state.jobs.filter(j => f(j) && (!tech || j.technicianId === tech)).length})</option>)}
        </select></label>
      {actor.role === 'technician'
        ? <label className="check inline filter-check"><input type="checkbox" checked={!!tech} onChange={e => set({ benim: e.target.checked ? null : '0' })} /> Yalnız bana atananlar</label>
        : <label className="filter-field">Teknisyen
          <select className="select" value={tech} onChange={e => set({ teknisyen: e.target.value || null })}><option value="">Tümü</option>{technicians(state).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
      <label className="filter-field">Kabul tarihi
        <span className="date-range"><input type="date" className="date-input" value={from} max={to || undefined} onChange={e => set({ bas: e.target.value || null })} aria-label="Başlangıç" /><span>–</span><input type="date" className="date-input" value={to} min={from || undefined} onChange={e => set({ bit: e.target.value || null })} aria-label="Bitiş" /></span></label>
      {(durum !== 'acik' || (tech && actor.role !== 'technician') || from || to) && <button type="button" className="btn link sm" onClick={() => router.replace('/is-emirleri', { scroll: false })}><Icon name="x" size={13} />Filtreleri temizle</button>}
      <div className="toolbar-end"><Search value={q} onChange={setQ} placeholder="İE no, plaka, müşteri, şikâyet" /></div>
    </FilterBar>

    {view === 'liste' ? <Card flush><JobTable jobs={jobs} emptyText="Bu filtreye uyan iş emri yok" /></Card>
      : <div className="stack tight">{openStatuses.concat(durum === 'acik' ? [] : ['Teslim edildi', 'İptal'] as JobStatus[]).map(st => {
        const group = jobs.filter(j => j.status === st);
        if (!group.length) return null;
        return <FastTab key={st} title={st} summary={`${group.length} iş emri`} flush><JobTable jobs={group} /></FastTab>;
      })}{!jobs.length && <Card><p className="muted">Bu filtreye uyan iş emri yok.</p></Card>}</div>}

    {intake && <IntakeForm open onClose={() => set({ yeni: null })} onDone={id => router.push(detailHref('/is-emirleri/detay', id))} />}
  </>;
}
