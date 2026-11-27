import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { db, readState, transaction, writeState } from './database';
import * as rules from '../rules';
import { commandArity, type Command } from '../command-list';
import { AUDIT_WINDOW } from './repository';
import { appendOnlyCommands, commandTargets, fingerprint, overwriteCommands } from '../entity-guard';
import type { Actor, State, User } from '../types';
import { validCommand } from './validation';
import { ApiError, fail } from './errors';
import { supabaseAdmin, type RequestAuth } from './supabase';
export { ApiError } from './errors';

async function actorFor(id: string, client?: PoolClient): Promise<Actor> {
  const result = await (client ?? db()).query('select id,name,role,customer_id from profiles where id=$1 and active', [id]);
  const u = result.rows[0];
  if (!u) return fail(403, 'Aktif kullanıcı profili bulunamadı. Servis yöneticisine başvurun.');
  return { userId: u.id, name: u.name, role: u.role, customerId: u.customer_id ?? undefined };
}
export async function authenticate(auth: RequestAuth): Promise<Actor> {
  const { data, error } = await auth.client.auth.getUser();
  if (error || !data.user) return fail(401, 'Oturum süresi doldu. Yeniden giriş yapın.');
  return actorFor(data.user.id);
}
export async function login(auth: RequestAuth, email: unknown, password: unknown) {
  if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 256) return fail(400, 'E-posta ve parola gerekli.');
  const { data, error } = await auth.client.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) return fail(error?.status === 429 ? 429 : 401, error?.status === 429 ? 'Çok fazla giriş denemesi. Bir süre sonra tekrar deneyin.' : 'E-posta veya parola hatalı.');
  try { return await actorFor(data.user.id); }
  catch (e) { await auth.client.auth.signOut({ scope: 'local' }); throw e; }
}
export async function logout(auth: RequestAuth) {
  const { error } = await auth.client.auth.signOut({ scope: 'local' });
  if (error && error.status !== 403) return fail(502, 'Oturum kapatılamadı. Yeniden deneyin.');
}
/** Filter BEFORE serialization: the browser never receives another customer's records. */
export function visibleState(s: State, a: Actor): State {
  if (a.role === 'admin') return s;
  if (a.role === 'advisor') return { ...s, audit: [] };
  let jobs = s.jobs;
  if (a.role === 'customer') jobs = rules.portalView(s, a).jobs.map(j => ({ ...j, payments: j.payments.map(p => ({ ...p, note: '', key: '' })), history: j.history.map(h => ({ ...h, note: '' })), deliveryNote: '' }));
  // Teknisyen: yalnız atandığı işler. Ödeme, teslim/bakiye açıklaması, müşteri görüşme notu ve teklif taslağı içeriği gönderilmez.
  else jobs = jobs.filter(j => j.technicianId === a.userId).map(j => ({
    ...j, payments: [], deliveryNote: '',
    history: j.history.map(h => h.status === 'Teslim edildi' ? { ...h, note: '' } : h),
    // Taslak sürüm görünür kalır (durum düğmeleri doğru çalışsın) ama kalemleri ve notu gönderilmez.
    estimates: j.estimates.map(e => e.status === 'Taslak' ? { ...e, lines: [], note: '' } : { ...e, decision: e.decision && { ...e.decision, note: '' } }),
  }));
  const customerIds = new Set(jobs.map(j => j.customerId));
  const vehicleIds = new Set(jobs.map(j => j.vehicleId));
  return { ...s, seq: { customer: 0, appointment: 0, job: 0 },
    settings: { ...s.settings, company: { ...s.settings.company, taxNo: '', taxOffice: '' } },
    users: s.users.filter(u => u.id === a.userId),
    customers: s.customers.filter(c => a.role === 'customer' ? c.id === a.customerId : customerIds.has(c.id)).map(c => a.role === 'technician' ? { ...c, phone: '', email: '', address: '', taxNo: '' } : c),
    vehicles: s.vehicles.filter(v => a.role === 'customer' ? v.customerId === a.customerId : vehicleIds.has(v.id)),
    appointments: a.role === 'customer' ? s.appointments.filter(x => x.customerId === a.customerId) : [],
    jobs, notes: [], evaluations: [], catalog: [], reminders: [], audit: [],
    stockItems: [], stockMovements: [],
    technicianAwards: a.role === 'technician' ? (s.technicianAwards ?? []).filter(x => x.technicianId === a.userId) : [],
  };
}
export async function snapshot(a: Actor) {
  const { state, revision } = await readState();
  const user = state.users.find(u => u.id === a.userId && u.active);
  if (!user) return fail(401, 'Aktif oturum bulunamadı.');
  const actor: Actor = { userId: user.id, name: user.name, role: user.role, customerId: user.customerId };
  return { state: visibleState(state, actor), revision, actor };
}
/**
 * Eski revizyonla gelen komut ne zaman en güncel kayda uygulanabilir?
 * - Üzerine yazan düzenlemeler: asla (409).
 * - İş emri/randevu komutları: yalnız hedef kayıt, kullanıcının gördüğü haliyle aynıysa.
 * - Yalnız ekleme yapan komutlar: her zaman; iş kuralları güncel veride yeniden çalışır.
 * Sınıflandırılmamış yeni bir komut güvenli tarafta kalır ve 409 alır.
 */
export function staleConflict(c: Command, guards: Record<string, string>, view: State): string | null {
  if (overwriteCommands.has(c.name)) return 'Düzenlediğiniz kayıt başka bir kullanıcı tarafından değiştirildi. Sayfa güncellendi; değişikliği kontrol edip yeniden kaydedin.';
  if (appendOnlyCommands.has(c.name)) return null;
  const targets = commandTargets(c);
  if (!targets.length && c.name !== 'openJob') return 'Kayıtlar başka bir işlemle değişti. Sayfa güncellendi; işlemi yeniden deneyin.';
  for (const t of targets) if (guards[t.key] !== fingerprint(view, t)) return t.kind === 'job'
    ? 'İşlem yaptığınız iş emri bu arada başka bir kullanıcı tarafından değiştirildi. Sayfa güncellendi; güncel durumu kontrol edip yeniden deneyin.'
    : 'İşlem yaptığınız randevu bu arada değiştirildi. Sayfa güncellendi; güncel durumu kontrol edip yeniden deneyin.';
  return null;
}
const validGuards = (g: unknown): g is Record<string, string> => g === undefined || (!!g && typeof g === 'object' && !Array.isArray(g) && Object.keys(g).length <= 100 && Object.entries(g).every(([k, v]) => k.length <= 80 && typeof v === 'string' && v.length <= 40));
export async function mutate(identity: Actor, body: { commands?: unknown; revision?: unknown; key?: unknown; message?: unknown; ref?: unknown; guards?: unknown }) {
  if (!validGuards(body.guards)) return fail(400, 'Geçersiz işlem isteği.');
  const guards = (body.guards ?? {}) as Record<string, string>;
  if (!Array.isArray(body.commands) || body.commands.length < 1 || body.commands.length > 50 || typeof body.key !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.key) || !Number.isSafeInteger(body.revision)) return fail(400, 'Geçersiz işlem isteği.');
  const commands = body.commands as Command[];
  for (const c of commands) {
    if (!c || !Object.hasOwn(commandArity, c.name) || !Array.isArray(c.args) || c.args.length > commandArity[c.name] || !validCommand(c)) return fail(400, 'Geçersiz komut veya alan.');
    c.args = c.args.map(x => x === null ? undefined : x);
  }
  const fingerprint = createHash('sha256').update(JSON.stringify(commands)).digest('hex');
  const created: string[] = [];
  const emailChanges: { id: string; email: string }[] = [];
  let actor = identity;
  try {
    await transaction(async client => {
      await client.query('select id from app_control where id=1 for update');
      actor = await actorFor(identity.userId, client);
      const current = await readState(client);
      const done = (await client.query('select * from operation_keys where key=$1', [body.key])).rows[0];
      if (done) {
        if (done.user_id !== actor.userId || done.fingerprint !== fingerprint) return fail(409, 'İşlem anahtarı daha önce kullanılmış.');
        return;
      }
      if (current.revision !== body.revision) {
        const view = visibleState(current.state, actor);
        for (const c of commands) { const conflict = staleConflict(c, guards, view); if (conflict) return fail(409, conflict); }
      }
      let next = current.state;
      for (const c of commands) {
        const fn = rules[c.name] as unknown as (s: State, a: Actor, ...args: unknown[]) => State;
        const before = next;
        next = fn(next, actor, ...c.args);
        if (c.name === 'upsertUser') {
          const account = next.users.find(u => !before.users.some(old => old.id === u.id));
          if (account) {
            const { data, error } = await supabaseAdmin().auth.admin.createUser({ email: account.email, email_confirm: true, password: randomBytes(32).toString('base64url'), user_metadata: { name: account.name } });
            if (error || !data.user) return fail(422, 'Auth hesabı açılamadı. E-posta kullanımda olabilir.');
            created.push(data.user.id);
            next = { ...next, users: next.users.map(u => u.id === account.id ? { ...u, id: data.user.id } : u) };
          } else {
            const id = c.args[1] as string;
            const previous = before.users.find(u => u.id === id)!;
            const changed = next.users.find(u => u.id === id)!;
            if (previous.email !== changed.email) {
              const { error } = await supabaseAdmin().auth.admin.updateUserById(id, { email: changed.email });
              if (error) return fail(422, 'Auth e-posta güncellemesi tamamlanamadı.');
              emailChanges.push({ id, email: previous.email });
            }
          }
        }
      }
      const message = typeof body.message === 'string' ? body.message.slice(0, 300) : 'İşlem kaydedildi';
      next = { ...next, audit: [{ id: randomUUID(), at: new Date().toISOString(), by: actor.name, role: actor.role, action: `${commands.map(c => c.name).join(', ')}: ${message}`, ref: typeof body.ref === 'string' ? body.ref.slice(0, 80) : undefined }, ...next.audit].slice(0, AUDIT_WINDOW) };
      await writeState(client, current.state, next, current.revision + 1);
      await client.query('insert into operation_keys(key,user_id,fingerprint,revision) values($1,$2,$3,$4)', [body.key, actor.userId, fingerprint, current.revision + 1]);
    });
  } catch (error) {
    // Compensate only Auth records created/changed by this failed transaction.
    for (const id of created) await supabaseAdmin().auth.admin.deleteUser(id);
    for (const value of emailChanges) await supabaseAdmin().auth.admin.updateUserById(value.id, { email: value.email });
    throw error;
  }
  return snapshot(actor);
}
export async function setPassword(auth: RequestAuth, actor: Actor, userId: unknown, password: unknown, currentPassword?: unknown) {
  if (typeof userId !== 'string' || typeof password !== 'string' || password.length < 10 || password.length > 128) return fail(400, 'Parola 10–128 karakter olmalı.');
  if (actor.role !== 'admin' && actor.userId !== userId) return fail(403, 'Bu işlem için yetkiniz yok.');
  const target = (await db().query('select email from profiles where id=$1', [userId])).rows[0];
  if (!target) return fail(404, 'Kullanıcı bulunamadı.');
  if (actor.role === 'admin') {
    const { error } = await supabaseAdmin().auth.admin.updateUserById(userId, { password });
    if (error) return fail(422, 'Supabase Auth parolayı değiştiremedi.');
  } else {
    if (typeof currentPassword !== 'string' || currentPassword.length > 256) return fail(400, 'Mevcut parola gerekli.');
    const checked = await auth.client.auth.signInWithPassword({ email: target.email, password: currentPassword });
    if (checked.error) return fail(403, 'Mevcut parola hatalı.');
    const { error } = await auth.client.auth.updateUser({ password });
    if (error) return fail(422, 'Parola değiştirilemedi.');
  }
}
