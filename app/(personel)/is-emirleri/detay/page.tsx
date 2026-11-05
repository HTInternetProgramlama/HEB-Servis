'use client';
import { detailHref } from '@/lib/routes';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApp } from '@/components/store';
import { Button, Card, Empty, Field, FormError, KV, Modal, PageHeader, Status, Tabs, useFormRunner } from '@/components/ui';
import { Icon } from '@/components/icons';
import { CarDrawing, Plate } from '@/components/vehicle-identity';
import { PaymentForm } from '@/components/payment';
import { ShareSheet } from '@/components/share-sheet';
import { estimateMessage } from '@/lib/share';
import { DamageMap, DeliveryForm, EvaluationForm, FuelGauge, LineForm } from '@/components/forms';
import {
  addInspection, allowedMoves, amountDue, amountPaid, approvedEstimate, balance, can, createEstimateDraft, decideEstimate, estimateTotals,
  latestEstimate, lineTotals, moveJob, reassignJob, removeLine, sendEstimate, serviceName, setEstimateNote, staffName, technicians, toggleInspectionVisibility,
} from '@/lib/rules';
import { generateTechnicalDraft, type Suggestion } from '@/lib/advisor';
import { fmtDate, fmtDateTime, km, money, qtyText } from '@/lib/format';
import type { Channel, Estimate, InspectionResult, Job, JobStatus } from '@/lib/types';

type Tab = 'overview' | 'inspection' | 'estimate' | 'payments' | 'history';
const flow: JobStatus[] = ['Kabul edildi', 'İnceleniyor', 'Onay bekliyor', 'İşlemde', 'Son kontrol', 'Teslime hazır', 'Teslim edildi'];

export default function Page() {
  return <Suspense><JobDetail /></Suspense>;
}

function JobDetail() {
  const id = useSearchParams().get('id');
  const { state, actor, run } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [modal, setModal] = useState<'' | 'payment' | 'deliver' | 'evaluate' | 'cancel' | 'move'>('');
  const [pendingMove, setPendingMove] = useState<JobStatus | null>(null);
  const job = state.jobs.find(j => j.id === id);
  if (!job) return <Empty icon="wrench" title="İş emri bulunamadı"><Link href="/is-emirleri">İş emirlerine dön</Link></Empty>;
  if (actor.role === 'technician' && job.technicianId !== actor.userId) return <Empty icon="lock" title="Bu iş emri size atanmamış">Atanan işlerinizi atölye panosunda görebilirsiniz.</Empty>;
  const vehicle = state.vehicles.find(v => v.id === job.vehicleId)!;
  const customer = state.customers.find(c => c.id === job.customerId)!;
  const moves = allowedMoves(job, actor);
  const latest = latestEstimate(job);
  const step = job.status === 'Parça bekliyor' ? flow.indexOf('İşlemde') : flow.indexOf(job.status);
  const showMoney = can(actor, 'payment.read');

  function doMove(m: JobStatus) {
    if (m === 'İptal') { setModal('cancel'); return }
    if (m === 'Parça bekliyor') { setPendingMove(m); setModal('move'); return }
    run((s, a) => moveJob(s, a, job!.id, m), `${job!.no} → ${m}`, job!.no);
  }

  return <>
    <PageHeader crumbs={[['İş emirleri', '/is-emirleri'], [job.no]]}
      title={<span className="title-row"><span className="mono">{job.no}</span><Status value={job.status} /></span>}
      sub={<>{serviceName(state, job.serviceId)} · kabul {fmtDateTime(job.createdAt)} · danışman {staffName(state, job.advisorId)}</>}
      actions={<>
        {moves.filter(m => m !== 'İptal').map(m => <Button key={m} variant="primary" onClick={() => doMove(m)}>{m === 'Teslime hazır' && job.status === 'Onay bekliyor' ? 'İşlemsiz teslime hazırla' : m}<Icon name="arrow" size={14} /></Button>)}
        {job.status === 'Teslime hazır' && can(actor, 'payment.write') && <Button variant="primary" icon="check" onClick={() => setModal('deliver')}>Teslim et</Button>}
        {showMoney && balance(job) > 0 && <Button icon="wallet" onClick={() => setModal('payment')}>Tahsilat</Button>}
        {job.status === 'Teslim edildi' && can(actor, 'evaluation.write') && <Button icon="star" onClick={() => setModal('evaluate')}>Ziyareti değerlendir</Button>}
        <Link className="btn" href={detailHref('/servis-formu', job.id)} target="_blank"><Icon name="printer" size={15} />Servis formu</Link>
        {moves.includes('İptal') && <Button variant="ghost" onClick={() => setModal('cancel')}>İptal et</Button>}
      </>} />

    {job.status !== 'İptal' && <ol className="stepper">{flow.map((f, i) => <li key={f} className={i < step ? 'done' : i === step ? 'current' : ''}><span>{i < step ? <Icon name="check" size={12} /> : i + 1}</span>{f === 'İşlemde' && job.status === 'Parça bekliyor' ? 'Parça bekliyor' : f}</li>)}</ol>}

    <div className="detail-layout">
      <div className="detail-main">
        <Tabs value={tab} onChange={setTab} items={[
          ['overview', 'Kabul bilgileri'], ['inspection', 'Kontrol bulguları', job.inspections.length], ['estimate', 'Teklif', job.estimates.length],
          ...(showMoney ? [['payments', 'Tahsilat', job.payments.length] as [Tab, string, number]] : []), ['history', 'Durum geçmişi', job.history.length],
        ]} />
        {tab === 'overview' && <Overview job={job} />}
        {tab === 'inspection' && <Inspections job={job} />}
        {tab === 'estimate' && <EstimatePanel job={job} />}
        {tab === 'payments' && showMoney && <Payments job={job} onAdd={() => setModal('payment')} />}
        {tab === 'history' && <Card flush><ol className="timeline">{[...job.history].reverse().map((h, i) => <li key={i}><Status value={h.status} /><div><strong>{h.by}</strong>{h.note && <p>{h.note}</p>}</div><time>{fmtDateTime(h.at)}</time></li>)}</ol></Card>}
      </div>

      <aside className="detail-side">
        <Card title="Araç">
          <CarDrawing vehicle={vehicle} />
          <div className="row-between mt"><Plate value={vehicle.plate} /><Link href={detailHref('/araclar/detay', vehicle.id)} className="btn sm link">Araç dosyası</Link></div>
          <KV items={[['Model', `${vehicle.brand} ${vehicle.model} · ${vehicle.year}`], ['Kabul km', km(job.intake.km)], ['Yakıt / vites', `${vehicle.fuel} · ${vehicle.transmission}`], ['Şasi', <span className="mono small" key="v">{vehicle.vin || '—'}</span>]]} />
        </Card>
        <Card title="Müşteri">
          <KV cols={1} items={[['Ad / unvan', can(actor, 'customer.write') ? <Link href={detailHref('/musteriler/detay', customer.id)}>{customer.name}</Link> : customer.name], ['Telefon', <a key="p" href={`tel:${customer.phone.replace(/\s/g, '')}`}>{customer.phone}</a>], ['İletişim tercihi', customer.preference]]} />
          {can(actor, 'note.read') && state.notes.filter(n => n.customerId === customer.id).slice(-2).map(n => <div key={n.id} className="inner-note"><Icon name="lock" size={12} /><div><b>{n.category}</b> {n.text}</div></div>)}
        </Card>
        <Card title="Sorumlular">
          <KV cols={1} items={[['Servis danışmanı', staffName(state, job.advisorId)], ['Teknisyen', can(actor, 'job.create') && !['Teslim edildi', 'İptal'].includes(job.status)
            ? <select key="t" className="select sm" value={job.technicianId} onChange={e => run((s, a) => reassignJob(s, a, job.id, e.target.value), `${job.no} teknisyeni ${staffName(state, e.target.value)} olarak değiştirildi`, job.no)}>{technicians(state).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            : staffName(state, job.technicianId)], ['Tahmini teslim', fmtDateTime(job.promisedAt)], ...(job.deliveredAt ? [['Teslim', fmtDateTime(job.deliveredAt)] as [string, string]] : [])]} />
        </Card>
        {showMoney && <Card title="Mali özet">
          <dl className="sum">
            <div><dt>Onaylı iş tutarı</dt><dd>{money(amountDue(job))}</dd></div>
            <div><dt>Tahsil edilen</dt><dd>{money(amountPaid(job))}</dd></div>
            <div className="total"><dt>Kalan bakiye</dt><dd className={balance(job) > 0 ? 'text-bad' : ''}>{money(balance(job))}</dd></div>
          </dl>
          {latest && latest.status === 'Gönderildi' && <p className="small muted mt">v{latest.version} teklifi ({money(estimateTotals(latest).total)}) müşteri kararını bekliyor.</p>}
        </Card>}
      </aside>
    </div>

    {modal === 'payment' && <PaymentForm open job={job} onClose={() => setModal('')} />}
    {modal === 'deliver' && <DeliveryForm open job={job} onClose={() => setModal('')} onDone={() => router.push(detailHref('/servis-formu', job.id))} />}
    {modal === 'evaluate' && <EvaluationForm open job={job} onClose={() => setModal('')} />}
    {(modal === 'cancel' || modal === 'move') && <ReasonModal title={modal === 'cancel' ? 'İş emrini iptal et' : 'Parça bekliyor'} label={modal === 'cancel' ? 'İptal gerekçesi' : 'Beklenen parça / tedarikçi'} required={modal === 'cancel'}
      onClose={() => setModal('')} onSubmit={note => run((s, a) => moveJob(s, a, job.id, modal === 'cancel' ? 'İptal' : pendingMove!, note), `${job.no} → ${modal === 'cancel' ? 'İptal' : pendingMove}`, job.no)} />}
  </>;
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

function Overview({ job }: { job: Job }) {
  const { state } = useApp();
  const appt = state.appointments.find(a => a.id === job.appointmentId);
  return <div className="stack">
    <Card title="Müşteri şikâyeti / talebi"><p className="quote">{job.intake.complaint}</p></Card>
    <Card title="Kabul kontrolü" sub={`${job.intake.by} · ${fmtDateTime(job.intake.at)}`}>
      <div className="intake-view">
        <DamageMap damages={job.intake.damages} readOnly />
        <div className="stack">
          <KV items={[['Kilometre', km(job.intake.km)], ['Yakıt', <FuelGauge key="f" value={job.intake.fuel} />], ['Randevu', appt ? `${appt.no} · ${fmtDate(appt.date)} ${appt.time}` : 'Randevusuz kabul'], ['Müşteri teyidi', job.intake.customerAck ? 'Birlikte kontrol edildi' : '—']]} />
          <div><h3 className="mini-head">Mevcut hasarlar</h3>{job.intake.damages.length ? <ul className="plain-list">{job.intake.damages.map(d => <li key={d.area}><b>{d.area}</b> · {d.kind}{d.note && ` — ${d.note}`}</li>)}</ul> : <p className="muted small">Kabulde hasar kaydı yok.</p>}</div>
          <div><h3 className="mini-head">Araçta bırakılanlar</h3><p className="small">{job.intake.belongings || '—'}</p></div>
        </div>
      </div>
    </Card>
  </div>;
}

function Inspections({ job }: { job: Job }) {
  const { state, actor, run } = useApp();
  const { error, busy, submit } = useFormRunner();
  const [draft, setDraft] = useState<ReturnType<typeof generateTechnicalDraft> | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const writable = can(actor, 'inspection.write') && !['Teslim edildi', 'İptal'].includes(job.status);
  const vehicle = state.vehicles.find(v => v.id === job.vehicleId)!;

  function makeDraft() {
    const past = state.jobs.filter(j => j.vehicleId === vehicle.id && j.id !== job.id).flatMap(j => j.inspections.filter(i => i.result !== 'Uygun').map(i => i.item));
    setDraft(generateTechnicalDraft({ brand: vehicle.brand, model: vehicle.model, year: vehicle.year, km: job.intake.km, fuel: vehicle.fuel, complaint: job.intake.complaint, pastItems: past }));
    setPicked(new Set());
  }
  async function addPicked(list: Suggestion[]) {
    const chosen = list.filter((_, i) => picked.has(i));
    await run((s, a) => chosen.reduce((st, x) => addInspection(st, a, job.id, { item: x.item, result: x.priority, note: 'Ön değerlendirme önerisi; muayene ile doğrulanmalı. ' + x.reason, customerVisible: false, source: 'Ön değerlendirme' }), s), `${chosen.length} ön değerlendirme önerisi bulgu listesine eklendi`, job.no);
    setDraft(null);
  }

  return <div className="stack">
    <Card title="Kontrol bulguları" sub="Kabuldeki mevcut hasarlardan ayrı tutulur. Müşteriye açık işaretli bulgular portalda ve servis formunda görünür." flush>
      {job.inspections.length ? <table className="table">
        <thead><tr><th>Kontrol maddesi</th><th>Sonuç</th><th className="hide-sm">Açıklama</th><th className="hide-sm">Kaydeden</th><th>Müşteri</th></tr></thead>
        <tbody>{job.inspections.map(i => <tr key={i.id}>
          <td><strong>{i.item}</strong>{i.source === 'Ön değerlendirme' && <small className="cell-sub">Ön değerlendirmeden</small>}</td>
          <td><Status value={i.result} /></td>
          <td className="hide-sm small">{i.note || '—'}</td>
          <td className="hide-sm small">{i.by}<small className="cell-sub">{fmtDateTime(i.at)}</small></td>
          <td>{can(actor, 'estimate.write') ? <button className={'vis-toggle ' + (i.customerVisible ? 'on' : '')} onClick={() => run((s, a) => toggleInspectionVisibility(s, a, job.id, i.id), i.customerVisible ? 'Bulgu müşteriden gizlendi' : 'Bulgu müşteriye açıldı', job.no)} aria-label={i.customerVisible ? 'Müşteriye açık' : 'Yalnız personel'}><Icon name={i.customerVisible ? 'eye' : 'eyeoff'} size={14} />{i.customerVisible ? 'Açık' : 'Gizli'}</button> : <span className="small muted">{i.customerVisible ? 'Açık' : 'Gizli'}</span>}</td>
        </tr>)}</tbody>
      </table> : <Empty icon="clipboard" title="Henüz bulgu kaydedilmedi" />}
    </Card>

    {writable && <Card title="Bulgu ekle">
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
    </Card>}

    {writable && <Card title="Teknik ön değerlendirme" sub="Araç teknik bilgisi, kilometre ve şikâyetten olası kontrol listesi üretir. Kesin teşhis değildir; seçilenler onayınızla bulgu listesine eklenir."
      actions={<Button icon="bulb" onClick={makeDraft}>{draft ? 'Yeniden oluştur' : 'Taslak oluştur'}</Button>}>
      <p className="small muted"><Icon name="lock" size={12} /> Kullanılan veriler: marka/model, yıl, kabul km, yakıt türü, şikâyet metni ve aracın önceki bulguları. Müşteri adı, telefon, plaka ve iç notlar kullanılmaz.</p>
      {draft && <div className="draft">
        <p>{draft.explanation}</p>
        <ul className="draft-list">{draft.suggestions.map((sg, i) => <li key={i}><label className="check"><input type="checkbox" checked={picked.has(i)} onChange={() => setPicked(p => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n })} /><span><strong>{sg.item}</strong><small>{sg.reason}</small></span></label><Status value={sg.priority} /></li>)}</ul>
        <div className="row-between"><small className="muted">{draft.engine}</small><Button variant="primary" disabled={!picked.size} onClick={() => addPicked(draft.suggestions)}>Seçilenleri bulgu olarak ekle ({picked.size})</Button></div>
      </div>}
    </Card>}
  </div>;
}

function EstimatePanel({ job }: { job: Job }) {
  const { state, actor, run } = useApp();
  const [share, setShare] = useState(false);
  const customer = state.customers.find(c => c.id === job.customerId)!;
  const [version, setVersion] = useState<number | null>(null);
  const [lineModal, setLineModal] = useState<null | { lineId?: string }>(null);
  const [decide, setDecide] = useState<null | 'Onaylandı' | 'Reddedildi'>(null);
  const latest = latestEstimate(job);
  const e = job.estimates.find(x => x.version === version) ?? latest;
  const writable = can(actor, 'estimate.write');
  const canStart = writable && !['Teslime hazır', 'Teslim edildi', 'İptal'].includes(job.status) && (!latest || latest.status !== 'Taslak');

  if (!e) return <Card><Empty icon="receipt" title="Henüz teklif hazırlanmadı">{writable ? 'Hizmet türüne göre önerilen kalemlerle taslak oluşturulur.' : 'Teklifi servis danışmanı hazırlar.'}</Empty>{canStart && <div className="center"><Button variant="primary" icon="plus" onClick={() => run((s, a) => createEstimateDraft(s, a, job.id), 'Teklif taslağı oluşturuldu', job.no)}>Teklif taslağı oluştur</Button></div>}</Card>;
  const t = estimateTotals(e);
  const editable = writable && e.status === 'Taslak' && e.id === latest?.id;

  return <div className="stack">
    <div className="toolbar tight">
      <div className="seg small">{job.estimates.map(x => <button key={x.id} className={x.id === e.id ? 'active' : ''} onClick={() => setVersion(x.version)}>v{x.version} <Status value={x.status} /></button>)}</div>
      <div className="toolbar-end">
        {canStart && <Button icon="plus" onClick={() => { run((s, a) => createEstimateDraft(s, a, job.id), `Teklif v${(latest?.version ?? 0) + 1} taslağı oluşturuldu`, job.no); setVersion(null) }}>{latest ? 'Yeni sürüm (revizyon)' : 'Taslak oluştur'}</Button>}
      </div>
    </div>
    {e.id !== latest?.id && <div className="banner"><Icon name="history" size={15} />Eski sürüm görüntüleniyor. Bu sürüme verilen karar güncel sürüm için geçerli değildir.</div>}
    <Card title={`Teklif v${e.version}`} sub={<>{e.createdBy} · {fmtDateTime(e.createdAt)}{e.sentAt && <> · gönderim {fmtDateTime(e.sentAt)}</>}</>} flush
      actions={editable && <Button size="sm" icon="plus" onClick={() => setLineModal({})}>Kalem ekle</Button>}>
      {e.lines.length ? <div className="table-wrap"><table className="table lines">
        <thead><tr><th>Tür</th><th>Kod</th><th>Açıklama</th><th className="num">Miktar</th><th className="num">Birim fiyat</th><th className="num">İnd.</th><th className="num">Tutar</th>{editable && <th />}</tr></thead>
        <tbody>{e.lines.map(l => <tr key={l.id}>
          <td><span className={'tag ' + (l.kind === 'Parça' ? 'blue' : 'violet')}>{l.kind}</span></td>
          <td className="mono small">{l.code || '—'}</td><td>{l.name}</td>
          <td className="num">{qtyText(l.qty)} {l.unit}</td><td className="num">{money(l.unitPrice)}</td>
          <td className="num">{l.discountPct ? `%${l.discountPct}` : '—'}</td><td className="num strong">{money(lineTotals(l).net)}</td>
          {editable && <td className="actions"><button className="icon-btn" aria-label="Düzenle" onClick={() => setLineModal({ lineId: l.id })}><Icon name="edit" size={14} /></button><button className="icon-btn" aria-label="Sil" onClick={() => run((s, a) => removeLine(s, a, job.id, l.id), `"${l.name}" tekliften çıkarıldı`, job.no)}><Icon name="trash" size={14} /></button></td>}
        </tr>)}</tbody>
      </table></div> : <Empty icon="receipt" title="Kalem yok">Parça ve işçilik kalemlerini ekleyin.</Empty>}
      <div className="totals">
        <div className="totals-note">
          {editable ? <textarea defaultValue={e.note} rows={3} maxLength={800} placeholder="Müşteriye açıklama (ör. değişim gerekçesi, garanti süresi)" onBlur={ev => ev.target.value !== e.note && run((s, a) => setEstimateNote(s, a, job.id, ev.target.value), 'Teklif açıklaması güncellendi', job.no)} />
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
    </Card>
    {e.decision && <div className={'banner ' + (e.decision.result === 'Onaylandı' ? 'ok' : 'bad')}><Icon name={e.decision.result === 'Onaylandı' ? 'check' : 'x'} size={15} /><div><strong>{e.decision.result}</strong> · {e.decision.channel} · {e.decision.by} · {fmtDateTime(e.decision.at)}{e.decision.note && <p>{e.decision.note}</p>}</div></div>}
    {editable && <div className="action-bar"><span className="muted small">Gönderildikten sonra bu sürüm değiştirilemez; değişiklik yeni sürüm gerektirir ve önceki onay geçerliliğini yitirir.</span>
      <Button variant="primary" icon="mail" onClick={() => run((s, a) => sendEstimate(s, a, job.id), `Teklif v${e.version} müşteri onayına gönderildi`, job.no).then(err => { if (!err) setShare(true) })}>Müşteri onayına gönder</Button></div>}
    {writable && e.status === 'Gönderildi' && e.id === latest?.id && <div className="action-bar"><span className="muted small">Müşteri portaldan karar verebilir. Telefon veya şubede alınan kararı buradan kaydedin.</span>
      <div className="btn-row"><Button icon="mail" onClick={() => setShare(true)}>Müşteriye ilet</Button><Button onClick={() => setDecide('Reddedildi')}>Ret kaydet</Button><Button variant="primary" icon="check" onClick={() => setDecide('Onaylandı')}>Onay kaydet</Button></div></div>}
    {lineModal && <LineForm open job={job} line={e.lines.find(l => l.id === lineModal.lineId)} onClose={() => setLineModal(null)} />}
    {decide && <DecisionModal job={job} estimate={e} result={decide} onClose={() => setDecide(null)} />}
    {share && latest && <Modal open title={`Teklif v${latest.version} müşteriye iletilsin`} sub={`Portal bağlantısı ile onaylanabilir · ${customer.preference} tercih ediyor`} onClose={() => setShare(false)} width={760}>
      <div className="sent-banner"><span className="sent-plane"><Icon name="mail" size={18} /></span><div><strong>Teklif portala gönderildi</strong><small>Müşteri bildirimi otomatik gitmez; aşağıdan istediğiniz kanalla iletin.</small></div></div>
      <ShareSheet name={customer.name} phone={customer.phone} email={customer.email || undefined} subject={`${job.no} servis teklifi`} text={estimateMessage(state, job, latest, location.origin)} />
    </Modal>}
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

function Payments({ job, onAdd }: { job: Job; onAdd: () => void }) {
  const { actor } = useApp();
  const approved = approvedEstimate(job);
  return <Card title="Tahsilatlar" sub={approved ? `Onaylı teklif v${approved.version} üzerinden` : 'Onaylı teklif yok; tahsilat girilemez'} flush actions={can(actor, 'payment.write') && balance(job) > 0 && <Button size="sm" icon="plus" onClick={onAdd}>Tahsilat ekle</Button>}>
    {job.payments.length ? <table className="table">
      <thead><tr><th>Tarih</th><th>Yöntem</th><th className="hide-sm">Açıklama</th><th className="hide-sm">Kaydeden</th><th className="num">Tutar</th></tr></thead>
      <tbody>{job.payments.map(p => <tr key={p.id}><td>{fmtDateTime(p.at)}</td><td>{p.method}</td><td className="hide-sm">{p.note || '—'}</td><td className="hide-sm">{p.by}</td><td className="num strong">{money(p.amount)}</td></tr>)}</tbody>
      <tfoot><tr><td colSpan={4} className="hide-sm">Kalan bakiye</td><td className="num strong">{money(balance(job))}</td></tr></tfoot>
    </table> : <Empty icon="wallet" title="Tahsilat kaydı yok" />}
  </Card>;
}
