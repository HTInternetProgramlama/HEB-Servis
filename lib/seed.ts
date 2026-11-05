import type { Appointment, CatalogItem, Customer, Estimate, EstimateLine, Job, JobStatus, Payment, PaymentMethod, State, User, Vehicle } from './types';
import { addDays, today } from './format';

// Tüm kişi, plaka ve firma bilgileri kurgusaldır.

const users: User[] = [
  { id: 'u-admin', name: 'Hasan Emre', email: 'yonetici@hebservis.test', phone: '0346 000 00 10', role: 'admin', active: true },
  { id: 'u-adv1', name: 'Selin Arslan', email: 'selin@hebservis.test', phone: '0346 000 00 11', role: 'advisor', active: true },
  { id: 'u-adv2', name: 'Burak Çelik', email: 'burak@hebservis.test', phone: '0346 000 00 12', role: 'advisor', active: true },
  { id: 'u-t1', name: 'Ahmet Yılmaz', email: 'ahmet@hebservis.test', phone: '0346 000 00 21', role: 'technician', active: true },
  { id: 'u-t2', name: 'Mehmet Kaya', email: 'mehmet@hebservis.test', phone: '0346 000 00 22', role: 'technician', active: true },
  { id: 'u-t3', name: 'Emre Demir', email: 'emre@hebservis.test', phone: '0346 000 00 23', role: 'technician', active: true },
  { id: 'u-c1', name: 'Ayşe Demir', email: 'ayse.demir@ornek.test', phone: '0555 000 00 01', role: 'customer', customerId: 'c1', active: true },
  { id: 'u-c2', name: 'Mert Kaya', email: 'mert.kaya@ornek.test', phone: '0555 000 00 02', role: 'customer', customerId: 'c2', active: true },
];

const catalog: CatalogItem[] = [
  ['p-oil', 'Parça', 'YAG-5W30', 'Motor yağı 5W-30 tam sentetik', 'lt', 65000],
  ['p-oilf', 'Parça', 'FLT-YAG', 'Yağ filtresi', 'adet', 42000],
  ['p-airf', 'Parça', 'FLT-HAVA', 'Hava filtresi', 'adet', 54000],
  ['p-cabf', 'Parça', 'FLT-POLEN', 'Polen filtresi (aktif karbonlu)', 'adet', 48000],
  ['p-fuelf', 'Parça', 'FLT-YAKIT', 'Yakıt filtresi', 'adet', 92000],
  ['p-padf', 'Parça', 'FRN-BAL-ON', 'Ön fren balatası', 'takım', 245000],
  ['p-padr', 'Parça', 'FRN-BAL-AR', 'Arka fren balatası', 'takım', 189000],
  ['p-disc', 'Parça', 'FRN-DSK-ON', 'Ön fren diski', 'adet', 215000],
  ['p-brfl', 'Parça', 'SVI-FREN', 'Fren hidroliği DOT 4', 'lt', 38000],
  ['p-cool', 'Parça', 'SVI-ANTF', 'Antifriz (-37 °C)', 'lt', 29000],
  ['p-wip', 'Parça', 'SLC-SET', 'Silecek süpürgesi', 'takım', 65000],
  ['p-bat', 'Parça', 'AKU-72', 'Akü 12V 72Ah', 'adet', 485000],
  ['p-plug', 'Parça', 'ATE-BUJI', 'Buji', 'adet', 34000],
  ['p-timing', 'Parça', 'MTR-TRG', 'Triger seti + devirdaim', 'takım', 980000],
  ['p-shock', 'Parça', 'SUS-AMR-ON', 'Ön amortisör', 'adet', 365000],
  ['l-maint', 'İşçilik', 'ISC-BAKIM', 'Periyodik bakım işçiliği', 'saat', 120000],
  ['l-diag', 'İşçilik', 'ISC-TESPIT', 'Bilgisayarlı arıza tespiti', 'adet', 90000],
  ['l-brake', 'İşçilik', 'ISC-FREN', 'Fren sistemi işçiliği', 'saat', 120000],
  ['l-tyre', 'İşçilik', 'ISC-LASTIK', 'Lastik söküm-takım ve balans', 'adet', 25000],
  ['l-align', 'İşçilik', 'ISC-ROT', 'Rot ayarı', 'adet', 90000],
  ['l-ac', 'İşçilik', 'ISC-KLIMA', 'Klima gaz dolumu ve kaçak testi', 'adet', 140000],
  ['l-timing', 'İşçilik', 'ISC-TRIGER', 'Triger değişim işçiliği', 'saat', 120000],
  ['l-susp', 'İşçilik', 'ISC-SUSP', 'Ön düzen işçiliği', 'saat', 120000],
].map(([id, kind, code, name, unit, unitPrice]) => ({ id, kind, code, name, unit, unitPrice, active: true }) as CatalogItem);

const customersRaw: [string, Customer['kind'], string, string, string, string, Customer['preference']][] = [
  ['c1', 'Bireysel', 'Ayşe Demir', '0555 000 00 01', 'ayse.demir@ornek.test', 'Kızılırmak Mah. 12. Sk. No:4, Merkez / Sivas', 'Telefon'],
  ['c2', 'Bireysel', 'Mert Kaya', '0555 000 00 02', 'mert.kaya@ornek.test', 'Esentepe Mah. Atatürk Cad. No:88, Merkez / Sivas', 'SMS'],
  ['c3', 'Bireysel', 'Elif Yıldız', '0555 000 00 03', '', 'Yenişehir Mah. 3. Cad. No:17, Merkez / Sivas', 'Telefon'],
  ['c4', 'Kurumsal', 'Kızılırmak Lojistik Ltd. Şti.', '0346 000 00 40', 'filo@kizilirmak-lojistik.test', 'OSB 4. Cad. No:9, Sivas', 'E-posta'],
  ['c5', 'Bireysel', 'Deniz Aydın', '0555 000 00 05', 'deniz.aydin@ornek.test', 'Ahmet Turangazi Mah. No:31, Sivas', 'SMS'],
  ['c6', 'Bireysel', 'Okan Şahin', '0555 000 00 06', '', 'Mevlana Mah. 7. Sk. No:2, Sivas', 'Telefon'],
  ['c7', 'Kurumsal', 'Cumhuriyet Eczane Deposu A.Ş.', '0346 000 00 70', 'satinalma@cumhuriyet-ecza.test', 'Kayseri Yolu 6. km, Sivas', 'E-posta'],
  ['c8', 'Bireysel', 'Zeynep Koç', '0555 000 00 08', 'zeynep.koc@ornek.test', 'Gökçebostan Mah. No:45, Sivas', 'Telefon'],
];

const vehiclesRaw: [string, string, string, string, string, number, number, Vehicle['fuel'], Vehicle['transmission'], string, string][] = [
  ['v1', 'c1', '58AD240', 'Volkswagen', 'Golf', 2020, 84250, 'Benzin', 'Otomatik', 'Gri', 'WVWZZZCDZLW000124'],
  ['v2', 'c2', '58MK512', 'Renault', 'Megane', 2022, 52100, 'Dizel', 'Otomatik', 'Beyaz', 'VF1RFB00X66000312'],
  ['v3', 'c3', '58EY106', 'Fiat', 'Egea', 2021, 71030, 'Dizel', 'Manuel', 'Beyaz', 'ZFA35600006000731'],
  ['v4', 'c5', '58DA101', 'Renault', 'Clio', 2022, 42400, 'Benzin', 'Manuel', 'Kırmızı', 'VF1RJA00X67000418'],
  ['v5', 'c4', '58KL301', 'Ford', 'Transit Custom', 2021, 168400, 'Dizel', 'Manuel', 'Beyaz', 'WF0YXXTTGYMA00051'],
  ['v6', 'c4', '58KL302', 'Ford', 'Transit Custom', 2021, 154900, 'Dizel', 'Manuel', 'Beyaz', 'WF0YXXTTGYMA00052'],
  ['v7', 'c6', '58OS734', 'Toyota', 'Corolla', 2019, 118600, 'Hibrit', 'Otomatik', 'Siyah', 'NMTBZ3BE30R000215'],
  ['v8', 'c7', '58CE450', 'Dacia', 'Duster', 2020, 96700, 'Dizel', 'Manuel', 'Gri', 'UU1HSDAG563000428'],
  ['v9', 'c8', '58ZK908', 'Hyundai', 'i20', 2023, 23800, 'Benzin', 'Otomatik', 'Mavi', 'NLHBN51BAPZ000909'],
  ['v10', 'c1', '58AY017', 'Peugeot', '3008', 2021, 61200, 'Dizel', 'Otomatik', 'Lacivert', 'VF3MCYHZRMS000017'],
];

const L = (id: string, qty = 100, discountPct = 0): EstimateLine => {
  const c = catalog.find(c => c.id === id)!;
  return { id: `${id}-${qty}-${discountPct}`, kind: c.kind, code: c.code, name: c.name, unit: c.unit, qty, unitPrice: c.unitPrice, discountPct };
};

const flow: JobStatus[] = ['Kabul edildi', 'İnceleniyor', 'Onay bekliyor', 'İşlemde', 'Son kontrol', 'Teslime hazır', 'Teslim edildi'];

interface JobSpec {
  id: string; no: number; customerId: string; vehicleId: string; serviceId: string; tech: string; advisor: string;
  status: JobStatus; daysAgo: number; complaint: string; lines: EstimateLine[]; paid?: [number, PaymentMethod][] | 'full';
  fuel?: number; damages?: Job['intake']['damages']; appointmentId?: string; parts?: boolean; secondEstimate?: EstimateLine[]; promiseHours?: number;
}

function iso(day: string, time: string) { return new Date(`${day}T${time}:00+03:00`).toISOString() }

function buildJob(s: JobSpec, base: string, vehicle: Vehicle, clock: Date): Job {
  const start = addDays(base, -s.daysAgo);
  const advisor = users.find(u => u.id === s.advisor)!.name, tech = users.find(u => u.id === s.tech)!.name;
  const reached = s.status === 'Parça bekliyor' ? flow.indexOf('İşlemde') : flow.indexOf(s.status);
  const history: Job['history'] = [];
  const at = (i: number) => s.daysAgo === 0 ? iso(start, `${String(8 + Math.min(i, 2)).padStart(2, '0')}:${i % 2 ? '45' : '15'}`) : iso(addDays(start, Math.floor(i / 3)), `${String(9 + (i % 3) * 2).padStart(2, '0')}:${i % 2 ? '40' : '10'}`);
  flow.slice(0, reached + 1).forEach((st, i) => history.push({ status: st, at: at(i), by: ['Kabul edildi', 'Onay bekliyor', 'Teslim edildi', 'Teslime hazır'].includes(st) ? advisor : tech, note: st === 'Kabul edildi' ? (s.appointmentId ? 'Randevudan kabul' : 'Randevusuz kabul') : st === 'İşlemde' ? 'Teklif v1 onaylandı (Telefon)' : '' }));
  if (s.status === 'Parça bekliyor') history.push({ status: 'Parça bekliyor', at: at(reached + 1), by: tech, note: 'Ön amortisör tedarikçiden bekleniyor' });

  const estimates: Estimate[] = [];
  if (reached >= 2) {
    const sent = history[2].at, decided = reached >= 3;
    estimates.push({ id: s.id + '-e1', version: 1, status: decided ? 'Onaylandı' : 'Gönderildi', vatRate: 20, lines: s.lines, note: '', createdAt: history[1].at, createdBy: advisor, sentAt: sent, decision: decided ? { result: 'Onaylandı', channel: s.customerId === 'c1' || s.customerId === 'c2' ? 'Portal' : 'Telefon', note: s.customerId === 'c1' || s.customerId === 'c2' ? '' : 'Müşteriyle telefonda kalemler tek tek görüşüldü.', by: s.customerId === 'c1' ? 'Ayşe Demir' : s.customerId === 'c2' ? 'Mert Kaya' : advisor, at: history[3]?.at ?? sent } : undefined });
  } else if (reached === 1) {
    estimates.push({ id: s.id + '-e1', version: 1, status: 'Taslak', vatRate: 20, lines: s.lines, note: '', createdAt: history[1].at, createdBy: advisor });
  }
  if (s.secondEstimate && estimates[0]) {
    estimates.push({ id: s.id + '-e2', version: 2, status: 'Gönderildi', vatRate: 20, lines: [...s.lines, ...s.secondEstimate], note: 'Kontrolde ön amortisörlerde yağ kaçağı tespit edildi; değişimi önerilir.', createdAt: history.at(-1)!.at, createdBy: advisor, sentAt: history.at(-1)!.at });
  }

  const total = estimates.find(e => e.status === 'Onaylandı') ? (() => {
    const e = estimates.find(e => e.status === 'Onaylandı')!; let sub = 0;
    for (const l of e.lines) { const g = Math.round(l.qty * l.unitPrice / 100); sub += g - Math.round(g * l.discountPct / 100) }
    return sub + Math.round(sub * 20 / 100);
  })() : 0;
  const payments: Payment[] = s.paid === 'full'
    ? [{ id: s.id + '-p1', key: s.id + '-k1', amount: total, method: s.no % 3 === 0 ? 'Nakit' : s.no % 3 === 1 ? 'Kredi kartı' : 'Havale/EFT', note: '', at: history.at(-1)!.at, by: advisor }]
    : (s.paid ?? []).map(([amount, method], i) => ({ id: `${s.id}-p${i}`, key: `${s.id}-k${i}`, amount, method, note: i === 0 ? 'Kapora' : '', at: history[Math.min(3 + i, history.length - 1)].at, by: advisor }));

  const inspections: Job['inspections'] = reached >= 1 ? [
    { id: s.id + '-i1', item: 'Fren hidroliği seviyesi ve nem oranı', result: 'Uygun', note: 'Nem %1, seviye normal.', customerVisible: true, source: 'Teknisyen', at: history[1].at, by: tech },
    { id: s.id + '-i2', item: s.complaint.includes('fren') ? 'Ön fren balata kalınlığı' : 'Lastik diş derinliği', result: s.complaint.includes('fren') ? 'Acil' : 'Takip edilmeli', note: s.complaint.includes('fren') ? 'Balata 2 mm, disk yüzeyinde çizik.' : 'Ön lastikler 3 mm, kış öncesi değişim önerilir.', customerVisible: true, source: 'Teknisyen', at: history[1].at, by: tech },
    { id: s.id + '-i3', item: 'Motor bölmesi sızıntı kontrolü', result: 'Uygun', note: '', customerVisible: false, source: 'Teknisyen', at: history[1].at, by: tech },
  ] : [];

  return {
    id: s.id, no: `İE-${base.slice(0, 4)}-${String(s.no).padStart(4, '0')}`, appointmentId: s.appointmentId, customerId: s.customerId, vehicleId: s.vehicleId,
    serviceId: s.serviceId, advisorId: s.advisor, technicianId: s.tech, status: s.status,
    intake: { km: vehicle.km, fuel: s.fuel ?? 4, complaint: s.complaint, damages: s.damages ?? [], belongings: s.no % 2 ? 'Yedek anahtar yok, ruhsat torpidoda.' : '', customerAck: true, at: history[0].at, by: advisor },
    inspections, estimates, payments, history,
    promisedAt: s.status === 'Teslim edildi' ? iso(start, '17:00') : new Date(Math.round((clock.getTime() + (s.promiseHours ?? 4) * 3600000) / 1800000) * 1800000).toISOString(),
    deliveredAt: s.status === 'Teslim edildi' ? history.at(-1)!.at : undefined, createdAt: history[0].at,
  };
}

export function seed(clock = new Date()): State {
  const base = today(clock);
  const now = clock.toISOString();
  const customers: Customer[] = customersRaw.map(([id, kind, name, phone, email, address, preference], i) => ({
    id, no: 'M-' + String(i + 1).padStart(4, '0'), kind, name, phone, email, address, preference, consent: true,
    taxNo: kind === 'Kurumsal' ? String(1000000000 + i * 7919) : '', createdAt: iso(addDays(base, -400 + i * 30), '10:00'),
  }));
  const vehicles: Vehicle[] = vehiclesRaw.map(([id, customerId, plate, brand, model, year, km, fuel, transmission, color, vin], i) => ({
    id, customerId, plate, brand, model, year, km, fuel, transmission, color, vin, createdAt: iso(addDays(base, -380 + i * 25), '11:00'),
  }));
  const v = (id: string) => vehicles.find(x => x.id === id)!;

  const specs: JobSpec[] = [
    // Geçmiş, teslim edilmiş işler (raporlar ve geçmiş için)
    { id: 'j1', no: 1, customerId: 'c3', vehicleId: 'v3', serviceId: 's-maint', tech: 'u-t1', advisor: 'u-adv1', status: 'Teslim edildi', daysAgo: 26, complaint: 'Periyodik bakım zamanı geldi.', lines: [L('p-oil', 450), L('p-oilf'), L('p-airf'), L('p-fuelf'), L('l-maint', 150)], paid: 'full' },
    { id: 'j2', no: 2, customerId: 'c4', vehicleId: 'v5', serviceId: 's-brake', tech: 'u-t2', advisor: 'u-adv2', status: 'Teslim edildi', daysAgo: 19, complaint: 'Frenlerde sürtme sesi ve pedal titremesi.', lines: [L('p-padf'), L('p-disc', 200), L('p-brfl'), L('l-brake', 200, 10)], paid: 'full' },
    { id: 'j3', no: 3, customerId: 'c6', vehicleId: 'v7', serviceId: 's-maint', tech: 'u-t3', advisor: 'u-adv1', status: 'Teslim edildi', daysAgo: 13, complaint: 'Bakım ve klima soğutmuyor.', lines: [L('p-oil', 420), L('p-oilf'), L('p-cabf'), L('l-maint', 100), L('l-ac')], paid: 'full' },
    { id: 'j4', no: 4, customerId: 'c7', vehicleId: 'v8', serviceId: 's-diag', tech: 'u-t1', advisor: 'u-adv2', status: 'Teslim edildi', daysAgo: 8, complaint: 'Motor arıza lambası yanıyor, çekişte tekleme.', lines: [L('l-diag'), L('p-plug', 400), L('p-airf'), L('l-maint', 50)], paid: 'full' },
    { id: 'j5', no: 5, customerId: 'c8', vehicleId: 'v9', serviceId: 's-tyre', tech: 'u-t2', advisor: 'u-adv1', status: 'Teslim edildi', daysAgo: 5, complaint: 'Kışlık lastik takılacak, rot balans.', lines: [L('l-tyre', 400), L('l-align')], paid: 'full' },
    { id: 'j6', no: 6, customerId: 'c4', vehicleId: 'v6', serviceId: 's-maint', tech: 'u-t3', advisor: 'u-adv2', status: 'Teslim edildi', daysAgo: 3, complaint: 'Filo periyodik bakımı.', lines: [L('p-oil', 600), L('p-oilf'), L('p-airf'), L('p-fuelf'), L('p-cabf'), L('l-maint', 150, 15)], paid: [[400000, 'Havale/EFT']] },
    { id: 'j7', no: 7, customerId: 'c2', vehicleId: 'v2', serviceId: 's-maint', tech: 'u-t1', advisor: 'u-adv1', status: 'Teslim edildi', daysAgo: 1, complaint: 'Yağ bakımı ve silecekler değişecek.', lines: [L('p-oil', 500), L('p-oilf'), L('p-wip'), L('l-maint', 100)], paid: 'full' },
    // Atölyedeki aktif işler
    { id: 'j8', no: 8, customerId: 'c1', vehicleId: 'v1', serviceId: 's-brake', tech: 'u-t1', advisor: 'u-adv1', status: 'Onay bekliyor', daysAgo: 0, complaint: 'Frenleme sırasında ön taraftan gıcırtı sesi geliyor.', lines: [L('p-padf'), L('p-disc', 200), L('l-brake', 150)], appointmentId: 'a1', fuel: 3, damages: [{ area: 'Ön tampon', kind: 'Çizik', note: 'Sağ köşede 5 cm' }] },
    { id: 'j9', no: 9, customerId: 'c5', vehicleId: 'v4', serviceId: 's-maint', tech: 'u-t2', advisor: 'u-adv1', status: 'İşlemde', daysAgo: 0, complaint: '40.000 km bakımı.', lines: [L('p-oil', 400), L('p-oilf'), L('p-airf'), L('p-cabf'), L('l-maint', 100)], paid: [[200000, 'Kredi kartı']], fuel: 5 },
    { id: 'j10', no: 10, customerId: 'c4', vehicleId: 'v5', serviceId: 's-diag', tech: 'u-t3', advisor: 'u-adv2', status: 'Parça bekliyor', daysAgo: 1, complaint: 'Yükte arka taraftan vuruntu, yol tutuşu bozuk.', lines: [L('l-diag'), L('l-susp', 200)], secondEstimate: [L('p-shock', 200)], fuel: 2, promiseHours: 50, damages: [{ area: 'Sol arka kapı', kind: 'Göçük', note: 'Yükleme hasarı' }, { area: 'Arka tampon', kind: 'Çizik', note: '' }] },
    { id: 'j11', no: 11, customerId: 'c1', vehicleId: 'v10', serviceId: 's-maint', tech: 'u-t2', advisor: 'u-adv2', status: 'Teslime hazır', daysAgo: 1, complaint: 'Bakım ve akü zayıf, sabah zor çalışıyor.', lines: [L('p-oil', 500), L('p-oilf'), L('p-fuelf'), L('p-bat'), L('l-maint', 120)], paid: [[300000, 'Kredi kartı']] },
    { id: 'j12', no: 12, customerId: 'c3', vehicleId: 'v3', serviceId: 's-diag', tech: 'u-t3', advisor: 'u-adv1', status: 'İnceleniyor', daysAgo: 0, complaint: 'Hararet göstergesi yükseliyor, antifriz eksiliyor.', lines: [L('l-diag'), L('p-cool', 600)], fuel: 6, promiseHours: -1 },
  ];
  // j10 için ikinci sürüm gönderildiği için iş onay bekliyor olmalı; seed bunu açıkça ayarlar.
  const jobs = specs.map(s => buildJob(s, base, v(s.vehicleId), clock));
  const j10 = jobs.find(j => j.id === 'j10')!;
  j10.status = 'Onay bekliyor';
  j10.history.push({ status: 'Onay bekliyor', at: j10.estimates[1].sentAt!, by: 'Burak Çelik', note: 'Teklif v2 (ek iş) müşteriye gönderildi' });
  j10.estimates[0].decision = { result: 'Onaylandı', channel: 'Telefon', note: 'Filo yöneticisi ile görüşüldü, tespit ve işçilik onaylandı.', by: 'Burak Çelik', at: j10.history[3].at };
  j10.payments = [];

  // Teslim sonrası bakım planları
  for (const j of jobs.filter(j => j.status === 'Teslim edildi')) {
    const veh = vehicles.find(x => x.id === j.vehicleId)!;
    veh.nextServiceDate = addDays(base, -j.history.length + (j.id === 'j1' ? -2 : j.id === 'j3' ? 9 : 160));
    veh.nextServiceKm = Math.ceil((veh.km + 15000) / 1000) * 1000;
  }
  vehicles.find(x => x.id === 'v8')!.nextServiceKm = 97500;
  vehicles.find(x => x.id === 'v6')!.nextServiceDate = addDays(base, 22);

  const appointments: Appointment[] = [
    ['a1', 'c1', 'v1', 's-brake', 0, '09:00', 90, 'r1', 'İş emri açıldı', 'Portal'],
    ['a2', 'c2', 'v2', 's-tyre', 0, '10:30', 45, 'r2', 'Onaylı', 'Portal'],
    ['a3', 'c3', 'v3', 's-diag', 0, '14:00', 60, 'r4', 'Bekliyor', 'Telefon'],
    ['a4', 'c6', 'v7', 's-ac', 0, '15:30', 60, 'r2', 'Onaylı', 'Telefon'],
    ['a5', 'c8', 'v9', 's-maint', 1, '09:30', 60, 'r1', 'Onaylı', 'Portal'],
    ['a6', 'c7', 'v8', 's-maint', 1, '13:00', 90, 'r3', 'Bekliyor', 'Şube'],
    ['a7', 'c4', 'v6', 's-maint', 2, '10:00', 90, 'r1', 'Bekliyor', 'Telefon'],
    ['a8', 'c5', 'v4', 's-maint', -3, '11:00', 60, 'r2', 'Gelmedi', 'Portal'],
  ].map(([id, customerId, vehicleId, serviceId, d, time, duration, resourceId, status, source], i) => ({
    id: id as string, no: 'R-' + String(i + 1).padStart(5, '0'), customerId: customerId as string, vehicleId: vehicleId as string, serviceId: serviceId as string,
    date: addDays(base, d as number), time: time as string, duration: duration as number, resourceId: resourceId as string,
    status: status as Appointment['status'], note: '', source: source as Appointment['source'], createdAt: iso(addDays(base, (d as number) - 3), '15:20'), createdBy: 'Selin Arslan',
  }));

  return {
    version: 3,
    seq: { customer: customers.length, appointment: appointments.length, job: jobs.length },
    settings: {
      company: { name: 'HEB Otomotiv Servis Hizmetleri', branch: 'Merkez Servis', address: 'Organize Sanayi Bölgesi 2. Cad. No:14, Merkez / Sivas', phone: '0346 000 00 00', email: 'servis@hebservis.test', taxOffice: 'Sivas Kale V.D.', taxNo: '4610000001' },
      workStart: '09:00', workEnd: '18:00', breakStart: '12:00', breakEnd: '13:00', workDays: [1, 2, 3, 4, 5, 6],
      vatRate: 20, serviceIntervalKm: 15000, serviceIntervalMonths: 12,
      resources: [
        { id: 'r1', name: 'Lift 1', kind: 'Lift', active: true },
        { id: 'r2', name: 'Lift 2', kind: 'Lift', active: true },
        { id: 'r3', name: 'Lift 3', kind: 'Lift', active: true },
        { id: 'r4', name: 'Arıza tespit alanı', kind: 'Kontrol', active: true },
      ],
      services: [
        { id: 's-maint', name: 'Periyodik bakım', duration: 90, catalogIds: ['p-oil', 'p-oilf', 'p-airf', 'l-maint'] },
        { id: 's-brake', name: 'Fren sistemi bakımı', duration: 90, catalogIds: ['p-padf', 'l-brake'] },
        { id: 's-diag', name: 'Arıza tespiti', duration: 60, catalogIds: ['l-diag'] },
        { id: 's-tyre', name: 'Lastik değişimi ve balans', duration: 45, catalogIds: ['l-tyre'] },
        { id: 's-ac', name: 'Klima bakımı', duration: 60, catalogIds: ['l-ac'] },
      ],
    },
    users, customers, vehicles, appointments, jobs,
    notes: [
      { id: 'n1', customerId: 'c1', category: 'İletişim tercihi', text: 'Ek işlem çıkarsa onaydan önce telefonla aranmak istiyor; değişen parçaları görmek istiyor.', at: iso(addDays(base, -60), '10:12'), by: 'Selin Arslan', revisions: [] },
      { id: 'n2', customerId: 'c4', category: 'Ödeme', text: 'Kurumsal fatura; ödemeler ay sonu havale ile yapılıyor. Onay yetkilisi filo yöneticisi.', at: iso(addDays(base, -40), '14:30'), by: 'Burak Çelik', revisions: [] },
      { id: 'n3', customerId: 'c6', category: 'Ziyaret gözlemi', text: 'Randevusuna 40 dk geç geldi, önceden haber verdi.', jobId: 'j3', at: iso(addDays(base, -13), '11:00'), by: 'Selin Arslan', revisions: [] },
    ],
    evaluations: [
      { id: 'e1', customerId: 'c3', jobId: 'j1', punctuality: 5, payment: 5, communication: 4, reason: 'Zamanında geldi, ödeme teslimde yapıldı.', at: iso(addDays(base, -26), '17:30'), by: 'Selin Arslan' },
      { id: 'e2', customerId: 'c4', jobId: 'j2', punctuality: 4, payment: 4, communication: 5, reason: 'Filo yöneticisi onayları hızlı verdi.', at: iso(addDays(base, -19), '17:40'), by: 'Burak Çelik' },
      { id: 'e3', customerId: 'c6', jobId: 'j3', punctuality: 3, payment: 5, communication: 4, reason: 'Geç geldi ancak önceden bilgi verdi.', at: iso(addDays(base, -13), '17:10'), by: 'Selin Arslan' },
    ],
    catalog,
    reminders: [],
    audit: [{ id: 'au0', at: now, by: 'Sistem', role: 'admin', action: 'Örnek veri yüklendi' }],
  };
}
