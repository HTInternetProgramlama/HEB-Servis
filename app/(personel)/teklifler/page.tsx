'use client';
import { detailHref } from '@/lib/routes';
import Link from 'next/link';
import { useApp } from '@/components/store';
import { Card, Empty, PageHeader, Status } from '@/components/ui';
import { VehicleCell } from '@/components/vehicle-identity';
import { estimateTotals, latestEstimate } from '@/lib/rules';
import { fmtDateTime, money } from '@/lib/format';

export default function EstimatesPage() {
  const { state } = useApp();
  const rows = state.jobs.flatMap(j => j.estimates.filter(e => e.status !== 'Taslak').map(e => ({ j, e })));
  const waiting = state.jobs.filter(j => latestEstimate(j)?.status === 'Gönderildi').map(j => ({ j, e: latestEstimate(j)! }));
  const drafts = state.jobs.filter(j => latestEstimate(j)?.status === 'Taslak' && !['İptal'].includes(j.status)).map(j => ({ j, e: latestEstimate(j)! }));
  const decided = rows.filter(r => r.e.decision).sort((a, b) => b.e.decision!.at.localeCompare(a.e.decision!.at)).slice(0, 15);
  const hours = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 3600000);

  const Table = ({ list, mode }: { list: typeof rows; mode: 'wait' | 'draft' | 'done' }) => <div className="table-wrap"><table className="table">
    <thead><tr><th>İş emri</th><th>Araç</th><th className="hide-sm">Müşteri</th><th>Sürüm</th><th className="hide-sm">{mode === 'wait' ? 'Gönderim' : mode === 'draft' ? 'Oluşturma' : 'Karar'}</th><th className="num">Toplam</th></tr></thead>
    <tbody>{list.map(({ j, e }) => <tr key={e.id}>
      <td><Link className="mono strong" href={detailHref('/is-emirleri/detay', j.id)}>{j.no}</Link></td>
      <td><VehicleCell vehicle={state.vehicles.find(v => v.id === j.vehicleId)} /></td>
      <td className="hide-sm">{state.customers.find(c => c.id === j.customerId)?.name}<small className="cell-sub">{state.customers.find(c => c.id === j.customerId)?.phone}</small></td>
      <td>v{e.version} <Status value={e.status} /></td>
      <td className="hide-sm small">{mode === 'wait' ? <>{fmtDateTime(e.sentAt)}<small className={'cell-sub ' + (hours(e.sentAt!) > 24 ? 'text-bad' : '')}>{hours(e.sentAt!)} saattir bekliyor</small></> : mode === 'draft' ? fmtDateTime(e.createdAt) : <>{e.decision!.channel} · {e.decision!.by}<small className="cell-sub">{fmtDateTime(e.decision!.at)}</small></>}</td>
      <td className="num strong">{money(estimateTotals(e).total)}</td>
    </tr>)}</tbody>
  </table></div>;

  return <>
    <PageHeader title="Teklif onayları" sub="Müşteri kararı bekleyen ve hazırlanmakta olan teklifler. Karar her zaman güncel sürüm için kaydedilir." />
    <Card title="Müşteri kararı bekleyen" sub={`${waiting.length} teklif · ${money(waiting.reduce((s, r) => s + estimateTotals(r.e).total, 0))}`} flush>{waiting.length ? <Table list={waiting} mode="wait" /> : <Empty icon="check" title="Bekleyen teklif yok" />}</Card>
    <Card title="Hazırlanan taslaklar" flush>{drafts.length ? <Table list={drafts} mode="draft" /> : <Empty icon="receipt" title="Taslak yok" />}</Card>
    <Card title="Son kararlar" flush>{decided.length ? <Table list={decided} mode="done" /> : <Empty icon="receipt" title="Karar kaydı yok" />}</Card>
  </>;
}
