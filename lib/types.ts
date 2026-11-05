// Para tutarları her yerde kuruş cinsinden tamsayıdır; miktarlar yüzde birlik tamsayıdır (1,5 saat = 150).

export type Role = 'admin' | 'advisor' | 'technician' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  customerId?: string;
  active: boolean;
}

export interface Actor {
  userId: string;
  name: string;
  role: Role;
  customerId?: string;
}

export interface Resource { id: string; name: string; kind: 'Lift' | 'Kontrol' | 'Hizmet'; active: boolean }
export interface ServiceType { id: string; name: string; duration: number; catalogIds: string[] }

export interface Company {
  name: string; branch: string; address: string; phone: string; email: string; taxOffice: string; taxNo: string;
}

export interface Settings {
  company: Company;
  workStart: string; workEnd: string; breakStart: string; breakEnd: string;
  workDays: number[]; // 1 = Pazartesi … 7 = Pazar
  vatRate: number;
  serviceIntervalKm: number;
  serviceIntervalMonths: number;
  resources: Resource[];
  services: ServiceType[];
}

export type CustomerKind = 'Bireysel' | 'Kurumsal';
export type ContactPreference = 'Telefon' | 'SMS' | 'E-posta';

export interface Customer {
  id: string; no: string; kind: CustomerKind; name: string; phone: string; email: string;
  address: string; taxNo: string; preference: ContactPreference; consent: boolean; createdAt: string;
}

export type Fuel = 'Benzin' | 'Dizel' | 'Hibrit' | 'Elektrik' | 'LPG';
export type Transmission = 'Manuel' | 'Otomatik';

export interface Vehicle {
  id: string; customerId: string; plate: string; brand: string; model: string; year: number; km: number;
  vin: string; fuel: Fuel; transmission: Transmission; color: string; createdAt: string;
  nextServiceDate?: string; nextServiceKm?: number;
}

export type AppointmentStatus = 'Bekliyor' | 'Onaylı' | 'Geldi' | 'İş emri açıldı' | 'İptal' | 'Gelmedi';
export type Channel = 'Portal' | 'Telefon' | 'Şube';

export interface Appointment {
  id: string; no: string; customerId: string; vehicleId: string; serviceId: string;
  date: string; time: string; duration: number; resourceId: string;
  status: AppointmentStatus; note: string; source: Channel; createdAt: string; createdBy: string;
}

export type JobStatus =
  | 'Kabul edildi' | 'İnceleniyor' | 'Onay bekliyor' | 'İşlemde' | 'Parça bekliyor'
  | 'Son kontrol' | 'Teslime hazır' | 'Teslim edildi' | 'İptal';

export type DamageKind = 'Çizik' | 'Göçük' | 'Kırık' | 'Boya farkı' | 'Diğer';
export interface Damage { area: string; kind: DamageKind; note: string }

export interface Intake {
  km: number; fuel: number; complaint: string; damages: Damage[]; belongings: string;
  customerAck: boolean; at: string; by: string;
}

export type InspectionResult = 'Uygun' | 'Takip edilmeli' | 'Acil';
export interface Inspection {
  id: string; item: string; result: InspectionResult; note: string; customerVisible: boolean;
  source: 'Teknisyen' | 'Ön değerlendirme'; at: string; by: string;
}

export type LineKind = 'Parça' | 'İşçilik';
export interface EstimateLine {
  id: string; kind: LineKind; code: string; name: string; unit: string;
  qty: number; unitPrice: number; discountPct: number;
}

export type EstimateStatus = 'Taslak' | 'Gönderildi' | 'Onaylandı' | 'Reddedildi' | 'Geçersiz';
export interface Decision { result: 'Onaylandı' | 'Reddedildi'; channel: Channel; note: string; by: string; at: string }
export interface Estimate {
  id: string; version: number; status: EstimateStatus; vatRate: number; lines: EstimateLine[];
  note: string; createdAt: string; createdBy: string; sentAt?: string; decision?: Decision;
}

export type PaymentMethod = 'Nakit' | 'Kredi kartı' | 'Havale/EFT';
export interface Payment { id: string; key: string; amount: number; method: PaymentMethod; note: string; at: string; by: string }

export interface StatusEvent { status: JobStatus; at: string; by: string; note: string }

export interface Job {
  id: string; no: string; appointmentId?: string; customerId: string; vehicleId: string; serviceId: string;
  advisorId: string; technicianId: string; status: JobStatus; intake: Intake;
  inspections: Inspection[]; estimates: Estimate[]; payments: Payment[]; history: StatusEvent[];
  promisedAt: string; deliveredAt?: string; deliveryNote?: string; createdAt: string;
}

export type NoteCategory = 'İletişim tercihi' | 'Ziyaret gözlemi' | 'Ödeme' | 'Genel';
export interface CustomerNote {
  id: string; customerId: string; jobId?: string; category: NoteCategory; text: string;
  at: string; by: string; revisions: { text: string; at: string; by: string }[];
}

export interface Evaluation {
  id: string; customerId: string; jobId: string;
  punctuality: number; payment: number; communication: number; reason: string; at: string; by: string;
}

export interface CatalogItem { id: string; kind: LineKind; code: string; name: string; unit: string; unitPrice: number; active: boolean }

export type ReminderResult = 'Randevu alındı' | 'Ulaşılamadı' | 'Daha sonra aranacak' | 'İstemiyor';
export interface ReminderLog { id: string; vehicleId: string; result: ReminderResult; note: string; at: string; by: string }

export interface AuditEntry { id: string; at: string; by: string; role: Role; action: string; ref?: string }

export interface State {
  version: 3;
  seq: { customer: number; appointment: number; job: number };
  settings: Settings;
  users: User[];
  customers: Customer[];
  vehicles: Vehicle[];
  appointments: Appointment[];
  jobs: Job[];
  notes: CustomerNote[];
  evaluations: Evaluation[];
  catalog: CatalogItem[];
  reminders: ReminderLog[];
  audit: AuditEntry[];
}
