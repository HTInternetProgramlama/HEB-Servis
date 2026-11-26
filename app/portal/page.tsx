'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/store';
import { Icon, type IconName } from '@/components/icons';
import { CarImage, Plate } from '@/components/vehicle-identity';
import { AppointmentForm } from '@/components/forms';
import { amountDue, amountPaid, balance, estimateTotals, portalView, serviceName } from '@/lib/rules';
import { fmtDate, fmtDateTime, km, money, today } from '@/lib/format';
import { detailHref } from '@/lib/routes';
import styles from '@/components/customer-portal.module.css';

const stages = ['Kabul', 'İnceleme', 'Teklif / onay', 'İşlem', 'Son kontrol', 'Teslim'];
const stageIndex: Record<string, number> = { 'Kabul edildi': 0, 'İnceleniyor': 1, 'Onay bekliyor': 2, 'İşlemde': 3, 'Parça bekliyor': 3, 'Son kontrol': 4, 'Teslime hazır': 5 };
const statusText: Record<string, string> = {
  'Kabul edildi': 'Aracınız teslim alındı. İlk kontroller için hazırlanıyor.',
  'İnceleniyor': 'Aracınızın ihtiyacını belirlemek için kontroller yapılıyor.',
  'Onay bekliyor': 'Planlanan işlemleri ve teklifinizi inceleyerek kararınızı iletebilirsiniz.',
  'İşlemde': 'Onayladığınız servis işlemleri devam ediyor.',
  'Parça bekliyor': 'İşlemlere devam edebilmek için gerekli parçanın gelmesi bekleniyor.',
  'Son kontrol': 'Servis işlemleri tamamlandı. Teslim öncesi son kontroller yapılıyor.',
  'Teslime hazır': 'Son kontroller tamamlandı. Aracınızı teslim almak için servisimizle iletişime geçebilirsiniz.',
};
const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export default function PortalHome() {
  const { state, actor } = useApp();
  const [book, setBook] = useState<string | null>(null);
  const [allHistory, setAllHistory] = useState(false);
  const view = portalView(state, actor);
  const company = state.settings.company;
  const active = view.jobs.filter(j => !['Teslim edildi', 'İptal'].includes(j.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const past = view.jobs.filter(j => j.status === 'Teslim edildi').sort((a, b) => (b.deliveredAt ?? b.createdAt).localeCompare(a.deliveredAt ?? a.createdAt));
  const upcoming = view.appointments.filter(a => ['Bekliyor', 'Onaylı'].includes(a.status) && new Date(`${a.date}T${a.time}:00+03:00`).getTime() >= Date.now()).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const offers = active.flatMap(job => {
    const estimate = job.estimates.filter(e => e.status === 'Gönderildi').at(-1);
    return estimate ? [{ job, estimate }] : [];
  });
  const featuredJob = offers[0]?.job ?? active[0];
  const featured = view.vehicles.find(v => v.id === featuredJob?.vehicleId) ?? view.vehicles[0];
  const openBalance = view.jobs.filter(j => j.status !== 'İptal').reduce((sum, j) => sum + Math.max(0, balance(j)), 0);
  const paid = view.jobs.reduce((sum, j) => sum + amountPaid(j), 0);
  const billed = past.reduce((sum, j) => sum + amountDue(j), 0);
  const phoneHref = company.phone ? `tel:${company.phone.replace(/[^\d+]/g, '')}` : undefined;
  const contactHref = phoneHref ?? (company.email ? `mailto:${company.email}` : '#iletisim');
  const firstName = view.customer?.name.trim().split(/\s+/)[0] ?? actor.name.split(' ')[0];
  const summaries: { icon: IconName; value: number; label: string; detail: string; href: string; attention?: boolean }[] = [
    { icon: 'car', value: view.vehicles.length, label: 'Kayıtlı aracınız', detail: 'Araçlar ve bakım planları', href: '#araclarim' },
    { icon: 'wrench', value: active.length, label: 'Devam eden servis', detail: active.length ? 'Güncel durumu takip edin' : 'Aracınız serviste değil', href: '#servisim' },
    { icon: 'receipt', value: offers.length, label: 'Onay bekleyen teklif', detail: offers.length ? 'İncelemeniz için hazır' : 'Bekleyen kararınız yok', href: offers.length ? '#teklifler' : '#servisim', attention: offers.length > 0 },
    { icon: 'calendar', value: upcoming.length, label: 'Yaklaşan randevu', detail: upcoming[0] ? `${fmtDate(upcoming[0].date, { day: 'numeric', month: 'short' })} · ${upcoming[0].time}` : 'Size uygun zamanı planlayın', href: '#randevularim' },
  ];

  return <div className={styles.dashboard}>
    <section className={styles.hero} aria-labelledby="portal-title">
      <div className={styles.heroCopy}>
        <span className={styles.eyebrow}>SİZE ÖZEL SERVİS ALANI</span>
        <h1 id="portal-title">Merhaba {firstName},<br /><span>yolculuğunuz burada başlar.</span></h1>
        <p>Aracınızın servis sürecini takip edin, tekliflerinizi inceleyin ve bir sonraki bakımınızı kolayca planlayın.</p>
        <div className={styles.heroActions}>
          {view.vehicles.length ? <button className={styles.primaryButton} onClick={() => setBook(featured?.id ?? '')}><Icon name="calendar" size={19} />Randevu planla<Icon name="arrow" size={17} /></button> : <a className={styles.primaryButton} href={contactHref}><Icon name="phone" size={18} />İlk aracınızı kaydettirin</a>}
          <a className={styles.heroLink} href={offers.length ? '#teklifler' : '#araclarim'}>{offers.length ? 'Teklifimi incele' : 'Araçlarıma göz at'}<Icon name="down" size={16} /></a>
        </div>
        <span className={styles.heroFoot}><Icon name="check" size={15} />{company.name}{company.branch && ` · ${company.branch}`}</span>
      </div>
      <div className={styles.heroVehicle}>
        <div className={styles.heroVehicleTop}><span className={styles.vehicleEyebrow}>{featuredJob ? 'SERVİSTEKİ ARACINIZ' : featured ? 'GARAJINIZDAN' : 'BİR SONRAKİ YOLCULUĞUNUZ'}</span>{featured && <Plate value={featured.plate} size="sm" />}</div>
        {featured ? <><CarImage vehicle={featured} eager className={styles.heroCar} /><div className={styles.heroVehicleBottom}><div><strong>{featured.brand} {featured.model}</strong><span>{featured.year} · {km(featured.km)}</span></div><span className={styles.heroBadge}><i />{featuredJob?.status ?? 'Aracınız kayıtlı'}</span></div><small className={styles.artNote}>Temsili araç görseli</small></> : <div className={styles.emptyGarage}><Icon name="car" size={88} /><strong>Aracınız için yeriniz hazır.</strong><span>Araç kaydınız oluşturulduğunda servis ve bakım bilgileri burada görünür.</span></div>}
      </div>
    </section>

    <div className={styles.summaryGrid} aria-label="Servis hesabınızın özeti">{summaries.map(s => <a key={s.label} href={s.href} className={`${styles.summaryCard} ${s.attention ? styles.summaryAttention : ''}`}><div className={styles.summaryTop}><span className={styles.summaryIcon}><Icon name={s.icon} size={22} /></span><Icon name="right" size={17} /></div><strong>{s.value.toLocaleString('tr-TR')}</strong><span className={styles.summaryLabel}>{s.label}</span><small>{s.detail}</small></a>)}</div>

    {offers.length > 0 && <section id="teklifler" className={styles.offerSection} aria-labelledby="offers-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>SIRADAKİ ADIM SİZDE</span><h2 id="offers-title">Onayınızı bekleyen teklifler</h2><p>İşlemleri ve tutarı inceleyin, kararınızı servis detayından iletin.</p></div><span className={styles.countBadge}>{offers.length} teklif</span></div><div className={styles.offerGrid}>{offers.map(({ job, estimate }) => {
      const vehicle = view.vehicles.find(v => v.id === job.vehicleId);
      return <article key={estimate.id} className={styles.offerCard}><span className={styles.offerIcon}><Icon name="receipt" size={25} /></span><div className={styles.offerContent}><span className={styles.orangeLabel}>İncelemeniz için hazır</span><h3>{vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Servis teklifiniz'}</h3><p>{serviceName(state, job.serviceId)} · {job.no}</p><div className={styles.offerMeta}>{vehicle && <Plate value={vehicle.plate} size="sm" />}<span>{estimate.lines.length} işlem kalemi · Teklif v{estimate.version}</span></div></div><div className={styles.offerAmount}><small>KDV dahil toplam</small><strong>{money(estimateTotals(estimate).total)}</strong><Link href={detailHref('/portal/servis', job.id)} className={styles.primaryButton}>Teklifi incele<Icon name="arrow" size={16} /></Link></div></article>;
    })}</div></section>}

    <div className={styles.mainColumns}>
      <div className={styles.mainColumn}>
        <section id="servisim" className={styles.section} aria-labelledby="active-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>HER ADIMDAN HABERİNİZ OLSUN</span><h2 id="active-title">Servisiniz ne aşamada?</h2></div>{active.length > 0 && <span className={styles.neutralBadge}>{active.length} aktif servis</span>}</div>
          {active.length ? active.map(job => {
            const vehicle = view.vehicles.find(v => v.id === job.vehicleId);
            const current = stageIndex[job.status] ?? 0;
            const pending = offers.some(o => o.job.id === job.id);
            return <article key={job.id} className={styles.serviceCard}><div className={styles.cardTop}><div><span className={styles.smallLabel}>{job.no} · {serviceName(state, job.serviceId)}</span><h3>{vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Servis kaydınız'}</h3></div><span className={`${styles.stateBadge} ${job.status === 'Teslime hazır' ? styles.readyBadge : ''}`}>{job.status}</span></div><p className={styles.serviceMessage}>{statusText[job.status]}</p><ol className={styles.progress} aria-label="Servis aşamaları">{stages.map((label, index) => <li key={label} className={index < current ? styles.stepDone : index === current ? styles.stepCurrent : ''} aria-current={index === current ? 'step' : undefined}><span>{index < current ? <Icon name="check" size={13} /> : index + 1}</span><small>{label}</small></li>)}</ol><div className={styles.serviceFooter}><div><Icon name="clock" size={17} /><span>Tahmini teslim<strong>{job.promisedAt ? fmtDateTime(job.promisedAt) : 'Servisimizle görüşün'}</strong></span></div><Link className={pending ? styles.primaryButton : styles.secondaryButton} href={detailHref('/portal/servis', job.id)}>{pending ? 'Teklifi incele' : 'Servis detayları'}<Icon name="arrow" size={16} /></Link></div>{job.status === 'Teslime hazır' && balance(job) > 0 && <div className={styles.balanceNote}>Teslimde kalan ödeme <strong>{money(balance(job))}</strong></div>}</article>;
          }) : <div className={styles.emptyCard}><span className={styles.emptyIcon}><Icon name="check" size={28} /></span><div><h3>Şu anda devam eden servisiniz yok.</h3><p>Yeni bir servis kaydı açıldığında bütün aşamaları buradan takip edebilirsiniz.</p>{view.vehicles.length ? <button className={styles.textButton} onClick={() => setBook('')}>Bir sonraki ziyaretinizi planlayın<Icon name="arrow" size={16} /></button> : <a className={styles.textButton} href={contactHref}>Servisimizle tanışın<Icon name="arrow" size={16} /></a>}</div></div>}
        </section>

        <section id="araclarim" className={styles.section} aria-labelledby="vehicles-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>YOLA HAZIR TUTUN</span><h2 id="vehicles-title">Araçlarınız & bakım planınız</h2><p>Servis kayıtlarınız ve yaklaşan bakımlarınız bir arada.</p></div><span className={styles.neutralBadge}>{view.vehicles.length} araç</span></div>
          <div className={styles.vehicleGrid}>{view.vehicles.map(vehicle => {
            const last = past.find(j => j.vehicleId === vehicle.id);
            const isActive = active.some(j => j.vehicleId === vehicle.id);
            const daysLeft = vehicle.nextServiceDate ? Math.round((Date.parse(`${vehicle.nextServiceDate}T12:00:00Z`) - Date.parse(`${today()}T12:00:00Z`)) / 86400000) : null;
            const kmLeft = vehicle.nextServiceKm !== undefined ? vehicle.nextServiceKm - vehicle.km : null;
            const overdue = (daysLeft !== null && daysLeft < 0) || (kmLeft !== null && kmLeft <= 0);
            const due = overdue || (daysLeft !== null && daysLeft <= 30) || (kmLeft !== null && kmLeft <= 1500);
            return <article className={styles.vehicleCard} key={vehicle.id}><div className={styles.vehicleArt}><Plate value={vehicle.plate} size="sm" /><CarImage vehicle={vehicle} className={styles.vehicleCar} />{isActive && <span className={styles.inService}><i />Şu anda serviste</span>}</div><div className={styles.vehicleBody}><span className={styles.smallLabel}>{vehicle.year} · {vehicle.fuel} · {vehicle.transmission}</span><h3>{vehicle.brand} {vehicle.model}</h3><div className={styles.mileage}><Icon name="gauge" size={16} />Son kayıtlı kilometre<strong>{km(vehicle.km)}</strong></div><div className={`${styles.maintenance} ${due ? styles.maintenanceDue : ''}`}><span><Icon name="wrench" size={15} />{overdue ? 'Bakım zamanı geldi' : due ? 'Bakımınız yaklaşıyor' : 'Sonraki bakımınız'}</span><strong>{vehicle.nextServiceDate ? fmtDate(vehicle.nextServiceDate) : vehicle.nextServiceKm ? km(vehicle.nextServiceKm) : 'Birlikte planlayalım'}</strong>{vehicle.nextServiceDate && vehicle.nextServiceKm ? <small>veya {km(vehicle.nextServiceKm)}</small> : !vehicle.nextServiceDate && !vehicle.nextServiceKm ? <small>Servisiniz henüz bir bakım planı belirlememiş.</small> : null}</div><div className={styles.lastService}><span>Son tamamlanan servis</span><strong>{last ? fmtDate(last.deliveredAt ?? last.createdAt) : 'Henüz servis kaydı yok'}</strong></div><button className={styles.vehicleBooking} onClick={() => setBook(vehicle.id)}><Icon name="calendar" size={17} />Bu araç için randevu al<Icon name="arrow" size={16} /></button></div></article>;
          })}</div>
          {!view.vehicles.length && <div className={styles.emptyCard}><span className={styles.emptyIcon}><Icon name="car" size={30} /></span><div><h3>Garajınız ilk aracınızı bekliyor.</h3><p>Araç kaydınızı servisimiz oluşturur. Bizimle iletişime geçin; aracınızı hesabınıza ekleyelim, randevunuzu birlikte planlayalım.</p><a className={styles.textButton} href={contactHref}>Araç kaydı için iletişime geçin<Icon name="arrow" size={16} /></a></div></div>}
        </section>
      </div>

      <aside className={styles.sideColumn}>
        <section id="randevularim" className={styles.sideCard} aria-labelledby="appointments-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>TAKVİMİNİZ</span><h2 id="appointments-title">Yaklaşan ziyaretler</h2></div><Icon name="calendar" size={22} /></div>{upcoming.length ? <div className={styles.appointmentList}>{upcoming.slice(0, 3).map(appointment => {
          const vehicle = view.vehicles.find(v => v.id === appointment.vehicleId);
          return <article key={appointment.id} className={styles.appointment}><div className={styles.dateTile}><strong>{appointment.date.slice(8, 10)}</strong><span>{fmtDate(appointment.date, { month: 'short' })}</span></div><div><span className={appointment.status === 'Onaylı' ? styles.confirmedLabel : styles.orangeLabel}>{appointment.status === 'Onaylı' ? 'Randevunuz onaylandı' : 'Servis onayı bekleniyor'}</span><h3>{serviceName(state, appointment.serviceId)}</h3><p>{appointment.time} · {appointment.duration} dakika</p>{vehicle && <small>{vehicle.brand} {vehicle.model} · {vehicle.plate}</small>}<Link className={styles.appointmentDetails} href={detailHref('/portal/randevular/detay', appointment.id)}>Randevu ayrıntıları<Icon name="right" size={14} /></Link></div></article>;
        })}</div> : <div className={styles.sideEmpty}><Icon name="calendar" size={32} /><h3>Sıradaki ziyaretinizi planlayalım.</h3><p>Uygun gün ve saati seçin, randevu talebinizi bize iletin.</p>{view.vehicles.length ? <button className={styles.secondaryButton} onClick={() => setBook('')}>Randevu talep et<Icon name="plus" size={16} /></button> : <a className={styles.secondaryButton} href={contactHref}>Önce araç kaydı oluşturun</a>}</div>}<Link className={styles.sideCardLink} href="/portal/randevular">Tüm randevularım<Icon name="arrow" size={16} /></Link><Link className={styles.sideCardLink} href="/portal/randevular?gorunum=gecmis"><span><Icon name="history" size={15} /> Geçmiş randevularımı incele</span><Icon name="right" size={16} /></Link></section>

        <section className={styles.paymentCard} aria-labelledby="payments-title"><span className={styles.paymentIcon}><Icon name="wallet" size={23} /></span><span className={styles.eyebrow}>HESABINIZA GENEL BAKIŞ</span><h2 id="payments-title">Servis & ödeme özeti</h2><div className={styles.paymentTotal}><span>Kalan servis bakiyesi</span><strong>{money(openBalance)}</strong><small>{openBalance > 0 ? 'Kayıtlı servislerinizin kalan ödeme toplamı' : 'Kayıtlı servislerinizde açık bakiyeniz yok.'}</small></div><dl className={styles.paymentRows}><div><dt>Tamamlanan servis</dt><dd>{past.length}</dd></div><div><dt>Tamamlanan iş tutarı</dt><dd>{money(billed)}</dd></div><div><dt>Toplam tahsilat</dt><dd>{money(paid)}</dd></div></dl><p className={styles.paymentFoot}>Tutar ve tahsilat ayrıntılarını ilgili servis kaydınızdan inceleyebilirsiniz.</p></section>

        <section id="iletisim" className={styles.contactCard} aria-labelledby="contact-title"><span className={styles.eyebrow}>BİR TELEFON KADAR YAKIN</span><h2 id="contact-title">Size nasıl yardımcı olalım?</h2><p>Aracınız, randevunuz veya servis süreciniz hakkında bizimle iletişime geçin.</p><strong className={styles.companyName}>{company.name}</strong>{company.branch && <span className={styles.branch}>{company.branch}</span>}<div className={styles.contactList}>{phoneHref && <a href={phoneHref}><span><Icon name="phone" size={19} /></span><div><small>Servisimizi arayın</small><strong>{company.phone}</strong></div><Icon name="arrow" size={16} /></a>}{company.email && <a href={`mailto:${company.email}`}><span><Icon name="mail" size={19} /></span><div><small>Bize yazın</small><strong>{company.email}</strong></div><Icon name="arrow" size={16} /></a>}<div className={styles.workingHours}><span><Icon name="clock" size={19} /></span><div><small>Çalışma saatleri</small><strong>{state.settings.workStart} – {state.settings.workEnd}</strong><p>{state.settings.workDays.map(day => dayNames[day - 1]).filter(Boolean).join(' · ')}</p>{state.settings.breakStart && state.settings.breakEnd && <small>Öğle arası: {state.settings.breakStart} – {state.settings.breakEnd}</small>}</div></div></div>{company.address && <p className={styles.address}>{company.address}</p>}</section>
      </aside>
    </div>

    <section id="gecmis" className={styles.section} aria-labelledby="history-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>ARACINIZIN HİKÂYESİ</span><h2 id="history-title">Geçmiş servisleriniz</h2><p>Yapılan işlemleri, servis formlarınızı ve ödemelerinizi yeniden inceleyin.</p></div>{past.length > 4 && <button className={styles.secondaryButton} onClick={() => setAllHistory(!allHistory)}>{allHistory ? 'Daha az göster' : `Tümünü göster (${past.length})`}<Icon name="down" size={16} /></button>}</div>{past.length ? <div className={styles.historyList}>{(allHistory ? past : past.slice(0, 4)).map(job => {
      const vehicle = view.vehicles.find(v => v.id === job.vehicleId);
      return <article key={job.id} className={styles.historyCard}><span className={styles.historyIcon}><Icon name="check" size={22} /></span><div className={styles.historyInfo}><span className={styles.smallLabel}>{fmtDate(job.deliveredAt ?? job.createdAt)} · {job.no}</span><h3>{serviceName(state, job.serviceId)}</h3><p>{vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}` : 'Kayıtlı servisiniz'}</p></div><div className={styles.historyAmount}><strong>{money(amountDue(job))}</strong><small>{balance(job) > 0 ? `${money(balance(job))} kalan` : 'Ödemesi tamamlandı'}</small></div><div className={styles.historyActions}><Link className={styles.secondaryButton} href={detailHref('/portal/servis', job.id)}>Ayrıntılar<Icon name="right" size={16} /></Link><Link className={styles.documentLink} href={detailHref('/servis-formu', job.id)} target="_blank" rel="noopener noreferrer"><Icon name="printer" size={15} />Servis formu<span className={styles.srOnly}> (yeni sekmede açılır)</span></Link></div></article>;
    })}</div> : <div className={styles.emptyCard}><span className={styles.emptyIcon}><Icon name="history" size={29} /></span><div><h3>Aracınızın servis hikâyesi burada birikecek.</h3><p>Tamamlanan ilk servisinizden sonra işlem ve ödeme kayıtlarınıza buradan ulaşabilirsiniz.</p>{view.vehicles.length ? <button className={styles.textButton} onClick={() => setBook('')}>İlk ziyaretinizi planlayın<Icon name="arrow" size={16} /></button> : <a className={styles.textButton} href="#iletisim">Servisimizle iletişime geçin<Icon name="arrow" size={16} /></a>}</div></div>}</section>

    {book !== null && <AppointmentForm open portal preset={{ vehicleId: book || undefined, customerId: actor.customerId }} onClose={() => setBook(null)} />}
  </div>;
}
