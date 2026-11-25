'use client';
import { detailHref, pagesBasePath } from '@/lib/routes';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/components/store';
import { Card, PageHeader, Search } from '@/components/ui';
import { JobTable } from '@/components/job-table';
import { IntakeForm } from '@/components/forms';
import { PaymentForm } from '@/components/payment';
import { balance, can, latestEstimate, technicians } from '@/lib/rules';
import { fold, normalizePlate } from '@/lib/format';
import type { Job, JobStatus } from '@/lib/types';

const OPEN: JobStatus[] = ['Kabul edildi', 'İnceleniyor', 'Onay bekliyor', 'İşlemde', 'Parça bekliyor', 'Son kontrol', 'Teslime hazır'];
const isLate = (j: Job) => !['Teslime hazır', 'Teslim edildi', 'İptal'].includes(j.status) && new Date(j.promisedAt).getTime() < Date.now();

/** Filtreler: eski "Teklif onayları" (onay) ve "Tahsilat > açık bakiyeler" (bakiye) burada. */
const filters: { key: string; label: string; test: (j: Job) => boolean; money?: boolean }[] = [
  { key: 'acik', label: 'Açık', test: j => OPEN.includes(j.status) },
  { key: 'onay', label: 'Onay bekliyor', test: j => j.status === 'Onay bekliyor' || latestEstimate(j)?.status === 'Gönderildi' },
  { key: 'serviste', label: 'Serviste', test: j => ['İşlemde', 'Parça bekliyor', 'Son kontrol'].includes(j.status) },
  { key: 'hazir', label: 'Hazır', test: j => j.status === 'Teslime hazır' },
  { key: 'gecikme', label: 'Gecikenler', test: isLate },
  { key: 'bakiye', label: 'Açık bakiye', test: j => j.status !== 'İptal' && balance(j) > 0, money: true },
  { key: 'teslim', label: 'Teslim edildi', test: j => j.status === 'Teslim edildi' },
  { key: 'iptal', label: 'İptal', test: j => j.status === 'İptal' },
  { key: 'tumu', label: 'Tümü', test: () => true },
];

export default function Page() {
  return <Suspense><JobsPage /></Suspense>;
}

function JobsPage() {
  const { state, actor } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const isTech = actor.role === 'technician';
  const [tech, setTech] = useState(isTech ? actor.userId : '');
  const [intake, setIntake] = useState(false);
  const [pay, setPay] = useState<Job | null>(null);
  useEffect(() => { if (params.get('yeni') === '1' && can(actor, 'job.create')) setIntake(true) }, [actor, params]);

  const visible = filters.filter(f => !f.money || can(actor, 'payment.read'));
  const filter = visible.find(f => f.key === params.get('filtre')) ?? visible[0];
  const term = fold(q.trim()), plate = normalizePlate(q);
  const scoped = state.jobs.filter(j => !tech || j.technicianId === tech);
  const jobs = scoped.filter(j => {
    if (!filter.test(j)) return false;
    if (!term) return true;
    const v = state.vehicles.find(v => v.id === j.vehicleId), c = state.customers.find(c => c.id === j.customerId);
    return fold(j.no).includes(term) || (!!v && !!plate && normalizePlate(v.plate).includes(plate)) || (!!c && fold(c.name).includes(term)) || fold(j.intake.complaint).includes(term);
  }).sort((a, b) => filter.key === 'onay' ? (latestEstimate(a)?.sentAt ?? '').localeCompare(latestEstimate(b)?.sentAt ?? '') : b.createdAt.localeCompare(a.createdAt));

  return <>
    <PageHeader title="İş Emirleri"
      actions={<div className="seg" role="tablist" aria-label="Görünüm"><Link href="/" role="tab" aria-selected={false}>Pano</Link><button className="active" role="tab" aria-selected>Liste</button></div>} />
    <div className="toolbar">
      <div className="chips" role="tablist" aria-label="Filtre">{visible.map(f => {
        const n = scoped.filter(f.test).length;
        return <button key={f.key} role="tab" aria-selected={f === filter} className={'chip ' + (f === filter ? 'on' : '')} onClick={() => router.replace(`/is-emirleri?filtre=${f.key}`, { scroll: false })}>{f.label}{f.key !== 'tumu' && <span className="chip-count">{n}</span>}</button>;
      })}</div>
    </div>
    <div className="toolbar">
      {!isTech ? <select className="select" value={tech} onChange={e => setTech(e.target.value)} aria-label="Teknisyen"><option value="">Tüm teknisyenler</option>{technicians(state).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        : <label className="check inline"><input type="checkbox" checked={!!tech} onChange={e => setTech(e.target.checked ? actor.userId : '')} /> Yalnız bana atananlar</label>}
      <div className="toolbar-end"><Search value={q} onChange={setQ} placeholder="Plaka, iş emri no, müşteri" /></div>
    </div>
    <Card flush><JobTable jobs={jobs} mode={filter.key === 'onay' ? 'estimate' : filter.key === 'bakiye' ? 'balance' : undefined} onPay={setPay} empty={filter.key === 'onay' ? 'Onay bekleyen teklif yok' : filter.key === 'bakiye' ? 'Açık bakiye yok' : 'Kayıt yok'} /></Card>
    {intake && <IntakeForm open onClose={() => { setIntake(false); history.replaceState(null, '', pagesBasePath + '/is-emirleri/') }} onDone={id => router.push(detailHref('/is-emirleri/detay', id))} />}
    {pay && <PaymentForm open job={pay} onClose={() => setPay(null)} />}
  </>;
}
