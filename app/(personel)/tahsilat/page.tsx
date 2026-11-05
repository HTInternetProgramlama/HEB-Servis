'use client';
import { detailHref } from '@/lib/routes';
import { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/store';
import { Button, Card, Empty, PageHeader, Stat } from '@/components/ui';
import { PaymentForm } from '@/components/payment';
import { VehicleCell } from '@/components/vehicle-identity';
import { amountDue, amountPaid, balance, can } from '@/lib/rules';
import { addDays, daysBetween, fmtDate, fmtDateTime, isoDay, money, today } from '@/lib/format';
import type { Job } from '@/lib/types';

export default function PaymentsPage() {
  const { state, actor } = useApp();
  const [from, setFrom] = useState(addDays(today(), -29));
  const [to, setTo] = useState(today());
  const [pay, setPay] = useState<Job | null>(null);
  const payments = state.jobs.flatMap(j => j.payments.map(p => ({ p, j }))).filter(({ p }) => isoDay(p.at) >= from && isoDay(p.at) <= to).sort((a, b) => b.p.at.localeCompare(a.p.at));
  const total = payments.reduce((s, x) => s + x.p.amount, 0);
  const byMethod = (['Nakit', 'Kredi kartı', 'Havale/EFT'] as const).map(m => [m, payments.filter(x => x.p.method === m).reduce((s, x) => s + x.p.amount, 0)] as const);
  const open = state.jobs.filter(j => j.status !== 'İptal' && balance(j) > 0).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return <>
    <PageHeader title="Tahsilat" sub="İşlem tutarı ve tahsilat ayrı izlenir. Bu ekran kayıt tutar; çevrim içi ödeme almaz." />
    <div className="toolbar">
      <label className="inline-field">Başlangıç<input type="date" value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} /></label>
      <label className="inline-field">Bitiş<input type="date" value={to} min={from} onChange={e => e.target.value && setTo(e.target.value)} /></label>
    </div>
    <div className="stats">
      <Stat label="Dönem tahsilatı" value={money(total)} foot={`${payments.length} işlem`} />
      {byMethod.map(([m, v]) => <Stat key={m} label={m} value={money(v)} foot={total ? `%${Math.round(v / total * 100)}` : '—'} />)}
    </div>
    <Card title="Açık bakiyeler" sub={`${open.length} iş emri · toplam ${money(open.reduce((s, j) => s + balance(j), 0))}`} flush>
      {open.length ? <div className="table-wrap"><table className="table">
        <thead><tr><th>İş emri</th><th>Araç</th><th className="hide-sm">Müşteri</th><th className="hide-sm">Durum</th><th className="num hide-sm">Onaylı tutar</th><th className="num hide-sm">Tahsil</th><th className="num">Kalan</th><th /></tr></thead>
        <tbody>{open.map(j => {
          const c = state.customers.find(c => c.id === j.customerId);
          const age = j.deliveredAt ? daysBetween(isoDay(j.deliveredAt), today()) : null;
          return <tr key={j.id}>
            <td><Link className="mono strong" href={detailHref('/is-emirleri/detay', j.id)}>{j.no}</Link></td>
            <td><VehicleCell vehicle={state.vehicles.find(v => v.id === j.vehicleId)} /></td>
            <td className="hide-sm">{c?.name}<small className="cell-sub">{c?.phone}</small></td>
            <td className="hide-sm">{j.status}{age !== null && <small className="cell-sub text-bad">Teslimden {age} gün sonra açık</small>}</td>
            <td className="num hide-sm">{money(amountDue(j))}</td><td className="num hide-sm">{money(amountPaid(j))}</td><td className="num strong text-bad">{money(balance(j))}</td>
            <td className="actions">{can(actor, 'payment.write') && <Button size="sm" onClick={() => setPay(j)}>Tahsil et</Button>}</td>
          </tr>;
        })}</tbody>
      </table></div> : <Empty icon="check" title="Açık bakiye yok" />}
    </Card>
    <Card title="Tahsilat hareketleri" sub={`${fmtDate(from)} – ${fmtDate(to)}`} flush>
      {payments.length ? <div className="table-wrap"><table className="table">
        <thead><tr><th>Tarih</th><th>İş emri</th><th className="hide-sm">Müşteri</th><th>Yöntem</th><th className="hide-sm">Kaydeden</th><th className="num">Tutar</th></tr></thead>
        <tbody>{payments.map(({ p, j }) => <tr key={p.id}><td>{fmtDateTime(p.at)}</td><td><Link className="mono" href={detailHref('/is-emirleri/detay', j.id)}>{j.no}</Link></td><td className="hide-sm">{state.customers.find(c => c.id === j.customerId)?.name}</td><td>{p.method}{p.note && <small className="cell-sub">{p.note}</small>}</td><td className="hide-sm">{p.by}</td><td className="num strong">{money(p.amount)}</td></tr>)}</tbody>
        <tfoot><tr><td colSpan={5}>Toplam</td><td className="num strong">{money(total)}</td></tr></tfoot>
      </table></div> : <Empty icon="wallet" title="Bu aralıkta tahsilat yok" />}
    </Card>
    {pay && <PaymentForm open job={pay} onClose={() => setPay(null)} />}
  </>;
}
