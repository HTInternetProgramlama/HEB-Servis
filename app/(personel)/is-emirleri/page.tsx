'use client';
import { detailHref, pagesBasePath } from '@/lib/routes';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/store';
import { Button, Card, PageHeader, Search } from '@/components/ui';
import { JobTable } from '@/components/job-table';
import { IntakeForm } from '@/components/forms';
import { can } from '@/lib/rules';
import { fold, normalizePlate } from '@/lib/format';
import type { JobStatus } from '@/lib/types';

const groups: [string, JobStatus[] | null][] = [
  ['Açık', ['Kabul edildi', 'İnceleniyor', 'Onay bekliyor', 'İşlemde', 'Parça bekliyor', 'Son kontrol', 'Teslime hazır']],
  ['Onay bekliyor', ['Onay bekliyor']],
  ['Teslime hazır', ['Teslime hazır']],
  ['Teslim edildi', ['Teslim edildi']],
  ['İptal', ['İptal']],
  ['Tümü', null],
];

export default function JobsPage() {
  const { state, actor } = useApp();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState(0);
  const [intake, setIntake] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('yeni') === '1' && can(actor, 'job.create')) setIntake(true);
    if (params.get('durum') === 'teslim') setGroup(3);
  }, [actor]);

  const term = fold(q.trim()), plate = normalizePlate(q);
  const filter = groups[group][1];
  const jobs = state.jobs.filter(j => {
    if (filter && !filter.includes(j.status)) return false;
    if (actor.role === 'technician' && j.technicianId !== actor.userId) return false;
    if (!term) return true;
    const v = state.vehicles.find(v => v.id === j.vehicleId), c = state.customers.find(c => c.id === j.customerId);
    return fold(j.no).includes(term) || (!!v && normalizePlate(v.plate).includes(plate)) || (!!c && fold(c.name).includes(term)) || fold(j.intake.complaint).includes(term);
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return <>
    <PageHeader title="İş emirleri" sub="Kabulden teslime tüm servis kayıtları"
      actions={can(actor, 'job.create') && <Button variant="primary" icon="plus" onClick={() => setIntake(true)}>Randevusuz araç kabul</Button>} />
    <div className="toolbar">
      <div className="seg">{groups.map(([label, st], i) => <button key={label} className={group === i ? 'active' : ''} onClick={() => setGroup(i)}>{label}<span className="seg-count">{state.jobs.filter(j => !st || st.includes(j.status)).length}</span></button>)}</div>
      {actor.role === 'technician' && <span className="small muted">Yalnız size atanan işler gösteriliyor.</span>}
      <div className="toolbar-end"><Search value={q} onChange={setQ} placeholder="İş emri, plaka, müşteri, şikâyet" /></div>
    </div>
    <Card flush><JobTable jobs={jobs} /></Card>
    {intake && <IntakeForm open onClose={() => { setIntake(false); history.replaceState(null, '', pagesBasePath + '/is-emirleri/') }} onDone={id => router.push(detailHref('/is-emirleri/detay', id))} />}
  </>;
}
