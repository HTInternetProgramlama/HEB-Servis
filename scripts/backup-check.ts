import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { loadConfig } from './env';
import { backup } from './backup';
import { db, readState } from '../lib/server/database';
import { mutate } from '../lib/server/service';
import { supabaseAdmin } from '../lib/server/supabase';
import { randomUUID } from 'node:crypto';
loadConfig();
async function main() {
  if (!process.env.HEB_ENV_FILE || !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error('Geri yükleme testi yalnız ayrı yerel test ortamında çalışır.');
  const original = await readState(); const c = original.state.customers[0];
  const u = original.state.users.find(u => u.role === 'admin')!;
  const directory = await backup();
  const photo = original.state.jobs.flatMap(j => j.inspections).find(i => i.photoPath)?.photoPath;
  const storage = supabaseAdmin().storage.from('service-photos');
  if (photo) { const result = await storage.remove([photo]); if (result.error) throw new Error('Test fotoğrafı kaldırılamadı.'); }
  await mutate({ userId: u.id, name: u.name, role: u.role }, { revision: original.revision, key: randomUUID(), message: 'Yerel geri yükleme testi', commands: [{ name: 'updateCustomer', args: [c.id, { kind: c.kind, name: 'Yedek sonrası değişiklik', phone: c.phone, email: c.email, address: c.address, taxNo: c.taxNo, preference: c.preference, consent: c.consent }] }] });
  execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/restore.ts', directory, '--confirm-restore'], { env: process.env, stdio: 'pipe' });
  assert.equal((await readState()).state.customers.find(v => v.id === c.id)!.name, c.name);
  if (photo) assert.equal((await storage.download(photo)).error, null);
  const trigger = await db().query("select tgenabled from pg_trigger where tgname='estimate_lines_locked'");
  assert.equal(trigger.rows[0].tgenabled, 'O');
  console.log('Geri yükleme testi geçti: değişmiş müşteri kaydı ve silinmiş test fotoğrafı yedekten döndü; teklif kilidi etkin kaldı.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Yedek testi başarısız.'); process.exitCode = 1; }).finally(() => db().end());
