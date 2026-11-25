'use client';
import { detailHref } from '@/lib/routes';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/store';
import { Button, Empty, FactBox, FastTab, KV, PageHeader, Score, Status } from '@/components/ui';
import { Icon } from '@/components/icons';
import { CarDrawing, Plate, VehicleCell } from '@/components/vehicle-identity';
import { AppointmentForm, CustomerForm, EvaluationForm, NoteForm, VehicleForm } from '@/components/forms';
import { amountDue, amountPaid, balance, can, customerScore, editNote, resourceName, serviceName } from '@/lib/commands';
import { fmtDate, fmtDateTime, money } from '@/lib/format';
import type { Job } from '@/lib/types';

export default function Page() {
  return <Suspense><CustomerDetail /></Suspense>;
}

/** Müşteri kartı: katlanabilir bölümler ve sağda müşteri özeti bilgi kutusu. */
function CustomerDetail() {
  const id = useSearchParams().get('id');
  const { state, actor, run } = useApp();
  const [modal, setModal] = useState<'' | 'edit' | 'vehicle' | 'appointment' | 'note'>('');
  const [evalJob, setEvalJob] = useState<Job | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const c = state.customers.find(x => x.id === id);
  if (!c) return <Empty icon="users" title="Müşteri bulunamadı"><Link href="/musteriler">Listeye dön</Link></Empty>;
  const vehicles = state.vehicles.filter(v => v.customerId === c.id);
  const jobs = state.jobs.filter(j => j.customerId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const appts = state.appointments.filter(a => a.customerId === c.id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const notes = state.notes.filter(n => n.customerId === c.id).sort((a, b) => b.at.localeCompare(a.at));
  const evals = state.evaluations.filter(e => e.customerId === c.id);
  const score = customerScore(state, c.id);
  const spent = jobs.reduce((s, j) => s + amountDue(j), 0), paid = jobs.reduce((s, j) => s + amountPaid(j), 0);
  const open = jobs.reduce((s, j) => s + Math.max(0, balance(j)), 0);
  const noShows = appts.filter(a => a.status === 'Gelmedi').length;
  const portalUser = state.users.find(u => u.customerId === c.id);

  return <>
    <PageHeader crumbs={[['Müşteriler', '/musteriler'], [c.no]]} title={<span className="title-row">{c.name}<span className="tag slate">{c.kind}</span></span>}
      sub={<span className="inline-meta"><span className="mono">{c.no}</span><span><Icon name="phone" size={13} />{c.phone}</span>{c.email && <span><Icon name="mail" size={13} />{c.email}</span>}<span>İletişim: {c.preference}</span></span>}
      actions={<>
        <Button icon="edit" onClick={() => setModal('edit')}>Düzenle</Button>
        <Button variant="primary" icon="plus" onClick={() => setModal('vehicle')}>Araç ekle</Button>
        <Button icon="calendar" onClick={() => setModal('appointment')}>Yeni randevu</Button>
        <Button icon="note" onClick={() => setModal('note')}>İç not ekle</Button>
      </>} />
    <div className="doc-layout">
      <div className="doc-main">
        <FastTab title="Genel" summary={`${c.phone} · ${c.preference}`}>
          <KV cols={3} items={[['Müşteri no', c.no], ['Tür', c.kind], [c.kind === 'Kurumsal' ? 'Vergi no' : 'T.C. kimlik no', c.taxNo || '—'], ['Telefon', c.phone], ['E-posta', c.email || '—'], ['İletişim tercihi', c.preference], ['Adres', c.address || '—'], ['KVKK onayı', c.consent ? 'Alındı' : 'Yok'], ['Kayıt tarihi', fmtDate(c.createdAt)], ['Portal hesabı', portalUser ? portalUser.email : 'Açılmadı']]} />
        </FastTab>

        <FastTab title="Araçlar" summary={`${vehicles.length} araç`} flush>{vehicles.length ? <div className="table-wrap"><table className="table dense"><thead><tr><th>Araç</th><th className="hide-sm">Yakıt / vites</th><th className="hide-sm">Sonraki bakım</th><th>Durum</th></tr></thead>
          <tbody>{vehicles.map(v => {
            const live = state.jobs.find(j => j.vehicleId === v.id && !['Teslim edildi', 'İptal'].includes(j.status));
            return <tr key={v.id}>
              <td><Link href={detailHref('/araclar/detay', v.id)}><VehicleCell vehicle={v} /></Link></td><td className="hide-sm">{v.fuel} · {v.transmission}</td>
              <td className="hide-sm">{v.nextServiceDate ? fmtDate(v.nextServiceDate) : '—'}{v.nextServiceKm && <small className="cell-sub">{v.nextServiceKm.toLocaleString('tr-TR')} km</small>}</td>
              <td>{live ? <Link href={detailHref('/is-emirleri/detay', live.id)}><Status value={live.status} /></Link> : <span className="muted small">Serviste değil</span>}</td>
            </tr>;
          })}</tbody></table></div> : <Empty icon="car" title="Kayıtlı araç yok" />}</FastTab>

        <FastTab title="Servis geçmişi" summary={`${jobs.length} iş emri`} flush>{jobs.length ? <div className="table-wrap"><table className="table dense"><thead><tr><th>İE No</th><th>Tarih</th><th>Plaka</th><th className="hide-sm">Hizmet</th><th>Durum</th><th className="num">Tutar</th><th /></tr></thead>
          <tbody>{jobs.map(j => { const v = state.vehicles.find(x => x.id === j.vehicleId); return <tr key={j.id}>
            <td><Link className="mono strong" href={detailHref('/is-emirleri/detay', j.id)}>{j.no}</Link></td><td className="nowrap">{fmtDate(j.createdAt)}</td>
            <td>{v ? <Plate value={v.plate} size="sm" /> : '—'}</td><td className="hide-sm">{serviceName(state, j.serviceId)}</td><td><Status value={j.status} /></td>
            <td className="num">{money(amountDue(j))}{balance(j) > 0 && <small className="cell-sub text-bad">{money(balance(j))} açık</small>}</td>
            <td className="actions">{j.status === 'Teslim edildi' && can(actor, 'evaluation.write') && <Button size="sm" icon="star" onClick={() => setEvalJob(j)}>{evals.some(e => e.jobId === j.id) ? 'Güncelle' : 'Değerlendir'}</Button>}</td>
          </tr> })}</tbody></table></div> : <Empty icon="wrench" title="Servis kaydı yok" />}</FastTab>

        <FastTab title="Randevular" open={false} summary={`${appts.length} randevu · ${noShows} gelmedi`} flush>{appts.length ? <div className="table-wrap"><table className="table dense"><thead><tr><th>No</th><th>Tarih</th><th className="hide-sm">Hizmet</th><th className="hide-sm">Kanal</th><th>Durum</th></tr></thead>
          <tbody>{appts.map(a => <tr key={a.id}><td className="mono">{a.no}</td><td>{fmtDate(a.date)} {a.time}<small className="cell-sub">{resourceName(state, a.resourceId)}</small></td><td className="hide-sm">{serviceName(state, a.serviceId)}</td><td className="hide-sm">{a.source}</td><td><Status value={a.status} /></td></tr>)}</tbody></table></div> : <Empty icon="calendar" title="Randevu yok" />}</FastTab>

        <FastTab title="İç notlar" summary={`${notes.length} not · yalnız personel`} flush actions={<Button size="sm" icon="plus" onClick={() => setModal('note')}>Not ekle</Button>}>
          <p className="small muted pad-x">Yalnız yönetici ve danışmanlar görür; portal, servis formu ve ön değerlendirme girdilerinden çıkarılır.</p>
          {notes.length ? <ul className="note-list">{notes.map(n => <li key={n.id}>
            <div className="row-between"><span className="tag slate">{n.category}</span><small className="muted">{n.by} · {fmtDateTime(n.at)}{n.jobId && <> · <Link href={detailHref('/is-emirleri/detay', n.jobId)}>{state.jobs.find(j => j.id === n.jobId)?.no}</Link></>}</small></div>
            {editing === n.id ? <form className="inline-edit" onSubmit={e => { e.preventDefault(); const text = String(new FormData(e.currentTarget).get('t')); run((s, a) => editNote(s, a, n.id, text), 'İç not düzeltildi', c.no).then(err => !err && setEditing(null)) }}>
              <textarea name="t" defaultValue={n.text} rows={3} maxLength={1000} /><div className="btn-row"><Button size="sm" onClick={() => setEditing(null)}>Vazgeç</Button><button className="btn sm primary">Kaydet</button></div></form>
              : <p>{n.text}</p>}
            <div className="row-between">{n.revisions.length > 0 ? <details className="small muted"><summary>{n.revisions.length} düzeltme</summary>{n.revisions.map((r, i) => <p key={i}><s>{r.text}</s> — {r.by}, {fmtDateTime(r.at)}</p>)}</details> : <span />}
              {editing !== n.id && <button className="btn sm link" onClick={() => setEditing(n.id)}><Icon name="edit" size={13} />Düzelt</button>}</div>
          </li>)}</ul> : <Empty icon="note" title="İç not yok" />}
        </FastTab>

        <FastTab title="Değerlendirmeler" open={false} summary={score ? `ortalama ${score.overall.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} / 5 · ${evals.length} kayıt` : 'Değerlendirme yok'} flush>
          <p className="small muted pad-x">Tamamlanmış ziyaret başına tek güncel değerlendirme. Otomatik fiyat veya hizmet kararı üretmez.</p>
          {score && <div className="score-grid"><div><span>Randevuya uyum</span><Score value={score.punctuality} /></div><div><span>Ödeme düzeni</span><Score value={score.payment} /></div><div><span>İletişim / işbirliği</span><Score value={score.communication} /></div></div>}
          {evals.length ? <div className="table-wrap"><table className="table dense"><thead><tr><th>Ziyaret</th><th className="num">Uyum</th><th className="num">Ödeme</th><th className="num">İletişim</th><th className="hide-sm">Gerekçe</th></tr></thead>
            <tbody>{evals.map(e => <tr key={e.id}><td className="mono">{state.jobs.find(j => j.id === e.jobId)?.no}<small className="cell-sub">{e.by} · {fmtDate(e.at)}</small></td><td className="num">{e.punctuality}</td><td className="num">{e.payment}</td><td className="num">{e.communication}</td><td className="hide-sm small">{e.reason}</td></tr>)}</tbody></table></div>
            : <Empty icon="star" title="Değerlendirme yok">Teslim edilmiş ziyaretler “Servis geçmişi” bölümünden değerlendirilir.</Empty>}
        </FastTab>
      </div>

      <aside className="doc-side" aria-label="Bilgi kutusu">
        <FactBox title="Müşteri özeti">
          <dl className="fact-list">
            <div><dt>Toplam ziyaret</dt><dd>{jobs.length}</dd></div>
            <div><dt>Gelmedi kaydı</dt><dd>{noShows}</dd></div>
            <div><dt>Onaylı iş tutarı</dt><dd>{money(spent)}</dd></div>
            <div><dt>Tahsil edilen</dt><dd>{money(paid)}</dd></div>
            <div className="total"><dt>Açık bakiye</dt><dd className={open > 0 ? 'text-bad' : ''}>{money(open)}</dd></div>
            <div><dt>Değerlendirme</dt><dd>{score ? <Score value={score.overall} /> : '—'}</dd></div>
          </dl>
        </FactBox>
        {vehicles[0] && <FactBox title="Araç" actions={<Link className="small" href={detailHref('/araclar/detay', vehicles[0].id)}>Araç kartı</Link>}>
          <CarDrawing vehicle={vehicles[0]} />
          {vehicles.length > 1 && <p className="small muted">+{vehicles.length - 1} araç daha (Araçlar bölümü)</p>}
        </FactBox>}
      </aside>
    </div>
    {modal === 'edit' && <CustomerForm open customer={c} onClose={() => setModal('')} />}
    {modal === 'vehicle' && <VehicleForm open customerId={c.id} onClose={() => setModal('')} />}
    {modal === 'appointment' && <AppointmentForm open preset={{ customerId: c.id }} onClose={() => setModal('')} />}
    {modal === 'note' && <NoteForm open customerId={c.id} onClose={() => setModal('')} />}
    {evalJob && <EvaluationForm open job={evalJob} onClose={() => setEvalJob(null)} />}
  </>;
}
