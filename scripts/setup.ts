import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadConfig } from './env';
import { migrate } from './migrate';
import { db, transaction, writeState } from '../lib/server/database';
import { supabaseAdmin } from '../lib/server/supabase';
import { seed } from '../lib/seed';
import { databaseSeed } from './seed-data';
loadConfig();
export async function setup() {
  await migrate();
  if ((await db().query('select count(*)::int as n from settings')).rows[0].n > 0) { console.log('Mevcut veriler korundu; ilk kurulum zaten tamamlanmış.'); return; }
  const email = process.env.HEB_ADMIN_EMAIL;
  const password = process.env.HEB_ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /BURAYA/.test(email) || !password || password.length < 10 || /BURAYA/.test(password)) throw new Error('HEB_ADMIN_EMAIL ve en az 10 karakterli HEB_ADMIN_PASSWORD ayarlarını doldurun.');
  const client = supabaseAdmin();
  const ids = new Map<string, string>(); const created: string[] = [];
  const demoPassword = process.env.HEB_DEMO_PASSWORD || randomBytes(18).toString('base64url');
  try {
    for (const u of seed().users) {
      const result = await client.auth.admin.createUser({ email: u.role === 'admin' ? email : u.email, password: u.role === 'admin' ? password : demoPassword, email_confirm: true, user_metadata: { name: u.name, heb_classroom: true } });
      if (result.error || !result.data.user) throw new Error(`Auth hesabı oluşturulamadı (${u.role}). Var olan kullanıcılarla çakışmayı kontrol edin.`);
      ids.set(u.email, result.data.user.id); created.push(result.data.user.id);
    }
    await transaction(async pg => {
      await pg.query('select id from app_control where id=1 for update');
      if ((await pg.query('select count(*)::int as n from settings')).rows[0].n) throw new Error('Başka bir kurulum tamamlandı. Mevcut veriler korunuyor.');
      await writeState(pg, null, databaseSeed(ids, email), 0);
    });
  } catch (error) { for (const id of created) await client.auth.admin.deleteUser(id); throw error; }
  mkdirSync('.work', { recursive: true });
  writeFileSync('.work/demo-access.txt', `Yalnız kurgusal ders hesapları için ortak parola: ${demoPassword}\nYönetici parolası bu dosyaya yazılmaz.\n`, { mode: 0o600 });
  console.log('İlk kurulum tamamlandı: ilişkili PostgreSQL tabloları, 8 Auth hesabı ve özel fotoğraf alanı hazır. Demo erişim bilgileri .work/demo-access.txt dosyasındadır.');
}
if (process.argv[1]?.endsWith('setup.ts')) setup().catch(error => { console.error(error instanceof Error && !('code' in error) ? error.message : 'Kurulum tamamlanamadı. PostgreSQL bağlantısını ve boş proje seçimini kontrol edin.'); process.exitCode = 1; }).finally(() => db().end());
