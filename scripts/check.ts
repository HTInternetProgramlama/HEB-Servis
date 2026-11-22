import { loadConfig } from './env';
import { db } from '../lib/server/database';
import { supabaseAdmin } from '../lib/server/supabase';
loadConfig();
async function main() {
  const fields = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'DATABASE_URL', 'DATABASE_PASSWORD', 'HEB_ADMIN_EMAIL', 'HEB_ADMIN_PASSWORD'];
  let missing = false;
  for (const field of fields) {
    const value = process.env[field];
    const ready = !!value && !/BURAYA|PROJE_REF|SESSION_POOLER_HOST/.test(value);
    console.log(`${field}: ${ready ? 'doldurulmuş' : 'eksik'}`); if (!ready) missing = true;
  }
  if (missing) { process.exitCode = 1; return; }
  const result = await db().query("select current_setting('server_version') as version, to_regclass('public.app_control') as schema");
  console.log(`PostgreSQL bağlantısı başarılı (${result.rows[0].version}). Şema: ${result.rows[0].schema ? 'kurulu' : 'kurulum bekliyor'}`);
  const { error } = await supabaseAdmin().auth.admin.listUsers({ perPage: 1 });
  if (error) throw new Error('Supabase Auth erişimi doğrulanamadı. Secret key alanını kontrol edin.');
  console.log('Supabase Auth yönetim bağlantısı başarılı. Gizli değerler çıktıya yazılmadı.');
}
main().catch(error => {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  console.error(code ? `Bağlantı doğrulanamadı (${code}).` : error instanceof Error && !('code' in error) ? error.message : 'Bağlantı doğrulanamadı.'); process.exitCode = 1;
}).finally(async () => { if (process.env.DATABASE_URL && !/BURAYA|PROJE_REF|SESSION_POOLER_HOST/.test(process.env.DATABASE_URL)) await db().end(); });
