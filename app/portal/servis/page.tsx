'use client';
import { detailHref } from '@/lib/routes';
import { InspectionPhoto } from '@/components/inspection-photo';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/store';
import { Button, Card, Empty, KV, Modal, Status } from '@/components/ui';
import { Icon } from '@/components/icons';
import { CarDrawing, Plate } from '@/components/vehicle-identity';
import { amountDue, amountPaid, balance, decideEstimate, estimateTotals, lineTotals, portalView, serviceName } from '@/lib/commands';
import { fmtDateTime, km, money, qtyText } from '@/lib/format';
import styles from '@/components/portal-service.module.css';

const progressLabels = ['Araç kabulü', 'Kontrol ve onay', 'Servis işlemleri', 'Teslim'];
const stage: Record<string, number> = { 'Kabul edildi': 0, 'İnceleniyor': 1, 'Onay bekliyor': 1, 'İşlemde': 2, 'Parça bekliyor': 2, 'Son kontrol': 2, 'Teslime hazır': 3, 'Teslim edildi': 3 };
const guidance: Record<string, string> = {
  'Kabul edildi': 'Aracınızı teslim aldık. İlk kontrolün ardından bulgularınızı burada paylaşacağız.',
  'İnceleniyor': 'Aracınızın kontrolleri yapılıyor. Paylaşılan bulguları aşağıda inceleyebilirsiniz.',
  'Onay bekliyor': 'İşlemlere devam edebilmemiz için teklifinizi inceleyip kararınızı paylaşın.',
  'İşlemde': 'Onay verdiğiniz servis işlemleri devam ediyor. Son güncellemeler bu ekrana yansır.',
  'Parça bekliyor': 'İşlemler için gerekli parça bekleniyor. Teslim planını servisle görüşebilirsiniz.',
  'Son kontrol': 'Servis işlemlerinin ardından son kontroller yapılıyor.',
  'Teslime hazır': 'Aracınız sizi bekliyor. Teslim saatinizi servisle birlikte planlayabilirsiniz.',
  'Teslim edildi': 'Servis ziyaretiniz tamamlandı. İşlem ve ödeme kayıtlarınız burada saklanır.',
  'İptal': 'Bu servis kaydı iptal edildi. Ayrıntılar için servisimizle iletişime geçebilirsiniz.',
};

export default function Page() {
  return <Suspense><PortalJob /></Suspense>;
}

function PortalJob() {
  const id = useSearchParams().get('id');
  const { state, actor, run } = useApp();
  const [confirm, setConfirm] = useState<null | 'Onaylandı' | 'Reddedildi'>(null);
  const [deciding, setDeciding] = useState(false);
  const view = portalView(state, actor);
  const job = view.jobs.find(j => j.id === id);
  if (!job) return <Empty icon="lock" title="Kayıt bulunamadı">Bu servis kaydı hesabınıza ait değil veya silinmiş. <Link href="/portal">Ana sayfaya dön</Link></Empty>;
  const v = view.vehicles.find(x => x.id === job.vehicleId)!;
  const e = job.estimates.at(-1);
  const t = e ? estimateTotals(e) : null;
  const currentStage = stage[job.status] ?? -1;
  const phone = state.settings.company.phone;
  const checks = job.inspections.filter(i => i.result === 'Uygun').length;
  const attention = job.inspections.filter(i => i.result !== 'Uygun').length;

  return <div className={styles.page}>
    <Link href="/portal" className="back-link"><Icon name="left" size={14} />Araçlarım ve servis</Link>
    <section className={styles.hero} aria-label="Aracınızın servis özeti">
      <div className={styles.heroCopy}><span className={styles.eyebrow}>{serviceName(state, job.serviceId)} · {job.no}</span><div className={styles.title}><h1>{v.brand} {v.model}</h1><Status value={job.status} /></div><Plate value={v.plate} /><p className={styles.guidance}>{guidance[job.status]}</p><div className={styles.meta}><span><Icon name="clock" size={16} />Kabul {fmtDateTime(job.createdAt)}</span><span><Icon name="car" size={16} />{km(job.intake.km)}</span></div></div>
      <div className={styles.heroArt}><CarDrawing vehicle={v} /><span>{v.year} · {v.fuel} · {v.transmission}</span></div>
    </section>
    <section className={styles.progress} aria-label="Servis aşamaları"><div className={styles.progressHeading}><h2>Aracınız hangi aşamada?</h2><span>{job.status === 'Teslim edildi' ? `Teslim edildi · ${fmtDateTime(job.deliveredAt)}` : job.status === 'İptal' ? 'İptal edilen kayıt' : `Planlanan teslim · ${fmtDateTime(job.promisedAt)}`}</span></div><ol>{progressLabels.map((label, i) => <li key={label} className={i < currentStage ? styles.complete : i === currentStage ? styles.current : ''} aria-current={i === currentStage ? 'step' : undefined}><span>{i < currentStage || job.status === 'Teslim edildi' ? <Icon name="check" size={17} /> : i + 1}</span><strong>{label}</strong></li>)}</ol><p>Tahmini teslim zamanı işin durumuna göre güncellenebilir.</p></section>
    <div className={styles.summary}><div><Icon name="clipboard" size={20} /><span>Paylaşılan kontrol<strong>{job.inspections.length}</strong><small>{checks} uygun · {attention} takip / işlem önerisi</small></span></div><div><Icon name="receipt" size={20} /><span>Onaylı işlem tutarı<strong>{money(amountDue(job))}</strong><small>{e?.status === 'Gönderildi' ? 'Ayrıca kararınızı bekleyen bir teklif var' : 'Onaylanan servis işlemleriniz'}</small></span></div><div><Icon name="wallet" size={20} /><span>Kalan ödeme<strong>{money(Math.max(0, balance(job)))}</strong><small>Kaydedilen ödeme {money(amountPaid(job))}</small></span></div></div>

    {e && t && <Card title={`Teklif · sürüm ${e.version}`} sub={e.sentAt ? `Gönderim ${fmtDateTime(e.sentAt)}` : undefined} className={e.status === 'Gönderildi' ? 'attention' : ''} flush>
      {e.note && <p className="quote pad">{e.note}</p>}
      <div className="table-wrap"><table className="table lines">
        <thead><tr><th>Kalem</th><th className="num">Miktar</th><th className="num hide-sm">Birim fiyat</th><th className="num">Tutar</th></tr></thead>
        <tbody>{e.lines.map(l => <tr key={l.id}><td>{l.name}<small className="cell-sub">{l.kind}{l.discountPct ? ` · %${l.discountPct} indirim` : ''}</small></td><td className="num">{qtyText(l.qty)} {l.unit}</td><td className="num hide-sm">{money(l.unitPrice)}</td><td className="num">{money(lineTotals(l).net)}</td></tr>)}</tbody>
      </table></div>
      <div className="totals"><div /><dl className="sum">
        <div><dt>Ara toplam</dt><dd>{money(t.subtotal)}</dd></div>
        <div><dt>KDV %{e.vatRate}</dt><dd>{money(t.vat)}</dd></div>
        <div className="total"><dt>Genel toplam</dt><dd>{money(t.total)}</dd></div>
      </dl></div>
      {e.status === 'Gönderildi' ? <div className="action-bar"><span className="small">Onayınızla birlikte yalnız bu teklifteki işlemler yapılır. Ek bir işlem gerekirse yeni teklif gönderilir.</span>
        <div className="btn-row"><Button onClick={() => setConfirm('Reddedildi')}>Reddet</Button><Button variant="primary" icon="check" onClick={() => setConfirm('Onaylandı')}>Teklifi onayla</Button></div></div>
        : e.decision && <div className={'banner ' + (e.decision.result === 'Onaylandı' ? 'ok' : 'bad')}><Icon name={e.decision.result === 'Onaylandı' ? 'check' : 'x'} size={15} />{e.decision.result} · {e.decision.channel} · {fmtDateTime(e.decision.at)}</div>}
    </Card>}

    <div className="grid-main">
      <Card title="Kontrol sonuçları" sub="Teknisyenin sizinle paylaştığı bulgular" flush>
        {job.inspections.length ? <ul className="finding-list">{job.inspections.map(i => <li key={i.id}><Status value={i.result} /><div><strong>{i.item}</strong><InspectionPhoto id={i.id} hasPhoto={!!i.photoPath} />{i.note && <p>{i.note}</p>}</div></li>)}</ul> : <Empty icon="clipboard" title="Henüz paylaşılan bulgu yok" />}
      </Card>
      <Card title="Ödeme özeti">
        <dl className="sum">
          <div><dt>Onaylı iş tutarı</dt><dd>{money(amountDue(job))}</dd></div>
          <div><dt>Ödenen</dt><dd>{money(amountPaid(job))}</dd></div>
          <div className="total"><dt>Kalan</dt><dd>{money(balance(job))}</dd></div>
        </dl>
        <p className="small muted mt">Ödemeler serviste nakit, kart veya havale ile alınır.</p>
        {job.status === 'Teslim edildi' && <Link className="btn mt" href={detailHref('/servis-formu', job.id)} target="_blank"><Icon name="printer" size={14} />Servis formunu yazdır</Link>}
      </Card>
    </div>
    <Card title="Kabul bilgileri">
      <KV cols={3} items={[['Şikâyet / talep', job.intake.complaint], ['Kabul km', km(job.intake.km)], ['Tahmini teslim', fmtDateTime(job.promisedAt)], ['Kabulde not edilen hasarlar', job.intake.damages.length ? job.intake.damages.map(d => `${d.area} (${d.kind})`).join(', ') : 'Yok']]} />
    </Card>

    <div className={styles.bottomGrid}>
      <Card title="Servis yolculuğunuz" sub="Aracınızın kabulden teslimata durum geçmişi">
        <ol className={styles.timeline}>{job.history.slice().sort((a, b) => a.at.localeCompare(b.at)).map((event, i) => <li key={`${event.at}-${i}`}><i aria-hidden="true" /><div><strong>{event.status}</strong><time dateTime={event.at}>{fmtDateTime(event.at)}</time></div></li>)}</ol>
      </Card>
      <div className={styles.sideStack}>
        <Card title="Ödeme hareketleri" sub="Servis tarafından kaydedilen tahsilatlar">
          {job.payments.length ? <ul className={styles.paymentList}>{job.payments.slice().sort((a, b) => b.at.localeCompare(a.at)).map(p => <li key={p.id}><span><strong>{p.method}</strong><time dateTime={p.at}>{fmtDateTime(p.at)}</time></span><b>{money(p.amount)}</b></li>)}</ul> : <p className={styles.emptyText}>Bu servis için henüz ödeme kaydı yok. Ödeme yöntemleri ve teslim planı için bize ulaşabilirsiniz.</p>}
        </Card>
        <section className={styles.help}><span className={styles.helpIcon}><Icon name="phone" size={22} /></span><h2>Servis danışmanınıza ulaşın</h2><p>Teslim planı veya işlemlerle ilgili sorunuz varsa buradayız.</p><strong>{state.settings.company.branch}</strong>{phone && <a className="btn primary" href={`tel:${phone.replace(/[^+\d]/g, '')}`}><Icon name="phone" size={16} />{phone}</a>}<Link href="/portal/randevular">Randevularımı görüntüle</Link></section>
      </div>
    </div>

    {confirm && e && <Modal open title={confirm === 'Onaylandı' ? 'Teklifi onaylıyor musunuz?' : 'Teklifi reddediyor musunuz?'} onClose={() => setConfirm(null)} width={440}
      footer={<><Button disabled={deciding} onClick={() => setConfirm(null)}>Vazgeç</Button><Button disabled={deciding} variant={confirm === 'Onaylandı' ? 'primary' : 'danger'} onClick={async () => { if (deciding) return; setDeciding(true); try { const error = await run((s, a) => decideEstimate(s, a, job.id, e.id, confirm, 'Portal', ''), confirm === 'Onaylandı' ? 'Teklif onaylandı; işlemlere başlanacak' : 'Teklif reddedildi; servis danışmanı sizinle iletişime geçecek', job.no); if (!error) setConfirm(null); } finally { setDeciding(false); } }}>{deciding ? 'Kaydediliyor…' : confirm === 'Onaylandı' ? `${money(t!.total)} onayla` : 'Reddet'}</Button></>}>
      <p>{confirm === 'Onaylandı' ? `Sürüm ${e.version} teklifindeki ${e.lines.length} kalem için ${money(t!.total)} (KDV dahil) onay vermiş olacaksınız. Onay zamanı ve kanalı kayda alınır.` : 'İşlemler yapılmayacak. Aracınızı teslim almak için servis danışmanı sizi arayacak.'}</p>
    </Modal>}
  </div>;
}
