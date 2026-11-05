'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/store';
import { Button, Card, Empty, PageHeader, Search, Status } from '@/components/ui';
import { BrandMark, VehicleCell } from '@/components/vehicle-identity';
import { VehicleForm } from '@/components/forms';
import { can } from '@/lib/rules';
import { fmtDate, fold, normalizePlate, today } from '@/lib/format';

export default function VehiclesPage() {
  const { state, actor } = useApp();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [form, setForm] = useState(false);
  const term = fold(q.trim()), plate = normalizePlate(q);
  const rows = state.vehicles.filter(v => !term || normalizePlate(v.plate).includes(plate) || fold(`${v.brand} ${v.model} ${v.vin}`).includes(term) || fold(state.customers.find(c => c.id === v.customerId)?.name ?? '').includes(term));
  const staffCustomers = can(actor, 'customer.write');

  return <>
    <PageHeader title="Araçlar" sub={`${state.vehicles.length} kayıtlı araç`} actions={can(actor, 'vehicle.write') && <Button variant="primary" icon="plus" onClick={() => setForm(true)}>Yeni araç</Button>} />
    <div className="toolbar"><Search value={q} onChange={setQ} placeholder="Plaka, marka, model, şasi no veya sahip" /></div>
    <Card flush>{rows.length ? <div className="table-wrap"><table className="table">
      <thead><tr><th>Araç</th><th className="hide-sm">Marka</th><th className="hide-sm">Sahibi</th><th className="hide-sm">Yakıt</th><th className="hide-sm">Sonraki bakım</th><th>Durum</th></tr></thead>
      <tbody>{rows.map(v => {
        const owner = state.customers.find(c => c.id === v.customerId);
        const open = state.jobs.find(j => j.vehicleId === v.id && !['Teslim edildi', 'İptal'].includes(j.status));
        const due = (v.nextServiceDate && v.nextServiceDate <= today()) || (v.nextServiceKm && v.km >= v.nextServiceKm);
        return <tr key={v.id} className="row-link" onClick={() => router.push(`/araclar/${v.id}`)}>
          <td><VehicleCell vehicle={v} /></td>
          <td className="hide-sm"><BrandMark brand={v.brand} /></td>
          <td className="hide-sm">{staffCustomers && owner ? <Link href={`/musteriler/${owner.id}`} onClick={e => e.stopPropagation()}>{owner.name}</Link> : owner?.name}</td>
          <td className="hide-sm">{v.fuel} · {v.transmission}</td>
          <td className={'hide-sm ' + (due ? 'text-bad' : '')}>{v.nextServiceDate ? fmtDate(v.nextServiceDate) : '—'}{v.nextServiceKm && <small className="cell-sub">{v.nextServiceKm.toLocaleString('tr-TR')} km</small>}</td>
          <td>{open ? <Status value={open.status} /> : <span className="muted small">—</span>}</td>
        </tr>;
      })}</tbody>
    </table></div> : <Empty icon="car" title="Araç bulunamadı" />}</Card>
    {form && <VehicleForm open onClose={() => setForm(false)} />}
  </>;
}
