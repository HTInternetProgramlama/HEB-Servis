import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../lib/seed';
import { enrichAppointmentHistory } from '../scripts/enrich-appointment-history';
import { amountDue, amountPaid } from '../lib/rules';

test('geçmiş demo randevuları mevcut kayıtları korur ve tekrarda çoğalmaz', () => {
  const clock = new Date('2026-11-26T10:00:00Z');
  const before = seed(clock), original = structuredClone(before);
  const next = enrichAppointmentHistory(before, clock);
  assert.deepEqual(before, original);
  for (const key of ['customers', 'vehicles', 'users', 'notes', 'evaluations'] as const) assert.deepEqual(next[key], before[key]);
  assert.deepEqual(next.jobs.slice(0, before.jobs.length), before.jobs);
  assert.deepEqual(next.appointments.slice(0, before.appointments.length), before.appointments);
  assert.equal(next.appointments.length - before.appointments.length, 6);
  assert.equal(next.jobs.length - before.jobs.length, 2);
  for (const job of next.jobs.slice(before.jobs.length)) {
    const appointment = next.appointments.find(a => a.id === job.appointmentId)!;
    assert.equal(appointment.customerId, job.customerId);
    assert.equal(appointment.vehicleId, job.vehicleId);
    assert.equal(job.status, 'Teslim edildi');
    assert.equal(amountDue(job), amountPaid(job));
    assert.ok(job.inspections.every(i => !i.photoPath));
  }
  assert.deepEqual(enrichAppointmentHistory(next, clock), next);
});

test('demo dışı müşteri e-postası varsa geçmiş kaydı eklenmez', () => {
  const clock = new Date('2026-11-26T10:00:00Z');
  const before = seed(clock);
  before.customers = before.customers.map(c => ({ ...c, email: c.email.replace('.test', '.example') }));
  assert.deepEqual(enrichAppointmentHistory(before, clock), before);
});
