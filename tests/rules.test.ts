import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../lib/seed';
import {
  addCustomer, addInspection, addNote, addVehicle, allowedMoves, amountDue, balance, confirmAppointment, createEstimateDraft, decideEstimate,
  deliverJob, estimateTotals, evaluateVisit, lineTotals, moveJob, openJob, portalView, recordPayment, requestAppointment, sendEstimate,
  setAppointmentStatus, upsertLine, can,
} from '../lib/rules';
import { generateTechnicalDraft } from '../lib/advisor';
import { parseMoney, parseQty } from '../lib/format';
import type { Actor, State } from '../lib/types';

const clock = new Date('2099-01-05T06:00:00Z'); // Pazartesi 09:00 TSİ
const admin: Actor = { userId: 'u-admin', name: 'Hasan Emre', role: 'admin' };
const advisor: Actor = { userId: 'u-adv1', name: 'Selin Arslan', role: 'advisor' };
const tech: Actor = { userId: 'u-t1', name: 'Ahmet Yılmaz', role: 'technician' };
const otherTech: Actor = { userId: 'u-t2', name: 'Mehmet Kaya', role: 'technician' };
const ayse: Actor = { userId: 'u-c1', name: 'Ayşe Demir', role: 'customer', customerId: 'c1' };
const mert: Actor = { userId: 'u-c2', name: 'Mert Kaya', role: 'customer', customerId: 'c2' };

function base(): State { const s = seed(new Date('2099-01-03T09:00:00Z')); return { ...s, appointments: [], jobs: [] } }
const slot = { customerId: 'c1', vehicleId: 'v1', serviceId: 's-maint', date: '2099-01-06', time: '09:00', duration: 60, resourceId: 'r1', note: '', source: 'Telefon' as const };

function walkIn(s: State, vehicleId = 'v1', customerId = 'c1') {
  return openJob(s, advisor, { customerId, vehicleId, serviceId: 's-brake', technicianId: 'u-t1', km: s.vehicles.find(v => v.id === vehicleId)!.km + 10, fuel: 4, complaint: 'Fren sesi geliyor', damages: [], belongings: '', customerAck: true, promisedAt: '2099-01-05T15:00:00Z' }, clock);
}
function withSentEstimate() {
  let s = walkIn(base()); const id = s.jobs[0].id;
  s = addInspection(s, tech, id, { item: 'Ön balata', result: 'Acil', note: '2 mm', customerVisible: true }, clock);
  s = createEstimateDraft(s, advisor, id, clock);
  s = sendEstimate(s, advisor, id, clock);
  return { s, id };
}

test('BK-01: aynı alan ve çakışan saatte yalnız bir randevu onaylanır; farklı alan ve bitişik saat serbesttir', () => {
  let s = requestAppointment(base(), advisor, slot, clock);
  s = requestAppointment(s, advisor, { ...slot, customerId: 'c2', vehicleId: 'v2', time: '09:30' }, clock);
  s = confirmAppointment(s, advisor, s.appointments[0].id, clock);
  assert.throws(() => confirmAppointment(s, advisor, s.appointments[1].id, clock), /çakışma/);
  s = requestAppointment(s, advisor, { ...slot, customerId: 'c3', vehicleId: 'v3', time: '10:00' }, clock);
  assert.doesNotThrow(() => confirmAppointment(s, advisor, s.appointments[2].id, clock));
  s = requestAppointment(s, advisor, { ...slot, customerId: 'c5', vehicleId: 'v4', time: '09:30', resourceId: 'r2' }, clock);
  assert.doesNotThrow(() => confirmAppointment(s, advisor, s.appointments[3].id, clock));
});

test('randevu: mesai, öğle arası, kapalı gün ve geçmiş saat reddedilir; iptal kapasiteyi açar', () => {
  assert.throws(() => requestAppointment(base(), advisor, { ...slot, time: '08:30' }, clock), /çalışma saatleri/);
  assert.throws(() => requestAppointment(base(), advisor, { ...slot, time: '11:30' }, clock), /öğle/);
  assert.throws(() => requestAppointment(base(), advisor, { ...slot, date: '2099-01-05', time: '08:45' }, clock), /çalışma saatleri|Geçmiş/);
  assert.throws(() => requestAppointment(base(), advisor, { ...slot, date: '2099-01-11' }, clock), /çalışma günü/); // Pazar
  let s = requestAppointment(base(), advisor, slot, clock);
  s = confirmAppointment(s, advisor, s.appointments[0].id, clock);
  s = setAppointmentStatus(s, advisor, s.appointments[0].id, 'İptal', clock);
  s = requestAppointment(s, advisor, { ...slot, customerId: 'c2', vehicleId: 'v2' }, clock);
  assert.doesNotThrow(() => confirmAppointment(s, advisor, s.appointments[1].id, clock));
});

test('BK-02: aynı randevudan ikinci iş emri oluşmaz', () => {
  let s = requestAppointment(base(), advisor, slot, clock);
  const aid = s.appointments[0].id;
  s = confirmAppointment(s, advisor, aid, clock);
  s = setAppointmentStatus(s, advisor, aid, 'Geldi', clock);
  const input = { appointmentId: aid, customerId: 'c1', vehicleId: 'v1', serviceId: 's-maint', technicianId: 'u-t1', km: 90000, fuel: 4, complaint: 'Bakım zamanı', damages: [], belongings: '', customerAck: true, promisedAt: '2099-01-05T15:00:00Z' };
  s = openJob(s, advisor, input, clock);
  const again = openJob(s, advisor, input, clock);
  assert.equal(again.jobs.filter(j => j.appointmentId === aid).length, 1);
  assert.equal(again.appointments[0].status, 'İş emri açıldı');
});

test('BK-03: müşteri başka müşterinin aracına randevu alamaz, teklifine karar veremez; portal yalnız kendi kaydını döndürür', () => {
  assert.throws(() => requestAppointment(base(), mert, { ...slot }, clock), /kendi/);
  const { s, id } = withSentEstimate();
  assert.throws(() => decideEstimate(s, mert, id, s.jobs[0].estimates[0].id, 'Onaylandı', 'Portal', '', clock), /size ait değil/);
  const view = portalView(s, mert);
  assert.equal(view.jobs.length, 0);
  assert.ok(view.vehicles.every(v => v.customerId === 'c2'));
});

test('BK-04: iç notlar, puanlar, taslak teklif ve gizli bulgular portal yanıtında yer almaz', () => {
  let { s, id } = withSentEstimate();
  s = addInspection(s, tech, id, { item: 'Gizli kontrol', result: 'Uygun', note: '', customerVisible: false }, clock);
  s = addNote(s, advisor, { customerId: 'c1', category: 'Genel', text: 'İç not içeriği' }, clock);
  const view = portalView(s, ayse);
  const json = JSON.stringify(view);
  assert.ok(!json.includes('İç not içeriği'));
  assert.equal('notes' in view || 'evaluations' in view, false);
  assert.ok(view.jobs[0].inspections.every(i => i.customerVisible));
  assert.ok(view.jobs[0].estimates.every(e => e.status !== 'Taslak'));
});

test('BK-04: teknik ön değerlendirme kişisel bilgi almaz ve kesin teşhis üretmez', () => {
  const out = generateTechnicalDraft({ brand: 'Fiat', model: 'Egea', year: 2019, km: 120000, fuel: 'Dizel', complaint: 'Hararet yapıyor, antifriz eksiliyor', pastItems: [] });
  assert.ok(out.suggestions.some(s => s.item.includes('Soğutma')));
  assert.ok(out.suggestions.some(s => s.item.includes('Triger')));
  assert.match(out.explanation, /teşhis|muayene/);
});

test('BK-05: yeni sürüm gönderilince eski sürüm geçersizleşir ve eski sürüme karar verilemez', () => {
  let { s, id } = withSentEstimate();
  const v1 = s.jobs[0].estimates[0].id;
  s = createEstimateDraft(s, advisor, id, clock);
  s = upsertLine(s, advisor, id, { kind: 'Parça', code: 'X', name: 'Ek parça', unit: 'adet', qty: 100, unitPrice: 10000, discountPct: 0 });
  s = sendEstimate(s, advisor, id, clock);
  assert.equal(s.jobs[0].estimates[0].status, 'Geçersiz');
  assert.throws(() => decideEstimate(s, ayse, id, v1, 'Onaylandı', 'Portal', '', clock), /artık geçerli değil/);
  const v2 = s.jobs[0].estimates[1].id;
  s = decideEstimate(s, ayse, id, v2, 'Onaylandı', 'Portal', '', clock);
  assert.equal(s.jobs[0].status, 'İşlemde');
  assert.throws(() => upsertLine(s, advisor, id, { kind: 'Parça', code: 'Y', name: 'Değişiklik', unit: 'adet', qty: 100, unitPrice: 1, discountPct: 0 }), /taslak/);
});

test('onaysız işe başlanamaz; telefon onayı açıklama ister', () => {
  const { s, id } = withSentEstimate();
  assert.ok(!allowedMoves(s.jobs[0], advisor).includes('İşlemde'));
  assert.throws(() => moveJob(s, advisor, id, 'İşlemde', '', clock), /geçilemez/);
  assert.throws(() => decideEstimate(s, advisor, id, s.jobs[0].estimates[0].id, 'Onaylandı', 'Telefon', '', clock), /açıklama/);
});

test('BK-06: parça/işçilik, indirim, KDV ve bakiye kuruş doğruluğunda hesaplanır', () => {
  assert.equal(parseMoney('1.250,50'), 125050);
  assert.equal(parseMoney('0,1'), 10);
  assert.equal(parseMoney('19.99'), 1999);
  assert.equal(parseQty('1,5'), 150);
  assert.throws(() => parseMoney('12,345'), /ondalık/);
  assert.deepEqual(lineTotals({ qty: 150, unitPrice: 33333, discountPct: 10 }), { gross: 50000, discount: 5000, net: 45000 });
  const t = estimateTotals({ vatRate: 20, lines: [
    { id: '1', kind: 'Parça', code: '', name: 'A', unit: 'adet', qty: 300, unitPrice: 1999, discountPct: 0 },
    { id: '2', kind: 'İşçilik', code: '', name: 'B', unit: 'saat', qty: 125, unitPrice: 120000, discountPct: 15 },
  ] });
  assert.equal(t.parts, 5997);
  assert.equal(t.labor, 127500);
  assert.equal(t.subtotal, 133497);
  assert.equal(t.vat, 26699);
  assert.equal(t.total, 160196);
});

test('FR-09: aynı işlem anahtarıyla mükerrer tahsilat oluşmaz, bakiye aşılamaz', () => {
  let { s, id } = withSentEstimate();
  s = decideEstimate(s, ayse, id, s.jobs[0].estimates[0].id, 'Onaylandı', 'Portal', '', clock);
  const due = amountDue(s.jobs[0]);
  s = recordPayment(s, advisor, id, { key: 'k1', amount: 10000, method: 'Nakit', note: '' }, clock);
  s = recordPayment(s, advisor, id, { key: 'k1', amount: 10000, method: 'Nakit', note: '' }, clock);
  assert.equal(s.jobs[0].payments.length, 1);
  assert.equal(balance(s.jobs[0]), due - 10000);
  assert.throws(() => recordPayment(s, advisor, id, { key: 'k2', amount: due, method: 'Nakit', note: '' }, clock), /aşamaz/);
  assert.throws(() => recordPayment(s, tech, id, { key: 'k3', amount: 1, method: 'Nakit', note: '' }, clock), /yetki/);
});

test('BK-07: randevu → kabul → bulgu → teklif → onay → işlem → son kontrol → tahsilat → teslim → değerlendirme', () => {
  let s = requestAppointment(base(), ayse, { ...slot, source: 'Portal' }, clock);
  const aid = s.appointments[0].id;
  s = confirmAppointment(s, advisor, aid, clock);
  s = setAppointmentStatus(s, advisor, aid, 'Geldi', clock);
  s = openJob(s, advisor, { appointmentId: aid, customerId: 'c1', vehicleId: 'v1', serviceId: 's-maint', technicianId: 'u-t1', km: 90000, fuel: 5, complaint: 'Periyodik bakım', damages: [{ area: 'Kaput', kind: 'Çizik', note: '' }], belongings: '', customerAck: true, promisedAt: '2099-01-05T15:00:00Z' }, clock);
  const id = s.jobs[0].id;
  assert.throws(() => addInspection(s, otherTech, id, { item: 'Yağ', result: 'Uygun', note: '', customerVisible: true }, clock), /atanan/);
  s = addInspection(s, tech, id, { item: 'Motor yağı seviyesi', result: 'Takip edilmeli', note: '', customerVisible: true }, clock);
  assert.equal(s.jobs[0].status, 'İnceleniyor');
  s = createEstimateDraft(s, advisor, id, clock);
  assert.ok(s.jobs[0].estimates[0].lines.length > 0, 'hizmet türünden önerilen kalemler gelir');
  s = sendEstimate(s, advisor, id, clock);
  s = decideEstimate(s, ayse, id, s.jobs[0].estimates[0].id, 'Onaylandı', 'Portal', '', clock);
  s = moveJob(s, tech, id, 'Son kontrol', '', clock);
  assert.throws(() => moveJob(s, tech, id, 'Teslime hazır', '', clock), /geçilemez/);
  s = moveJob(s, advisor, id, 'Teslime hazır', '', clock);
  assert.throws(() => deliverJob(s, advisor, id, { note: '', nextServiceDate: '2100-01-01', nextServiceKm: 105000, allowBalance: false }, clock), /bakiye/);
  s = recordPayment(s, advisor, id, { key: 'p', amount: balance(s.jobs[0]), method: 'Kredi kartı', note: '' }, clock);
  s = deliverJob(s, advisor, id, { note: 'Parçalar gösterildi', nextServiceDate: '2100-01-01', nextServiceKm: 105000, allowBalance: false }, clock);
  assert.equal(s.jobs[0].status, 'Teslim edildi');
  assert.equal(s.vehicles.find(v => v.id === 'v1')!.nextServiceKm, 105000);
  s = evaluateVisit(s, advisor, { jobId: id, punctuality: 5, payment: 5, communication: 4, reason: 'Sorunsuz ziyaret' }, clock);
  s = evaluateVisit(s, advisor, { jobId: id, punctuality: 4, payment: 5, communication: 4, reason: 'Güncellendi' }, clock);
  assert.equal(s.evaluations.filter(e => e.jobId === id).length, 1);
  assert.ok(s.jobs[0].history.length >= 6 && s.jobs[0].history.every(h => h.by && h.at));
});

test('kabul kuralları: kilometre geriye gidemez, açık iş emri varken ikinci kabul açılamaz', () => {
  const s0 = base();
  assert.throws(() => openJob(s0, advisor, { customerId: 'c1', vehicleId: 'v1', serviceId: 's-maint', technicianId: 'u-t1', km: 100, fuel: 4, complaint: 'Bakım zamanı', damages: [], belongings: '', customerAck: true, promisedAt: '2099-01-05T15:00:00Z' }, clock), /düşük olamaz/);
  const s = walkIn(s0);
  assert.throws(() => walkIn(s), /kapanmamış/);
});

test('rol yetkileri: teknisyen müşteri/fiyat işlemi yapamaz, danışman ayar değiştiremez', () => {
  assert.equal(can(tech, 'note.read'), false);
  assert.equal(can(tech, 'estimate.write'), false);
  assert.equal(can(advisor, 'settings.write'), false);
  assert.throws(() => addCustomer(base(), tech, { kind: 'Bireysel', name: 'Deniz Test', phone: '0555 123 45 67', email: '', address: '', taxNo: '', preference: 'Telefon', consent: true }), /yetki/);
  assert.throws(() => addNote(base(), tech, { customerId: 'c1', category: 'Genel', text: 'deneme notu' }), /yetki/);
});

test('müşteri ve araç doğrulamaları', () => {
  const s = base();
  assert.throws(() => addCustomer(s, advisor, { kind: 'Bireysel', name: 'Deniz Test', phone: '0555 123 45 67', email: '', address: '', taxNo: '', preference: 'Telefon', consent: false }), /KVKK/);
  assert.throws(() => addCustomer(s, advisor, { kind: 'Kurumsal', name: 'Test A.Ş.', phone: '0555 123 45 67', email: '', address: '', taxNo: '', preference: 'Telefon', consent: true }), /vergi/);
  const next = addCustomer(s, advisor, { kind: 'Bireysel', name: 'Deniz Test', phone: '0555 123 45 67', email: '', address: '', taxNo: '', preference: 'Telefon', consent: true });
  assert.equal(next.customers.at(-1)!.no, 'M-0009');
  assert.throws(() => addVehicle(s, advisor, { customerId: 'c1', plate: '58 ad 240', brand: 'VW', model: 'Golf', year: 2020, km: 100, vin: '', fuel: 'Benzin', transmission: 'Manuel', color: '' }), /plaka/);
  assert.throws(() => addVehicle(s, advisor, { customerId: 'c1', plate: '34 XY 99', brand: 'VW', model: 'Golf', year: 2020, km: 100, vin: 'ABC', fuel: 'Benzin', transmission: 'Manuel', color: '' }), /Şasi/);
});

test('örnek veri tutarlıdır: açık iş emri olan araçlarda tekrar yok, bekleyen teklif portalda görünür', () => {
  const s = seed();
  const open = s.jobs.filter(j => !['Teslim edildi', 'İptal'].includes(j.status));
  assert.equal(new Set(open.map(j => j.vehicleId)).size, open.length);
  const view = portalView(s, ayse);
  assert.ok(view.jobs.some(j => j.estimates.at(-1)?.status === 'Gönderildi'));
});
