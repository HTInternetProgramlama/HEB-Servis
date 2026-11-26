/** Additive, repeatable historical appointments for the two explicitly fictional demo accounts. */
import assert from 'node:assert/strict';
import { loadConfig } from './env';
import { db, readState, transaction, writeState } from '../lib/server/database';
import { stableUuid } from '../lib/server/repository';
import { approvedEstimate, estimateTotals } from '../lib/rules';
import { addDays, today } from '../lib/format';
import type { Appointment, Job, State } from '../lib/types';

export function enrichAppointmentHistory(before: State, clock = new Date()): State {
  const next = structuredClone(before);
  const actor = next.users.find(u => u.role === 'admin' && u.active);
  assert.ok(actor, 'Etkin yönetici gerekli.');
  const emails = ['ayse.demir@ornek.test', 'mert.kaya@ornek.test'];
  for (const [index, email] of emails.entries()) {
    const account = next.users.find(u => u.role === 'customer' && u.active && u.email === email);
    const customer = next.customers.find(c => c.id === account?.customerId && c.email === email);
    if (!customer) continue;
    const source = before.jobs.find(j => j.customerId === customer.id && approvedEstimate(j));
    const vehicle = next.vehicles.find(v => v.id === source?.vehicleId && v.customerId === customer.id);
    const resource = next.settings.resources.find(r => r.active);
    if (!source || !vehicle || !resource) continue;
    const id = (kind: string) => stableUuid(`heb-appointment-history-v1:${customer.id}:${kind}`);
    const day = addDays(today(clock), -14 - index);
    const at = (time: string) => new Date(`${day}T${time}:00+03:00`).toISOString();
    const appointmentId = id('completed-appointment');
    const jobId = id('completed-job');
    if (!next.appointments.some(a => a.id === appointmentId)) {
      const appointment: Appointment = { id: appointmentId, no: `R-${String(++next.seq.appointment).padStart(5, '0')}`, customerId: customer.id, vehicleId: vehicle.id, serviceId: source.serviceId,
        date: day, time: '09:00', duration: 90, resourceId: resource.id, status: 'İş emri açıldı', source: 'Portal',
        note: 'Kurgusal demo randevusu: periyodik kontrol ve bakım talebi.', createdAt: new Date(`${addDays(day, -3)}T14:00:00+03:00`).toISOString(), createdBy: customer.name };
      next.appointments.push(appointment);
    }
    if (!next.jobs.some(j => j.id === jobId)) {
      const estimate = structuredClone(approvedEstimate(source)!);
      estimate.id = id('estimate'); estimate.version = 1; estimate.status = 'Onaylandı';
      estimate.createdAt = at('09:30'); estimate.sentAt = at('09:40'); estimate.createdBy = actor.name;
      estimate.note = 'Kurgusal demo: kontrol ve bakım için onaylanan işlemler.';
      estimate.decision = { result: 'Onaylandı', channel: 'Portal', note: '', at: at('10:00'), by: customer.name };
      estimate.lines = estimate.lines.map((line, i) => ({ ...line, id: id(`line-${i}`) }));
      const total = estimateTotals(estimate).total;
      const job: Job = { ...structuredClone(source), id: jobId, no: `İE-${day.slice(0, 4)}-${String(++next.seq.job).padStart(4, '0')}`, appointmentId,
        status: 'Teslim edildi', createdAt: at('09:00'), promisedAt: at('17:00'), deliveredAt: at('16:30'), deliveryNote: 'Kurgusal demo teslimi.',
        intake: { ...source.intake, km: Math.max(0, vehicle.km - 1200), complaint: 'Kurgusal demo: periyodik kontrol ve bakım.', at: at('09:00'), by: actor.name },
        estimates: [estimate],
        inspections: source.inspections.map((inspection, i) => ({ ...inspection, id: id(`inspection-${i}`), photoPath: undefined, at: at('09:20') })),
        payments: total > 0 ? [{ id: id('payment'), key: `demo-appointment-history:${customer.id}`, amount: total, method: 'Kredi kartı', note: 'Kurgusal demo kaydı; gerçek ödeme değildir.', at: at('16:20'), by: actor.name }] : [],
        history: (['Kabul edildi', 'İnceleniyor', 'Onay bekliyor', 'İşlemde', 'Son kontrol', 'Teslime hazır', 'Teslim edildi'] as const).map((status, i) => ({ status, at: at(['09:00', '09:15', '09:40', '10:00', '15:30', '16:00', '16:30'][i]), by: actor.name, note: '' })),
      };
      next.jobs.push(job);
    }
    for (const [i, status] of (['İptal', 'Gelmedi'] as const).entries()) {
      const appointmentId = id(`appointment-${status}`);
      if (next.appointments.some(a => a.id === appointmentId)) continue;
      const date = addDays(day, -7 - i * 3);
      next.appointments.push({ id: appointmentId, no: `R-${String(++next.seq.appointment).padStart(5, '0')}`, customerId: customer.id, vehicleId: vehicle.id, serviceId: source.serviceId,
        date, time: '14:00', duration: 60, resourceId: resource.id, status, source: 'Portal', note: 'Kurgusal demo: servis geçmişi inceleme örneği.',
        createdAt: new Date(`${addDays(date, -2)}T11:00:00+03:00`).toISOString(), createdBy: customer.name });
    }
  }
  return next;
}
async function main() {
  loadConfig();
  const apply = process.argv.includes('--apply');
  if (apply) assert.ok(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname) || process.argv.includes('--allow-cloud'), 'Bulut için --allow-cloud gerekli.');
  await transaction(async pg => {
    await pg.query('select id from app_control where id=1 for update');
    const { state: before, revision } = await readState(pg);
    const next = enrichAppointmentHistory(before);
    assert.deepEqual(enrichAppointmentHistory(next), next, 'Tekrar çalıştırma kayıt çoğaltmamalı.');
    const additions = { appointments: next.appointments.length - before.appointments.length, jobs: next.jobs.length - before.jobs.length };
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', additions }));
    if (apply && Object.values(additions).some(n => n > 0)) await writeState(pg, before, next, revision + 1);
  });
}
if (process.argv[1]?.endsWith('enrich-appointment-history.ts')) main().catch(() => { console.error('Geçmiş randevu demo kayıtları hazırlanamadı.'); process.exitCode = 1; }).finally(() => db().end());
