'use client';
import { detailHref } from '@/lib/routes';
import { InspectionPhoto } from '@/components/inspection-photo';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApp } from '@/components/store';
import { Button, Empty, FactBox, FastTab, Field, FormError, KV, MenuButton, Modal, PageHeader, Status, useFormRunner } from '@/components/ui';
import { Icon } from '@/components/icons';
import { CarDrawing, Plate } from '@/components/vehicle-identity';
import { PaymentForm } from '@/components/payment';
import { ShareSheet } from '@/components/share-sheet';
import { estimateMessage, serviceFormMessage } from '@/lib/share';
import { DamageMap, DeliveryForm, EvaluationForm, FuelGauge, LineForm } from '@/components/forms';
import {
  addInspection, allowedMoves, amountDue, amountPaid, approvedEstimate, balance, can, createEstimateDraft, decideEstimate, estimateTotals,
  latestEstimate, lineTotals, moveJob, reassignJob, removeLine, roleLabel, sendEstimate, serviceName, setEstimateNote, staffName, technicians, toggleInspectionVisibility,
} from '@/lib/commands';
import { generateTechnicalDraft, type Suggestion } from '@/lib/advisor';
import { fmtDate, fmtDateTime, km, money, qtyText } from '@/lib/format';
import type { Channel, Estimate, InspectionResult, Job, JobStatus } from '@/lib/types';

export default function Page() {
  return <Suspense><JobDetail /></Suspense>;
}

/** Belgelerin yazdırma bağlantısı: servis formu sayfası `belge` parametresiyle kabul formu / teklif / servis formu basar. */
const docHref = (id: string, doc: 'kabul' | 'teklif' | 'servis') => detailHref('/servis-formu', id) + (doc === 'servis' ? '' : '&belge=' + doc);

function JobDetail() {
  const id = useSearchParams().get('id');
  const { state, actor, run } = useApp();
  const router = useRouter();
  const [modal, setModal] = useState<'' | 'payment' | 'deliver' | 'evaluate' | 'cancel' | 'move'>('');
  const [share, setShare] = useState<'' | 'estimate' | 'form'>('');
  const [pendingMove, setPendingMove] = useState<JobStatus | null>(null);
  const [decide, setDecide] = useState<null | 'Onaylandı' | 'Reddedildi'>(null);
  const job = state.jobs.find(j => j.id === id);
  if (!job) return <Empty icon="wrench" title="İş emri bulunamadı"><Link href="/is-emirleri">İş emirlerine dön</Link></Empty>;
  if (actor.role === 'technician' && job.technicianId !== actor.userId) return <Empty icon="lock" title="Bu iş emri size atanmamış">Atanan işlerinizi İş Emirleri listesinde görebilirsiniz.</Empty>;
  const vehicle = state.vehicles.find(v => v.id === job.vehicleId)!;
  const customer = state.customers.find(c => c.id === job.customerId)!;
  const moves = allowedMoves(job, actor);
  const latest = latestEstimate(job);
  const sentEstimate = job.estimates.filter(e => e.status !== 'Taslak').at(-1);
  const showMoney = can(actor, 'payment.read');
  const appt = state.appointments.find(a => a.id === job.appointmentId);
  const others = state.jobs.filter(j => j.vehicleId === vehicle.id && j.id !== job.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const customerOpen = state.jobs.filter(j => j.customerId === customer.id && j.status !== 'İptal').reduce((s, j) => s + Math.max(0, balance(j)), 0);
  const urgent = job.inspections.filter(i => i.result === 'Acil').length;

  function doMove(m: JobStatus) {
    if (m === 'İptal') { setModal('cancel'); return }
    if (m === 'Parça bekliyor') { setPendingMove(m); setModal('move'); return }
    run((s, a) => moveJob(s, a, job!.id, m), `${job!.no} → ${m}`, job!.no);
  }
  const forward = moves.filter(m => m !== 'İptal');
  // Müşteri kararı bekleniyorsa birincil eylem "Onay kaydet" olur; durum geçişleri ikincil kalır.
  const decidable = can(actor, 'estimate.write') && latest?.status === 'Gönderildi';
  const delivering = job.status === 'Teslime hazır' && can(actor, 'payment.write');

  return <>
    <PageHeader crumbs={[['İş Emirleri', '/is-emirleri'], [job.no]]}
      title={<span className="title-row">İş Emri <span className="mono">{job.no}</span><Status value={job.status} /></span>}
      sub={<>{serviceName(state, job.serviceId)} · {vehicle.brand} {vehicle.model} · {customer.name} · kabul {fmtDateTime(job.createdAt)}</>}
      actions={<>
        {decidable && <><Button variant="primary" icon="check" onClick={() => setDecide('Onaylandı')}>Onay kaydet</Button><Button onClick={() => setDecide('Reddedildi')}>Ret kaydet</Button></>}
        {forward.map((m, i) => <Button key={m} variant={i === 0 && !decidable && !delivering ? 'primary' : 'default'} onClick={() => doMove(m)}>{m === 'Teslime hazır' && job.status === 'Onay bekliyor' ? 'İşlemsiz teslime hazırla' : m === 'Parça bekliyor' ? 'Parça bekliyor' : `${m} olarak işaretle`}</Button>)}
        {job.status === 'Teslime hazır' && can(actor, 'payment.write') && <Button variant="primary" icon="check" onClick={() => setModal('deliver')}>Teslim et</Button>}
        {showMoney && can(actor, 'payment.write') && balance(job) > 0 && <Button icon="wallet" onClick={() => setModal('payment')}>Tahsilat al</Button>}
        {can(actor, 'estimate.write') && <MenuButton icon="send" label="Gönder" align="left">
          <button type="button" role="menuitem" disabled={!latest || latest.status === 'Taslak'} onClick={() => setShare('estimate')}><Icon name="receipt" size={15} />Teklifi müşteriye ilet{latest?.status === 'Taslak' && <span className="dd-sub">önce onaya gönderin</span>}</button>
          <button type="button" role="menuitem" onClick={() => setShare('form')}><Icon name="file" size={15} />Servis formunu ilet</button>
        </MenuButton>}
        <MenuButton icon="printer" label="Yazdır" align="left">
          <Link href={docHref(job.id, 'kabul')} target="_blank" role="menuitem"><Icon name="clipboard" size={15} />Araç kabul formu</Link>
          {sentEstimate || (latest && can(actor, 'estimate.write')) ? <Link href={docHref(job.id, 'teklif')} target="_blank" role="menuitem"><Icon name="receipt" size={15} />Teklif çıktısı<span className="dd-sub">v{(sentEstimate ?? latest)!.version}</span></Link>
            : <button type="button" disabled><Icon name="receipt" size={15} />Teklif çıktısı<span className="dd-sub">teklif yok</span></button>}
          <Link href={docHref(job.id, 'servis')} target="_blank" role="menuitem"><Icon name="file" size={15} />Servis / teslim formu</Link>
        </MenuButton>
        {job.status === 'Teslim edildi' && can(actor, 'evaluation.write') && <Button icon="star" onClick={() => setModal('evaluate')}>Ziyareti değerlendir</Button>}
        {moves.includes('İptal') && <><span className="action-sep" /><Button variant="ghost" icon="x" onClick={() => setModal('cancel')}>İptal et</Button></>}
      </>} />

    <div className="doc-layout">
      <div className="doc-main">
        <FastTab title="Genel" mobileOpen summary={`${staffName(state, job.technicianId)} · teslim sözü ${fmtDateTime(job.promisedAt)}`}>
          <KV cols={3} items={[
            ['İş emri no', <span key="n" className="mono">{job.no}</span>],
            ['Hizmet türü', serviceName(state, job.serviceId)],
            ['Durum', <Status key="s" value={job.status} />],
            ['Müşteri', can(actor, 'customer.write') ? <Link key="c" href={detailHref('/musteriler/detay', customer.id)}>{customer.name}</Link> : customer.name],
            ['Telefon', <a key="p" href={`tel:${customer.phone.replace(/\s/g, '')}`}>{customer.phone}</a>],
            ['İletişim tercihi', customer.preference],
            ['Araç', <Link key="v" href={detailHref('/araclar/detay', vehicle.id)}>{vehicle.brand} {vehicle.model} ({vehicle.year})</Link>],
            ['Plaka', <Plate key="pl" value={vehicle.plate} size="sm" />],
            ['Kabul km', km(job.intake.km)],
            ['Kabul tarihi', fmtDateTime(job.createdAt)],
            ['Randevu', appt ? `${appt.no} · ${fmtDate(appt.date)} ${appt.time}` : 'Randevusuz kabul'],
            ['Servis danışmanı', staffName(state, job.advisorId)],
            ['Teknisyen', can(actor, 'job.create') && !['Teslim edildi', 'İptal'].includes(job.status)
              ? <select key="t" className="select sm" value={job.technicianId} onChange={e => run((s, a) => reassignJob(s, a, job.id, e.target.value), `${job.no} teknisyeni ${staffName(state, e.target.value)} olarak değiştirildi`, job.no)}>{technicians(state).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              : staffName(state, job.technicianId)],
            ['Teslim sözü', fmtDateTime(job.promisedAt)],
            ['Teslim', job.deliveredAt ? fmtDateTime(job.deliveredAt) : '—'],
          ]} />
        </FastTab>

        <FastTab title="Şikâyet ve kabul" summary={`${km(job.intake.km)} · ${job.intake.damages.length} hasar kaydı`}>
          <p className="quote">{job.intake.complaint}</p>
          <div className="intake-view mt">
            <DamageMap damages={job.intake.damages} readOnly />
            <div className="stack">
              <KV items={[['Kilometre', km(job.intake.km)], ['Yakıt', <FuelGauge key="f" value={job.intake.fuel} />], ['Kabulü yapan', `${job.intake.by} · ${fmtDateTime(job.intake.at)}`], ['Müşteri teyidi', job.intake.customerAck ? 'Birlikte kontrol edildi' : '—']]} />
              <div><h3 className="mini-head">Mevcut hasarlar</h3>{job.intake.damages.length ? <ul className="plain-list">{job.intake.damages.map(d => <li key={d.area}><b>{d.area}</b> · {d.kind}{d.note && ` — ${d.note}`}</li>)}</ul> : <p className="muted small">Kabulde hasar kaydı yok.</p>}</div>
              <div><h3 className="mini-head">Araçta bırakılanlar</h3><p className="small">{job.intake.belongings || '—'}</p></div>
            </div>
          </div>
        </FastTab>

        <FastTab title="Muayene" summary={`${job.inspections.length} bulgu${urgent ? ` · ${urgent} acil` : ''}`}>
          <Inspections job={job} />
        </FastTab>

        <FastTab title="Teklif ve kalemler" summary={latest ? `v${latest.version} · ${latest.status} · ${money(estimateTotals(latest).total)}` : 'Teklif hazırlanmadı'}>
          <EstimatePanel job={job} onShare={() => setShare('estimate')} />
        </FastTab>

        {showMoney && <FastTab title="Tahsilat" summary={`${job.payments.length} kayıt · kalan ${money(balance(job))}`} flush
          actions={can(actor, 'payment.write') && balance(job) > 0 && <Button size="sm" icon="plus" onClick={() => setModal('payment')}>Tahsilat al</Button>}>
          <Payments job={job} />
        </FastTab>}

        <FastTab title="Geçmiş" open={false} summary={`${job.history.length} durum değişikliği`} flush>
          <ol className="timeline">{[...job.history].reverse().map((h, i) => <li key={i}><time>{fmtDateTime(h.at)}</time><div><Status value={h.status} /> <span className="small">{h.by}</span>{h.note && <p>{h.note}</p>}</div><span /></li>)}</ol>
          {can(actor, 'audit.read') && <AuditRows refNo={job.no} />}
        </FastTab>
      </div>

      <aside className="doc-side" aria-label="Bilgi kutusu">
        <FactBox title="Araç" actions={<Link href={detailHref('/araclar/detay', vehicle.id)} className="small">Araç kartı</Link>}>
          <CarDrawing vehicle={vehicle} />
          <dl className="fact-list">
            <div><dt>Plaka</dt><dd><Plate value={vehicle.plate} size="sm" /></dd></div>
            <div><dt>Model</dt><dd>{vehicle.brand} {vehicle.model} · {vehicle.year}</dd></div>
            <div><dt>Yakıt / vites</dt><dd>{vehicle.fuel} · {vehicle.transmission}</dd></div>
            <div><dt>Şasi no</dt><dd className="mono small">{vehicle.vin || '—'}</dd></div>
          </dl>
        </FactBox>
        {showMoney && <FactBox title="Bakiye">
          <dl className="fact-list">
            <div><dt>Onaylı iş tutarı</dt><dd>{money(amountDue(job))}</dd></div>
            <div><dt>Tahsil edilen</dt><dd>{money(amountPaid(job))}</dd></div>
            <div className="total"><dt>Kalan</dt><dd className={balance(job) > 0 ? 'text-bad' : ''}>{money(balance(job))}</dd></div>
            <div><dt>Müşteri toplam açık</dt><dd>{money(customerOpen)}</dd></div>
          </dl>
          {latest?.status === 'Gönderildi' && <p className="small muted mt">v{latest.version} teklifi ({money(estimateTotals(latest).total)}) müşteri kararını bekliyor.</p>}
        </FactBox>}
        <FactBox title="Son servisler">
          {others.length ? <ul className="fact-links">{others.slice(0, 3).map(j => <li key={j.id}>
            <Link href={detailHref('/is-emirleri/detay', j.id)} className="mono">{j.no}</Link><span className="small muted">{fmtDate(j.createdAt)}</span>
            <small>{serviceName(state, j.serviceId)} · {km(j.intake.km)}</small>
          </li>)}</ul> : <p className="small muted">Bu araç için önceki servis kaydı yok.</p>}
        </FactBox>
        {can(actor, 'note.read') && state.notes.some(n => n.customerId === customer.id) && <FactBox title="Müşteri iç notları">
          {state.notes.filter(n => n.customerId === customer.id).slice(-2).map(n => <div key={n.id} className="inner-note"><Icon name="lock" size={12} /><div><b>{n.category}</b> {n.text}</div></div>)}
        </FactBox>}
      </aside>
    </div>

    {decide && latest && <DecisionModal job={job} estimate={latest} result={decide} onClose={() => setDecide(null)} />}
    {modal === 'payment' && <PaymentForm open job={job} onClose={() => setModal('')} />}
    {modal === 'deliver' && <DeliveryForm open job={job} onClose={() => setModal('')} onDone={() => router.push(detailHref('/servis-formu', job.id))} />}
    {modal === 'evaluate' && <EvaluationForm open job={job} onClose={() => setModal('')} />}
    {(modal === 'cancel' || modal === 'move') && <ReasonModal title={modal === 'cancel' ? 'İş emrini iptal et' : 'Parça bekliyor'} label={modal === 'cancel' ? 'İptal gerekçesi' : 'Beklenen parça / tedarikçi'} required={modal === 'cancel'}
      onClose={() => setModal('')} onSubmit={note => run((s, a) => moveJob(s, a, job.id, modal === 'cancel' ? 'İptal' : pendingMove!, note), `${job.no} → ${modal === 'cancel' ? 'İptal' : pendingMove}`, job.no)} />}
    {share === 'estimate' && latest && latest.status !== 'Taslak' && <Modal open title={`Teklif v${latest.version} müşteriye iletilsin`} sub={`Portal bağlantısı ile onaylanabilir · ${customer.preference} tercih ediyor`} onClose={() => setShare('')} width={760}>
      <p className="banner"><Icon name="mail" size={15} />Teklif portalda müşterinin onayına açıktır. Bildirim otomatik gitmez; aşağıdan bir kanal seçin.</p>
      <ShareSheet name={customer.name} phone={customer.phone} email={customer.email || undefined} subject={`${job.no} servis teklifi`} text={estimateMessage(state, job, latest, location.origin)} />
    </Modal>}
    {share === 'form' && <Modal open title="Servis formunu müşteriye ilet" sub={`${customer.name} · ${customer.preference} tercih ediyor`} onClose={() => setShare('')} width={760}>
      <ShareSheet name={customer.name} phone={customer.phone} email={customer.email || undefined} subject={`${job.no} servis formu`} text={serviceFormMessage(state, job, location.origin)} />
    </Modal>}
  </>;
}

function AuditRows({ refNo }: { refNo: string }) {
  const { state } = useApp();
  const rows = state.audit.filter(a => a.ref === refNo);
  if (!rows.length) return null;
  return <div className="subsection"><h3 className="subsection-title">İşlem günlüğü</h3>
    <div className="table-wrap"><table className="table dense"><thead><tr><th>Zaman</th><th>Kullanıcı</th><th className="hide-sm">Rol</th><th>İşlem</th></tr></thead>
      <tbody>{rows.map(a => <tr key={a.id}><td className="nowrap small">{fmtDateTime(a.at)}</td><td>{a.by}</td><td className="hide-sm small">{roleLabel[a.role]}</td><td>{a.action}</td></tr>)}</tbody></table></div>
  </div>;
}

function ReasonModal({ title, label, required, onClose, onSubmit }: { title: string; label: string; required: boolean; onClose: () => void; onSubmit: (note: string) => Promise<string | null> }) {
  const { error, busy, submit } = useFormRunner();
  return <Modal open title={title} onClose={onClose} width={460}>
    <form className="form" onSubmit={e => { e.preventDefault(); const note = String(new FormData(e.currentTarget).get('note')); submit(() => onSubmit(note), onClose) }}>
      <FormError error={error} />
      <Field label={label}><textarea name="note" rows={3} required={required} maxLength={300} /></Field>
      <div className="form-actions"><Button onClick={onClose}>Vazgeç</Button><button className="btn primary" disabled={busy}>Kaydet</button></div>
    </form>
  </Modal>;
}

function Inspections({ job }: { job: Job }) {
  const { state, actor, run } = useApp();
  const { error, busy, submit } = useFormRunner();
  const [draft, setDraft] = useState<(ReturnType<typeof generateTechnicalDraft> & { causes?: string[]; ai?: boolean; notice?: string }) | null>(null);
  const [thinking, setThinking] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const writable = can(actor, 'inspection.write') && !['Teslim edildi', 'İptal'].includes(job.status);
  const vehicle = state.vehicles.find(v => v.id === job.vehicleId)!;

  async function makeDraft() {
    setThinking(true); setPicked(new Set());
    try {
      const response = await fetch('/api/ai/technical', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: job.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDraft(data);
    } catch {
      // Network or server failure: the same rule engine runs locally so the technician is never blocked.
      const past = state.jobs.filter(j => j.vehicleId === vehicle.id && j.id !== job.id).flatMap(j => j.inspections.filter(i => i.result !== 'Uygun').map(i => i.item));
      setDraft({ ...generateTechnicalDraft({ brand: vehicle.brand, model: vehicle.model, year: vehicle.year, km: job.intake.km, fuel: vehicle.fuel, complaint: job.intake.complaint, pastItems: past }), notice: 'Sunucuya ulaşılamadı; tarayıcıdaki kural tabanlı motor kullanıldı.' });
    } finally { setThinking(false) }
  }
  async function addPicked(list: Suggestion[]) {
    const chosen = list.filter((_, i) => picked.has(i));
    await run((s, a) => chosen.reduce((st, x) => addInspection(st, a, job.id, { item: x.item, result: x.priority, note: (draft?.ai ? 'Yapay zekâ önerisi' : 'Ön değerlendirme önerisi') + '; muayene ile doğrulanmalı. ' + x.reason, customerVisible: false, source: 'Ön değerlendirme' }), s), `${chosen.length} ön değerlendirme önerisi bulgu listesine eklendi`, job.no);
    setDraft(null);
  }

  return <div className="stack">
    <div className="subsection">
      <div className="subsection-head"><h3 className="subsection-title">Kontrol bulguları</h3>
        {writable && <div className="btn-row"><Button size="sm" icon="plus" onClick={() => setAdding(a => !a)}>{adding ? 'Formu kapat' : 'Bulgu ekle'}</Button><Button size="sm" icon="sparkle" disabled={thinking} onClick={makeDraft}>{draft ? 'Ön değerlendirmeyi yenile' : 'Ön değerlendirme öner'}</Button></div>}</div>
      <p className="small muted">Kabuldeki mevcut hasarlardan ayrı tutulur. Müşteriye açık bulgular portalda ve servis formunda görünür.</p>
      {job.inspections.length ? <div className="table-wrap"><table className="table dense">
        <thead><tr><th>Kontrol maddesi</th><th>Sonuç</th><th className="hide-sm">Açıklama</th><th className="hide-sm">Kaydeden</th><th>Müşteri</th></tr></thead>
        <tbody>{job.inspections.map(i => <tr key={i.id}>
          <td><strong>{i.item}</strong><InspectionPhoto id={i.id} hasPhoto={!!i.photoPath} writable={writable} />{i.source === 'Ön değerlendirme' && <small className="cell-sub">Ön değerlendirmeden</small>}</td>
          <td><Status value={i.result} /></td>
          <td className="hide-sm small">{i.note || '—'}</td>
          <td className="hide-sm small">{i.by}<small className="cell-sub">{fmtDateTime(i.at)}</small></td>
          <td>{can(actor, 'estimate.write') ? <button className={'vis-toggle ' + (i.customerVisible ? 'on' : '')} onClick={() => run((s, a) => toggleInspectionVisibility(s, a, job.id, i.id), i.customerVisible ? 'Bulgu müşteriden gizlendi' : 'Bulgu müşteriye açıldı', job.no)} aria-label={i.customerVisible ? 'Müşteriye açık' : 'Yalnız personel'}><Icon name={i.customerVisible ? 'eye' : 'eyeoff'} size={14} />{i.customerVisible ? 'Açık' : 'Gizli'}</button> : <span className="small muted">{i.customerVisible ? 'Açık' : 'Gizli'}</span>}</td>
        </tr>)}</tbody>
      </table></div> : <p className="muted small empty-line">Henüz bulgu kaydedilmedi.</p>}
    </div>

    {writable && adding && <div className="subsection boxed">
      <h3 className="subsection-title">Yeni bulgu</h3>
      <form className="form" onSubmit={e => {
        e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget;
        submit(() => run((s, a) => addInspection(s, a, job.id, { item: String(f.get('item')), result: String(f.get('result')) as InspectionResult, note: String(f.get('note')), customerVisible: f.get('visible') === 'on' }), 'Kontrol bulgusu eklendi', job.no), () => form.reset());
      }}>
        <FormError error={error} />
        <div className="grid-3">
          <Field label="Kontrol maddesi" wide><input name="item" required minLength={3} maxLength={120} list="check-items" placeholder="Ör. Ön fren balata kalınlığı" /></Field>
          <Field label="Sonuç"><select name="result"><option>Uygun</option><option>Takip edilmeli</option><option>Acil</option></select></Field>
          <Field label="Ölçüm / açıklama" wide><input name="note" maxLength={600} placeholder="Ör. 3 mm, sol ön disk çizik" /></Field>
        </div>
        <datalist id="check-items">{['Ön fren balata kalınlığı', 'Arka fren balata kalınlığı', 'Fren diski yüzeyi', 'Fren hidroliği seviyesi ve nem oranı', 'Lastik diş derinliği', 'Akü sağlık testi', 'Motor yağı seviyesi', 'Soğutma sıvısı seviyesi', 'Ön düzen boşlukları', 'Amortisörler', 'Silecekler', 'Aydınlatma', 'Egzoz sistemi', 'OBD arıza kodları'].map(x => <option key={x} value={x} />)}</datalist>
        <div className="row-between"><label className="check"><input type="checkbox" name="visible" defaultChecked /> Müşteriye açık</label><button className="btn primary" disabled={busy}>Bulguyu kaydet</button></div>
      </form>
    </div>}

    {writable && (thinking || draft) && <div className="subsection boxed">
      <h3 className="subsection-title">Teknik ön değerlendirme <span className="tag ai">Yapay zekâ</span></h3>
      <p className="small muted"><Icon name="lock" size={12} /> Modele yalnız marka/model, yıl, kabul km, yakıt türü, şikâyet metni ve aracın önceki bulguları gönderilir. Müşteri adı, telefon, plaka ve iç notlar gönderilmez. Kesin teşhis değildir.</p>
      {thinking && <div className="ai-panel"><div className="ai-loading"><i />Şikâyet ve araç geçmişi değerlendiriliyor…</div></div>}
      {draft && !thinking && <div className="ai-panel">
        <div className="ai-head"><strong><Icon name={draft.ai ? 'sparkle' : 'bulb'} size={16} />{draft.ai ? 'Yapay zekâ önerisi' : 'Kural tabanlı öneri'}</strong><span className="ai-meta">{draft.engine}</span></div>
        {draft.notice && <div className="banner warn"><Icon name="alert" size={14} />{draft.notice}</div>}
        <p>{draft.explanation}</p>
        {!!draft.causes?.length && <div><div className="mini-head">Olası nedenler</div><ol className="ai-causes">{draft.causes.map(c => <li key={c}>{c}</li>)}</ol></div>}
        <ul className="draft-list">{draft.suggestions.map((sg, i) => <li key={i}><label className="check"><input type="checkbox" checked={picked.has(i)} onChange={() => setPicked(p => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n })} /><span><strong>{sg.item}</strong><small>{sg.reason}</small></span></label><Status value={sg.priority} /></li>)}</ul>
        <div className="row-between wrap"><small className="muted">Öneriler teknisyen muayenesiyle doğrulanmalıdır.</small><Button variant="primary" disabled={!picked.size} onClick={() => addPicked(draft.suggestions)}>Seçilenleri bulgu olarak ekle ({picked.size})</Button></div>
      </div>}
    </div>}
  </div>;
}

function EstimatePanel({ job, onShare }: { job: Job; onShare: () => void }) {
  const { actor, run } = useApp();
  const [version, setVersion] = useState<number | null>(null);
  const [lineModal, setLineModal] = useState<null | { lineId?: string }>(null);
  const [decide, setDecide] = useState<null | 'Onaylandı' | 'Reddedildi'>(null);
  const latest = latestEstimate(job);
  const e = job.estimates.find(x => x.version === version) ?? latest;
  const writable = can(actor, 'estimate.write');
  const canStart = writable && !['Teslime hazır', 'Teslim edildi', 'İptal'].includes(job.status) && (!latest || latest.status !== 'Taslak');

  if (!e) return <div className="empty-line">
    <p className="muted small">Henüz teklif hazırlanmadı. {writable ? 'Hizmet türüne göre önerilen kalemlerle taslak oluşturulur.' : 'Teklifi servis danışmanı hazırlar.'}</p>
    {canStart && <Button variant="primary" icon="plus" onClick={() => run((s, a) => createEstimateDraft(s, a, job.id), 'Teklif taslağı oluşturuldu', job.no)}>Teklif taslağı oluştur</Button>}
  </div>;
  const t = estimateTotals(e);
  const editable = writable && e.status === 'Taslak' && e.id === latest?.id;

  return <div className="stack">
    <div className="subsection-head">
      <div className="seg small" role="group" aria-label="Teklif sürümü">{job.estimates.map(x => <button key={x.id} className={x.id === e.id ? 'active' : ''} onClick={() => setVersion(x.version)}>v{x.version} · {x.status}</button>)}</div>
      <div className="btn-row">
        {editable && <Button size="sm" icon="plus" onClick={() => setLineModal({})}>Kalem ekle</Button>}
        {canStart && <Button size="sm" icon="plus" onClick={() => { run((s, a) => createEstimateDraft(s, a, job.id), `Teklif v${(latest?.version ?? 0) + 1} taslağı oluşturuldu`, job.no); setVersion(null) }}>{latest ? 'Yeni sürüm (revizyon)' : 'Taslak oluştur'}</Button>}
      </div>
    </div>
    <p className="small muted">{e.createdBy} · {fmtDateTime(e.createdAt)}{e.sentAt && <> · gönderim {fmtDateTime(e.sentAt)}</>}</p>
    {e.id !== latest?.id && <div className="banner"><Icon name="history" size={15} />Eski sürüm görüntüleniyor. Bu sürüme verilen karar güncel sürüm için geçerli değildir.</div>}
    <div className="lines-box">
      {e.lines.length ? <div className="table-wrap"><table className="table dense lines">
        <thead><tr><th>Tür</th><th>Kod</th><th>Açıklama</th><th className="num">Miktar</th><th className="num hide-sm">Birim fiyat</th><th className="num hide-sm">İnd.</th><th className="num">Tutar</th>{editable && <th />}</tr></thead>
        <tbody>{e.lines.map(l => <tr key={l.id}>
          <td><span className={'tag ' + (l.kind === 'Parça' ? 'blue' : 'violet')}>{l.kind}</span></td>
          <td className="mono small">{l.code || '—'}</td><td>{l.name}</td>
          <td className="num">{qtyText(l.qty)} {l.unit}</td><td className="num hide-sm">{money(l.unitPrice)}</td>
          <td className="num hide-sm">{l.discountPct ? `%${l.discountPct}` : '—'}</td><td className="num strong">{money(lineTotals(l).net)}</td>
          {editable && <td className="actions"><button className="icon-btn" aria-label="Düzenle" onClick={() => setLineModal({ lineId: l.id })}><Icon name="edit" size={14} /></button><button className="icon-btn" aria-label="Sil" onClick={() => run((s, a) => removeLine(s, a, job.id, l.id), `"${l.name}" tekliften çıkarıldı`, job.no)}><Icon name="trash" size={14} /></button></td>}
        </tr>)}</tbody>
      </table></div> : <p className="muted small empty-line">Kalem yok. Parça ve işçilik kalemlerini ekleyin.</p>}
      <div className="totals">
        <div className="totals-note">
          {editable ? <textarea defaultValue={e.note} rows={3} maxLength={800} placeholder="Müşteriye açıklama (ör. değişim gerekçesi, garanti süresi)" aria-label="Teklif açıklaması" onBlur={ev => ev.target.value !== e.note && run((s, a) => setEstimateNote(s, a, job.id, ev.target.value), 'Teklif açıklaması güncellendi', job.no)} />
            : e.note && <p className="quote">{e.note}</p>}
        </div>
        <dl className="sum">
          <div><dt>Parça</dt><dd>{money(t.parts)}</dd></div>
          <div><dt>İşçilik</dt><dd>{money(t.labor)}</dd></div>
          {t.discount > 0 && <div><dt>İndirim</dt><dd>−{money(t.discount)}</dd></div>}
          <div><dt>Ara toplam</dt><dd>{money(t.subtotal)}</dd></div>
          <div><dt>KDV %{e.vatRate}</dt><dd>{money(t.vat)}</dd></div>
          <div className="total"><dt>Genel toplam</dt><dd>{money(t.total)}</dd></div>
        </dl>
      </div>
    </div>
    {e.decision && <div className={'banner ' + (e.decision.result === 'Onaylandı' ? 'ok' : 'bad')}><Icon name={e.decision.result === 'Onaylandı' ? 'check' : 'x'} size={15} /><div><strong>{e.decision.result}</strong> · {e.decision.channel} · {e.decision.by} · {fmtDateTime(e.decision.at)}{e.decision.note && <p>{e.decision.note}</p>}</div></div>}
    {editable && <div className="action-bar"><span className="muted small">Gönderildikten sonra bu sürüm değiştirilemez; değişiklik yeni sürüm gerektirir ve önceki onay geçerliliğini yitirir.</span>
      <Button variant="primary" icon="send" onClick={() => run((s, a) => sendEstimate(s, a, job.id), `Teklif v${e.version} müşteri onayına gönderildi`, job.no).then(err => { if (!err) onShare() })}>Müşteri onayına gönder</Button></div>}
    {writable && e.status === 'Gönderildi' && e.id === latest?.id && <div className="action-bar"><span className="muted small">Müşteri portaldan karar verebilir. Telefon veya şubede alınan kararı buradan kaydedin.</span>
      <div className="btn-row"><Button icon="send" onClick={onShare}>Müşteriye ilet</Button><Button onClick={() => setDecide('Reddedildi')}>Ret kaydet</Button><Button variant="primary" icon="check" onClick={() => setDecide('Onaylandı')}>Onay kaydet</Button></div></div>}
    {lineModal && <LineForm open job={job} line={e.lines.find(l => l.id === lineModal.lineId)} onClose={() => setLineModal(null)} />}
    {decide && <DecisionModal job={job} estimate={e} result={decide} onClose={() => setDecide(null)} />}
  </div>;
}

function DecisionModal({ job, estimate, result, onClose }: { job: Job; estimate: Estimate; result: 'Onaylandı' | 'Reddedildi'; onClose: () => void }) {
  const { run } = useApp();
  const { error, busy, submit } = useFormRunner();
  return <Modal open title={result === 'Onaylandı' ? `Teklif v${estimate.version} onayını kaydet` : `Teklif v${estimate.version} reddini kaydet`} sub={`Genel toplam ${money(estimateTotals(estimate).total)}`} onClose={onClose} width={480}>
    <form className="form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); submit(() => run((s, a) => decideEstimate(s, a, job.id, estimate.id, result, String(f.get('channel')) as Channel, String(f.get('note'))), `Teklif v${estimate.version}: ${result} (${f.get('channel')})`, job.no), onClose) }}>
      <FormError error={error} />
      <Field label="Kanal"><select name="channel"><option>Telefon</option><option>Şube</option></select></Field>
      <Field label="Görüşme açıklaması" hint="Kiminle, ne zaman görüşüldü; hangi kalemler konuşuldu"><textarea name="note" rows={3} required minLength={5} maxLength={400} /></Field>
      <div className="form-actions"><Button onClick={onClose}>Vazgeç</Button><button className={'btn ' + (result === 'Onaylandı' ? 'primary' : 'danger')} disabled={busy}>{result === 'Onaylandı' ? 'Onayı kaydet' : 'Reddi kaydet'}</button></div>
    </form>
  </Modal>;
}

function Payments({ job }: { job: Job }) {
  const approved = approvedEstimate(job);
  return <>
    <p className="small muted pad-x">{approved ? `Onaylı teklif v${approved.version} üzerinden · onaylı tutar ${money(amountDue(job))}` : 'Onaylı teklif yok; tahsilat girilemez.'}</p>
    {job.payments.length ? <div className="table-wrap"><table className="table dense">
      <thead><tr><th>Tarih</th><th>Yöntem</th><th className="hide-sm">Açıklama</th><th className="hide-sm">Kaydeden</th><th className="num">Tutar</th></tr></thead>
      <tbody>{job.payments.map(p => <tr key={p.id}><td className="nowrap">{fmtDateTime(p.at)}</td><td>{p.method}</td><td className="hide-sm">{p.note || '—'}</td><td className="hide-sm">{p.by}</td><td className="num strong">{money(p.amount)}</td></tr>)}</tbody>
      <tfoot><tr><td colSpan={4} className="hide-sm">Kalan bakiye</td><td className="num strong">{money(balance(job))}</td></tr></tfoot>
    </table></div> : <p className="muted small empty-line pad-x">Tahsilat kaydı yok.</p>}
  </>;
}
