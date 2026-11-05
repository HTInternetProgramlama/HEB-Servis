import type {
  Actor, Appointment, Channel, CatalogItem, Customer, CustomerNote, Damage, Estimate, EstimateLine, Evaluation,
  Inspection, InspectionResult, Job, JobStatus, NoteCategory, Payment, PaymentMethod, ReminderResult, Role,
  Settings, State, User, Vehicle,
} from './types';
import { addMonths, minutes, normalizePlate, nowIso, today, uid, weekday } from './format';

export class RuleError extends Error {}
function ensure(condition: unknown, message: string): asserts condition { if (!condition) throw new RuleError(message) }

/* ───────────── Yetkiler ───────────── */

export type Permission =
  | 'customer.write' | 'vehicle.write' | 'appointment.manage' | 'job.create' | 'job.status' | 'inspection.write'
  | 'estimate.write' | 'estimate.decide' | 'payment.write' | 'payment.read' | 'note.read' | 'note.write'
  | 'evaluation.write' | 'reports.read' | 'reminder.write' | 'catalog.write' | 'settings.write' | 'staff.write'
  | 'audit.read' | 'staff.area';

const matrix: Record<Permission, Role[]> = {
  'customer.write': ['admin', 'advisor'],
  'vehicle.write': ['admin', 'advisor'],
  'appointment.manage': ['admin', 'advisor'],
  'job.create': ['admin', 'advisor'],
  'job.status': ['admin', 'advisor', 'technician'],
  'inspection.write': ['admin', 'advisor', 'technician'],
  'estimate.write': ['admin', 'advisor'],
  'estimate.decide': ['admin', 'advisor', 'customer'],
  'payment.write': ['admin', 'advisor'],
  'payment.read': ['admin', 'advisor'],
  'note.read': ['admin', 'advisor'],
  'note.write': ['admin', 'advisor'],
  'evaluation.write': ['admin', 'advisor'],
  'reports.read': ['admin', 'advisor'],
  'reminder.write': ['admin', 'advisor'],
  'catalog.write': ['admin'],
  'settings.write': ['admin'],
  'staff.write': ['admin'],
  'audit.read': ['admin'],
  'staff.area': ['admin', 'advisor', 'technician'],
};
export function can(actor: Actor | null | undefined, permission: Permission) { return !!actor && matrix[permission].includes(actor.role) }
function need(actor: Actor, permission: Permission) { ensure(can(actor, permission), 'Bu işlem için yetkiniz yok.') }

export const roleLabel: Record<Role, string> = { admin: 'Yönetici', advisor: 'Servis danışmanı', technician: 'Teknisyen', customer: 'Müşteri' };

/* ───────────── Yardımcılar ───────────── */

const pad = (n: number, w = 4) => String(n).padStart(w, '0');
function stamp(clock: Date) { return { at: nowIso(clock) } }
export function findJob(state: State, id: string) { const j = state.jobs.find(j => j.id === id); ensure(j, 'İş emri bulunamadı.'); return j }
function patchJob(state: State, id: string, fn: (j: Job) => Job): State { return { ...state, jobs: state.jobs.map(j => j.id === id ? fn(j) : j) } }
function ownsJob(actor: Actor, job: Job) { return actor.role !== 'customer' || job.customerId === actor.customerId }
function assigned(actor: Actor, job: Job) { return actor.role !== 'technician' || job.technicianId === actor.userId }

export function staffName(state: State, id: string | undefined) { return state.users.find(u => u.id === id)?.name ?? '—' }
export function technicians(state: State) { return state.users.filter(u => u.role === 'technician' && u.active) }
export function advisors(state: State) { return state.users.filter(u => (u.role === 'advisor' || u.role === 'admin') && u.active) }
export function serviceName(state: State, id: string) { return state.settings.services.find(s => s.id === id)?.name ?? id }
export function resourceName(state: State, id: string) { return state.settings.resources.find(r => r.id === id)?.name ?? id }

/* ───────────── Müşteri ve araç ───────────── */

export type CustomerInput = Omit<Customer, 'id' | 'no' | 'createdAt'>;
function validateCustomer(input: CustomerInput) {
  ensure(input.name.trim().length >= 3, 'Müşteri / firma adı en az 3 karakter olmalı.');
  ensure(/^\+?[\d\s()-]{10,20}$/.test(input.phone.trim()), 'Geçerli bir telefon numarası girin (ör. 0555 123 45 67).');
  ensure(!input.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email), 'E-posta adresi geçersiz.');
  if (input.kind === 'Kurumsal') ensure(/^\d{10}$/.test(input.taxNo.trim()), 'Kurumsal müşteride 10 haneli vergi numarası zorunlu.');
  else ensure(!input.taxNo || /^\d{11}$/.test(input.taxNo.trim()), 'T.C. kimlik numarası 11 hane olmalı.');
  ensure(input.consent, 'KVKK aydınlatma onayı alınmadan kayıt açılamaz.');
}
export function addCustomer(state: State, actor: Actor, input: CustomerInput, clock = new Date()): State {
  need(actor, 'customer.write'); validateCustomer(input);
  const phone = input.phone.replace(/\D/g, '');
  ensure(!state.customers.some(c => c.phone.replace(/\D/g, '') === phone), 'Bu telefon numarasıyla kayıtlı bir müşteri var.');
  const seq = state.seq.customer + 1;
  const customer: Customer = { ...input, name: input.name.trim(), phone: input.phone.trim(), email: input.email.trim(), taxNo: input.taxNo.trim(), id: uid(), no: 'M-' + pad(seq), createdAt: nowIso(clock) };
  return { ...state, seq: { ...state.seq, customer: seq }, customers: [...state.customers, customer] };
}
export function updateCustomer(state: State, actor: Actor, id: string, input: CustomerInput): State {
  need(actor, 'customer.write'); validateCustomer(input);
  ensure(state.customers.some(c => c.id === id), 'Müşteri bulunamadı.');
  return { ...state, customers: state.customers.map(c => c.id === id ? { ...c, ...input, name: input.name.trim(), phone: input.phone.trim() } : c) };
}

export type VehicleInput = Omit<Vehicle, 'id' | 'createdAt' | 'nextServiceDate' | 'nextServiceKm'>;
function validateVehicle(state: State, input: VehicleInput, selfId?: string) {
  ensure(state.customers.some(c => c.id === input.customerId), 'Önce kayıtlı bir müşteri seçin.');
  const plate = normalizePlate(input.plate);
  ensure(/^\d{2}[A-ZÇĞİÖŞÜ]{1,3}\d{2,5}$/.test(plate), 'Plakayı 58 ABC 123 biçiminde girin.');
  ensure(!state.vehicles.some(v => v.id !== selfId && normalizePlate(v.plate) === plate), 'Bu plaka başka bir araç kaydında kullanılıyor.');
  ensure(input.brand.trim() && input.model.trim(), 'Marka ve model zorunlu.');
  ensure(Number.isInteger(input.year) && input.year >= 1950 && input.year <= new Date().getFullYear() + 1, 'Geçerli bir model yılı girin.');
  ensure(Number.isInteger(input.km) && input.km >= 0 && input.km < 3_000_000, 'Kilometre 0 veya pozitif tam sayı olmalı.');
  ensure(!input.vin || /^[A-HJ-NPR-Z0-9]{17}$/.test(input.vin.toUpperCase()), 'Şasi numarası 17 karakter olmalı (I, O, Q kullanılmaz).');
  return plate;
}
export function addVehicle(state: State, actor: Actor, input: VehicleInput, clock = new Date()): State {
  need(actor, 'vehicle.write');
  const plate = validateVehicle(state, input);
  return { ...state, vehicles: [...state.vehicles, { ...input, plate, vin: input.vin.toUpperCase(), brand: input.brand.trim(), model: input.model.trim(), id: uid(), createdAt: nowIso(clock) }] };
}
export function updateVehicle(state: State, actor: Actor, id: string, input: VehicleInput): State {
  need(actor, 'vehicle.write');
  const current = state.vehicles.find(v => v.id === id); ensure(current, 'Araç bulunamadı.');
  const plate = validateVehicle(state, input, id);
  ensure(input.km >= current.km || actor.role === 'admin', 'Kilometre geriye alınamaz. Düzeltme için yöneticiye başvurun.');
  return { ...state, vehicles: state.vehicles.map(v => v.id === id ? { ...v, ...input, plate, vin: input.vin.toUpperCase() } : v) };
}

/* ───────────── Randevu ───────────── */

export function validateSlot(settings: Settings, a: Pick<Appointment, 'date' | 'time' | 'duration' | 'resourceId'>, clock = new Date()) {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(a.date) && !Number.isNaN(new Date(a.date + 'T00:00:00Z').valueOf()) && new Date(a.date + 'T00:00:00Z').toISOString().slice(0, 10) === a.date;
  ensure(valid, 'Geçerli bir tarih seçin.');
  ensure(settings.resources.some(r => r.id === a.resourceId && r.active), 'Geçerli bir servis alanı seçin.');
  ensure(Number.isInteger(a.duration) && a.duration >= 15 && a.duration <= 480, 'Süre 15–480 dakika olmalı.');
  ensure(settings.workDays.includes(weekday(a.date)), 'Seçilen gün servis çalışma günü değil.');
  const start = minutes(a.time), end = start + a.duration;
  ensure(start >= minutes(settings.workStart) && end <= minutes(settings.workEnd), `Randevu ${settings.workStart}–${settings.workEnd} çalışma saatleri içinde olmalı.`);
  ensure(!(start < minutes(settings.breakEnd) && end > minutes(settings.breakStart)), `${settings.breakStart}–${settings.breakEnd} öğle arasıyla çakışıyor; başka bir saat seçin.`);
  ensure(new Date(a.date + 'T' + a.time + ':00+03:00').getTime() > clock.getTime(), 'Geçmiş bir saate randevu verilemez.');
}
const blocking: Appointment['status'][] = ['Onaylı', 'Geldi', 'İş emri açıldı'];
export function findClash(state: State, a: Pick<Appointment, 'id' | 'date' | 'time' | 'duration' | 'resourceId'>) {
  const s = minutes(a.time), e = s + a.duration;
  return state.appointments.find(b => b.id !== a.id && b.date === a.date && b.resourceId === a.resourceId && blocking.includes(b.status) && s < minutes(b.time) + b.duration && minutes(b.time) < e);
}

export type AppointmentInput = Pick<Appointment, 'customerId' | 'vehicleId' | 'serviceId' | 'date' | 'time' | 'duration' | 'resourceId' | 'note' | 'source'>;
export function requestAppointment(state: State, actor: Actor, input: AppointmentInput, clock = new Date()): State {
  if (actor.role === 'customer') {
    ensure(input.customerId === actor.customerId, 'Yalnız kendi araçlarınız için randevu talep edebilirsiniz.');
    input = { ...input, source: 'Portal' };
  } else need(actor, 'appointment.manage');
  ensure(state.vehicles.some(v => v.id === input.vehicleId && v.customerId === input.customerId), 'Seçilen araç bu müşteriye bağlı değil.');
  ensure(state.settings.services.some(s => s.id === input.serviceId), 'Geçerli bir hizmet seçin.');
  ensure(input.note.length <= 500, 'Açıklama en fazla 500 karakter olabilir.');
  validateSlot(state.settings, input, clock);
  ensure(!state.appointments.some(a => a.vehicleId === input.vehicleId && a.date === input.date && ['Bekliyor', 'Onaylı'].includes(a.status)), 'Bu araç için aynı gün açık bir randevu zaten var.');
  const seq = state.seq.appointment + 1;
  const a: Appointment = { ...input, id: uid(), no: 'R-' + pad(seq, 5), status: 'Bekliyor', createdAt: nowIso(clock), createdBy: actor.name };
  return { ...state, seq: { ...state.seq, appointment: seq }, appointments: [...state.appointments, a] };
}
export function confirmAppointment(state: State, actor: Actor, id: string, clock = new Date()): State {
  need(actor, 'appointment.manage');
  const a = state.appointments.find(a => a.id === id); ensure(a, 'Randevu bulunamadı.');
  if (a.status === 'Onaylı') return state;
  ensure(a.status === 'Bekliyor', 'Yalnız bekleyen talepler onaylanabilir.');
  validateSlot(state.settings, a, clock);
  const clash = findClash(state, a);
  ensure(!clash, `Bu servis alanında ${clash?.time} saatindeki ${clash?.no} ile çakışma var. Saati veya alanı değiştirin.`);
  return { ...state, appointments: state.appointments.map(b => b.id === id ? { ...b, status: 'Onaylı' } : b) };
}
export function rescheduleAppointment(state: State, actor: Actor, id: string, change: Pick<Appointment, 'date' | 'time' | 'resourceId' | 'duration'>, clock = new Date()): State {
  need(actor, 'appointment.manage');
  const a = state.appointments.find(a => a.id === id); ensure(a, 'Randevu bulunamadı.');
  ensure(['Bekliyor', 'Onaylı'].includes(a.status), 'Yalnız açık randevular değiştirilebilir.');
  const next = { ...a, ...change };
  validateSlot(state.settings, next, clock);
  if (a.status === 'Onaylı') { const clash = findClash(state, next); ensure(!clash, `Seçilen saatte ${clash?.no} ile çakışma var.`) }
  return { ...state, appointments: state.appointments.map(b => b.id === id ? next : b) };
}
export function setAppointmentStatus(state: State, actor: Actor, id: string, status: 'Geldi' | 'Gelmedi' | 'İptal', clock = new Date()): State {
  const a = state.appointments.find(a => a.id === id); ensure(a, 'Randevu bulunamadı.');
  if (actor.role === 'customer') {
    ensure(status === 'İptal' && a.customerId === actor.customerId, 'Bu randevu üzerinde işlem yapamazsınız.');
    ensure(new Date(a.date + 'T' + a.time + ':00+03:00').getTime() - clock.getTime() > 2 * 3600_000, 'Randevuya 2 saatten az kaldığı için iptal servis danışmanı üzerinden yapılabilir.');
  } else need(actor, 'appointment.manage');
  ensure(status === 'İptal' ? ['Bekliyor', 'Onaylı'].includes(a.status) : a.status === 'Onaylı', 'Bu durum değişikliğine izin verilmiyor.');
  return { ...state, appointments: state.appointments.map(b => b.id === id ? { ...b, status } : b) };
}

/* ───────────── Araç kabul ve iş emri ───────────── */

export interface IntakeInput {
  appointmentId?: string; customerId: string; vehicleId: string; serviceId: string; technicianId: string;
  km: number; fuel: number; complaint: string; damages: Damage[]; belongings: string; customerAck: boolean; promisedAt: string;
}
export function openJob(state: State, actor: Actor, input: IntakeInput, clock = new Date()): State {
  need(actor, 'job.create');
  if (input.appointmentId) {
    const existing = state.jobs.find(j => j.appointmentId === input.appointmentId);
    if (existing) return state; // aynı randevudan ikinci iş emri açılmaz
    const a = state.appointments.find(a => a.id === input.appointmentId); ensure(a, 'Randevu bulunamadı.');
    ensure(a.status === 'Geldi' || a.status === 'Onaylı', 'Araç kabulü yalnız onaylı veya gelmiş randevu için yapılabilir.');
    ensure(a.vehicleId === input.vehicleId && a.customerId === input.customerId, 'Randevu ile kabul edilen araç eşleşmiyor.');
  }
  const vehicle = state.vehicles.find(v => v.id === input.vehicleId && v.customerId === input.customerId);
  ensure(vehicle, 'Araç bu müşteriye bağlı değil.');
  ensure(!state.jobs.some(j => j.vehicleId === vehicle.id && !['Teslim edildi', 'İptal'].includes(j.status)), 'Bu aracın kapanmamış bir iş emri var.');
  ensure(state.users.some(u => u.id === input.technicianId && u.role === 'technician' && u.active), 'Teknisyen seçin.');
  ensure(state.settings.services.some(s => s.id === input.serviceId), 'Hizmet türü seçin.');
  ensure(Number.isInteger(input.km) && input.km >= vehicle.km, `Kabul kilometresi araçtaki son kayıttan (${vehicle.km.toLocaleString('tr-TR')} km) düşük olamaz.`);
  ensure(Number.isInteger(input.fuel) && input.fuel >= 0 && input.fuel <= 8, 'Yakıt seviyesi seçin.');
  ensure(input.complaint.trim().length >= 5, 'Müşteri şikâyeti / talebi en az 5 karakter olmalı.');
  ensure(input.customerAck, 'Kabul formunun müşteriyle birlikte kontrol edildiği onaylanmalı.');
  ensure(!Number.isNaN(new Date(input.promisedAt).valueOf()) && new Date(input.promisedAt).getTime() > clock.getTime(), 'Tahmini teslim zamanı ileri bir tarih olmalı.');
  const seq = state.seq.job + 1, at = nowIso(clock);
  const job: Job = {
    id: uid(), no: `İE-${today(clock).slice(0, 4)}-${pad(seq)}`, appointmentId: input.appointmentId, customerId: input.customerId,
    vehicleId: input.vehicleId, serviceId: input.serviceId, advisorId: actor.userId, technicianId: input.technicianId, status: 'Kabul edildi',
    intake: { km: input.km, fuel: input.fuel, complaint: input.complaint.trim(), damages: input.damages, belongings: input.belongings.trim(), customerAck: true, at, by: actor.name },
    inspections: [], estimates: [], payments: [], history: [{ status: 'Kabul edildi', at, by: actor.name, note: input.appointmentId ? 'Randevudan kabul' : 'Randevusuz kabul' }],
    promisedAt: new Date(input.promisedAt).toISOString(), createdAt: at,
  };
  return {
    ...state, seq: { ...state.seq, job: seq }, jobs: [...state.jobs, job],
    vehicles: state.vehicles.map(v => v.id === vehicle.id ? { ...v, km: input.km } : v),
    appointments: input.appointmentId ? state.appointments.map(a => a.id === input.appointmentId ? { ...a, status: 'İş emri açıldı' } : a) : state.appointments,
  };
}

/** Elle seçilebilen geçişler. Onay bekliyor'a geçiş yalnız teklif gönderimiyle, İşlemde'ye geçiş onaylı teklifle olur. */
export const transitions: Record<JobStatus, JobStatus[]> = {
  'Kabul edildi': ['İnceleniyor', 'İptal'],
  'İnceleniyor': ['İptal'],
  'Onay bekliyor': ['İşlemde', 'Teslime hazır', 'İptal'],
  'İşlemde': ['Parça bekliyor', 'Son kontrol'],
  'Parça bekliyor': ['İşlemde'],
  'Son kontrol': ['İşlemde', 'Teslime hazır'],
  'Teslime hazır': [],
  'Teslim edildi': [],
  'İptal': [],
};
const technicianMoves: JobStatus[] = ['İnceleniyor', 'İşlemde', 'Parça bekliyor', 'Son kontrol'];

export function latestEstimate(job: Job) { return job.estimates.at(-1) }
export function approvedEstimate(job: Job) { return [...job.estimates].reverse().find(e => e.status === 'Onaylandı') }

export function allowedMoves(job: Job, actor: Actor): JobStatus[] {
  if (!can(actor, 'job.status') || !assigned(actor, job)) return [];
  const latest = latestEstimate(job);
  return transitions[job.status].filter(s => {
    if (actor.role === 'technician' && !technicianMoves.includes(s)) return false;
    if (s === 'İptal') return job.payments.length === 0 && actor.role !== 'technician';
    // Ek iş teklifi reddedilirse daha önce onaylanan kapsamla işe devam edilir; hiç onay yoksa araç işlem yapılmadan teslime hazırlanır.
    if (job.status === 'Onay bekliyor' && s === 'İşlemde') return latest?.status === 'Onaylandı' || (latest?.status === 'Reddedildi' && !!approvedEstimate(job));
    if (job.status === 'Onay bekliyor' && s === 'Teslime hazır') return latest?.status === 'Reddedildi' && !approvedEstimate(job);
    return true;
  });
}
export function moveJob(state: State, actor: Actor, jobId: string, status: JobStatus, note = '', clock = new Date()): State {
  need(actor, 'job.status');
  const job = findJob(state, jobId);
  ensure(assigned(actor, job), 'Yalnız size atanan iş emirlerini güncelleyebilirsiniz.');
  ensure(allowedMoves(job, actor).includes(status), `"${job.status}" aşamasından "${status}" aşamasına geçilemez.`);
  if (status === 'İptal') ensure(note.trim().length >= 5, 'İptal gerekçesi yazın.');
  if (status === 'Son kontrol') ensure(approvedEstimate(job), 'Onaylı teklif olmadan son kontrole geçilemez.');
  return patchJob(state, jobId, j => ({ ...j, status, history: [...j.history, { status, at: nowIso(clock), by: actor.name, note: note.trim() }] }));
}
export function reassignJob(state: State, actor: Actor, jobId: string, technicianId: string): State {
  need(actor, 'job.create');
  const job = findJob(state, jobId);
  ensure(!['Teslim edildi', 'İptal'].includes(job.status), 'Kapanmış iş emri değiştirilemez.');
  ensure(state.users.some(u => u.id === technicianId && u.role === 'technician' && u.active), 'Teknisyen seçin.');
  return patchJob(state, jobId, j => ({ ...j, technicianId }));
}

/* ───────────── Kontrol bulguları ───────────── */

export interface InspectionInput { item: string; result: InspectionResult; note: string; customerVisible: boolean; source?: Inspection['source'] }
export function addInspection(state: State, actor: Actor, jobId: string, input: InspectionInput, clock = new Date()): State {
  need(actor, 'inspection.write');
  const job = findJob(state, jobId);
  ensure(assigned(actor, job), 'Yalnız size atanan iş emrine bulgu ekleyebilirsiniz.');
  ensure(!['Teslim edildi', 'İptal'].includes(job.status), 'Kapanmış iş emrine bulgu eklenemez.');
  ensure(input.item.trim().length >= 3, 'Kontrol maddesi en az 3 karakter olmalı.');
  ensure(input.note.length <= 600, 'Açıklama en fazla 600 karakter olabilir.');
  const inspection: Inspection = { id: uid(), item: input.item.trim(), result: input.result, note: input.note.trim(), customerVisible: input.customerVisible, source: input.source ?? 'Teknisyen', by: actor.name, ...stamp(clock) };
  return patchJob(state, jobId, j => ({
    ...j, inspections: [...j.inspections, inspection],
    ...(j.status === 'Kabul edildi' ? { status: 'İnceleniyor' as JobStatus, history: [...j.history, { status: 'İnceleniyor' as JobStatus, at: inspection.at, by: actor.name, note: 'İlk bulgu kaydedildi' }] } : {}),
  }));
}
export function toggleInspectionVisibility(state: State, actor: Actor, jobId: string, inspectionId: string): State {
  need(actor, 'estimate.write');
  return patchJob(state, jobId, j => ({ ...j, inspections: j.inspections.map(i => i.id === inspectionId ? { ...i, customerVisible: !i.customerVisible } : i) }));
}

/* ───────────── Teklif ───────────── */

export function lineTotals(line: Pick<EstimateLine, 'qty' | 'unitPrice' | 'discountPct'>) {
  const gross = Math.round(line.qty * line.unitPrice / 100);
  const discount = Math.round(gross * line.discountPct / 100);
  return { gross, discount, net: gross - discount };
}
export function estimateTotals(estimate: Pick<Estimate, 'lines' | 'vatRate'>) {
  let gross = 0, discount = 0, parts = 0, labor = 0;
  for (const line of estimate.lines) {
    const t = lineTotals(line); gross += t.gross; discount += t.discount;
    if (line.kind === 'Parça') parts += t.net; else labor += t.net;
  }
  const subtotal = gross - discount;
  const vat = Math.round(subtotal * estimate.vatRate / 100);
  return { gross, discount, subtotal, vat, total: subtotal + vat, parts, labor };
}
export function amountDue(job: Job) { const e = approvedEstimate(job); return e ? estimateTotals(e).total : 0 }
export function amountPaid(job: Job) { return job.payments.reduce((s, p) => s + p.amount, 0) }
export function balance(job: Job) { return amountDue(job) - amountPaid(job) }

function editableEstimate(job: Job) {
  const e = latestEstimate(job);
  ensure(e && e.status === 'Taslak', 'Düzenlenebilir taslak teklif yok. Önce yeni sürüm oluşturun.');
  return e;
}
export function createEstimateDraft(state: State, actor: Actor, jobId: string, clock = new Date()): State {
  need(actor, 'estimate.write');
  const job = findJob(state, jobId);
  ensure(!['Teslime hazır', 'Teslim edildi', 'İptal'].includes(job.status), 'Bu aşamada teklif oluşturulamaz.');
  const latest = latestEstimate(job);
  ensure(!latest || latest.status !== 'Taslak', 'Zaten düzenlenen bir taslak var.');
  const draft: Estimate = {
    id: uid(), version: (latest?.version ?? 0) + 1, status: 'Taslak', vatRate: state.settings.vatRate,
    lines: latest ? latest.lines.map(l => ({ ...l, id: uid() })) : defaultLines(state, job.serviceId),
    note: latest?.note ?? '', createdAt: nowIso(clock), createdBy: actor.name,
  };
  return patchJob(state, jobId, j => ({ ...j, estimates: [...j.estimates, draft] }));
}
function defaultLines(state: State, serviceId: string): EstimateLine[] {
  const service = state.settings.services.find(s => s.id === serviceId);
  return (service?.catalogIds ?? []).map(id => state.catalog.find(c => c.id === id)).filter((c): c is CatalogItem => !!c && c.active)
    .map(c => ({ id: uid(), kind: c.kind, code: c.code, name: c.name, unit: c.unit, qty: 100, unitPrice: c.unitPrice, discountPct: 0 }));
}
export type LineInput = Omit<EstimateLine, 'id'>;
function validateLine(line: LineInput) {
  ensure(line.name.trim().length >= 2, 'Kalem açıklaması zorunlu.');
  ensure(Number.isInteger(line.qty) && line.qty > 0 && line.qty <= 100000, 'Miktar 0’dan büyük olmalı.');
  ensure(Number.isInteger(line.unitPrice) && line.unitPrice >= 0 && line.unitPrice <= 100_000_000, 'Birim fiyat geçersiz.');
  ensure(Number.isInteger(line.discountPct) && line.discountPct >= 0 && line.discountPct <= 100, 'İndirim 0–100 arasında tam sayı olmalı.');
}
export function upsertLine(state: State, actor: Actor, jobId: string, line: LineInput, lineId?: string): State {
  need(actor, 'estimate.write');
  const draft = editableEstimate(findJob(state, jobId)); validateLine(line);
  const lines = lineId ? draft.lines.map(l => l.id === lineId ? { ...line, id: lineId } : l) : [...draft.lines, { ...line, id: uid() }];
  return patchJob(state, jobId, j => ({ ...j, estimates: j.estimates.map(e => e.id === draft.id ? { ...e, lines } : e) }));
}
export function removeLine(state: State, actor: Actor, jobId: string, lineId: string): State {
  need(actor, 'estimate.write');
  const draft = editableEstimate(findJob(state, jobId));
  return patchJob(state, jobId, j => ({ ...j, estimates: j.estimates.map(e => e.id === draft.id ? { ...e, lines: e.lines.filter(l => l.id !== lineId) } : e) }));
}
export function setEstimateNote(state: State, actor: Actor, jobId: string, note: string): State {
  need(actor, 'estimate.write');
  const draft = editableEstimate(findJob(state, jobId));
  ensure(note.length <= 800, 'Not en fazla 800 karakter olabilir.');
  return patchJob(state, jobId, j => ({ ...j, estimates: j.estimates.map(e => e.id === draft.id ? { ...e, note } : e) }));
}
export function sendEstimate(state: State, actor: Actor, jobId: string, clock = new Date()): State {
  need(actor, 'estimate.write');
  const job = findJob(state, jobId); const draft = editableEstimate(job);
  ensure(draft.lines.length > 0, 'En az bir teklif kalemi ekleyin.');
  ensure(job.status !== 'Kabul edildi' || job.inspections.length > 0, 'Teklif göndermeden önce en az bir kontrol bulgusu kaydedin.');
  const at = nowIso(clock);
  return patchJob(state, jobId, j => ({
    ...j,
    estimates: j.estimates.map(e => e.id === draft.id ? { ...e, status: 'Gönderildi', sentAt: at } : e.status === 'Gönderildi' ? { ...e, status: 'Geçersiz' } : e),
    status: 'Onay bekliyor',
    history: j.status === 'Onay bekliyor' ? j.history : [...j.history, { status: 'Onay bekliyor', at, by: actor.name, note: `Teklif v${draft.version} müşteriye gönderildi` }],
  }));
}
export function decideEstimate(state: State, actor: Actor, jobId: string, estimateId: string, result: 'Onaylandı' | 'Reddedildi', channel: Channel, note: string, clock = new Date()): State {
  need(actor, 'estimate.decide');
  const job = findJob(state, jobId);
  ensure(ownsJob(actor, job), 'Bu teklif size ait değil.');
  const latest = latestEstimate(job);
  ensure(latest && latest.id === estimateId, 'Bu teklif sürümü artık geçerli değil. Güncel sürümü inceleyin.');
  ensure(latest.status === 'Gönderildi', 'Bu teklif için karar zaten kaydedilmiş veya teklif henüz gönderilmemiş.');
  if (actor.role === 'customer') channel = 'Portal';
  else ensure(channel !== 'Portal' && note.trim().length >= 5, 'Telefon / şube onayında görüşme açıklaması (en az 5 karakter) zorunlu.');
  const at = nowIso(clock);
  return patchJob(state, jobId, j => ({
    ...j,
    estimates: j.estimates.map(e => e.id === estimateId ? { ...e, status: result, decision: { result, channel, note: note.trim(), by: actor.name, at } } : e),
    ...(result === 'Onaylandı' ? { status: 'İşlemde' as JobStatus, history: [...j.history, { status: 'İşlemde' as JobStatus, at, by: actor.name, note: `Teklif v${latest.version} onaylandı (${channel})` }] } : {}),
  }));
}

/* ───────────── Tahsilat ve teslim ───────────── */

export function recordPayment(state: State, actor: Actor, jobId: string, input: { key: string; amount: number; method: PaymentMethod; note: string }, clock = new Date()): State {
  need(actor, 'payment.write');
  const job = findJob(state, jobId);
  if (job.payments.some(p => p.key === input.key)) return state; // aynı işlem anahtarı mükerrer kayıt oluşturmaz
  ensure(job.status !== 'İptal', 'İptal edilen iş emrine tahsilat girilemez.');
  ensure(approvedEstimate(job), 'Onaylı teklif olmadan tahsilat kaydedilemez.');
  ensure(Number.isInteger(input.amount) && input.amount > 0, 'Tahsilat tutarı 0’dan büyük olmalı.');
  ensure(input.amount <= balance(job), `Tutar kalan bakiyeyi (${(balance(job) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺) aşamaz.`);
  const payment: Payment = { id: uid(), key: input.key, amount: input.amount, method: input.method, note: input.note.trim(), by: actor.name, ...stamp(clock) };
  return patchJob(state, jobId, j => ({ ...j, payments: [...j.payments, payment] }));
}
export function deliverJob(state: State, actor: Actor, jobId: string, input: { note: string; nextServiceDate: string; nextServiceKm: number; allowBalance: boolean }, clock = new Date()): State {
  need(actor, 'payment.write');
  const job = findJob(state, jobId);
  ensure(job.status === 'Teslime hazır', 'Yalnız teslime hazır araçlar teslim edilebilir.');
  const open = balance(job);
  if (open > 0) {
    ensure(input.allowBalance && actor.role === 'admin', 'Açık bakiye kapanmadan teslim yapılamaz. Bakiyeli teslim yalnız yönetici onayıyla yapılır.');
    ensure(input.note.trim().length >= 5, 'Bakiyeli teslimde açıklama zorunlu.');
  }
  const vehicle = state.vehicles.find(v => v.id === job.vehicleId); ensure(vehicle, 'Araç bulunamadı.');
  ensure(!input.nextServiceKm || input.nextServiceKm > job.intake.km, 'Sonraki bakım kilometresi kabul kilometresinden büyük olmalı.');
  const at = nowIso(clock);
  return {
    ...patchJob(state, jobId, j => ({ ...j, status: 'Teslim edildi', deliveredAt: at, deliveryNote: input.note.trim(), history: [...j.history, { status: 'Teslim edildi', at, by: actor.name, note: input.note.trim() }] })),
    vehicles: state.vehicles.map(v => v.id === vehicle.id ? { ...v, nextServiceDate: input.nextServiceDate || undefined, nextServiceKm: input.nextServiceKm || undefined } : v),
  };
}
export function suggestedNextService(state: State, job: Job, clock = new Date()) {
  return { date: addMonths(today(clock), state.settings.serviceIntervalMonths), km: Math.ceil((job.intake.km + state.settings.serviceIntervalKm) / 1000) * 1000 };
}

/* ───────────── Müşteri ilişkileri ───────────── */

export function addNote(state: State, actor: Actor, input: { customerId: string; category: NoteCategory; text: string; jobId?: string }, clock = new Date()): State {
  need(actor, 'note.write');
  ensure(state.customers.some(c => c.id === input.customerId), 'Müşteri bulunamadı.');
  ensure(input.text.trim().length >= 3 && input.text.length <= 1000, 'Not 3–1000 karakter olmalı.');
  ensure(!input.jobId || state.jobs.some(j => j.id === input.jobId && j.customerId === input.customerId), 'Seçilen ziyaret bu müşteriye ait değil.');
  const note: CustomerNote = { id: uid(), customerId: input.customerId, jobId: input.jobId || undefined, category: input.category, text: input.text.trim(), by: actor.name, revisions: [], ...stamp(clock) };
  return { ...state, notes: [...state.notes, note] };
}
export function editNote(state: State, actor: Actor, noteId: string, text: string, clock = new Date()): State {
  need(actor, 'note.write');
  const note = state.notes.find(n => n.id === noteId); ensure(note, 'Not bulunamadı.');
  ensure(text.trim().length >= 3 && text.length <= 1000, 'Not 3–1000 karakter olmalı.');
  if (text.trim() === note.text) return state;
  return { ...state, notes: state.notes.map(n => n.id === noteId ? { ...n, text: text.trim(), revisions: [...n.revisions, { text: n.text, at: nowIso(clock), by: actor.name }] } : n) };
}
export function evaluateVisit(state: State, actor: Actor, input: { jobId: string; punctuality: number; payment: number; communication: number; reason: string }, clock = new Date()): State {
  need(actor, 'evaluation.write');
  const job = findJob(state, input.jobId);
  ensure(job.status === 'Teslim edildi', 'Yalnız tamamlanmış ziyaretler değerlendirilebilir.');
  for (const n of [input.punctuality, input.payment, input.communication]) ensure(Number.isInteger(n) && n >= 1 && n <= 5, 'Her ölçüt için 1–5 arası puan seçin.');
  ensure(input.reason.trim().length >= 5, 'Değerlendirme gerekçesi yazın.');
  const evaluation: Evaluation = { id: uid(), customerId: job.customerId, ...input, reason: input.reason.trim(), by: actor.name, ...stamp(clock) };
  return { ...state, evaluations: [...state.evaluations.filter(e => e.jobId !== input.jobId), evaluation] };
}
export function customerScore(state: State, customerId: string) {
  const list = state.evaluations.filter(e => e.customerId === customerId);
  if (!list.length) return null;
  const avg = (k: 'punctuality' | 'payment' | 'communication') => list.reduce((s, e) => s + e[k], 0) / list.length;
  const p = avg('punctuality'), pay = avg('payment'), c = avg('communication');
  return { count: list.length, punctuality: p, payment: pay, communication: c, overall: (p + pay + c) / 3 };
}

/* ───────────── Katalog, hatırlatma, ayarlar ───────────── */

export function upsertCatalog(state: State, actor: Actor, item: Omit<CatalogItem, 'id'>, id?: string): State {
  need(actor, 'catalog.write');
  ensure(item.code.trim() && item.name.trim().length >= 2, 'Kod ve ad zorunlu.');
  ensure(Number.isInteger(item.unitPrice) && item.unitPrice >= 0, 'Birim fiyat geçersiz.');
  ensure(!state.catalog.some(c => c.id !== id && c.code.toLocaleUpperCase('tr') === item.code.trim().toLocaleUpperCase('tr')), 'Bu stok / işçilik kodu kullanılıyor.');
  const clean = { ...item, code: item.code.trim().toLocaleUpperCase('tr'), name: item.name.trim() };
  return { ...state, catalog: id ? state.catalog.map(c => c.id === id ? { ...clean, id } : c) : [...state.catalog, { ...clean, id: uid() }] };
}
export function logReminder(state: State, actor: Actor, input: { vehicleId: string; result: ReminderResult; note: string }, clock = new Date()): State {
  need(actor, 'reminder.write');
  ensure(state.vehicles.some(v => v.id === input.vehicleId), 'Araç bulunamadı.');
  return { ...state, reminders: [...state.reminders, { id: uid(), ...input, note: input.note.trim(), by: actor.name, ...stamp(clock) }] };
}
export function updateSettings(state: State, actor: Actor, settings: Settings): State {
  need(actor, 'settings.write');
  const s = settings;
  ensure(s.company.name.trim().length >= 2, 'Firma adı zorunlu.');
  for (const t of [s.workStart, s.workEnd, s.breakStart, s.breakEnd]) minutes(t);
  ensure(minutes(s.workStart) < minutes(s.breakStart) && minutes(s.breakStart) < minutes(s.breakEnd) && minutes(s.breakEnd) < minutes(s.workEnd), 'Çalışma ve mola saatleri sıralı olmalı.');
  ensure(s.workDays.length > 0, 'En az bir çalışma günü seçin.');
  ensure(Number.isInteger(s.vatRate) && s.vatRate >= 0 && s.vatRate <= 50, 'KDV oranı 0–50 arası tam sayı olmalı.');
  ensure(s.resources.some(r => r.active), 'En az bir aktif servis alanı olmalı.');
  ensure(s.services.every(x => x.name.trim() && x.duration >= 15 && x.duration <= 480), 'Hizmet adları ve süreleri (15–480 dk) geçerli olmalı.');
  return { ...state, settings: s };
}
export function upsertUser(state: State, actor: Actor, input: Omit<User, 'id'>, id?: string): State {
  need(actor, 'staff.write');
  ensure(input.name.trim().length >= 3, 'Ad soyad zorunlu.');
  ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email), 'Geçerli e-posta girin.');
  ensure(!state.users.some(u => u.id !== id && u.email.toLowerCase() === input.email.toLowerCase()), 'Bu e-posta başka bir kullanıcıda kayıtlı.');
  ensure(input.role !== 'customer' || state.customers.some(c => c.id === input.customerId), 'Müşteri hesabı bir müşteri kaydına bağlanmalı.');
  if (id === actor.userId) ensure(input.active && input.role === 'admin', 'Kendi yönetici yetkinizi kaldıramazsınız.');
  return { ...state, users: id ? state.users.map(u => u.id === id ? { ...input, id } : u) : [...state.users, { ...input, id: uid() }] };
}

/* ───────────── Müşteri portalı görünümü ───────────── */

/** Portal yanıtı: yalnız oturumdaki müşterinin kayıtları; iç notlar, puanlar, taslak teklifler ve gizli bulgular çıkarılır. */
export function portalView(state: State, actor: Actor) {
  ensure(actor.role === 'customer' && actor.customerId, 'Müşteri oturumu gerekli.');
  const id = actor.customerId;
  return {
    customer: state.customers.find(c => c.id === id),
    vehicles: state.vehicles.filter(v => v.customerId === id),
    appointments: state.appointments.filter(a => a.customerId === id),
    jobs: state.jobs.filter(j => j.customerId === id).map(j => ({
      ...j,
      inspections: j.inspections.filter(i => i.customerVisible),
      estimates: j.estimates.filter(e => e.status !== 'Taslak'),
      technicianId: '', advisorId: '',
    })),
  };
}

/* ───────────── Hatırlatmalar ───────────── */

export function dueReminders(state: State, clock = new Date()) {
  const day = today(clock);
  return state.vehicles.flatMap(v => {
    if (!v.nextServiceDate && !v.nextServiceKm) return [];
    const daysLeft = v.nextServiceDate ? Math.round((new Date(v.nextServiceDate + 'T12:00:00Z').getTime() - new Date(day + 'T12:00:00Z').getTime()) / 86400000) : null;
    const kmLeft = v.nextServiceKm ? v.nextServiceKm - v.km : null;
    const due = (daysLeft !== null && daysLeft <= 30) || (kmLeft !== null && kmLeft <= 1500);
    if (!due) return [];
    const open = state.appointments.some(a => a.vehicleId === v.id && ['Bekliyor', 'Onaylı'].includes(a.status) && a.date >= day);
    const last = state.reminders.filter(r => r.vehicleId === v.id).at(-1);
    return [{ vehicle: v, daysLeft, kmLeft, overdue: (daysLeft !== null && daysLeft < 0) || (kmLeft !== null && kmLeft < 0), hasAppointment: open, last }];
  }).sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
}
