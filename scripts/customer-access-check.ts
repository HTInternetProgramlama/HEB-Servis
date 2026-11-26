/** Local-only HTTP + email + browser acceptance checks. Never prints credentials or recovery URLs. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from './env';
import { db } from '../lib/server/database';
import { migrate } from './migrate';

const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3002';
const mailboxBase = 'http://127.0.0.1:54324';
type Jar = Map<string, string>;
const jars: Jar[] = [];
function local(value: string | undefined) { return !!value && ['localhost', '127.0.0.1'].includes(new URL(value).hostname); }
async function request(path: string, jar: Jar = new Map(), body?: unknown, origin = base) {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { Cookie: [...jar].map(([k,v]) => `${k}=${v}`).join('; '), ...(body === undefined ? {} : { Origin: origin, 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  for (const cookie of response.headers.getSetCookie()) { const first = cookie.split(';')[0], i = first.indexOf('='); jar.set(first.slice(0,i), first.slice(i+1)); }
  return response;
}
async function login(email: string, password: string) {
  const jar: Jar = new Map(); jars.push(jar);
  assert.equal((await request('/api/login', jar, { email, password })).status, 200, 'Yerel rol girişi');
  return jar;
}
function playwright() {
  const require = createRequire(import.meta.url);
  if (process.env.QA_PLAYWRIGHT_PATH) return require(process.env.QA_PLAYWRIGHT_PATH);
  const cache = join(process.env.LOCALAPPDATA!, 'npm-cache', '_npx');
  for (const name of readdirSync(cache)) { const p = join(cache, name, 'node_modules', 'playwright'); if (existsSync(join(p, 'package.json'))) return require(p); }
  throw new Error('Playwright bulunamadı; QA_PLAYWRIGHT_PATH ayarlayın.');
}
async function main() {
  assert.ok(process.env.HEB_ENV_FILE, 'Ayrı HEB_ENV_FILE gerekli.'); loadConfig();
  assert.ok([base, process.env.DATABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL].every(local), 'Test yalnız yerel uygulama/veritabanı/Auth kabul eder.');
  await migrate();
  const suffix = Date.now().toString(), mailbox = `qa-access-${suffix}`, email = `${mailbox}@example.test`;
  const fixture = randomUUID(), noVehicle = randomUUID(), noEmail = randomUUID();
  for (const [i,id] of [fixture,noVehicle,noEmail].entries()) {
    await db().query("insert into customers(id,no,kind,name,phone,email,preference,consent) values($1,$2,'Bireysel','QA Kurgusal Erişim',$3,$4,'E-posta',true)", [id, `QA-${suffix}-${i}`, `059${suffix.slice(-7)}${i}`, id === noEmail ? '' : id === fixture ? email : `qa-no-car-${suffix}@example.test`]);
  }
  await db().query("insert into vehicles(customer_id,plate,brand,model,year,km,fuel,transmission,color) values($1,$2,'Fiat','Egea',2022,50000,'Dizel','Manuel','Beyaz')", [fixture, `58QA${suffix.slice(-5)}`]);
  const admin = await login(process.env.HEB_ADMIN_EMAIL!, process.env.HEB_ADMIN_PASSWORD!);
  const demo = process.env.HEB_DEMO_PASSWORD!;
  const advisor = await login('selin@hebservis.test', demo);
  const tech = await login('ahmet@hebservis.test', demo);
  const customer = await login('ayse.demir@ornek.test', demo);
  const endpoint = `/api/customer-access?customerId=${fixture}`;
  assert.equal((await request(endpoint)).status, 401);
  for (const jar of [tech,customer]) {
    assert.equal((await request(endpoint, jar)).status, 403);
    assert.equal((await request('/api/customer-access', jar, {customerId:fixture})).status, 403);
  }
  assert.equal((await request('/api/customer-access', admin, {customerId:fixture}, 'https://other.test')).status, 403);
  assert.equal((await request('/api/customer-access', admin, {customerId:noVehicle})).status, 422);
  assert.equal((await request('/api/customer-access', admin, {customerId:noEmail})).status, 422);
  assert.equal((await request('/api/customer-access', admin, {customerId:'invalid'})).status, 400);
  assert.equal((await request('/api/customer-access', admin, {customerId:randomUUID()})).status, 404);
  console.log('PASS: roller, Origin, müşteri/e-posta/araç önkoşulları');
  const sent = await request('/api/customer-access', admin, {customerId:fixture});
  assert.equal(sent.status, 200, 'Erişim e-postası sağlayıcıya iletilmeli');
  const status = await (await request(endpoint, advisor)).json();
  assert.equal(status.account.email, email); assert.equal(status.deliveries[0].status, 'sent');
  assert.equal((await request('/api/customer-access', advisor, {customerId:fixture})).status, 429);
  assert.equal((await db().query('select id from profiles where customer_id=$1', [fixture])).rowCount, 1);
  assert.equal((await db().query('select id from customer_access_deliveries where customer_id=$1', [fixture])).rowCount, 1);
  console.log('PASS: hesap açma, danışman durum/geçmiş erişimi ve mükerrer gönderim engeli');
  let messages: any[] = [], mailpit = false;
  for (let i=0;i<30;i++) {
    const r=await fetch(`${mailboxBase}/api/v1/messages`);
    if(r.ok) { mailpit=true; const data=await r.json(); messages=data.messages.filter((m:any)=>m.To?.some((to:any)=>to.Address===email)); }
    else { const legacy=await fetch(`${mailboxBase}/api/v1/mailbox/${mailbox}`); if(legacy.ok)messages=await legacy.json(); }
    if(messages.length)break; await new Promise(r=>setTimeout(r,200));
  }
  assert.ok(messages.length, 'Yerel Mailpit/Inbucket e-postayı almalı');
  const message = await (await fetch(mailpit ? `${mailboxBase}/api/v1/message/${messages[0].ID}` : `${mailboxBase}/api/v1/mailbox/${mailbox}/${messages[0].id}`)).json();
  const content = mailpit ? message.HTML || message.Text : message.body.html || message.body.text;
  const recovery = String(content).match(/https?:\/\/[^\s"<>]+\/auth\/v1\/verify\?[^\s"<>]+/)?.[0]?.replace(/&amp;/g,'&');
  assert.ok(recovery, 'E-postada recovery bağlantısı olmalı'); assert.ok(local(recovery), 'Recovery bağlantısı yerel olmalı');
  const password = randomBytes(20).toString('base64url');
  const { chromium } = playwright();
  const executablePath = process.env.QA_CHROMIUM_PATH || join(process.env.LOCALAPPDATA!, 'ms-playwright/chromium-1234/chrome-win64/chrome.exe');
  const browser = await chromium.launch({ headless:true, executablePath });
  try {
    const context = await browser.newContext(), page = await context.newPage(); page.setDefaultTimeout(15000);
    await page.goto(recovery, { waitUntil:'domcontentloaded', timeout:20000 });
    await page.waitForURL(base + '/erisim', {timeout:15000});
    const input=page.locator('input[name=password]'); await input.waitFor();
    await input.fill(password); await page.locator('input[name=repeat]').fill(password+'different');
    await page.getByRole('button',{name:'Şifremi kaydet'}).click(); await page.getByRole('alert').filter({hasText:'Şifreler aynı olmalı'}).waitFor();
    await page.locator('input[name=repeat]').fill(password); await page.getByRole('button',{name:'Şifremi kaydet'}).click();
    await page.getByRole('status').filter({hasText:'Şifreniz kaydedildi'}).waitFor();
    assert.ok(!page.url().includes('#'), 'Token adres çubuğundan temizlenmeli');
    const session=await context.request.get(base+'/api/session'); assert.equal(session.status(),200);
    const data=await session.json(); assert.equal(data.actor.role,'customer'); assert.equal(data.state.customers.length,1); assert.equal(data.state.customers[0].id,fixture);
    assert.ok((await context.cookies()).filter((c: {name:string})=>c.name.includes('auth')).every((c: {httpOnly:boolean})=>c.httpOnly));
    await page.goto(base+'/raporlar',{waitUntil:'domcontentloaded'}); await page.waitForURL(base+'/portal');
    console.log('PASS: Inbucket → gerçek recovery bağlantısı → şifre formu → HttpOnly oturum → izole müşteri portalı');
    await page.goto(base+'/erisim',{waitUntil:'domcontentloaded'});
    await page.getByRole('alert').filter({hasText:'Erişim bağlantısı eksik'}).waitFor(); assert.equal(await page.locator('input[name=password]').isDisabled(),true);
  } finally { await browser.close(); }
  const newCustomer=await login(email,password);
  assert.equal((await request('/api/customer-access',newCustomer,{customerId:fixture})).status,403);
  assert.equal((await request('/api/customer-access/activate',new Map(),{accessToken:'invalid',refreshToken:'invalid',password:'short'})).status,400);
  console.log('PASS: yeni parola ile giriş, müşteri erişim yönetimi yasağı, geçersiz/eksik bağlantı');
}
main().catch(error=>{ console.error(error instanceof Error ? error.message.replace(/https?:\/\/[^\s"<>]+/g,'[URL]').replace(/(?:access_token|refresh_token|token)=[^\s&]+/g,'token=[redacted]') : 'Yerel erişim testi başarısız.');process.exitCode=1; }).finally(async()=>{ for(const jar of jars)try{await request('/api/logout',jar,{})}catch{} await db().end(); });
