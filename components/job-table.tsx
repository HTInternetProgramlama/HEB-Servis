'use client';
import { detailHref } from '@/lib/routes';
import Link from 'next/link';
import { useApp } from './store';
import { Empty, Status } from './ui';
import { VehicleCell } from './vehicle-identity';
import { amountDue, estimateTotals, latestEstimate, serviceName, staffName } from '@/lib/rules';
import { fmtDate, fmtTime, money } from '@/lib/format';
import type { Job } from '@/lib/types';

export function JobTable({ jobs }: { jobs: Job[] }) {
  const { state, actor } = useApp();
  if (!jobs.length) return <Empty icon="wrench" title="Açık iş emri yok" />;
  return <div className="table-wrap"><table className="table">
    <thead><tr><th>İş emri</th><th>Araç</th><th className="hide-sm">Müşteri</th><th className="hide-sm">Teknisyen</th><th>Durum</th><th className="hide-sm">Tahmini teslim</th>{actor.role !== 'technician' && <th className="num hide-sm">Tutar</th>}</tr></thead>
    <tbody>{jobs.map(j => {
      const late = !['Teslime hazır', 'Teslim edildi', 'İptal'].includes(j.status) && new Date(j.promisedAt).getTime() < Date.now();
      return <tr key={j.id} className="row-link">
        <td><Link href={detailHref('/is-emirleri/detay', j.id)} className="mono strong">{j.no}</Link><small className="cell-sub">{serviceName(state, j.serviceId)}</small></td>
        <td><VehicleCell vehicle={state.vehicles.find(v => v.id === j.vehicleId)} /></td>
        <td className="hide-sm">{state.customers.find(c => c.id === j.customerId)?.name}</td>
        <td className="hide-sm">{staffName(state, j.technicianId)}</td>
        <td><Status value={j.status} /></td>
        <td className={'hide-sm ' + (late ? 'text-bad' : '')}>{fmtDate(j.promisedAt, { day: '2-digit', month: '2-digit' })} {fmtTime(j.promisedAt)}{late && <small className="cell-sub text-bad">Gecikmede</small>}</td>
        {actor.role !== 'technician' && <td className="num hide-sm">{amountDue(j) ? money(amountDue(j)) : latestEstimate(j) ? <span className="muted">{money(estimateTotals(latestEstimate(j)!).total)}</span> : '—'}</td>}
      </tr>;
    })}</tbody>
  </table></div>;
}
