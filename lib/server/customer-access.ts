import { randomBytes, randomUUID } from 'node:crypto';
import type { Actor } from '../types';
import { db, transaction } from './database';
import { fail } from './errors';
import { supabaseAdmin, type RequestAuth } from './supabase';

function staff(actor: Actor) {
  if (!['admin', 'advisor'].includes(actor.role)) fail(403, 'Müşteri erişimini yalnız yönetici ve danışman yönetebilir.');
}
function customerId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) return fail(400, 'Geçerli müşteri seçin.');
  return value;
}
export async function customerAccessStatus(actor: Actor, value: unknown) {
  staff(actor);
  const id = customerId(value);
  const account = (await db().query("select id,email,active from profiles where customer_id=$1 and role='customer'", [id])).rows[0];
  const deliveries = (await db().query('select id,email,status,created_at,sent_at from customer_access_deliveries where customer_id=$1 order by created_at desc limit 10', [id])).rows;
  return { account: account ?? null, deliveries };
}

/** Account creation is serialized with ordinary writes. Passwords and email links never enter application data. */
export async function sendCustomerAccess(actor: Actor, value: unknown, origin: string) {
  staff(actor);
  const id = customerId(value);
  const deliveryId = randomUUID();
  let created: string | undefined;
  let email = '';
  try {
    await transaction(async pg => {
      await pg.query('select id from app_control where id=1 for update');
      const customer = (await pg.query('select * from customers where id=$1', [id])).rows[0];
      if (!customer) return fail(404, 'Müşteri bulunamadı.');
      email = String(customer.email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(422, 'Önce müşteri kartına geçerli e-posta girin.');
      if (!(await pg.query('select id from vehicles where customer_id=$1 limit 1', [id])).rowCount) return fail(422, 'Portal açmadan önce müşterinin araç bilgilerini kaydedin.');
      const previous = (await pg.query("select created_at from customer_access_deliveries where customer_id=$1 and created_at>now()-interval '60 seconds' and status in ('sent','pending') limit 1", [id])).rowCount;
      if (previous) return fail(429, 'Yeni erişim e-postası için bir dakika bekleyin.');
      const account = (await pg.query("select * from profiles where customer_id=$1 and role='customer'", [id])).rows[0];
      let userId: string;
      if (account) {
        if (!account.active) return fail(422, 'Portal hesabı pasif. Yönetici önce hesabı etkinleştirmeli.');
        if (account.email.toLowerCase() !== email) return fail(422, 'Portal hesabı e-postası müşteri kartıyla farklı. Yönetici Ayarlar bölümünden hesabın e-postasını eşitlemeli.');
        userId = account.id;
      } else {
        if ((await pg.query('select id from profiles where lower(email)=$1', [email])).rowCount) return fail(422, 'Bu e-posta başka bir hesaba bağlı.');
        const result = await supabaseAdmin().auth.admin.createUser({ email, email_confirm: true, password: randomBytes(32).toString('base64url'), user_metadata: { name: customer.name } });
        if (result.error || !result.data.user) return fail(422, 'Portal hesabı açılamadı. E-posta başka bir Auth hesabında kullanılıyor olabilir.');
        userId = result.data.user.id; created = userId;
        await pg.query("insert into profiles(id,name,email,phone,role,customer_id,active,position) values($1,$2,$3,$4,'customer',$5,true,(select coalesce(max(position),0)+1 from profiles))", [userId, customer.name, email, customer.phone, id]);
        await pg.query('update app_control set revision=revision+1 where id=1');
      }
      await pg.query("insert into customer_access_deliveries(id,customer_id,user_id,email,status,requested_by) values($1,$2,$3,$4,'pending',$5)", [deliveryId, id, userId, email, actor.userId]);
    });
  } catch (error) {
    if (created) await supabaseAdmin().auth.admin.deleteUser(created);
    throw error;
  }
  // No PKCE challenge: an administrator requests this email on a different browser from the customer.
  const sender = supabaseAdmin();
  let sent = false;
  try {
    const { error } = await sender.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/erisim` });
    sent = !error;
  } finally {
    await db().query("update customer_access_deliveries set status=$2,sent_at=case when $2='sent' then now() else null end where id=$1", [deliveryId, sent ? 'sent' : 'failed']);
  }
  if (!sent) return fail(502, 'Hesap hazır, ancak e-posta sağlayıcısı gönderimi kabul etmedi. Adresi ve Supabase e-posta ayarlarını kontrol edip tekrar deneyin.');
  return { ...(await customerAccessStatus(actor, id)), message: 'Şifre oluşturma bağlantısı e-posta sağlayıcısına iletildi. Müşteri e-postasındaki bağlantıdan şifresini belirleyebilir.' };
}

export async function activateCustomerAccess(auth: RequestAuth, body: Record<string, unknown>) {
  const { accessToken, refreshToken, password } = body;
  if (typeof accessToken !== 'string' || accessToken.length > 16000 || typeof refreshToken !== 'string' || refreshToken.length > 4000 || typeof password !== 'string' || password.length < 10 || password.length > 128) return fail(400, 'Geçerli erişim bağlantısı ve 10–128 karakterlik parola gerekli.');
  const session = await auth.client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (session.error || !session.data.user) return fail(401, 'Bağlantının süresi dolmuş. Servisten yeni erişim e-postası isteyin.');
  const profile = (await db().query("select id from profiles where id=$1 and role='customer' and active", [session.data.user.id])).rows[0];
  if (!profile) { await auth.client.auth.signOut({ scope: 'local' }); return fail(403, 'Aktif müşteri hesabı bulunamadı.'); }
  const result = await auth.client.auth.updateUser({ password });
  if (result.error) return fail(422, 'Parola güncellenemedi. Farklı ve güçlü bir parola deneyin.');
  return { ok: true };
}
