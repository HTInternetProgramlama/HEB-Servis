import { loadConfig } from './env';
import { db } from '../lib/server/database';
import assert from 'node:assert/strict';
loadConfig();
async function main() {
  const base = 'http://127.0.0.1:3001';
  const response = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email: process.env.HEB_ADMIN_EMAIL, password: process.env.HEB_ADMIN_PASSWORD }) });
  if (response.status !== 200) throw new Error(`Uygulama girişi doğrulanamadı (${response.status}).`);
  const cookie = response.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
  try {
    const snapshot = await response.json();
    assert.equal(snapshot.actor.role, 'admin');
    const result = await db().query('select id from profiles where id=$1 and active', [snapshot.actor.userId]);
    assert.equal(result.rowCount, 1);
    const jobs = (await db().query('select id from jobs')).rows.map(r => r.id);
    assert.ok(snapshot.state.jobs.every((j: { id: string }) => jobs.includes(j.id)));
    const rls = await db().query("select count(*)::int as enabled from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity");
    console.log(`Bulut backend uygulamadan doğrulandı: ${snapshot.state.customers.length} müşteri, ${snapshot.state.vehicles.length} araç, ${snapshot.state.jobs.length} iş emri. RLS açık tablo sayısı: ${rls.rows[0].enabled}.`);
    assert.equal((await fetch(base + '/api/session', { headers: { Cookie: cookie } })).status, 200);
  } finally {
    await fetch(base + '/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie }, body: '{}' });
  }
}
main().catch(error => { console.error(error instanceof Error && !('code' in error) ? error.message : 'Uygulama bağlantısı doğrulanamadı.'); process.exitCode = 1; }).finally(() => db().end());
