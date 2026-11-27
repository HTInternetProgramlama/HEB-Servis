import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from './env';
import { db, readState } from '../lib/server/database';
import { supabaseAdmin } from '../lib/server/supabase';
loadConfig();
export async function backup() {
  const { state, revision } = await readState(undefined, { fullAudit: true });
  const directory = path.resolve('backups', `postgres-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(path.join(directory, 'photos'), { recursive: true });
  const photos = state.jobs.flatMap(j => j.inspections.flatMap(i => i.photoPath ? [i.photoPath] : []));
  for (const photo of [...new Set(photos)]) {
    const { data, error } = await supabaseAdmin().storage.from('service-photos').download(photo);
    if (error || !data) throw new Error('Fotoğraflardan biri indirilemedi; yedek tamamlanmadı.');
    const target = path.resolve(directory, 'photos', photo);
    if (!target.startsWith(path.join(directory, 'photos') + path.sep)) throw new Error('Geçersiz fotoğraf yolu.');
    mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, Buffer.from(await data.arrayBuffer()));
  }
  writeFileSync(path.join(directory, 'application.json'), JSON.stringify({ format: 'heb-postgres-v1', revision, state, photos, createdAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  console.log(`İş verisi ve fotoğraf yedeği: ${directory}`);
  console.log('Auth parolaları sağlayıcıda yönetilir; bu yedek Supabase Auth parolalarını içermez.');
  return directory;
}
if (process.argv[1]?.endsWith('backup.ts')) backup().catch(() => { console.error('Yedek tamamlanamadı. Veritabanı ve Storage erişimini kontrol edin.'); process.exitCode = 1; }).finally(() => db().end());
