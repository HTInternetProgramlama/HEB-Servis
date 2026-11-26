import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadConfig } from '../scripts/env';
import { db } from '../lib/server/database';
import { readRelationalState, writeRelationalState } from '../lib/server/repository';
import { awardTechnician, evaluateCustomer, recordStockMovement, stockBalance, upsertStockItem } from '../lib/rules';
import type { Actor } from '../lib/types';

test('PostgreSQL stok kısıtları, değerlendirme/ödül kalıcılığı ve RLS (tam rollback)', async () => {
  assert.ok(process.env.HEB_ENV_FILE, 'Ayrı yerel HEB_ENV_FILE gerekir.');
  loadConfig();
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname), 'Yalnız yerel test veritabanı kullanılabilir.');
  const client = await db().connect();
  try {
    await client.query('begin');
    await client.query('select id from app_control where id=1 for update');
    if (!(await client.query("select to_regclass('public.stock_items') as name")).rows[0].name) {
      await client.query(readFileSync('supabase/migrations/20261126000200_stock_customer_awards.sql', 'utf8'));
    }
    const before = (await readRelationalState(client)).state;
    const user = before.users.find(u => u.role === 'admin' && u.active)!;
    const technician = before.users.find(u => u.role === 'technician' && u.active)!;
    const customer = before.users.find(u => u.role === 'customer' && u.active)!;
    assert.ok(user && technician && customer, 'Önce yerel test ilk kurulumunu yapın.');
    const actor: Actor = { userId: user.id, name: user.name, role: user.role };
    let next = upsertStockItem(before, actor, { code: `TEST-${randomUUID()}`, name: 'Rollback test parçası', unit: 'adet', minimum: 200, active: true });
    const itemId = next.stockItems!.at(-1)!.id;
    next = recordStockMovement(next, actor, { itemId, kind: 'Giriş', quantity: 500, reason: 'Test stok girişi' });
    next = recordStockMovement(next, actor, { itemId, kind: 'Çıkış', quantity: 350, reason: 'Test stok çıkışı' });
    next = evaluateCustomer(next, actor, { customerId: customer.customerId!, punctuality: 4, payment: 5, communication: 4, reason: 'İş emrinden bağımsız test kaydı' });
    next = awardTechnician(next, actor, { technicianId: technician.id, badge: 'Kalite', title: 'Test kalite rozeti', reason: 'Eksiksiz test kontrolleri', reward: 'Eğitim' });
    await writeRelationalState(client, before, next);
    const restored = (await readRelationalState(client)).state;
    assert.equal(stockBalance(restored, itemId), 150);
    assert.ok(restored.evaluations.some(e => e.customerId === customer.customerId && !e.jobId && e.reason === 'İş emrinden bağımsız test kaydı'));
    assert.ok(restored.technicianAwards!.some(a => a.title === 'Test kalite rozeti'));
    // A rejected statement must not abort the rest of the transaction's checks.
    const rejected = async (sql: string, params: unknown[], code: string) => {
      await client.query('savepoint expected_failure');
      await assert.rejects(client.query(sql, params), (error: any) => { if (error.code !== code) console.log(error.where); return error.code === code; });
      await client.query('rollback to savepoint expected_failure');
    };
    await rejected("insert into stock_movements(item_id,kind,quantity,reason) values($1,'Çıkış',151,'Yetersiz stok testi')", [itemId], '23514');
    await rejected("update stock_items set unit='lt' where id=$1", [itemId], '23514');
    await rejected('delete from stock_movements where item_id=$1', [itemId], '23514');
    await rejected('update stock_movements set quantity=quantity+1 where item_id=$1', [itemId], '23514');
    // Re-saving existing rows through ON CONFLICT must not count them twice.
    await client.query('update stock_items set minimum=minimum+1 where id=$1', [itemId]);
    const movement = next.stockMovements!.at(-1)!;
    await client.query('insert into stock_movements(id,item_id,kind,quantity,reason,at,by,by_name,position) select id,item_id,kind,quantity,reason,at,by,by_name,position from stock_movements where id=$1 on conflict(id) do update set position=excluded.position', [movement.id]);
    await client.query('set local role authenticated');
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [customer.id]);
    for (const table of ['stock_items', 'stock_movements', 'technician_awards', 'visit_evaluations', 'customer_notes']) {
      assert.equal((await client.query(`select * from ${table}`)).rowCount, 0, `${table} müşteriye sızmamalı`);
    }
    await rejected("insert into stock_items(code,name,unit) values('unauthorized','Yetkisiz','adet')", [], '42501');
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [technician.id]);
    const awards = (await client.query('select * from technician_awards')).rows;
    assert.ok(awards.length > 0 && awards.every(a => a.technician_id === technician.id));
    assert.equal((await client.query('select * from stock_movements')).rowCount, 0);
  } finally {
    await client.query('rollback');
    client.release();
    await db().end();
  }
});
