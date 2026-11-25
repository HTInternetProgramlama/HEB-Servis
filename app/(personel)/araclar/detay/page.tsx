'use client';
import { detailHref } from '@/lib/routes';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/store';
import { Button, Empty, FactBox, FastTab, KV, PageHeader, Status } from '@/components/ui';
import { BrandMark, CarDrawing, Plate } from '@/components/vehicle-identity';
import { AppointmentForm, VehicleForm } from '@/components/forms';
import { amountDue, can, serviceName, staffName } from '@/lib/rules';
import { fmtDate, km, money, today } from '@/lib/format';

export default function Page() {
  return <Suspense><VehicleDetail /></Suspense>;
}

/** Araç kartı: genel bilgiler, servis geçmişi, takip bulguları; sağda araç illüstrasyonu ve bakım planı. */
function VehicleDetail() {
  const id = useSearchParams().get('id');
  const { state, actor } = useApp();
  const [modal, setModal] = useState<'' | 'edit' | 'appointment'>('');
  const v = state.vehicles.find(x => x.id === id);
  if (!v) return <Empty icon="car" title="Araç bulunamadı"><Link href="/araclar">Listeye dön</Link></Empty>;
  const owner = state.customers.find(c => c.id === v.customerId);
  const jobs = state.jobs.filter(j => j.vehicleId === v.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const findings = jobs.flatMap(j => j.inspections.filter(i => i.result !== 'Uygun').map(i => ({ ...i, job: j })));
  const due = (v.nextServiceDate && v.nextServiceDate <= today()) || (v.nextServiceKm && v.km >= v.nextServiceKm);
  const live = jobs.find(j => !['Teslim edildi', 'İptal'].includes(j.status));
  const ownerLink = owner ? (can(actor, 'customer.write') ? <Link key="o" href={detailHref('/musteriler/detay', owner.id)}>{owner.name}</Link> : owner.name) : '—';

  return <>
    <PageHeader crumbs={[['Araçlar', '/araclar'], [v.plate]]} title={<span className="title-row"><BrandMark brand={v.brand} />{v.brand} {v.model}<Plate value={v.plate} /></span>}
      sub={`${v.year} · ${v.color || 'renk belirtilmedi'} · ${km(v.km)}`}
      actions={<>
        {can(actor, 'vehicle.write') && <Button icon="edit" onClick={() => setModal('edit')}>Düzenle</Button>}
        {can(actor, 'appointment.manage') && <Button variant="primary" icon="calendar" onClick={() => setModal('appointment')}>Randevu oluştur</Button>}
        {live && <Link className="btn" href={detailHref('/is-emirleri/detay', live.id)}>Açık iş emri {live.no}</Link>}
      </>} />
    <div className="doc-layout">
      <div className="doc-main">
        <FastTab title="Genel" summary={`${v.fuel} · ${v.transmission} · ${km(v.km)}`}>
          <KV cols={3} items={[['Plaka', <Plate key="p" value={v.plate} size="sm" />], ['Marka / model', `${v.brand} ${v.model}`], ['Model yılı', String(v.year)], ['Sahibi', ownerLink], ['Şasi no', <span className="mono small" key="vin">{v.vin || '—'}</span>], ['Renk', v.color || '—'], ['Yakıt / vites', `${v.fuel} · ${v.transmission}`], ['Son bilinen km', km(v.km)], ['Kayıt tarihi', fmtDate(v.createdAt)]]} />
        </FastTab>
        <FastTab title="Servis geçmişi" summary={`${jobs.length} ziyaret`} flush>
          {jobs.length ? <div className="table-wrap"><table className="table dense"><thead><tr><th>İE No</th><th>Tarih</th><th className="num">Km</th><th className="hide-sm">Hizmet</th><th className="hide-md">Teknisyen</th><th>Durum</th>{can(actor, 'payment.read') && <th className="num hide-sm">Onaylı iş</th>}</tr></thead>
            <tbody>{jobs.map(j => <tr key={j.id}>
              <td><Link href={detailHref('/is-emirleri/detay', j.id)} className="mono strong">{j.no}</Link></td><td className="nowrap">{fmtDate(j.createdAt)}</td><td className="num">{j.intake.km.toLocaleString('tr-TR')}</td>
              <td className="hide-sm">{serviceName(state, j.serviceId)}<small className="cell-sub">{j.intake.complaint}</small></td><td className="hide-md">{staffName(state, j.technicianId)}</td><td><Status value={j.status} /></td>
              {can(actor, 'payment.read') && <td className="num hide-sm">{amountDue(j) ? money(amountDue(j)) : '—'}</td>}
            </tr>)}</tbody></table></div> : <Empty icon="wrench" title="Servis kaydı yok" />}
        </FastTab>
        <FastTab title="Takip gerektiren bulgular" summary={`${findings.length} bulgu`} flush>
          <p className="small muted pad-x">Önceki ziyaretlerde “takip edilmeli” veya “acil” işaretlenen kontroller.</p>
          {findings.length ? <div className="table-wrap"><table className="table dense"><thead><tr><th>Bulgu</th><th>Sonuç</th><th className="hide-sm">Açıklama</th><th>Ziyaret</th></tr></thead>
            <tbody>{findings.map(f => <tr key={f.id}><td>{f.item}</td><td><Status value={f.result} /></td><td className="hide-sm small">{f.note}</td><td><Link className="mono small" href={detailHref('/is-emirleri/detay', f.job.id)}>{f.job.no}</Link></td></tr>)}</tbody></table></div>
            : <Empty icon="check" title="Takipte bulgu yok" />}
        </FastTab>
      </div>
      <aside className="doc-side" aria-label="Bilgi kutusu">
        <FactBox title="Araç"><CarDrawing vehicle={v} /></FactBox>
        <FactBox title="Bakım planı">
          <dl className="fact-list">
            <div><dt>Sonraki bakım tarihi</dt><dd className={due ? 'text-bad strong' : ''}>{fmtDate(v.nextServiceDate)}</dd></div>
            <div><dt>Sonraki bakım km</dt><dd>{v.nextServiceKm ? km(v.nextServiceKm) : '—'}</dd></div>
            <div><dt>Kalan</dt><dd>{v.nextServiceKm ? km(Math.max(0, v.nextServiceKm - v.km)) : '—'}</dd></div>
          </dl>
          {due && <p className="small text-bad mt">Bakım zamanı geldi.</p>}
        </FactBox>
        <FactBox title="Sahibi">
          <dl className="fact-list"><div><dt>Ad / unvan</dt><dd>{ownerLink}</dd></div><div><dt>Telefon</dt><dd>{owner?.phone ?? '—'}</dd></div><div><dt>Tercih</dt><dd>{owner?.preference ?? '—'}</dd></div></dl>
        </FactBox>
      </aside>
    </div>
    {modal === 'edit' && <VehicleForm open vehicle={v} onClose={() => setModal('')} />}
    {modal === 'appointment' && <AppointmentForm open preset={{ customerId: v.customerId, vehicleId: v.id }} onClose={() => setModal('')} />}
  </>;
}
