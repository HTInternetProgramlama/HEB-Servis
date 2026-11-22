import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validCommand } from '../lib/server/validation';
import { visibleState } from '../lib/server/service';
import { databaseSeed } from '../scripts/seed-data';
import { seed } from '../lib/seed';
import { stableUuid, flattenState } from '../lib/server/repository';
import { photoType } from '../lib/server/photos';

const state = seed();
test('sunucu müşteri yanıtı başka müşterinin bilgilerini ve gizli bulguları içermez', () => {
  const u = state.users.find(u => u.role === 'customer')!;
  const s = visibleState(state, { userId: u.id, name: u.name, role: u.role, customerId: u.customerId });
  assert.ok(s.jobs.every(j => j.customerId === u.customerId));
  assert.ok(s.jobs.every(j => j.inspections.every(i => i.customerVisible) && j.estimates.every(e => e.status !== 'Taslak')));
  assert.equal(s.notes.length + s.audit.length + s.evaluations.length, 0);
});
test('sunucu alan doğrulaması rol ve kayıt kimliği enjeksiyonunu engeller', () => {
  const input = { kind: 'Bireysel', name: 'Alan Testi', phone: '05559991111', email: '', address: '', taxNo: '', preference: 'Telefon', consent: true };
  assert.equal(validCommand({ name: 'addCustomer', args: [input] }), true);
  assert.equal(validCommand({ name: 'updateCustomer', args: ['c1', { ...input, id: 'c2' }] }), false);
  assert.equal(validCommand({ name: 'upsertUser', args: [{ name: 'Yetki Testi', email: 'yetki@test.com', phone: '', role: 'root', active: true }] }), false);
});
test('ilişkisel örnek veride Auth kimlikleri korunur, teklif kalemi kimlikleri tüm sürümlerde benzersizdir', () => {
  const users = new Map(state.users.map(u => [u.email, stableUuid(u.id)]));
  const seeded = databaseSeed(users, 'admin@example.com');
  const rows = flattenState(seeded);
  assert.equal(new Set(rows.estimate_lines.map(l => l.id)).size, rows.estimate_lines.length);
  assert.ok(rows.profiles.every(u => [...users.values()].includes(u.id)));
  assert.ok(rows.vehicles.every(v => rows.customers.some(c => c.id === v.customer_id)));
  assert.ok(rows.jobs.every(j => rows.profiles.some(u => u.id === j.technician_id)));
});
test('fotoğraf doğrulaması SVG ve sahte uzantıları kabul etmez', () => {
  assert.equal(photoType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(photoType(Buffer.from('sahte jpg dosyası')), null);
  assert.equal(photoType(Buffer.from([137,80,78,71,13,10,26,10]))?.mime, 'image/png');
  assert.equal(photoType(Buffer.from([255,216,255,224]))?.mime, 'image/jpeg');
});
