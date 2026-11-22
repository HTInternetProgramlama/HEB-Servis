import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadConfig } from './env';
import { transaction, db } from '../lib/server/database';
loadConfig();
export async function migrate() {
  await transaction(async client => {
    await client.query("select pg_advisory_xact_lock(hashtext('heb-schema-migration'))");
    await client.query('create table if not exists heb_schema_migrations (name text primary key, checksum text not null, applied_at timestamptz not null default now())');
    await client.query('alter table heb_schema_migrations enable row level security; revoke all on heb_schema_migrations from anon, authenticated');
    for (const name of readdirSync('supabase/migrations').filter(n => n.endsWith('.sql')).sort()) {
      const sql = readFileSync(`supabase/migrations/${name}`, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const prior = (await client.query('select checksum from heb_schema_migrations where name=$1', [name])).rows[0];
      if (prior) { if (prior.checksum !== checksum) throw new Error('Uygulanmış migration değişmiş. Yeni migration dosyası kullanın.'); continue; }
      const cliTable = (await client.query("select to_regclass('supabase_migrations.schema_migrations') as name")).rows[0].name;
      const alreadyApplied = cliTable && (await client.query('select version from supabase_migrations.schema_migrations where version=$1', [name.split('_')[0]])).rowCount;
      if (!alreadyApplied) await client.query(sql);
      await client.query('insert into heb_schema_migrations(name,checksum) values($1,$2)', [name, checksum]);
      console.log(`Şema hazır: ${name}`);
    }
  });
}
if (process.argv[1]?.endsWith('migrate.ts')) migrate().catch(() => { console.error('Migration uygulanamadı. Bağlantıyı ve hedef şemanın durumunu kontrol edin.'); process.exitCode = 1; }).finally(() => db().end());
