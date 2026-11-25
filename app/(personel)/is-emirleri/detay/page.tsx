'use client';
import { detailHref } from '@/lib/routes';
import { InspectionPhoto } from '@/components/inspection-photo';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApp } from '@/components/store';
import { Button, Empty, Field, FormError, KV, Menu, Modal, Status, useFormRunner, type MenuItem } from '@/components/ui';
import { Icon, type IconName } from '@/components/icons';
import { CarImage, Plate } from '@/components/vehicle-identity';
import { PaymentForm } from '@/components/payment';
import { ShareSheet } from '@/components/share-sheet';
import { estimateMessage } from '@/lib/share';
import { DamageMap, DeliveryForm, EvaluationForm, FuelGauge, LineForm, NoteForm } from '@/components/forms';
import {
  addInspection, allowedMoves, amountDue, amountPaid, approvedEstimate, balance, can, createEstimateDraft, decideEstimate, estimateTotals,
  latestEstimate, lineTotals, moveJob, reassignJob, removeLine, sendEstimate, serviceName, setEstimateNote, staffName, technicians, toggleInspectionVisibility,
} from '@/lib/commands';
import { generateTechnicalDraft, type Suggestion } from '@/lib/advisor';
import { fmtDate, fmtDateTime, km, money, qtyText } from '@/lib/format';
import type { Channel, Estimate, InspectionResult, Job, JobStatus } from '@/lib/types';

type Modal_ = '' | 'payment' | 'deliver' | 'evaluate' | 'cancel' | 'parts' | 'share' | 'note';
interface Action { label: string; icon?: IconName; run: () => void; disabled?: boolean; hint?: string; move?: JobStatus }

/** Elle seçilebilen geçişlerin düğme adları. */
const moveLabel: Partial<Record<JobStatus, string>> = {
  'İnceleniyor': 'Muayeneye başla', 'İşlemde': 'İşe başla', 'Parça bekliyor': 'Parça bekliyor', 'Son kontrol': 'Son kontrole al', 'Teslime hazır': 'Hazır', 'İptal': 'İptal et',
};

export default function Page() {
  return <Suspense><JobDetail /></Suspense>;
}

function JobDetail() {
  const id = useSearchParams().get('id');
  const { state, actor, run } = useApp();
  const router = useRouter();
  const [modal, setModal] = useState<Modal_>('');
  const [decide, setDecide] = useState<null | 'Onaylandı' | 'Reddedildi'>(null);
  const job = state.jobs.find(j => j.id === id);
  if (!job) return <Empty icon="wrench" title="İş emri bulunamadı"><Link href="/is-emirleri">İş emirlerine dön</Link></Empty>;
  if (actor.role === 'technician' && job.technicianId !== actor.userId) return <Empty icon="lock" title="Bu iş emri size atanmamış">Atanan işlerinizi Pano’da görebilirsiniz.</Empty>;
  const vehicle = state.vehicles.find(v => v.id === job.vehicleId)!;
  const customer = state.customers.find(c => c.id === job.customerId)!;
  const moves = allowedMoves(job, actor);
  const latest = latestEstimate(job);
  const showMoney = can(actor, 'payment.read');
  const estWrite = can(actor, 'estimate.write');
  const canPay = can(actor, 'payment.write');
  const scrollTo = (sec: string) => setTimeout(() => document.getElementById(sec)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);

  function doMove(m: JobStatus) {
    if (m === 'İptal') { setModal('cancel'); return }
    if (m === 'Parça bekliyor') { setModal('parts'); return }
    run((s, a) => moveJob(s, a, job!.id, m), `${job!.no} → ${m}`, job!.no);
  }
  const mv = (m: JobStatus, label = moveLabel[m] ?? m, icon: IconName = 'arrow'): Action => ({ label, icon, run: () => doMove(m), move: m });
  const draft = () => run((s, a) => createEstimateDraft(s, a, job.id), `Teklif v${(latest?.version ?? 0) + 1} taslağı oluşturuldu`, job.no).then(err => { if (!err) scrollTo('isler') });
  const send = () => run((s, a) => sendEstimate(s, a, job.id), `Teklif v${latest?.version} müşteri onayına gönderildi`, job.no).then(err => { if (!err) setModal('share') });

  // Duruma göre tek ana eylem.
  let primary: Action | null = null;
  const st = job.status;
  if (st === 'Kabul edildi' && moves.includes('İnceleniyor')) primary = mv('İnceleniyor', 'Muayeneye başla', 'clipboard');
  else if (st === 'İnceleniyor' && estWrite) primary = latest?.status === 'Taslak'
    ? { label: 'Onaya gönder', icon: 'mail', run: send, disabled: !latest.lines.length, hint: latest.lines.length ? undefined : 'Önce teklife kalem ekleyin' }
    : { label: 'Teklif hazırla', icon: 'receipt', run: draft };
  else if (st === 'Onay bekliyor') {
    if (moves.includes('İşlemde')) primary = mv('İşlemde', 'İşe başla', 'wrench');
    else if (moves.includes('Teslime hazır')) primary = mv('Teslime hazır', 'İşlemsiz teslime hazırla', 'check');
    else if (estWrite && latest?.status === 'Gönderildi') primary = { label: 'Onayı kaydet', icon: 'check', run: () => setDecide('Onaylandı') };
  }
  else if (st === 'İşlemde' && moves.includes('Son kontrol')) primary = mv('Son kontrol', 'Son kontrole al', 'clipboard');
  else if (st === 'Parça bekliyor' && moves.includes('İşlemde')) primary = mv('İşlemde', 'Parça geldi, işe devam', 'wrench');
  else if (st === 'Son kontrol' && moves.includes('Teslime hazır')) primary = mv('Teslime hazır', 'Hazır', 'check');
  else if (st === 'Teslime hazır' && canPay) primary = balance(job) > 0
    ? { label: 'Tahsil et', icon: 'wallet', run: () => setModal('payment') }
    : { label: 'Teslim et', icon: 'check', run: () => setModal('deliver') };
  else if (st === 'Teslim edildi' && can(actor, 'evaluation.write')) primary = { label: 'Ziyareti değerlendir', icon: 'star', run: () => setModal('evaluate') };

  const more: MenuItem[] = [
    ...moves.filter(m => m !== primary?.move && m !== 'İptal').map(m => ({ label: m === 'Teslime hazır' && st === 'Onay bekliyor' ? 'İşlemsiz teslime hazırla' : m === 'İşlemde' && st === 'Son kontrol' ? 'İşleme geri al' : moveLabel[m] ?? m, icon: 'arrow' as const, onClick: () => doMove(m) })),
    ...(st === 'Teslime hazır' && canPay && primary?.label !== 'Teslim et' ? [{ label: 'Teslim et', icon: 'check' as const, onClick: () => setModal('deliver') }] : []),
    ...(showMoney && canPay && balance(job) > 0 && primary?.label !== 'Tahsil et' ? [{ label: 'Ödeme al', icon: 'wallet' as const, onClick: () => setModal('payment') }] : []),
    { label: 'Servis formu', icon: 'printer', href: detailHref('/servis-formu', job.id), target: '_blank' },
    ...(moves.includes('İptal') ? [{ label: 'İş emrini iptal et', icon: 'x' as const, danger: true, onClick: () => setModal('cancel') }] : []),
  ];

  return <>
    <div className="wo-head">
      <nav className="crumbs" aria-label="Konum"><span><Link href="/is-emirleri">İş Emirleri</Link><Icon name="right" size={12} /></span><span className="mono">{job.no}</span></nav>
      <div className="wo-head-row">
        <div className="wo-title">
          <Plate value={vehicle.plate} size="lg" />
          <div>
            <h1><span>{vehicle.brand} {vehicle.model}</span><Status value={job.status} /></h1>
            <p className="wo-meta">
              {can(actor, 'customer.write') ? <Link href={detailHref('/musteriler/detay', customer.id)}>{customer.name}</Link> : <span>{customer.name}</span>}
              <a href={`tel:${customer.phone.replace(/\s/g, '')}`}><Icon name="phone" size={13} />{customer.phone}</a>
              <span>{serviceName(state, job.serviceId)}</span>
              <span>Söz: {fmtDate(job.promisedAt, { day: '2-digit', month: '2-digit' })} {new Date(job.promisedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
            </p>
          </div>
        </div>
        <div className="wo-actions">
          <Menu items={more} label="Diğer" />
          {primary && <Button variant="primary" icon={primary.icon} disabled={primary.disabled} title={primary.hint} onClick={primary.run}>{primary.label}</Button>}
        </div>
      </div>
    </div>

    <div className="wo-layout">
      <div className="wo-main">
        <Section n={1} id="kabul" title="Şikâyet ve kabul" meta={`${job.intake.by} · ${fmtDateTime(job.intake.at)}`}><Intake job={job} /></Section>
        <Section n={2} id="muayene" title="Muayene" meta={inspectionMeta(job)}><Inspections job={job} /></Section>
        <Section n={3} id="isler" title="İşler ve parçalar" meta={latest ? <>Teklif v{latest.version} <Status value={latest.status} /></> : undefined}>
          <EstimatePanel job={job} onDraft={draft} onSend={send} onShare={() => setModal('share')} onDecide={setDecide} />
        </Section>
        <Section n={4} id="notlar" title="Notlar ve geçmiş"
          actions={can(actor, 'note.write') && <Button size="sm" icon="plus" onClick={() => setModal('note')}>İç not</Button>}><NotesHistory job={job} /></Section>
      </div>

      <aside className="wo-side">
        {showMoney && <MoneyPanel job={job} onPay={() => setModal('payment')} />}
        <div className="side-card">
          <div className="side-car"><CarImage vehicle={vehicle} eager /></div>
          <KV cols={1} items={[
            ['Araç', <Link key="v" href={detailHref('/araclar/detay', vehicle.id)}>{vehicle.brand} {vehicle.model} · {vehicle.year}</Link>],
            ['Kabul km', km(job.intake.km)],
            ['Yakıt / vites', `${vehicle.fuel} · ${vehicle.transmission}`],
            ['Şasi', <span className="mono small" key="vin">{vehicle.vin || '—'}</span>],
          ]} />
        </div>
        <div className="side-card">
          <KV cols={1} items={[
            ['Servis danışmanı', staffName(state, job.advisorId)],
            ['Teknisyen', can(actor, 'job.create') && !['Teslim edildi', 'İptal'].includes(job.status)
              ? <select key="t" className="select sm" value={job.technicianId} onChange={e => run((s, a) => reassignJob(s, a, job.id, e.target.value), `${job.no} teknisyeni ${staffName(state, e.target.value)} olarak değiştirildi`, job.no)} aria-label="Teknisyen">{technicians(state).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              : staffName(state, job.technicianId)],
            ['Söz verilen teslim', fmtDateTime(job.promisedAt)],
            ...(job.deliveredAt ? [['Teslim', fmtDateTime(job.deliveredAt)] as [string, string]] : []),
            ['İletişim tercihi', customer.preference],
          ]} />
        </div>
      </aside>
    </div>

    {modal === 'payment' && <PaymentForm open job={job} onClose={() => setModal('')} />}
    {modal === 'deliver' && <DeliveryForm open job={job} onClose={() => setModal('')} onDone={() => router.push(detailHref('/servis-formu', job.id))} />}
    {modal === 'evaluate' && <EvaluationForm open job={job} onClose={() => setModal('')} />}
    {modal === 'note' && <NoteForm open customerId={customer.id} onClose={() => setModal('')} />}
    {(modal === 'cancel' || modal === 'parts') && <ReasonModal title={modal === 'cancel' ? 'İş emrini iptal et' : 'Parça bekliyor'} label={modal === 'cancel' ? 'İptal gerekçesi' : 'Beklenen parça / tedarikçi'} required={modal === 'cancel'}
      onClose={() => setModal('')} onSubmit={note => { const to: JobStatus = modal === 'cancel' ? 'İptal' : 'Parça bekliyor'; return run((s, a) => moveJob(s, a, job.id, to, note), `${job.no} → ${to}`, job.no) }} />}
    {decide && latest && <DecisionModal job={job} estimate={latest} result={decide} onClose={() => setDecide(null)} />}
    {modal === 'share' && latest && <Modal open title={`Teklif v${latest.version} müşteriye iletilsin`} sub={`${customer.preference} tercih ediyor · portaldan onaylanabilir`} onClose={() => setModal('')} width={760}>
      <ShareSheet name={customer.name} phone={customer.phone} email={customer.email || undefined} subject={`${job.no} servis teklifi`} text={estimateMessage(state, job, latest, location.origin)} />
    </Modal>}
  </>;
}

function inspectionMeta(job: Job) {
  if (!job.inspections.length) return undefined;
  const n = (r: InspectionResult) => job.inspections.filter(i => i.result === r).length;
  return <span className="lights" aria-label={`${n('Uygun')} uygun, ${n('Takip edilmeli')} takip, ${n('Acil')} acil`}>
    <span><i className="light green" />{n('Uygun')}</span><span><i className="light amber" />{n('Takip edilmeli')}</span><span><i className="light red" />{n('Acil')}</span>
  </span>;
}

function Section({ n, id, title, meta, actions, children }: { n: number; id: string; title: string; meta?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return <section className="wo-sec" id={id} aria-labelledby={id + '-h'}>
    <header><span className="wo-n">{n}</span><h2 id={id + '-h'}>{title}</h2>{meta && <span className="wo-sec-meta">{meta}</span>}{actions && <div className="wo-sec-actions">{actions}</div>}</header>
    <div className="wo-body">{children}</div>
  </section>;
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

function Intake({ job }: { job: Job }) {
  const { state } = useApp();
  const appt = state.appointments.find(a => a.id === job.appointmentId);
  return <div className="stack">
    <p className="quote">{job.intake.complaint}</p>
    <div className="intake-view">
      <DamageMap damages={job.intake.damages} readOnly />
      <div className="stack">
        <KV items={[['Kilometre', km(job.intake.km)], ['Yakıt', <FuelGauge key="f" value={job.intake.fuel} />], ['Randevu', appt ? `${appt.no} · ${fmtDate(appt.date)} ${appt.time}` : 'Randevusuz'], ['Müşteri teyidi', job.intake.customerAck ? 'Birlikte kontrol edildi' : '—']]} />
        <KV cols={1} items={[
          ['Mevcut hasarlar', job.intake.damages.length ? <ul key="d" className="dmg-list">{job.intake.damages.map(d => <li key={d.area}><b>{d.area}</b> · {d.kind}{d.note && ` — ${d.note}`}</li>)}</ul> : 'Yok'],
          ['Araçta bırakılanlar', job.intake.belongings || '—'],
        ]} />
      </div>
    </div>
  </div>;
}

function Inspections({ job }: { job: Job }) {
  const { state, actor, run } = useApp();
  const { error, busy, submit } = useFormRunner();
  const [draft, setDraft] = useState<(ReturnType<typeof generateTechnicalDraft> & { causes?: string[]; ai?: boolean; notice?: string }) | null>(null);
  const [thinking, setThinking] = useState(false);
  const [ai, setAi] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const writable = can(actor, 'inspection.write') && !['Teslim edildi', 'İptal'].includes(job.status);
  const vehicle = state.vehicles.find(v => v.id === job.vehicleId)!;

  async function makeDraft() {
    setAi(true); setThinking(true); setPicked(new Set());
    try {
      const response = await fetch('/api/ai/technical', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: job.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDraft(data);
    } catch {
      // Ağ veya sunucu hatasında aynı kural motoru tarayıcıda çalışır; teknisyen beklemez.
      const past = state.jobs.filter(j => j.vehicleId === vehicle.id && j.id !== job.id).flatMap(j => j.inspections.filter(i => i.result !== 'Uygun').map(i => i.item));
      setDraft({ ...generateTechnicalDraft({ brand: vehicle.brand, model: vehicle.model, year: vehicle.year, km: job.intake.km, fuel: vehicle.fuel, complaint: job.intake.complaint, pastItems: past }), notice: 'Sunucuya ulaşılamadı; tarayıcıdaki kural tabanlı motor kullanıldı.' });
    } finally { setThinking(false) }
  }
  async function addPicked(list: Suggestion[]) {
    const chosen = list.filter((_, i) => picked.has(i));
    await run((s, a) => chosen.reduce((st, x) => addInspection(st, a, job.id, { item: x.item, result: x.priority, note: (draft?.ai ? 'Yapay zekâ önerisi' : 'Ön değerlendirme önerisi') + '; muayene ile doğrulanmalı. ' + x.reason, customerVisible: false, source: 'Ön değerlendirme' }), s), `${chosen.length} ön değerlendirme önerisi bulgu listesine eklendi`, job.no);
    setDraft(null); setAi(false);
  }

  return <div className="stack">
    {job.inspections.length ? <div className="table-wrap flush-x"><table className="table">
      <thead><tr><th>Kontrol</th><th>Sonuç</th><th>Müşteri</th></tr></thead>
      <tbody>{job.inspections.map(i => <tr key={i.id}>
        <td><strong>{i.item}</strong>{i.note && <span className="insp-note">{i.note}</span>}<InspectionPhoto id={i.id} hasPhoto={!!i.photoPath} writable={writable} /><small className="cell-sub">{i.by} · {fmtDateTime(i.at)}{i.source === 'Ön değerlendirme' && ' · ön değerlendirmeden'}</small></td>
        <td><Status value={i.result} /></td>
        <td>{can(actor, 'estimate.write') ? <button className={'vis-toggle ' + (i.customerVisible ? 'on' : '')} onClick={() => run((s, a) => toggleInspectionVisibility(s, a, job.id, i.id), i.customerVisible ? 'Bulgu müşteriden gizlendi' : 'Bulgu müşteriye açıldı', job.no)} aria-label={i.customerVisible ? 'Müşteriye açık' : 'Yalnız personel'}><Icon name={i.customerVisible ? 'eye' : 'eyeoff'} size={14} />{i.customerVisible ? 'Açık' : 'Gizli'}</button> : <span className="small muted">{i.customerVisible ? 'Açık' : 'Gizli'}</span>}</td>
      </tr>)}</tbody>
    </table></div> : <p className="muted small">Henüz muayene bulgusu yok.</p>}

    {writable && <form className="inline-add" onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget;
      submit(() => run((s, a) => addInspection(s, a, job.id, { item: String(f.get('item')), result: String(f.get('result')) as InspectionResult, note: String(f.get('note')), customerVisible: f.get('visible') === 'on' }), 'Muayene bulgusu eklendi', job.no), () => form.reset());
    }}>
      <FormError error={error} />
      <div className="inline-add-row">
        <input name="item" required minLength={3} maxLength={120} list="check-items" placeholder="Kontrol maddesi (ör. Ön fren balatası)" aria-label="Kontrol maddesi" />
        <select name="result" aria-label="Sonuç"><option>Uygun</option><option>Takip edilmeli</option><option>Acil</option></select>
        <input name="note" maxLength={600} placeholder="Ölçüm / açıklama" aria-label="Ölçüm veya açıklama" />
        <label className="check"><input type="checkbox" name="visible" defaultChecked /> Müşteriye açık</label>
        <button className="btn primary" disabled={busy}><Icon name="plus" size={15} />Ekle</button>
      </div>
      <datalist id="check-items">{['Ön fren balata kalınlığı', 'Arka fren balata kalınlığı', 'Fren diski yüzeyi', 'Fren hidroliği seviyesi ve nem oranı', 'Lastik diş derinliği', 'Akü sağlık testi', 'Motor yağı seviyesi', 'Soğutma sıvısı seviyesi', 'Ön düzen boşlukları', 'Amortisörler', 'Silecekler', 'Aydınlatma', 'Egzoz sistemi', 'OBD arıza kodları'].map(x => <option key={x} value={x} />)}</datalist>
    </form>}

    {writable && !ai && <div><Button size="sm" icon="sparkle" onClick={makeDraft}>Asistandan kontrol listesi öner</Button></div>}
    {writable && ai && <div className="ai-panel">
      <div className="ai-head"><strong><Icon name={draft?.ai ? 'sparkle' : 'bulb'} size={16} />Ön değerlendirme</strong>{draft && <span className="ai-meta">{draft.engine}</span>}<button className="icon-btn" aria-label="Kapat" onClick={() => { setAi(false); setDraft(null) }}><Icon name="x" size={14} /></button></div>
      <p className="small muted"><Icon name="lock" size={12} /> Yalnız marka/model, yıl, km, yakıt, şikâyet ve önceki bulgular gönderilir; müşteri bilgisi gönderilmez. Kesin teşhis değildir.</p>
      {thinking && <div className="ai-loading"><i />Değerlendiriliyor…</div>}
      {draft && !thinking && <>
        {draft.notice && <div className="banner warn"><Icon name="alert" size={14} />{draft.notice}</div>}
        <p>{draft.explanation}</p>
        {!!draft.causes?.length && <div><div className="mini-head">Olası nedenler</div><ol className="ai-causes">{draft.causes.map(c => <li key={c}>{c}</li>)}</ol></div>}
        <ul className="draft-list">{draft.suggestions.map((sg, i) => <li key={i}><label className="check"><input type="checkbox" checked={picked.has(i)} onChange={() => setPicked(p => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n })} /><span><strong>{sg.item}</strong><small>{sg.reason}</small></span></label><Status value={sg.priority} /></li>)}</ul>
        <div className="row-between wrap"><Button size="sm" onClick={makeDraft}>Yeniden oluştur</Button><Button variant="primary" size="sm" disabled={!picked.size} onClick={() => addPicked(draft.suggestions)}>Seçilenleri bulgu olarak ekle ({picked.size})</Button></div>
      </>}
    </div>}
  </div>;
}

function EstimatePanel({ job, onDraft, onSend, onShare, onDecide }: { job: Job; onDraft: () => void; onSend: () => void; onShare: () => void; onDecide: (r: 'Onaylandı' | 'Reddedildi') => void }) {
  const { actor, run } = useApp();
  const [version, setVersion] = useState<number | null>(null);
  const [lineModal, setLineModal] = useState<null | { lineId?: string }>(null);
  const latest = latestEstimate(job);
  const e = job.estimates.find(x => x.version === version) ?? latest;
  const writable = can(actor, 'estimate.write');
  const canStart = writable && !['Teslime hazır', 'Teslim edildi', 'İptal'].includes(job.status) && (!latest || latest.status !== 'Taslak');

  if (!e) return <div className="empty-inline"><span className="muted">{writable ? 'Teklif henüz hazırlanmadı. Hizmet türüne göre önerilen kalemlerle taslak açılır.' : 'Teklifi servis danışmanı hazırlar.'}</span>{canStart && <Button variant="primary" icon="plus" onClick={onDraft}>Teklif hazırla</Button>}</div>;
  const t = estimateTotals(e);
  const editable = writable && e.status === 'Taslak' && e.id === latest?.id;

  return <div className="stack">
    {(job.estimates.length > 1 || canStart) && <div className="toolbar tight">
      {job.estimates.length > 1 && <div className="seg small" aria-label="Teklif sürümü">{job.estimates.map(x => <button key={x.id} className={x.id === e.id ? 'active' : ''} onClick={() => setVersion(x.version)}>v{x.version} · {x.status}</button>)}</div>}
      {canStart && <div className="toolbar-end"><Button size="sm" icon="plus" onClick={() => { onDraft(); setVersion(null) }}>Yeni sürüm (ek iş / revizyon)</Button></div>}
    </div>}
    {e.id !== latest?.id && <div className="banner"><Icon name="history" size={15} />Eski sürüm görüntüleniyor; karar güncel sürüm için verilir.</div>}
    {e.lines.length ? <div className="table-wrap flush-x"><table className="table lines">
      <thead><tr><th>İş / parça</th><th className="num">Miktar</th><th className="num hide-sm">Birim fiyat</th><th className="num hide-sm">İnd.</th><th className="num">Tutar</th>{editable && <th />}</tr></thead>
      <tbody>{e.lines.map(l => <tr key={l.id}>
        <td><span className={'kind-dot ' + (l.kind === 'Parça' ? 'part' : 'labor')} title={l.kind} />{l.name}<small className="cell-sub">{l.kind}{l.code && <> · <span className="mono">{l.code}</span></>}</small></td>
        <td className="num">{qtyText(l.qty)} {l.unit}</td><td className="num hide-sm">{money(l.unitPrice)}</td>
        <td className="num hide-sm">{l.discountPct ? `%${l.discountPct}` : '—'}</td><td className="num strong">{money(lineTotals(l).net)}</td>
        {editable && <td className="actions"><button className="icon-btn" aria-label="Düzenle" onClick={() => setLineModal({ lineId: l.id })}><Icon name="edit" size={14} /></button><button className="icon-btn" aria-label="Sil" onClick={() => run((s, a) => removeLine(s, a, job.id, l.id), `"${l.name}" tekliften çıkarıldı`, job.no)}><Icon name="trash" size={14} /></button></td>}
      </tr>)}</tbody>
      <tfoot><tr><td colSpan={2} className="muted">KDV dahil toplam</td><td className="hide-sm" /><td className="hide-sm" /><td className="num strong">{money(t.total)}</td>{editable && <td />}</tr></tfoot>
    </table></div> : <p className="muted small">Teklifte kalem yok.</p>}
    {editable ? <textarea className="note-input" defaultValue={e.note} rows={2} maxLength={800} placeholder="Müşteriye açıklama (değişim gerekçesi, garanti süresi…)" onBlur={ev => ev.target.value !== e.note && run((s, a) => setEstimateNote(s, a, job.id, ev.target.value), 'Teklif açıklaması güncellendi', job.no)} />
      : e.note && <p className="quote">{e.note}</p>}
    {e.decision && <div className={'banner ' + (e.decision.result === 'Onaylandı' ? 'ok' : 'bad')}><Icon name={e.decision.result === 'Onaylandı' ? 'check' : 'x'} size={15} /><div><strong>{e.decision.result}</strong> · {e.decision.channel} · {e.decision.by} · {fmtDateTime(e.decision.at)}{e.decision.note && <p>{e.decision.note}</p>}</div></div>}
    {editable && <div className="btn-row"><Button icon="plus" onClick={() => setLineModal({})}>Kalem ekle</Button><Button variant="primary" icon="mail" disabled={!e.lines.length} onClick={onSend}>Müşteri onayına gönder</Button><span className="muted small">Gönderilen sürüm değiştirilemez.</span></div>}
    {writable && e.status === 'Gönderildi' && e.id === latest?.id && <div className="btn-row"><Button icon="mail" onClick={onShare}>Müşteriye ilet</Button><Button onClick={() => onDecide('Reddedildi')}>Ret kaydet</Button><Button variant="primary" icon="check" onClick={() => onDecide('Onaylandı')}>Onay kaydet</Button><span className="muted small">Müşteri portaldan da karar verebilir.</span></div>}
    {lineModal && <LineForm open job={job} line={e.lines.find(l => l.id === lineModal.lineId)} onClose={() => setLineModal(null)} />}
  </div>;
}

function MoneyPanel({ job, onPay }: { job: Job; onPay: () => void }) {
  const { actor } = useApp();
  const latest = latestEstimate(job);
  const approved = approvedEstimate(job);
  const shown = approved ?? latest;
  const t = shown ? estimateTotals(shown) : null;
  return <div className="side-card money">
    <h3>Tutar{shown && <small> · teklif v{shown.version}{shown !== latest && ' (onaylı)'}</small>}</h3>
    {t ? <dl className="sum">
      <div><dt>Parça</dt><dd>{money(t.parts)}</dd></div>
      <div><dt>İşçilik</dt><dd>{money(t.labor)}</dd></div>
      {t.discount > 0 && <div><dt>İndirim</dt><dd>−{money(t.discount)}</dd></div>}
      <div><dt>Ara toplam</dt><dd>{money(t.subtotal)}</dd></div>
      <div><dt>KDV %{shown!.vatRate}</dt><dd>{money(t.vat)}</dd></div>
      <div className="total"><dt>Genel toplam</dt><dd>{money(t.total)}</dd></div>
    </dl> : <p className="muted small">Teklif hazırlanınca tutar burada görünür.</p>}
    <dl className="sum pay">
      <div><dt>Onaylı iş</dt><dd>{money(amountDue(job))}</dd></div>
      <div><dt>Tahsil edilen</dt><dd>{money(amountPaid(job))}</dd></div>
      <div className="total"><dt>Kalan</dt><dd className={balance(job) > 0 ? 'text-bad' : ''}>{money(balance(job))}</dd></div>
    </dl>
    {latest && latest.status === 'Gönderildi' && latest !== shown && <p className="small muted">v{latest.version} ({money(estimateTotals(latest).total)}) müşteri kararını bekliyor.</p>}
    {can(actor, 'payment.write') && balance(job) > 0 && <Button variant="primary" icon="wallet" className="block" onClick={onPay}>Ödeme al</Button>}
    {job.payments.length > 0 && <ul className="pay-list">{job.payments.map(p => <li key={p.id}><span>{fmtDate(p.at, { day: '2-digit', month: '2-digit' })} · {p.method}</span><b>{money(p.amount)}</b></li>)}</ul>}
  </div>;
}

function NotesHistory({ job }: { job: Job }) {
  const { state, actor } = useApp();
  const notes = can(actor, 'note.read') ? state.notes.filter(n => n.customerId === job.customerId && (!n.jobId || n.jobId === job.id)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4) : [];
  return <div className="stack">
    {notes.length > 0 && <ul className="note-list compact">{notes.map(n => <li key={n.id}><div className="row-between"><span className="tag slate"><Icon name="lock" size={11} /> {n.category}</span><small className="muted">{n.by} · {fmtDateTime(n.at)}</small></div><p>{n.text}</p></li>)}</ul>}
    <ol className="timeline">{[...job.history].reverse().map((h, i) => <li key={i}><Status value={h.status} /><div><strong>{h.by}</strong>{h.note && <p>{h.note}</p>}</div><time>{fmtDateTime(h.at)}</time></li>)}</ol>
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
