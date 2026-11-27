import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from './env';
import { backup } from './backup';
import { db, transaction, readState, writeState } from '../lib/server/database';
import { supabaseAdmin } from '../lib/server/supabase';
import { photoType } from '../lib/server/photos';
import type { State } from '../lib/types';
loadConfig();
async function main() {
  const directory = process.argv[2];
  if (!directory || !process.argv.includes('--confirm-restore')) throw new Error('Kullanım: npm run restore -- YEDEK_KLASORU --confirm-restore. Önce uygulama sunucusunu durdurun.');
  const root = realpathSync(directory);
  const payload = JSON.parse(readFileSync(path.join(root, 'application.json'), 'utf8'));
  if (payload.format !== 'heb-postgres-v1' || payload.state?.version !== 3 || !Array.isArray(payload.state.users) || !Array.isArray(payload.photos)) throw new Error('Yedek biçimi tanınmadı.');
  const state = payload.state as State;
  const supabase = supabaseAdmin();
  for (const user of state.users) {
    const { data, error } = await supabase.auth.admin.getUserById(user.id);
    if (error || !data.user) throw new Error('Yedekteki Auth hesapları bu projede yok. Bu araç aynı Supabase projesine iş verisi geri yükler; Auth hesabı taşımaz.');
  }
  for (const photo of payload.photos as string[]) {
    const photoRoot = realpathSync(path.join(root, 'photos'));
    const file = realpathSync(path.resolve(photoRoot, photo));
    if (!file.startsWith(photoRoot + path.sep)) throw new Error('Fotoğraf yolu yedek klasörünün dışında.');
    const bytes = readFileSync(file); const type = photoType(bytes);
    if (!type || bytes.length > 5 * 1024 * 1024) throw new Error('Yedekteki fotoğraf geçersiz.');
    const storage = supabase.storage.from('service-photos');
    const existing = await storage.download(photo);
    if (!existing.error) continue;
    const result = await storage.upload(photo, bytes, { contentType: type.mime, upsert: false });
    if (result.error) throw new Error('Fotoğraf geri yüklenemedi. Veritabanı değiştirilmedi.');
  }
  // Missing immutable objects can be restored first without replacing existing files.
  // Back up the current database and available objects before changing any SQL rows.
  await backup();
  await transaction(async client => {
    await client.query('select id from app_control where id=1 for update');
    const before = await readState(client, { fullAudit: true });
    // Maintenance-only, transactional trigger suspension. A rollback restores the trigger.
    // Foreign keys, CHECK constraints and RLS stay enabled throughout.
    await client.query('alter table estimate_lines disable trigger estimate_lines_locked');
    await client.query('delete from operation_keys');
    await writeState(client, before.state, state, before.revision + 1);
    await client.query('alter table estimate_lines enable trigger estimate_lines_locked');
  });
  console.log('İş verileri ve fotoğraflar geri yüklendi. Supabase Auth parolaları değiştirilmedi.');
}
main().catch(error => { console.error(error instanceof Error && !('code' in error) ? error.message : 'Geri yükleme tamamlanamadı; veritabanı işlemi geri alındı.'); process.exitCode = 1; }).finally(() => db().end());
