import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../lib/seed';
import { awardTechnician, evaluateCustomer, evaluateVisit, lowStockItems, recordStockMovement, stockBalance, upsertStockItem } from '../lib/rules';
import { visibleState } from '../lib/server/service';
import { validCommand } from '../lib/server/validation';
import { flattenState, readRelationalState } from '../lib/server/repository';
import { databaseSeed } from '../scripts/seed-data';
import type { Actor, State } from '../lib/types';
import type { PoolClient } from 'pg';

const admin: Actor = { userId: 'u-admin', name: 'Hasan Emre', role: 'admin' };
const advisor: Actor = { userId: 'u-adv1', name: 'Selin Arslan', role: 'advisor' };
const tech: Actor = { userId: 'u-t1', name: 'Ahmet Yılmaz', role: 'technician' };
const customer: Actor = { userId: 'u-c1', name: 'Ayşe Demir', role: 'customer', customerId: 'c1' };
const stockInput = { code: 'NEW-STOCK', name: 'Test parçası', unit: 'adet', minimum: 200, active: true };
function withCard(): State { return upsertStockItem({ ...seed(), stockItems: [], stockMovements: [] }, advisor, stockInput); }
function move(s: State, kind: 'Giriş' | 'Çıkış', quantity: number) {
  return recordStockMovement(s, advisor, { itemId: s.stockItems![0].id, kind, quantity, reason: 'Test hareketi' });
}
test('stok giriş/çıkışı kesirli miktarları korur, sıfırda durur ve düşük stok gösterir', () => {
  let s = withCard(); const id = s.stockItems![0].id;
  assert.equal(lowStockItems(s).length, 1);
  s = move(s, 'Giriş', 550); assert.equal(stockBalance(s, id), 550);
  assert.equal(lowStockItems(s).length, 0);
  s = move(s, 'Çıkış', 350); assert.equal(stockBalance(s, id), 200);
  assert.equal(lowStockItems(s).length, 1);
  assert.throws(() => move(s, 'Çıkış', 201), /Yetersiz stok/);
  assert.equal(stockBalance(s, id), 200);
  s = move(s, 'Çıkış', 200); assert.equal(stockBalance(s, id), 0);
  assert.equal(s.stockMovements!.length, 3);
});
test('stok miktarı, rol, pasif kart, bilinmeyen iş ve birim değişiklikleri doğrulanır', () => {
  const s = move(withCard(), 'Giriş', 500); const id = s.stockItems![0].id;
  for (const quantity of [0, -1, 0.1, NaN, Infinity, 100000001]) assert.throws(() => move(s, 'Giriş', quantity));
  for (const actor of [tech, customer]) {
    assert.throws(() => upsertStockItem(s, actor, stockInput), /yetkiniz/);
    assert.throws(() => recordStockMovement(s, actor, { itemId: id, kind: 'Giriş', quantity: 100, reason: 'Test' }), /yetkiniz/);
  }
  assert.throws(() => upsertStockItem(s, admin, { ...stockInput, unit: 'lt' }, id), /birimi/);
  assert.throws(() => upsertStockItem(s, admin, { ...stockInput, code: 'new-stock' }), /zaten/);
  assert.throws(() => recordStockMovement(s, admin, { itemId: id, kind: 'Çıkış', quantity: 100, reason: 'Test', jobId: 'missing' }), /bulunamadı/);
  const inactive = upsertStockItem(s, admin, { ...stockInput, active: false }, id);
  assert.throws(() => move(inactive, 'Giriş', 100), /Aktif/);
});
test('değerlendirme tüm iş durumlarında ve araçsız müşteri için çalışır, güncelleme tek kayıt tutar', () => {
  let s = seed(); const scores = { punctuality: 4, payment: 5, communication: 3, reason: 'İletişime zamanında dönüş sağlandı.' };
  for (const status of ['Kabul edildi', 'İşlemde', 'Parça bekliyor', 'İptal', 'Teslim edildi'] as const) {
    const job = { ...s.jobs[0], status }; s = { ...s, jobs: [job] };
    s = evaluateVisit(s, advisor, { jobId: job.id, ...scores });
    assert.equal(s.evaluations.filter(e => e.jobId === job.id).length, 1);
  }
  s = { ...s, jobs: [], vehicles: [] };
  s = evaluateCustomer(s, advisor, { customerId: 'c1', ...scores });
  const firstId = s.evaluations.find(e => e.customerId === 'c1' && !e.jobId)!.id;
  s = evaluateCustomer(s, advisor, { customerId: 'c1', ...scores, payment: 2 });
  assert.equal(s.evaluations.filter(e => e.customerId === 'c1' && !e.jobId).length, 1);
  assert.equal(s.evaluations.find(e => e.id === firstId)!.payment, 2);
  assert.throws(() => evaluateCustomer(s, customer, { customerId: 'c1', ...scores }), /yetkiniz/);
  assert.throws(() => evaluateCustomer(s, advisor, { customerId: 'missing', ...scores }), /bulunamadı/);
  assert.throws(() => evaluateCustomer(s, advisor, { customerId: 'c1', ...scores, punctuality: 6 }), /1–5/);
});
test('rozet yalnız yönetici tarafından aktif teknisyene ve kendisine ait iş emrine verilir', () => {
  const s = seed(); const input = { technicianId: tech.userId, badge: 'Kalite' as const, title: 'Kalite ödülü', reason: 'Eksiksiz kontrol adımları', reward: 'Eğitim' };
  const next = awardTechnician(s, admin, input);
  assert.equal(next.technicianAwards!.length, s.technicianAwards!.length + 1);
  for (const actor of [advisor, tech, customer]) assert.throws(() => awardTechnician(s, actor, input), /yetkiniz/);
  assert.throws(() => awardTechnician(s, admin, { ...input, technicianId: advisor.userId }), /teknisyen/);
  const otherJob = s.jobs.find(j => j.technicianId !== tech.userId)!;
  assert.throws(() => awardTechnician(s, admin, { ...input, jobId: otherJob.id }), /atanmış/);
});
test('portal hassas değerlendirmeler, notlar, stok ve ödülleri almaz; teknisyen yalnız kendi ödüllerini alır', () => {
  const s = evaluateCustomer(seed(), admin, { customerId: customer.customerId!, punctuality: 1, payment: 2, communication: 3, reason: 'Gizli müşteri gerekçesi' });
  const view = visibleState(s, customer);
  for (const key of ['notes', 'evaluations', 'stockItems', 'stockMovements', 'technicianAwards'] as const) assert.equal(view[key]!.length, 0);
  assert.ok(!JSON.stringify(view).includes('Gizli müşteri gerekçesi'));
  const techView = visibleState(s, tech);
  assert.ok(techView.technicianAwards!.every(a => a.technicianId === tech.userId));
  assert.equal(techView.stockMovements!.length + techView.stockItems!.length, 0);
});
test('yeni komutlar sunucu alan doğrulamasından geçer, kimlik/rol enjeksiyonu reddedilir', () => {
  assert.equal(validCommand({ name: 'upsertStockItem', args: [stockInput] }), true);
  assert.equal(validCommand({ name: 'upsertStockItem', args: [{ ...stockInput, id: 'injected' }] }), false);
  const movement = { itemId: 'stock', kind: 'Giriş', quantity: 100, reason: 'Test' };
  assert.equal(validCommand({ name: 'recordStockMovement', args: [movement] }), true);
  assert.equal(validCommand({ name: 'recordStockMovement', args: [{ ...movement, by: 'admin' }] }), false);
  assert.equal(validCommand({ name: 'awardTechnician', args: [{ technicianId: tech.userId, badge: 'root', title: 'Test', reason: 'Test ödülü', reward: '' }] }), false);
});
test('ilişkisel kayıt dönüşümü yeni alanları kayıpsız saklar ve genel değerlendirmede NULL iş emri kullanır', async () => {
  const original = seed(); const authIds = new Map(original.users.map(u => [u.email, u.id]));
  let s = databaseSeed(authIds, original.users[0].email);
  s = evaluateCustomer(s, admin, { customerId: s.customers[0].id, punctuality: 4, payment: 4, communication: 5, reason: 'Genel değerlendirme' });
  const rows = flattenState(s);
  assert.equal(rows.visit_evaluations.find(e => e.reason === 'Genel değerlendirme')!.job_id, null);
  assert.ok(rows.stock_movements.every(m => rows.stock_items.some(i => i.id === m.item_id)));
  const client = { query: async () => ({ rows: [{ data: { ...rows, control: { seq_customer: s.seq.customer, seq_appointment: s.seq.appointment, seq_job: s.seq.job, revision: 7 } } }] }) } as unknown as PoolClient;
  const restored = (await readRelationalState(client)).state;
  assert.deepEqual(restored.stockItems, s.stockItems);
  assert.deepEqual(restored.stockMovements, s.stockMovements);
  assert.deepEqual(restored.technicianAwards, s.technicianAwards);
  assert.deepEqual(restored.evaluations, s.evaluations);
});
