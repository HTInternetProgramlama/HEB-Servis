/** Provision named classroom accounts without changing the personal administrator. */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadConfig } from './env';
import { db, transaction } from '../lib/server/database';
import { supabaseAdmin } from '../lib/server/supabase';
import type { Role } from '../lib/types';
loadConfig();
const specs: { name: string; email: string; role: Role }[] = [
  { name: 'Demo Yönetici', email: 'yonetici@hebservis.test', role: 'admin' },
  { name: 'Selin Arslan', email: 'selin@hebservis.test', role: 'advisor' },
  { name: 'Burak Çelik', email: 'burak@hebservis.test', role: 'advisor' },
  { name: 'Ahmet Yılmaz', email: 'ahmet@hebservis.test', role: 'technician' },
  { name: 'Mehmet Kaya', email: 'mehmet@hebservis.test', role: 'technician' },
  { name: 'Emre Demir', email: 'emre@hebservis.test', role: 'technician' },
  { name: 'Ayşe Demir', email: 'ayse.demir@ornek.test', role: 'customer' },
  { name: 'Mert Kaya', email: 'mert.kaya@ornek.test', role: 'customer' },
  { name: 'Zeynep Koç', email: 'zeynep.koc@ornek.test', role: 'customer' },
];
const labels: Record<Role, string> = { admin: 'Yönetici', advisor: 'Danışman', technician: 'Teknisyen', customer: 'Müşteri' };
async function main() {
  const apply = process.argv.includes('--apply');
  if (!apply) { console.log(JSON.stringify({ mode: 'dry-run', accounts: specs.map(s => ({ email: s.email, role: s.role })) })); return; }
  if (!['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname) && !process.argv.includes('--allow-cloud')) throw new Error('Bulut için --allow-cloud gerekli.');
  mkdirSync('.work', { recursive: true });
  const passwordFile = '.work/role-account-passwords.json';
  const passwords: Record<string, string> = existsSync(passwordFile) ? JSON.parse(readFileSync(passwordFile, 'utf8')) : {};
  const originalPassword = existsSync('.work/demo-access.txt') ? readFileSync('.work/demo-access.txt', 'utf8').match(/parola:\s*(\S+)/)?.[1] : undefined;
  for (const spec of specs) {
    let profile = (await db().query('select * from profiles where lower(email)=$1', [spec.email])).rows[0];
    if (profile && (profile.role !== spec.role || !profile.active)) throw new Error(`Rol veya aktiflik farklı: ${spec.email}`);
    let password = passwords[spec.email] || (profile ? originalPassword : undefined);
    if (profile && password) {
      const probe = await supabaseAdmin().auth.signInWithPassword({ email: spec.email, password });
      if (!probe.error) { passwords[spec.email] = password; await supabaseAdmin().auth.admin.signOut(probe.data.session!.access_token, 'local'); continue; }
      if (probe.error.code !== 'invalid_credentials') throw new Error(`Giriş denetlenemedi: ${spec.email} (${probe.error.code || 'unknown'})`);
    }
    password = 'HEB-' + randomBytes(15).toString('base64url');
    // Save the generated credential locally BEFORE provisioning; never print or commit it.
    passwords[spec.email] = password;
    writeFileSync(passwordFile, JSON.stringify(passwords, null, 2), { mode: 0o600 });
    if (profile) {
      const result = await supabaseAdmin().auth.admin.updateUserById(profile.id, { password });
      if (result.error) throw new Error(`Demo parola belirlenemedi: ${spec.email}`);
    } else {
      let created: string | undefined;
      try {
        await transaction(async pg => {
          await pg.query('select id from app_control where id=1 for update');
          if ((await pg.query('select id from profiles where lower(email)=$1', [spec.email])).rowCount) throw new Error('Eşzamanlı hesap değişikliği; yeniden deneyin.');
          const customer = spec.role === 'customer' ? (await pg.query('select id,phone from customers where lower(email)=$1', [spec.email])).rows[0] : undefined;
          if (spec.role === 'customer' && !customer) throw new Error(`Müşteri kaydı gerekli: ${spec.email}`);
          const result = await supabaseAdmin().auth.admin.createUser({ email: spec.email, password, email_confirm: true, user_metadata: { name: spec.name, heb_classroom: true } });
          if (result.error || !result.data.user) throw new Error(`Demo hesap oluşturulamadı: ${spec.email}`);
          created = result.data.user.id;
          await pg.query('insert into profiles(id,name,email,phone,role,customer_id,active,position) values($1,$2,$3,$4,$5,$6,true,(select coalesce(max(position),0)+1 from profiles))', [created, spec.name, spec.email, customer?.phone ?? '', spec.role, customer?.id ?? null]);
          await pg.query('update app_control set revision=revision+1 where id=1');
        });
      } catch (error) { if (created) await supabaseAdmin().auth.admin.deleteUser(created); throw error; }
      profile = (await db().query('select * from profiles where lower(email)=$1', [spec.email])).rows[0];
    }
    const probe = await supabaseAdmin().auth.signInWithPassword({ email: spec.email, password });
    if (probe.error || probe.data.user.id !== profile.id) throw new Error(`Demo giriş doğrulanamadı: ${spec.email}`);
    await supabaseAdmin().auth.admin.signOut(probe.data.session!.access_token, 'local');
  }
  writeFileSync(passwordFile, JSON.stringify(passwords, null, 2), { mode: 0o600 });
  const rows = specs.map(s => `${labels[s.role]} | ${s.name} | ${s.email} | ${passwords[s.email]}`);
  writeFileSync('.work/HEB-Test-Hesaplari.txt', ['HEB Servis - Test Hesapları', 'Giriş: https://heb-servis.vercel.app/giris', '', 'Rol | Ad | E-posta | Şifre', ...rows, '', '.test adresleri kurgusaldır, e-posta almaz. Bu hesaplara yukarıdaki şifrelerle giriş yapılır.', 'Kişisel yönetici hesabının parolası değiştirilmedi.', 'Bu dosya ve parola eşlemesi yalnız yerel .work altında tutulur, Git ile yayımlanmaz.'].join('\n'), { mode: 0o600 });
  console.log(`${specs.length} ders hesabının Auth girişi doğrulandı. Yerel liste: .work/HEB-Test-Hesaplari.txt`);
}
main().catch(e => { console.error(e instanceof Error ? e.message : 'Demo hesap kurulumu tamamlanamadı.'); process.exitCode = 1; }).finally(() => db().end());
