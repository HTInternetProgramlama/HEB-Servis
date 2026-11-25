'use client';
import { detailHref } from '@/lib/routes';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from './store';
import { Empty, Status } from './ui';
import { Icon } from './icons';
import { Plate } from './vehicle-identity';
import { amountDue, balance, estimateTotals, latestEstimate, staffName } from '@/lib/rules';
import { fmtDate, fmtTime, money } from '@/lib/format';
import type { Job, State } from '@/lib/types';

type Key = 'no' | 'date' | 'plate' | 'vehicle' | 'customer' | 'tech' | 'status' | 'promised' | 'total' | 'balance';
const closed = ['Teslime hazır', 'Teslim edildi', 'İptal'];
export const isLate = (j: Job) => !closed.includes(j.status) && new Date(j.promisedAt).getTime() < Date.now();
const jobTotal = (j: Job) => amountDue(j) || (latestEstimate(j) ? estimateTotals(latestEstimate(j)!).total : 0);

function value(state: State, j: Job, k: Key): string | number {
  const v = state.vehicles.find(x => x.id === j.vehicleId);
  switch (k) {
    case 'no': return j.no;
    case 'date': return j.createdAt;
    case 'plate': return v?.plate ?? '';
    case 'vehicle': return v ? `${v.brand} ${v.model}` : '';
    case 'customer': return state.customers.find(c => c.id === j.customerId)?.name ?? '';
    case 'tech': return staffName(state, j.technicianId);
    case 'status': return j.status;
    case 'promised': return j.promisedAt;
    case 'total': return jobTotal(j);
    case 'balance': return balance(j);
  }
}

/** WIP tablosu: yoğun, başlığa tıklanarak sıralanır; satır iş emri belgesini açar. */
export function JobTable({ jobs, sortable = true, emptyText = 'Kayıt yok' }: { jobs: Job[]; sortable?: boolean; emptyText?: string }) {
  const { state, actor } = useApp();
  const router = useRouter();
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 } | null>(null);
  if (!jobs.length) return <Empty icon="wrench" title={emptyText} />;
  const money_ = actor.role !== 'technician';
  const rows = sort ? [...jobs].sort((a, b) => {
    const x = value(state, a, sort.key), y = value(state, b, sort.key);
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'tr')) * sort.dir;
  }) : jobs;
  const th = (k: Key, label: string, cls = '') => <th className={cls} aria-sort={sort?.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
    {sortable ? <button type="button" className="th-sort" onClick={() => setSort(s => s?.key === k ? { key: k, dir: (s.dir * -1) as 1 | -1 } : { key: k, dir: 1 })}>
      {label}<Icon name={sort?.key === k ? (sort.dir === 1 ? 'down' : 'up') : 'sort'} size={11} />
    </button> : label}
  </th>;
  return <div className="table-wrap"><table className="table dense">
    <thead><tr>
      {th('no', 'İE No')}{th('date', 'Tarih', 'hide-sm')}{th('plate', 'Plaka')}{th('vehicle', 'Araç', 'hide-md')}{th('customer', 'Müşteri', 'hide-sm')}
      {th('tech', 'Teknisyen', 'hide-md')}{th('status', 'Durum')}{th('promised', 'Teslim sözü', 'hide-sm')}
      {money_ && th('total', 'Tutar', 'num hide-sm')}{money_ && th('balance', 'Kalan', 'num')}
    </tr></thead>
    <tbody>{rows.map(j => {
      const v = state.vehicles.find(x => x.id === j.vehicleId);
      const late = isLate(j);
      const due = amountDue(j), bal = balance(j);
      return <tr key={j.id} className="row-link" onClick={e => { if (!(e.target as HTMLElement).closest('a')) router.push(detailHref('/is-emirleri/detay', j.id)) }}>
        <td><Link href={detailHref('/is-emirleri/detay', j.id)} className="mono strong">{j.no}</Link></td>
        <td className="hide-sm nowrap">{fmtDate(j.createdAt)}</td>
        <td>{v ? <Plate value={v.plate} size="sm" /> : '—'}</td>
        <td className="hide-md">{v ? `${v.brand} ${v.model}` : '—'}</td>
        <td className="hide-sm">{state.customers.find(c => c.id === j.customerId)?.name}</td>
        <td className="hide-md">{staffName(state, j.technicianId)}</td>
        <td><Status value={j.status} />{late && <span className="flag bad" title="Söz verilen teslim zamanı geçti">Gecikme</span>}</td>
        <td className={'hide-sm nowrap ' + (late ? 'text-bad' : '')}>{fmtDate(j.promisedAt, { day: '2-digit', month: '2-digit' })} {fmtTime(j.promisedAt)}</td>
        {money_ && <td className="num hide-sm">{due ? money(due) : jobTotal(j) ? <span className="muted" title="Onaylanmamış teklif tutarı">{money(jobTotal(j))}</span> : '—'}</td>}
        {money_ && <td className={'num ' + (bal > 0 ? 'strong' : 'muted')}>{bal > 0 ? money(bal) : '—'}</td>}
      </tr>;
    })}</tbody>
  </table></div>;
}
