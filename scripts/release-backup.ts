// Schema-independent release backup: works before new tables have been migrated.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from './env';
import { db, transaction } from '../lib/server/database';
import { supabaseAdmin } from '../lib/server/supabase';
loadConfig();
async function main() {
  const directory = path.resolve('backups', `release-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const tables = await transaction(async client => {
    const names = (await client.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r => String(r.tablename));
    const rows: Record<string, unknown[]> = {};
    for (const name of names) rows[name] = (await client.query(`select * from public."${name.replace(/"/g, '""')}"`)).rows;
    return rows;
  }, true);
  mkdirSync(path.join(directory, 'photos'), { recursive: true });
  for (const row of (tables.inspections ?? []) as { photo_path?: string }[]) {
    if (!row.photo_path) continue;
    const target = path.resolve(directory, 'photos', row.photo_path);
    if (!target.startsWith(path.join(directory, 'photos') + path.sep)) throw new Error('Geçersiz fotoğraf yolu.');
    const photo = await supabaseAdmin().storage.from('service-photos').download(row.photo_path);
    if (photo.error || !photo.data) throw new Error('Fotoğraf yedeği alınamadı.');
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(await photo.data.arrayBuffer()));
  }
  writeFileSync(path.join(directory, 'tables.json'), JSON.stringify({ format: 'heb-release-tables-v1', createdAt: new Date().toISOString(), tables }, null, 2), { mode: 0o600 });
  console.log(`Yayın öncesi ${Object.keys(tables).length} tablo ve özel fotoğraflar yedeklendi: ${directory}`);
}
main().catch(() => { console.error('Yayın öncesi yedek tamamlanamadı.'); process.exitCode = 1; }).finally(() => db().end());
