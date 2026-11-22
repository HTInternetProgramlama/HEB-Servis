import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../scripts/env';
import { setup } from '../scripts/setup';
import { db, readState, transaction } from '../lib/server/database';
import { mutate, snapshot } from '../lib/server/service';
import { addDays, today, weekday } from '../lib/format';
import { balance, findClash } from '../lib/rules';
import type { Actor } from '../lib/types';
import type { Command, CommandName } from '../lib/command-list';

let admin: Actor; let customer: Actor; let otherCustomer: Actor; let tech: Actor;
before(async () => {
  if (!process.env.HEB_ENV_FILE) throw new Error('Test için ayrı HEB_ENV_FILE gerekir. Bulut veritabanı testlerde kullanılmaz.');
  loadConfig();
  if (!['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error('Entegrasyon testi yalnız ayrı yerel veritabanında çalışır.');
  await setup();
  const { state } = await readState();
  const actor = (email: string): Actor => { const u = state.users.find(u => u.email === email)!; return { userId: u.id, name: u.name, role: u.role, customerId: u.customerId }; };
  admin = actor(process.env.HEB_ADMIN_EMAIL!); customer = actor('ayse.demir@ornek.test'); otherCustomer = actor('mert.kaya@ornek.test'); tech = actor('ahmet@hebservis.test');
});
after(async () => { await db().end(); });
const command = (name: CommandName, ...args: unknown[]): Command => ({ name, args });
async function save(commands: Command[], actor = admin, revision?: number, key = randomUUID()) {
  return mutate(actor, { commands, revision: revision ?? (await readState()).revision, key, message: 'PostgreSQL entegrasyon testi' });
}
test('veriler ayrı tablolardadır; PostgreSQL ve Supabase Auth ilişkileri geçerlidir', async () => {
  const { rows } = await db().query('select (select count(*)::int from customers) as customers,(select count(*)::int from jobs) as jobs,(select count(*)::int from profiles p join auth.users u on p.id=u.id) as users');
  assert.ok(rows[0].customers >= 8); assert.ok(rows[0].jobs >= 12); assert.equal(rows[0].users, 8);
  assert.equal((await db().query("select to_regclass('public.app_state') as old")).rows[0].old, null);
});
test('RLS müşteriyi kendi kayıtlarıyla sınırlar ve doğrudan yazmayı engeller', async () => {
  await transaction(async client => {
    await client.query('set local role authenticated');
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [customer.userId]);
    const rows = (await client.query('select id from customers')).rows;
    assert.deepEqual(rows.map(r => r.id), [customer.customerId]);
    assert.equal((await client.query('select * from customer_notes')).rowCount, 0);
    assert.equal((await client.query('select * from inspections where not customer_visible')).rowCount, 0);
    await assert.rejects(client.query('update customers set name=$1 where id=$2', ['Yetkisiz değişiklik', customer.customerId]), (error: any) => error.code === '42501');
  });
});
test('bir komut başarısızsa önceki değişiklikler ve sürüm geri alınır', async () => {
  const current = await readState();
  const c = current.state.customers[0];
  const input = { kind: c.kind, name: 'Geri alma testi', phone: c.phone, email: c.email, address: c.address, taxNo: c.taxNo, preference: c.preference, consent: c.consent };
  await assert.rejects(save([command('updateCustomer', c.id, input), command('addCustomer', input)]), /kayıtlı/);
  assert.deepEqual(await readState(), current);
});
test('eşzamanlı eski sürümler birbirini ezmez; aynı işlem anahtarı tekrar yazmaz', async () => {
  const current = await readState(); const id = current.state.customers[0].id;
  const c = current.state.customers[0];
  const input = { kind: c.kind, name: c.name, phone: c.phone, email: c.email, address: c.address, taxNo: c.taxNo, preference: c.preference, consent: c.consent };
  const key = randomUUID(); const commands = [command('updateCustomer', id, input)];
  const first = await save(commands, admin, current.revision, key);
  assert.equal((await save(commands, admin, current.revision, key)).revision, first.revision);
  const outcomes = await Promise.allSettled([save(commands, admin, first.revision), save(commands, admin, first.revision)]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
});
test('PostgreSQL üzerinde randevudan tahsilat ve teslimata kadar akış', async () => {
  let state = (await readState()).state;
  const plate = `58TT${String(Date.now()).slice(-5)}`;
  await save([command('addVehicle', { customerId: customer.customerId, plate, brand: 'Fiat', model: 'Egea', year: 2022, km: 80000, vin: '', fuel: 'Dizel', transmission: 'Manuel', color: 'Beyaz' })]);
  state = (await readState()).state;
  const vehicleId = state.vehicles.at(-1)!.id; const serviceId = state.settings.services[0].id; const resourceId = state.settings.resources[0].id;
  let date = addDays(today(), 30);
  while (!state.settings.workDays.includes(weekday(date)) || findClash(state, { id: 'integration', date, time: '09:00', duration: 60, resourceId })) date = addDays(date, 1);
  const request = await save([command('requestAppointment', { customerId: customer.customerId, vehicleId, serviceId, resourceId, date, time: '09:00', duration: 60, note: 'Entegrasyon testi', source: 'Portal' })], customer);
  const appointmentId = request.state.appointments.at(-1)!.id;
  await save([command('confirmAppointment', appointmentId)]);
  // Even an unrestricted database connection cannot bypass the overlap constraint.
  await assert.rejects(transaction(async client => {
    await client.query('insert into appointments(id,no,customer_id,vehicle_id,service_type_id,resource_id,starts_at,ends_at,status,source) select $1,$2,customer_id,vehicle_id,service_type_id,resource_id,starts_at,ends_at,status,source from appointments where id=$3', [randomUUID(), `TEST-${randomUUID()}`, appointmentId]);
  }), (error: any) => error.code === '23P01');
  await save([command('openJob', { appointmentId, customerId: customer.customerId, vehicleId, serviceId, technicianId: tech.userId, km: 80010, fuel: 4, complaint: 'Periyodik bakım talebi', damages: [], belongings: '', customerAck: true, promisedAt: `${date}T15:00:00+03:00` })]);
  const job = (await readState()).state.jobs.at(-1)!;
  await save([command('addInspection', job.id, { item: 'Yağ kontrolü', result: 'Takip edilmeli', note: 'Bakım gerekli', customerVisible: true })], tech);
  await save([command('createEstimateDraft', job.id)]);
  await save([command('sendEstimate', job.id)]);
  const estimate = (await readState()).state.jobs.at(-1)!.estimates.at(-1)!;
  await assert.rejects(save([command('decideEstimate', job.id, estimate.id, 'Onaylandı', 'Portal', '')], otherCustomer), /ait değil/);
  await assert.rejects(db().query('update estimate_lines set qty=qty+1 where estimate_id=$1', [estimate.id]), /değiştirilemez/);
  await save([command('decideEstimate', job.id, estimate.id, 'Onaylandı', 'Portal', '')], customer);
  await save([command('moveJob', job.id, 'Son kontrol')], tech);
  await save([command('moveJob', job.id, 'Teslime hazır')]);
  const payment = { key: randomUUID(), amount: balance((await readState()).state.jobs.at(-1)!), method: 'Nakit', note: '' };
  await save([command('recordPayment', job.id, payment)]); await save([command('recordPayment', job.id, payment)]);
  await save([command('deliverJob', job.id, { note: 'Teslim edildi', nextServiceDate: addDays(date, 180), nextServiceKm: 95000, allowBalance: false })]);
  const done = (await readState()).state.jobs.at(-1)!;
  assert.equal(done.status, 'Teslim edildi'); assert.equal(balance(done), 0); assert.equal(done.payments.length, 1);
  assert.ok((await snapshot(customer)).state.jobs.some(j => j.id === job.id));
});
