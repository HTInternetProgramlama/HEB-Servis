'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/store';
import { Icon, type IconName } from '@/components/icons';
import { CarImage, Plate } from '@/components/vehicle-identity';
import { InspectionPhoto } from '@/components/inspection-photo';
import { amountDue, amountPaid, balance, estimateTotals, lineTotals, portalView, serviceName } from '@/lib/rules';
import { fmtDate, fmtDateTime, fmtTime, km, money, qtyText } from '@/lib/format';
import { detailHref } from '@/lib/routes';
import type { AppointmentStatus, Estimate } from '@/lib/types';
import styles from '@/components/portal-appointment-detail.module.css';

const descriptions: Record<AppointmentStatus, string> = {
  'Bekliyor': 'Randevu talebiniz kaydedildi. Gün ve saatin kesinleşmesi için servis onayı bekleniyor.',
  'Onaylı': 'Randevunuz servis tarafından onaylanmış olarak kayıtlı.',
  'Geldi': 'Bu randevu için servise gelişiniz kaydedilmiş.',
  'İş emri açıldı': 'Bu randevu, servis işlemleri için iş emrine dönüştürülmüş.',
  'İptal': 'Bu randevu iptal edilmiş olarak kayıtlı. Kayıtta ayrıca bir iptal gerekçesi bulunmuyor.',
  'Gelmedi': 'Bu randevuya gelinmediği kaydedilmiş. Kayıtta ayrıca bir gelmeme gerekçesi bulunmuyor.',
};

function safeReturnTo(value: string | null) {
  const fallback = '/portal/randevular?gorunum=gecmis';
  if (!value || value.length > 2000) return fallback;
  try {
    const url = new URL(value, 'https://portal.local');
    if (url.origin !== 'https://portal.local' || !['/portal/randevular', '/portal/randevular/'].includes(url.pathname)) return fallback;
    return url.pathname + url.search;
  } catch { return fallback; }
}

function EmptyRecord() {
  return <section className={styles.notFound}><span><Icon name="calendar" size={34} /></span><h1>Randevu kaydı bulunamadı</h1><p>Bu bağlantıyla hesabınızda görüntülenebilen bir randevu bulunmuyor. Randevularınızdan bir kayıt seçerek devam edebilirsiniz.</p><Link className={styles.primaryButton} href="/portal/randevular"><Icon name="left" size={17} />Randevularıma dön</Link></section>;
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

function SectionTitle({ eyebrow, title, icon }: { eyebrow: string; title: string; icon: IconName }) {
  return <div className={styles.sectionTitle}><span className={styles.sectionIcon}><Icon name={icon} size={22} /></span><div><span className={styles.eyebrow}>{eyebrow}</span><h2>{title}</h2></div></div>;
}

export default function AppointmentDetailPage() {
  return <Suspense fallback={<div className={styles.loading} role="status">Randevu ayrıntıları hazırlanıyor…</div>}><AppointmentDetail /></Suspense>;
}

function AppointmentDetail() {
  const search = useSearchParams();
  const returnTo = safeReturnTo(search.get('donus'));
  const { state, actor } = useApp();
  const id = search.get('id');
  if (actor.role !== 'customer' || !actor.customerId || search.getAll('id').length !== 1 || !id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return <EmptyRecord />;
  const view = portalView(state, actor);
  const appointment = view.appointments.find(a => a.id === id.toLowerCase() && a.customerId === actor.customerId);
  if (!appointment) return <EmptyRecord />;
  const vehicle = view.vehicles.find(v => v.id === appointment.vehicleId && v.customerId === actor.customerId);
  const job = view.jobs.find(j => j.appointmentId === appointment.id && j.customerId === actor.customerId && j.vehicleId === appointment.vehicleId);
  const inspections = job?.inspections.filter(i => i.customerVisible) ?? [];
  const estimates = (job?.estimates ?? []).filter(e => e.status !== 'Taslak').slice().sort((a, b) => b.version - a.version);
  const pending = estimates.some(e => e.status === 'Gönderildi');
  const starts = new Date(`${appointment.date}T${appointment.time}:00+03:00`);
  const end = new Date(starts.getTime() + appointment.duration * 60_000);
  const endIso = Number.isFinite(end.getTime()) ? end.toISOString() : undefined;
  const endDate = endIso ? fmtDate(endIso) : '—';
  const title = serviceName(state, appointment.serviceId);
  const phone = state.settings.company.phone;
  const noJobText = appointment.status === 'İptal' ? 'Randevunuz iptal olarak kayıtlı ve bu randevuya bağlı bir servis iş emri bulunmuyor.' : appointment.status === 'Gelmedi' ? 'Randevunuz gelinmedi olarak kayıtlı ve bu randevuya bağlı bir servis iş emri bulunmuyor.' : 'Bu randevuya bağlı bir servis iş emri bulunmuyor. Bu nedenle kontrol, teklif ve ödeme kaydı gösterilmiyor.';

  return <div className={styles.page}>
    <nav className={styles.breadcrumb} aria-label="Konum"><Link href="/portal">Müşteri portalı</Link><Icon name="right" size={13} /><Link href={returnTo}>Randevularım</Link><Icon name="right" size={13} /><span>{appointment.no}</span></nav>
    <section className={styles.hero} aria-labelledby="appointment-title"><div className={styles.heroCopy}><span className={styles.eyebrow}>RANDEVUNUZUN TÜM AYRINTILARI</span><div className={styles.heroTitle}><h1 id="appointment-title">{title}</h1><span className={`${styles.status} ${appointment.status === 'İptal' || appointment.status === 'Gelmedi' ? styles.statusMuted : ''}`}>{appointment.status}</span></div><p className={styles.heroDate}><Icon name="calendar" size={20} />{fmtDate(appointment.date, { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}</p><div className={styles.heroMeta}><span><Icon name="clock" size={17} />{appointment.time} · {appointment.duration} dakika</span><span>{appointment.no}</span></div><p className={styles.guidance}>{descriptions[appointment.status]}</p><Link href={returnTo} className={styles.backButton}><Icon name="left" size={16} />Randevularıma dön</Link></div><div className={styles.heroArt}>{vehicle ? <><div className={styles.vehicleCaption}><Plate value={vehicle.plate} /><span>{vehicle.brand} {vehicle.model}</span></div><CarImage vehicle={vehicle} eager className={styles.carImage} /><small>{vehicle.year} · {vehicle.fuel} · {vehicle.transmission}<span>Temsili araç görseli</span></small></> : <div className={styles.missingVehicle}><Icon name="car" size={76} /><strong>Araç bilgisi görüntülenemiyor</strong><span>Randevu kaydınızın diğer ayrıntıları aşağıda yer alıyor.</span></div>}</div></section>

    <div className={styles.overviewGrid}>
      <section className={styles.card}><SectionTitle eyebrow="ZİYARET PLANI" title="Randevu bilgileri" icon="calendar" /><dl className={styles.fields}><DetailField label="Randevu numarası">{appointment.no}</DetailField><DetailField label="Kayıtlı durum">{appointment.status}</DetailField><DetailField label="Randevu tarihi">{fmtDate(appointment.date, { day: 'numeric', month: 'long', year: 'numeric' })}</DetailField><DetailField label="Başlangıç saati">{appointment.time}</DetailField><DetailField label="Planlanan bitiş">{endIso ? `${endDate} · ${fmtTime(endIso)}` : '—'}</DetailField><DetailField label="Planlanan süre">{appointment.duration} dakika</DetailField><DetailField label="Hizmet">{title}</DetailField><DetailField label="Talebin kayıt zamanı">{fmtDateTime(appointment.createdAt)}</DetailField><DetailField label="Talep kanalı">{appointment.source}</DetailField></dl><p className={styles.smallPrint}>Saat ve süreler randevu planına aittir; gerçekleşen servis kabulü ve teslim zamanları varsa servis kaydında ayrıca gösterilir.</p></section>
      <section className={styles.card}><SectionTitle eyebrow="ARACINIZ & TALEBİNİZ" title="Ziyaretinize dair" icon="car" />{vehicle && <dl className={styles.fields}><DetailField label="Marka / model">{vehicle.brand} {vehicle.model}</DetailField><DetailField label="Plaka"><Plate value={vehicle.plate} size="sm" /></DetailField><DetailField label="Model yılı">{vehicle.year}</DetailField><DetailField label="Son kayıtlı kilometre">{km(vehicle.km)}</DetailField><DetailField label="Yakıt">{vehicle.fuel}</DetailField><DetailField label="Vites">{vehicle.transmission}</DetailField></dl>}<div className={styles.requestNote}><h3>Randevu talebiniz / açıklamanız</h3><p>{appointment.note.trim() || 'Bu randevu için talep açıklaması kaydedilmemiş.'}</p></div><p className={styles.smallPrint}>Araç kilometresi güncel araç kaydından alınır; randevu gününe ait bir ölçüm olarak değerlendirilmemelidir.</p></section>
    </div>

    {job ? <>
      <section className={styles.serviceBanner} aria-labelledby="linked-service-title"><div><span className={styles.eyebrow}>RANDEVUNUZDAN SERVİSE</span><h2 id="linked-service-title">İlişkili servis kaydınız</h2><p>{job.no} · <strong>{job.status}</strong></p></div><div className={styles.bannerActions}><Link className={styles.primaryButton} href={detailHref('/portal/servis', job.id)}>{pending ? 'Teklifi incele ve karar ver' : 'Ayrıntılı servis sayfası'}<Icon name="arrow" size={17} /></Link><Link className={styles.secondaryButton} href={detailHref('/servis-formu', job.id)} target="_blank" rel="noopener noreferrer"><Icon name="printer" size={16} />Servis formunu yazdır<span className={styles.srOnly}> (yeni sekmede açılır)</span></Link></div></section>
      <div className={styles.serviceDates}><div><Icon name="clock" size={21} /><span>Servise kabul<strong>{fmtDateTime(job.intake.at)}</strong></span></div><div><Icon name="calendar" size={21} /><span>Tahmini teslim<strong>{fmtDateTime(job.promisedAt)}</strong></span></div><div><Icon name="check" size={21} /><span>Kaydedilen teslim<strong>{job.deliveredAt ? fmtDateTime(job.deliveredAt) : 'Teslim kaydı yok'}</strong></span></div><div><Icon name="gauge" size={21} /><span>Kabul kilometresi<strong>{km(job.intake.km)}</strong></span></div></div>
      {job.intake.complaint && <section className={styles.intakeNote}><h3>Servis kabulündeki talebiniz</h3><p>{job.intake.complaint}</p></section>}

      <section className={styles.section} aria-labelledby="inspections-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>SERVİSİNİZDEN PAYLAŞILANLAR</span><h2 id="inspections-title">Kontrol bulguları</h2></div><span className={styles.counter}>{inspections.length} kontrol</span></div>{inspections.length ? <div className={styles.inspectionGrid}>{inspections.slice().sort((a, b) => a.at.localeCompare(b.at)).map(inspection => <article className={styles.inspection} key={inspection.id}><div className={styles.inspectionTop}><h3>{inspection.item}</h3><span className={`${styles.resultBadge} ${inspection.result === 'Uygun' ? styles.resultGood : inspection.result === 'Acil' ? styles.resultUrgent : ''}`}>{inspection.result}</span></div>{inspection.note && <p>{inspection.note}</p>}<div className={styles.inspectionFooter}><time dateTime={inspection.at}>{fmtDateTime(inspection.at)}</time><InspectionPhoto id={inspection.id} hasPhoto={!!inspection.photoPath} /></div></article>)}</div> : <div className={styles.emptyPanel}><Icon name="clipboard" size={26} /><p>Bu servis için henüz sizinle paylaşılmış kontrol bulgusu bulunmuyor.</p></div>}</section>

      <section className={styles.section} aria-labelledby="estimates-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>İŞLEMLER & TEKLİF GEÇMİŞİ</span><h2 id="estimates-title">Paylaşılan teklif sürümleri</h2></div><span className={styles.counter}>{estimates.length} sürüm</span></div>{estimates.length ? <div className={styles.estimateList}>{estimates.map(estimate => <EstimateCard key={estimate.id} estimate={estimate} serviceHref={detailHref('/portal/servis', job.id)} />)}</div> : <div className={styles.emptyPanel}><Icon name="receipt" size={26} /><p>Bu servis için sizinle paylaşılmış bir teklif bulunmuyor.</p></div>}</section>

      <section className={styles.section} aria-labelledby="payments-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>SERVİS HESABINIZ</span><h2 id="payments-title">Ödeme özeti & hareketleri</h2></div></div><div className={styles.paymentSummary}><div><span>Onaylı işlem tutarı</span><strong>{money(amountDue(job))}</strong></div><div><span>Kaydedilen ödeme</span><strong>{money(amountPaid(job))}</strong></div><div><span>Kalan ödeme</span><strong>{money(Math.max(0, balance(job)))}</strong></div></div>{balance(job) < 0 && <p className={styles.smallPrint}>Onaylı işlem tutarını aşan kayıtlı ödeme: {money(-balance(job))}. Hesap ayrıntıları için servisimizle görüşebilirsiniz.</p>}{job.payments.length ? <div className={styles.paymentList}>{job.payments.slice().sort((a, b) => b.at.localeCompare(a.at)).map(payment => <article key={payment.id}><span className={styles.paymentIcon}><Icon name="wallet" size={21} /></span><div><h3>{payment.method}</h3><time dateTime={payment.at}>{fmtDateTime(payment.at)}</time></div><strong>{money(payment.amount)}</strong></article>)}</div> : <div className={styles.emptyPanel}><Icon name="wallet" size={26} /><p>Bu servis kaydına henüz tahsilat eklenmemiş.</p></div>}</section>

      {job.history.length > 0 && <section className={styles.card}><SectionTitle eyebrow="KAYITLI ZAMAN ÇİZELGESİ" title="Servis durum geçmişi" icon="history" /><ol className={styles.timeline}>{job.history.slice().sort((a, b) => a.at.localeCompare(b.at)).map((event, index) => <li key={`${event.at}-${index}`}><span aria-hidden="true" /><div><strong>{event.status}</strong><time dateTime={event.at}>{fmtDateTime(event.at)}</time></div></li>)}</ol></section>}
    </> : <section className={styles.noService}><span><Icon name="wrench" size={29} /></span><div><span className={styles.eyebrow}>SERVİS KAYDI</span><h2>Bu randevuya bağlı servis bulunmuyor</h2><p>{noJobText}</p><p>Randevu durumu: <strong>{appointment.status}</strong>. Burada yalnız kayıtlı bilgiler gösterilir.</p><div className={styles.noServiceActions}><Link className={styles.secondaryButton} href={returnTo}>Diğer randevularım<Icon name="arrow" size={16} /></Link>{phone && <a className={styles.textLink} href={`tel:${phone.replace(/[^\d+]/g, '')}`}><Icon name="phone" size={16} />Servisimize ulaşın</a>}</div></div></section>}
    <Link className={styles.bottomBack} href={returnTo}><Icon name="left" size={17} />Tüm randevularıma dön</Link>
  </div>;
}

function EstimateCard({ estimate, serviceHref }: { estimate: Estimate; serviceHref: string }) {
  const totals = estimateTotals(estimate);
  return <article className={`${styles.estimateCard} ${estimate.status === 'Gönderildi' ? styles.pendingEstimate : ''}`}><header className={styles.estimateHeader}><div><span className={styles.eyebrow}>TEKLİF SÜRÜMÜ {estimate.version}</span><h3>{estimate.status === 'Gönderildi' ? 'Kararınızı bekleyen teklif' : estimate.status === 'Geçersiz' ? 'Geçerliliği sona ermiş teklif' : `Teklif ${estimate.status.toLocaleLowerCase('tr-TR')}`}</h3><p>{estimate.sentAt ? `Paylaşım: ${fmtDateTime(estimate.sentAt)}` : `Oluşturulma: ${fmtDateTime(estimate.createdAt)}`}</p></div><span className={styles.status}>{estimate.status}</span></header>{estimate.note && <p className={styles.estimateNote}>{estimate.note}</p>}<div className={styles.lineItems}>{estimate.lines.map(line => {
    const lineTotal = lineTotals(line);
    return <div className={styles.lineItem} key={line.id}><div className={styles.lineTitle}><h4>{line.name}</h4><span>{line.kind}{line.code ? ` · ${line.code}` : ''}</span></div><dl><div><dt>Miktar</dt><dd>{qtyText(line.qty)} {line.unit}</dd></div><div><dt>Birim fiyat</dt><dd>{money(line.unitPrice)}</dd></div><div><dt>İndirim</dt><dd>%{line.discountPct}{line.discountPct > 0 ? ` (${money(lineTotal.discount)})` : ''}</dd></div><div><dt>Kalem tutarı</dt><dd>{money(lineTotal.net)}</dd></div></dl></div>;
  })}</div>{!estimate.lines.length && <p className={styles.smallPrint}>Bu sürümde teklif kalemi bulunmuyor.</p>}<div className={styles.estimateBottom}><div className={styles.decision}>{estimate.decision ? <><Icon name={estimate.decision.result === 'Onaylandı' ? 'check' : 'x'} size={22} /><h4>Karar: {estimate.decision.result}</h4><time dateTime={estimate.decision.at}>{fmtDateTime(estimate.decision.at)}</time><span>Karar kanalı: {estimate.decision.channel}</span></> : <><Icon name="receipt" size={23} /><h4>{estimate.status === 'Gönderildi' ? 'Kararınızı servis ekranından iletin.' : 'Bu sürüm için kayıtlı karar yok.'}</h4><p>{estimate.status === 'Geçersiz' ? 'Bu sürüm artık geçerli değil. Varsa güncel teklifinizi inceleyin.' : 'İşlem kapsamını ve tutarları servis ayrıntılarından da inceleyebilirsiniz.'}</p></>}{estimate.status === 'Gönderildi' && <Link className={styles.primaryButton} href={serviceHref}>Teklifi incele ve karar ver<Icon name="arrow" size={16} /></Link>}</div><dl className={styles.totals}><div><dt>Parça toplamı</dt><dd>{money(totals.parts)}</dd></div><div><dt>İşçilik toplamı</dt><dd>{money(totals.labor)}</dd></div><div><dt>İndirim öncesi toplam</dt><dd>{money(totals.gross)}</dd></div><div><dt>Toplam indirim</dt><dd>{money(totals.discount)}</dd></div><div><dt>KDV hariç ara toplam</dt><dd>{money(totals.subtotal)}</dd></div><div><dt>KDV (%{estimate.vatRate})</dt><dd>{money(totals.vat)}</dd></div><div className={styles.grandTotal}><dt>KDV dahil toplam</dt><dd>{money(totals.total)}</dd></div></dl></div></article>;
}
