import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { State } from '../types';
import { fail } from './errors';

// These tables are the persistence model. No application-state JSON column exists.
const tables = ['settings', 'resources', 'catalog_items', 'service_types', 'customers', 'profiles', 'vehicles', 'service_type_items', 'appointments', 'jobs', 'job_status_events', 'inspections', 'estimates', 'estimate_lines', 'payments', 'customer_notes', 'customer_note_revisions', 'visit_evaluations', 'stock_items', 'stock_movements', 'technician_awards', 'reminder_logs', 'audit_log'] as const;
type Table = typeof tables[number];
// pg's JSON result is decoded and checked against the schema by PostgreSQL.
type Row = Record<string, any>;
type Rows = Record<Table, Row[]>;
export function stableUuid(value: string) {
  const h = createHash('sha256').update(value).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const iso = (value: string | Date | null) => value ? new Date(value).toISOString() : undefined;
const empty = (value: string | null) => value ?? '';
const time = (value: string) => value.slice(0, 5);
const key = (table: Table, row: Row) => table === 'service_type_items' ? `${row.service_type_id}:${row.catalog_item_id}` : String(row.id);
const same = (a: Row | undefined, b: Row) => a && JSON.stringify(a) === JSON.stringify(b);

export function flattenState(state: State): Rows {
  const result = Object.fromEntries(tables.map(t => [t, []])) as unknown as Rows;
  const parents: Partial<Record<Table, string>> = { estimates: 'job_id', estimate_lines: 'estimate_id', inspections: 'job_id', payments: 'job_id', job_status_events: 'job_id', customer_note_revisions: 'note_id', service_type_items: 'service_type_id' };
  const put = (table: Table, row: Row) => {
    const parent = parents[table];
    const position = table === 'audit_log' ? 0 : parent ? result[table].filter(r => r[parent] === row[parent]).length : result[table].length;
    result[table].push({ ...row, position });
  };
  const who = (name: string | undefined) => state.users.find(u => u.name === name)?.id ?? null;
  const s = state.settings;
  put('settings', { id: 1, company: s.company, work_start: s.workStart, work_end: s.workEnd, break_start: s.breakStart, break_end: s.breakEnd, work_days: s.workDays, vat_rate: s.vatRate, service_interval_km: s.serviceIntervalKm, service_interval_months: s.serviceIntervalMonths });
  s.resources.forEach(r => put('resources', { id: r.id, name: r.name, kind: r.kind, active: r.active }));
  state.catalog.forEach(c => put('catalog_items', { id: c.id, kind: c.kind, code: c.code, name: c.name, unit: c.unit, unit_price: c.unitPrice, active: c.active }));
  s.services.forEach(v => {
    put('service_types', { id: v.id, name: v.name, duration_min: v.duration });
    v.catalogIds.forEach(id => put('service_type_items', { service_type_id: v.id, catalog_item_id: id }));
  });
  state.customers.forEach(c => put('customers', { id: c.id, no: c.no, kind: c.kind, name: c.name, phone: c.phone, email: c.email, address: c.address, tax_no: c.taxNo, preference: c.preference, consent: c.consent, created_at: c.createdAt }));
  state.users.forEach(u => put('profiles', { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, customer_id: u.role === 'customer' ? u.customerId : null, active: u.active }));
  state.vehicles.forEach(v => put('vehicles', { id: v.id, customer_id: v.customerId, plate: v.plate, brand: v.brand, model: v.model, year: v.year, km: v.km, vin: v.vin || null, fuel: v.fuel, transmission: v.transmission, color: v.color, next_service_date: v.nextServiceDate || null, next_service_km: v.nextServiceKm || null, created_at: v.createdAt }));
  state.appointments.forEach(a => {
    const starts = new Date(`${a.date}T${a.time}:00+03:00`);
    put('appointments', { id: a.id, no: a.no, customer_id: a.customerId, vehicle_id: a.vehicleId, service_type_id: a.serviceId, resource_id: a.resourceId, starts_at: starts.toISOString(), ends_at: new Date(starts.getTime() + a.duration * 60000).toISOString(), status: a.status, note: a.note, source: a.source, created_at: a.createdAt, created_by: who(a.createdBy), created_by_name: a.createdBy });
  });
  state.jobs.forEach(j => {
    put('jobs', { id: j.id, no: j.no, appointment_id: j.appointmentId || null, customer_id: j.customerId, vehicle_id: j.vehicleId, service_type_id: j.serviceId, advisor_id: j.advisorId, technician_id: j.technicianId, status: j.status, intake_km: j.intake.km, intake_fuel: j.intake.fuel, intake_at: j.intake.at, intake_by: who(j.intake.by), intake_by_name: j.intake.by, complaint: j.intake.complaint, damages: j.intake.damages, belongings: j.intake.belongings, customer_ack: j.intake.customerAck, promised_at: iso(j.promisedAt), delivered_at: iso(j.deliveredAt ?? null) ?? null, delivery_note: j.deliveryNote || null, created_at: j.createdAt });
    j.history.forEach((h, index) => put('job_status_events', { id: stableUuid(`${j.id}:history:${index}`), job_id: j.id, status: h.status, note: h.note, at: h.at, by: who(h.by), by_name: h.by }));
    j.inspections.forEach(i => put('inspections', { id: i.id, job_id: j.id, item: i.item, result: i.result, note: i.note, customer_visible: i.customerVisible, source: i.source, photo_path: i.photoPath || null, at: i.at, by: who(i.by), by_name: i.by }));
    j.estimates.forEach(e => {
      put('estimates', { id: e.id, job_id: j.id, version: e.version, status: e.status, vat_rate: e.vatRate, note: e.note, created_at: e.createdAt, created_by: who(e.createdBy), created_by_name: e.createdBy, sent_at: iso(e.sentAt ?? null) ?? null, decision_result: e.decision?.result ?? null, decision_channel: e.decision?.channel ?? null, decision_note: e.decision?.note ?? null, decision_by: who(e.decision?.by), decision_by_name: e.decision?.by ?? '', decision_at: iso(e.decision?.at ?? null) ?? null });
      e.lines.forEach(l => put('estimate_lines', { id: l.id, estimate_id: e.id, kind: l.kind, code: l.code, name: l.name, unit: l.unit, qty: l.qty, unit_price: l.unitPrice, discount_pct: l.discountPct }));
    });
    j.payments.forEach(p => put('payments', { id: p.id, job_id: j.id, idempotency_key: p.key, amount: p.amount, method: p.method, note: p.note, at: p.at, by: who(p.by), by_name: p.by }));
  });
  state.notes.forEach(n => {
    put('customer_notes', { id: n.id, customer_id: n.customerId, job_id: n.jobId || null, category: n.category, text: n.text, at: n.at, by: who(n.by), by_name: n.by });
    n.revisions.forEach((r, index) => put('customer_note_revisions', { id: stableUuid(`${n.id}:revision:${index}`), note_id: n.id, previous_text: r.text, at: r.at, by: who(r.by), by_name: r.by }));
  });
  state.evaluations.forEach(e => put('visit_evaluations', { id: e.id, job_id: e.jobId || null, customer_id: e.customerId, punctuality: e.punctuality, payment: e.payment, communication: e.communication, reason: e.reason, at: e.at, by: who(e.by), by_name: e.by }));
  (state.stockItems ?? []).forEach(i => put('stock_items', { id: i.id, code: i.code, name: i.name, unit: i.unit, minimum: i.minimum, active: i.active }));
  (state.stockMovements ?? []).forEach(m => put('stock_movements', { id: m.id, item_id: m.itemId, kind: m.kind, quantity: m.quantity, reason: m.reason, job_id: m.jobId || null, at: m.at, by: who(m.by), by_name: m.by }));
  (state.technicianAwards ?? []).forEach(a => put('technician_awards', { id: a.id, technician_id: a.technicianId, badge: a.badge, title: a.title, reason: a.reason, reward: a.reward, job_id: a.jobId || null, at: a.at, by: who(a.by), by_name: a.by }));
  state.reminders.forEach(r => put('reminder_logs', { id: r.id, vehicle_id: r.vehicleId, result: r.result, note: r.note, at: r.at, by: who(r.by), by_name: r.by }));
  state.audit.forEach(a => put('audit_log', { id: a.id, at: a.at, by: who(a.by), by_name: a.by, role: a.role, action: a.action, ref: a.ref || null }));
  return result;
}

/** Uygulama ekranları için işlem günlüğünün son kayıtları; tam geçmiş veritabanında kalır, yedek tamamını alır. */
export const AUDIT_WINDOW = 1000;
export async function readRelationalState(client: Pick<PoolClient, "query">, options: { fullAudit?: boolean } = {}): Promise<{ state: State; revision: number }> {
  const auditSource = options.fullAudit ? 'audit_log' : `(select * from audit_log order by at desc, id limit ${AUDIT_WINDOW})`;
  const fragments = tables.map(t => `'${t}',(select coalesce(jsonb_agg(t order by ${t === 'audit_log' ? 'at desc,id' : 'position'}),'[]'::jsonb) from ${t === 'audit_log' ? auditSource : t} t)`);
  const { rows } = await client.query(`select jsonb_build_object(${fragments.join(',')},'control',(select to_jsonb(c) from app_control c where id=1)) as data`);
  const d = rows[0].data as Rows & { control: Row };
  const co = d.control; const s = d.settings[0];
  if (!s || !co) return fail(503, 'Veritabanı ilk kurulumu gerekiyor. Kurulum komutunu çalıştırın.');
  const state: State = {
    version: 3, seq: { customer: co.seq_customer, appointment: co.seq_appointment, job: co.seq_job },
    settings: { company: s.company, workStart: time(s.work_start), workEnd: time(s.work_end), breakStart: time(s.break_start), breakEnd: time(s.break_end), workDays: s.work_days, vatRate: s.vat_rate, serviceIntervalKm: s.service_interval_km, serviceIntervalMonths: s.service_interval_months,
      resources: d.resources.map(r => ({ id: r.id, name: r.name, kind: r.kind, active: r.active })),
      services: d.service_types.map(r => ({ id: r.id, name: r.name, duration: r.duration_min, catalogIds: d.service_type_items.filter(i => i.service_type_id === r.id).map(i => i.catalog_item_id) })),
    },
    users: d.profiles.map(r => ({ id: r.id, name: r.name, email: r.email, phone: empty(r.phone), role: r.role, customerId: r.customer_id ?? undefined, active: r.active })),
    customers: d.customers.map(r => ({ id: r.id, no: r.no, kind: r.kind, name: r.name, phone: r.phone, email: empty(r.email), address: empty(r.address), taxNo: empty(r.tax_no), preference: r.preference, consent: r.consent, createdAt: iso(r.created_at)! })),
    vehicles: d.vehicles.map(r => ({ id: r.id, customerId: r.customer_id, plate: r.plate, brand: r.brand, model: r.model, year: r.year, km: r.km, vin: empty(r.vin), fuel: r.fuel, transmission: r.transmission, color: empty(r.color), nextServiceDate: r.next_service_date ?? undefined, nextServiceKm: r.next_service_km ?? undefined, createdAt: iso(r.created_at)! })),
    appointments: d.appointments.map(r => {
      const date = new Date(r.starts_at); const tr = new Date(date.getTime() + 3 * 3600000).toISOString();
      return { id: r.id, no: r.no, customerId: r.customer_id, vehicleId: r.vehicle_id, serviceId: r.service_type_id, resourceId: r.resource_id, date: tr.slice(0, 10), time: tr.slice(11, 16), duration: (new Date(r.ends_at).getTime() - date.getTime()) / 60000, status: r.status, note: empty(r.note), source: r.source, createdAt: iso(r.created_at)!, createdBy: r.created_by_name };
    }),
    jobs: d.jobs.map(r => ({ id: r.id, no: r.no, appointmentId: r.appointment_id ?? undefined, customerId: r.customer_id, vehicleId: r.vehicle_id, serviceId: r.service_type_id, advisorId: r.advisor_id, technicianId: r.technician_id, status: r.status, intake: { km: r.intake_km, fuel: r.intake_fuel, at: iso(r.intake_at)!, by: r.intake_by_name, complaint: r.complaint, damages: r.damages, belongings: empty(r.belongings), customerAck: r.customer_ack }, promisedAt: iso(r.promised_at)!, deliveredAt: iso(r.delivered_at), deliveryNote: r.delivery_note ?? undefined, createdAt: iso(r.created_at)!,
      history: d.job_status_events.filter(h => h.job_id === r.id).map(h => ({ status: h.status, at: iso(h.at)!, by: h.by_name, note: empty(h.note) })),
      inspections: d.inspections.filter(i => i.job_id === r.id).map(i => ({ id: i.id, item: i.item, result: i.result, note: empty(i.note), customerVisible: i.customer_visible, source: i.source, photoPath: i.photo_path ?? undefined, at: iso(i.at)!, by: i.by_name })),
      estimates: d.estimates.filter(e => e.job_id === r.id).map(e => ({ id: e.id, version: e.version, status: e.status, vatRate: e.vat_rate, note: empty(e.note), createdAt: iso(e.created_at)!, createdBy: e.created_by_name, sentAt: iso(e.sent_at),
        decision: e.decision_result ? { result: e.decision_result, channel: e.decision_channel, note: empty(e.decision_note), by: e.decision_by_name, at: iso(e.decision_at)! } : undefined,
        lines: d.estimate_lines.filter(l => l.estimate_id === e.id).map(l => ({ id: l.id, kind: l.kind, code: empty(l.code), name: l.name, unit: l.unit, qty: l.qty, unitPrice: l.unit_price, discountPct: l.discount_pct })),
      })),
      payments: d.payments.filter(p => p.job_id === r.id).map(p => ({ id: p.id, key: p.idempotency_key, amount: p.amount, method: p.method, note: empty(p.note), at: iso(p.at)!, by: p.by_name })),
    })),
    notes: d.customer_notes.map(n => ({ id: n.id, customerId: n.customer_id, jobId: n.job_id ?? undefined, category: n.category, text: n.text, at: iso(n.at)!, by: n.by_name, revisions: d.customer_note_revisions.filter(r => r.note_id === n.id).map(r => ({ text: r.previous_text, at: iso(r.at)!, by: r.by_name })) })),
    evaluations: d.visit_evaluations.map(e => ({ id: e.id, customerId: e.customer_id, jobId: e.job_id ?? '', punctuality: e.punctuality, payment: e.payment, communication: e.communication, reason: e.reason, at: iso(e.at)!, by: e.by_name })),
    stockItems: d.stock_items.map(i => ({ id: i.id, code: i.code, name: i.name, unit: i.unit, minimum: i.minimum, active: i.active })),
    stockMovements: d.stock_movements.map(m => ({ id: m.id, itemId: m.item_id, kind: m.kind, quantity: m.quantity, reason: m.reason, jobId: m.job_id ?? undefined, at: iso(m.at)!, by: m.by_name })),
    technicianAwards: d.technician_awards.map(a => ({ id: a.id, technicianId: a.technician_id, badge: a.badge, title: a.title, reason: a.reason, reward: a.reward, jobId: a.job_id ?? undefined, at: iso(a.at)!, by: a.by_name })),
    reminders: d.reminder_logs.map(r => ({ id: r.id, vehicleId: r.vehicle_id, result: r.result, note: empty(r.note), at: iso(r.at)!, by: r.by_name })),
    audit: d.audit_log.map(a => ({ id: a.id, at: iso(a.at)!, by: a.by_name, role: a.role, action: a.action, ref: a.ref ?? undefined })),
    catalog: d.catalog_items.map(c => ({ id: c.id, kind: c.kind, code: c.code, name: c.name, unit: c.unit, unitPrice: c.unit_price, active: c.active })),
  };
  return { state, revision: Number(co.revision) };
}

async function upsert(client: PoolClient, table: Table, row: Row) {
  const keys = Object.keys(row); const primary = table === 'service_type_items' ? ['service_type_id', 'catalog_item_id'] : ['id'];
  const values = keys.map(k => ['company', 'damages'].includes(k) ? JSON.stringify(row[k]) : row[k]);
  await client.query(`insert into ${table} (${keys.map(k => `"${k}"`).join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) on conflict (${primary.join(',')}) do update set ${keys.filter(k => !primary.includes(k)).map(k => `"${k}"=excluded."${k}"`).join(',')}`, values);
}
export async function writeRelationalState(client: PoolClient, before: State | null, next: State) {
  const old = before ? flattenState(before) : Object.fromEntries(tables.map(t => [t, []])) as unknown as Rows;
  const rows = flattenState(next);
  // Remove children before parents. Application rules do not delete customer/job history.
  for (const table of [...tables].reverse()) {
    const desired = new Set(rows[table].map(r => key(table, r)));
    for (const row of old[table]) if (!desired.has(key(table, row))) {
      if (table === 'audit_log') continue; // Denetim kaydı yalnız eklenir; bellekteki 1000 kayıt sınırı veritabanından silme sayılmaz.
      if (table === 'service_type_items') await client.query('delete from service_type_items where service_type_id=$1 and catalog_item_id=$2', [row.service_type_id, row.catalog_item_id]);
      else await client.query(`delete from ${table} where id=$1`, [row.id]);
    }
  }
  for (const table of tables) {
    if (table === 'estimate_lines') continue;
    const previous = new Map(old[table].map(r => [key(table, r), r]));
    for (const row of rows[table]) {
      if (table !== 'estimates') { if (!same(previous.get(key(table, row)), row)) await upsert(client, table, row); continue; }
      const existing = previous.get(String(row.id));
      if (!existing) await upsert(client, table, { ...row, status: 'Taslak' });
      const previousLines = new Map(old.estimate_lines.filter(l => l.estimate_id === row.id).map(l => [l.id, l]));
      for (const line of rows.estimate_lines.filter(l => l.estimate_id === row.id)) if (!same(previousLines.get(line.id), line)) await upsert(client, 'estimate_lines', line);
      if (!same(existing, row) || !existing) await upsert(client, table, row);
    }
  }
}
