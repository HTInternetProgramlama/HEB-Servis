'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApp } from '@/components/store';
import { Button, Card, Empty, KV, PageHeader, Status } from '@/components/ui';
import { BrandMark, CarDrawing, Plate } from '@/components/vehicle-identity';
import { AppointmentForm, VehicleForm } from '@/components/forms';
import { amountDue, can, serviceName, staffName } from '@/lib/rules';
import { fmtDate, km, money, today } from '@/lib/format';

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const { state, actor } = useApp();
  const [modal, setModal] = useState<'' | 'edit' | 'appointment'>('');
  const v = state.vehicles.find(x => x.id === id);
  if (!v) return <Empty icon="car" title="Araç bulunamadı"><Link href="/araclar">Listeye dön</Link></Empty>;
  const owner = state.customers.find(c => c.id === v.customerId);
  const jobs = state.jobs.filter(j => j.vehicleId === v.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const findings = jobs.flatMap(j => j.inspections.filter(i => i.result !== 'Uygun').map(i => ({ ...i, job: j })));
  const due = (v.nextServiceDate && v.nextServiceDate <= today()) || (v.nextServiceKm && v.km >= v.nextServiceKm);

  return <>
    <PageHeader crumbs={[['Araçlar', '/araclar'], [v.plate]]} title={<span className="title-row"><BrandMark brand={v.brand} />{v.brand} {v.model}<Plate value={v.plate} /></span>}
      sub={`${v.year} · ${v.color || 'renk belirtilmedi'} · ${km(v.km)}`}
      actions={can(actor, 'vehicle.write') && <><Button icon="edit" onClick={() => setModal('edit')}>Düzenle</Button><Button variant="primary" icon="calendar" onClick={() => setModal('appointment')}>Randevu oluştur</Button></>} />
    <div className="detail-layout">
      <div className="detail-main">
        <Card title="Servis geçmişi" sub={`${jobs.length} ziyaret`} flush>
          {jobs.length ? <ol className="service-history">{jobs.map(j => <li key={j.id}>
            <div className="sh-date"><strong>{fmtDate(j.createdAt, { day: '2-digit', month: 'short' })}</strong><small>{fmtDate(j.createdAt, { year: 'numeric' })}</small></div>
            <div className="sh-body">
              <div className="row-between"><Link href={`/is-emirleri/${j.id}`} className="mono strong">{j.no}</Link><Status value={j.status} /></div>
              <p>{serviceName(state, j.serviceId)} · {km(j.intake.km)} · {staffName(state, j.technicianId)}</p>
              <p className="muted small">{j.intake.complaint}</p>
              {can(actor, 'payment.read') && amountDue(j) > 0 && <p className="small">Onaylı iş: <b>{money(amountDue(j))}</b></p>}
            </div>
          </li>)}</ol> : <Empty icon="wrench" title="Servis kaydı yok" />}
        </Card>
        <Card title="Takip gerektiren bulgular" sub="Önceki ziyaretlerde “takip edilmeli” veya “acil” işaretlenen kontroller" flush>
          {findings.length ? <table className="table"><thead><tr><th>Bulgu</th><th>Sonuç</th><th className="hide-sm">Açıklama</th><th>Ziyaret</th></tr></thead>
            <tbody>{findings.map(f => <tr key={f.id}><td>{f.item}</td><td><Status value={f.result} /></td><td className="hide-sm small">{f.note}</td><td><Link className="mono small" href={`/is-emirleri/${f.job.id}`}>{f.job.no}</Link></td></tr>)}</tbody></table>
            : <Empty icon="check" title="Takipte bulgu yok" />}
        </Card>
      </div>
      <aside className="detail-side">
        <Card><CarDrawing vehicle={v} /></Card>
        <Card title="Araç bilgileri">
          <KV cols={1} items={[['Sahibi', owner ? (can(actor, 'customer.write') ? <Link href={`/musteriler/${owner.id}`}>{owner.name}</Link> : owner.name) : '—'], ['Şasi no', <span className="mono small" key="vin">{v.vin || '—'}</span>], ['Yakıt / vites', `${v.fuel} · ${v.transmission}`], ['Son bilinen km', km(v.km)], ['Kayıt', fmtDate(v.createdAt)]]} />
        </Card>
        <Card title="Bakım planı">
          <KV cols={1} items={[['Sonraki bakım tarihi', <span key="d" className={due ? 'text-bad strong' : ''}>{fmtDate(v.nextServiceDate)}</span>], ['Sonraki bakım km', v.nextServiceKm ? km(v.nextServiceKm) : '—'], ['Kalan', v.nextServiceKm ? km(Math.max(0, v.nextServiceKm - v.km)) : '—']]} />
          {due && <p className="small text-bad mt">Bakım zamanı geldi.</p>}
        </Card>
      </aside>
    </div>
    {modal === 'edit' && <VehicleForm open vehicle={v} onClose={() => setModal('')} />}
    {modal === 'appointment' && <AppointmentForm open preset={{ customerId: v.customerId, vehicleId: v.id }} onClose={() => setModal('')} />}
  </>;
}
