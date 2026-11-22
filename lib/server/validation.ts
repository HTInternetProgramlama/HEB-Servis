import type { Command } from '../command-list';
type Check = (value: unknown) => boolean;
const str: Check = v => typeof v === 'string' && v.length <= 2000;
const num: Check = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER;
const bool: Check = v => typeof v === 'boolean';
const one = (...values: unknown[]): Check => v => values.includes(v);
const optional = (check: Check): Check => v => v === undefined || v === null || check(v);
const list = (check: Check): Check => v => Array.isArray(v) && v.length <= 200 && v.every(check);
const object = (fields: Record<string, Check>): Check => v => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every(k => Object.hasOwn(fields, k)) && Object.entries(fields).every(([k, check]) => check((v as Record<string, unknown>)[k]));
const customer = object({ kind: one('Bireysel', 'Kurumsal'), name: str, phone: str, email: str, address: str, taxNo: str, preference: one('Telefon', 'SMS', 'E-posta'), consent: bool });
const vehicle = object({ customerId: str, plate: str, brand: str, model: str, year: num, km: num, vin: str, fuel: one('Benzin', 'Dizel', 'Hibrit', 'Elektrik', 'LPG'), transmission: one('Manuel', 'Otomatik'), color: str });
const slot = { date: str, time: str, duration: num, resourceId: str };
const channel = one('Portal', 'Telefon', 'Şube');
const kind = one('Parça', 'İşçilik');
const noteCategory = one('İletişim tercihi', 'Ziyaret gözlemi', 'Ödeme', 'Genel');
const statuses = one('Kabul edildi', 'İnceleniyor', 'Onay bekliyor', 'İşlemde', 'Parça bekliyor', 'Son kontrol', 'Teslime hazır', 'Teslim edildi', 'İptal');
const intake = { km: num, fuel: num, complaint: str, damages: list(object({ area: str, kind: one('Çizik', 'Göçük', 'Kırık', 'Boya farkı', 'Diğer'), note: str })), belongings: str, customerAck: bool };
const settings = object({
  company: object({ name: str, branch: str, address: str, phone: str, email: str, taxOffice: str, taxNo: str }),
  workStart: str, workEnd: str, breakStart: str, breakEnd: str, workDays: list(one(1, 2, 3, 4, 5, 6, 7)), vatRate: num, serviceIntervalKm: num, serviceIntervalMonths: num,
  resources: list(object({ id: str, name: str, kind: one('Lift', 'Kontrol', 'Hizmet'), active: bool })),
  services: list(object({ id: str, name: str, duration: num, catalogIds: list(str) })),
});
const specs: Record<Command['name'], Check[]> = {
  addCustomer: [customer], updateCustomer: [str, customer], addVehicle: [vehicle], updateVehicle: [str, vehicle],
  requestAppointment: [object({ ...slot, customerId: str, vehicleId: str, serviceId: str, note: str, source: channel })],
  confirmAppointment: [str], rescheduleAppointment: [str, object(slot)], setAppointmentStatus: [str, one('Geldi', 'Gelmedi', 'İptal')],
  openJob: [object({ appointmentId: optional(str), customerId: str, vehicleId: str, serviceId: str, technicianId: str, promisedAt: str, ...intake })],
  moveJob: [str, statuses, optional(str)], reassignJob: [str, str],
  addInspection: [str, object({ item: str, result: one('Uygun', 'Takip edilmeli', 'Acil'), note: str, customerVisible: bool, source: optional(one('Teknisyen', 'Ön değerlendirme')) })],
  toggleInspectionVisibility: [str, str], createEstimateDraft: [str],
  upsertLine: [str, object({ kind, code: str, name: str, unit: str, qty: num, unitPrice: num, discountPct: num }), optional(str)],
  removeLine: [str, str], setEstimateNote: [str, str], sendEstimate: [str],
  decideEstimate: [str, str, one('Onaylandı', 'Reddedildi'), channel, str],
  recordPayment: [str, object({ key: str, amount: num, method: one('Nakit', 'Kredi kartı', 'Havale/EFT'), note: str })],
  deliverJob: [str, object({ note: str, nextServiceDate: str, nextServiceKm: num, allowBalance: bool })],
  addNote: [object({ customerId: str, category: noteCategory, text: str, jobId: optional(str) })], editNote: [str, str],
  evaluateVisit: [object({ jobId: str, punctuality: num, payment: num, communication: num, reason: str })],
  upsertCatalog: [object({ kind, code: str, name: str, unit: str, unitPrice: num, active: bool }), optional(str)],
  logReminder: [object({ vehicleId: str, result: one('Randevu alındı', 'Ulaşılamadı', 'Daha sonra aranacak', 'İstemiyor'), note: str })],
  updateSettings: [settings],
  upsertUser: [object({ name: str, email: str, phone: str, role: one('admin', 'advisor', 'technician', 'customer'), customerId: optional(str), active: bool }), optional(str)],
};
export function validCommand(command: Command) {
  return specs[command.name].every((check, index) => check(command.args[index]));
}
