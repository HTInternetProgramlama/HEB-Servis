'use client';
import { detailHref } from '@/lib/routes';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from './store';
import { Button, Empty, Status } from './ui';
import { VehicleCell } from './vehicle-identity';
import { amountDue, amountPaid, balance, can, estimateTotals, latestEstimate, staffName } from '@/lib/rules';
import { fmtDate, fmtDateTime, fmtTime, money } from '@/lib/format';
import type { Job } from '@/lib/types';

/**
 * İş emri listesi. `mode` filtreye özgü sütunları açar:
 * estimate → teklif sürümü, gönderim ve bekleme süresi (eski "Teklif onayları" sayfası);
 * balance → onaylı tutar, tahsil edilen ve kalan (eski "Tahsilat > Açık bakiyeler").
 */
export function JobTable({ jobs, mode, onPay, empty = 'Kayıt yok' }: { jobs: Job[]; mode?: 'estimate' | 'balance'; onPay?: (job: Job) => void; empty?: string }) {
  const { state, actor } = useApp();
  const router = useRouter();
  if (!jobs.length) return <Empty icon="wrench" title={empty} />;
  const money_ = actor.role !== 'technician';
  const hours = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 3600000);
  return <div className="table-wrap"><table className="table">
    <thead><tr>
      <th>Araç</th><th className="hide-sm">Müşteri</th><th>Durum</th>
      {mode === 'estimate' ? <><th className="hide-sm">Teklif</th><th className="hide-sm">Gönderim</th></>
        : mode === 'balance' ? <><th className="num hide-sm">Onaylı</th><th className="num hide-sm">Tahsil</th></>
        : <><th className="hide-sm">Teknisyen</th><th className="hide-sm">Söz verilen</th></>}
      {money_ && <th className="num">{mode === 'balance' ? 'Kalan' : 'Tutar'}</th>}
      {mode === 'balance' && onPay && <th />}
    </tr></thead>
    <tbody>{jobs.map(j => {
      const late = !['Teslime hazır', 'Teslim edildi', 'İptal'].includes(j.status) && new Date(j.promisedAt).getTime() < Date.now();
      const e = latestEstimate(j);
      const href = detailHref('/is-emirleri/detay', j.id);
      return <tr key={j.id} className="row-link" onClick={() => router.push(href)}>
        <td><Link href={href} onClick={ev => ev.stopPropagation()} className="plain-link"><VehicleCell vehicle={state.vehicles.find(v => v.id === j.vehicleId)} sub={<span className="mono">{j.no}</span>} /></Link></td>
        <td className="hide-sm">{state.customers.find(c => c.id === j.customerId)?.name}</td>
        <td><Status value={j.status} />{late && <small className="cell-sub text-bad">Gecikti</small>}</td>
        {mode === 'estimate' ? <>
          <td className="hide-sm">{e ? <>v{e.version} <Status value={e.status} /></> : '—'}</td>
          <td className="hide-sm small">{e?.sentAt ? <>{fmtDateTime(e.sentAt)}{e.status === 'Gönderildi' && <small className={'cell-sub ' + (hours(e.sentAt) > 24 ? 'text-bad' : '')}>{hours(e.sentAt)} saattir bekliyor</small>}</> : '—'}</td>
        </> : mode === 'balance' ? <>
          <td className="num hide-sm">{money(amountDue(j))}</td>
          <td className="num hide-sm">{money(amountPaid(j))}</td>
        </> : <>
          <td className="hide-sm">{staffName(state, j.technicianId)}</td>
          <td className={'hide-sm ' + (late ? 'text-bad' : '')}>{fmtDate(j.promisedAt, { day: '2-digit', month: '2-digit' })} {fmtTime(j.promisedAt)}</td>
        </>}
        {money_ && <td className={'num ' + (mode === 'balance' ? 'strong text-bad' : '')}>{mode === 'balance' ? money(balance(j)) : amountDue(j) ? money(amountDue(j)) : e ? <span className="muted">{money(estimateTotals(e).total)}</span> : '—'}</td>}
        {mode === 'balance' && onPay && <td className="actions">{can(actor, 'payment.write') && <Button size="sm" onClick={ev => { ev.stopPropagation(); onPay(j) }}>Tahsil et</Button>}</td>}
      </tr>;
    })}</tbody>
  </table></div>;
}
