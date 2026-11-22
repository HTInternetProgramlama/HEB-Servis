import { spawn, type ChildProcess } from 'node:child_process';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './env';
loadConfig();
const base = 'http://127.0.0.1:3011';
let child: ChildProcess | undefined; let logs = '';
async function start() {
  logs = '';
  child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3011'], { env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout?.on('data', chunk => { logs += chunk; }); child.stderr?.on('data', chunk => { logs += chunk; });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`Test sunucusu kapandı: ${logs}`);
    try { if ((await fetch(base + '/api/session')).status === 401) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('HTTP test sunucusu hazırlanamadı. Derlemeyi ve test ortamını kontrol edin.');
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const done = new Promise(resolve => child!.once('exit', resolve)); child.kill(); await done;
}
type Cookies = Map<string, string>;
function remember(response: Response, jar: Cookies) {
  for (const cookie of response.headers.getSetCookie()) {
    const value = cookie.split(';')[0]; const split = value.indexOf('='); jar.set(value.slice(0, split), value.slice(split + 1));
  }
}
const cookieHeader = (jar: Cookies) => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
async function post(endpoint: string, body: unknown, jar = new Map<string, string>(), origin = base) {
  const response = await fetch(`${base}/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookieHeader(jar) }, body: JSON.stringify(body) });
  remember(response, jar); return response;
}
async function main() {
  if (!process.env.HEB_ENV_FILE || !['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error('HTTP testi için ayrı yerel HEB_ENV_FILE gerekir. Bulut projesinde test verisi oluşturulmaz.');
  try {
    await start();
    const admin: Cookies = new Map(); const customer: Cookies = new Map(); const other: Cookies = new Map();
    assert.equal((await post('login', {}, admin, 'https://example.test')).status, 403);
    assert.equal((await post('login', { email: process.env.HEB_ADMIN_EMAIL, password: 'Yanlış' }, admin)).status, 401);
    const response = await post('login', { email: process.env.HEB_ADMIN_EMAIL, password: process.env.HEB_ADMIN_PASSWORD }, admin);
    assert.equal(response.status, 200, await response.clone().text());
    assert.ok(response.headers.getSetCookie().every(c => /HttpOnly/i.test(c)));
    assert.match(response.headers.get('cache-control')!, /no-store/);
    let state = await response.json();
    const command = { commands: [{ name: 'addCustomer', args: [{ kind: 'Bireysel', name: 'HTTP Kalıcılık Testi', phone: '0555' + String(Date.now()).slice(-7), email: '', address: '', taxNo: '', preference: 'Telefon', consent: true }] }], revision: state.revision, key: randomUUID(), message: 'HTTP testi' };
    const savedResponse = await post('commands', command, admin);
    assert.equal(savedResponse.status, 200, await savedResponse.clone().text());
    state = await savedResponse.json(); const id = state.state.customers.at(-1).id;
    assert.equal((await post('commands', command, admin)).status, 200);
    assert.equal((await post('commands', { ...command, key: randomUUID() }, admin)).status, 409);
    const signedIn = await post('login', { email: 'ayse.demir@ornek.test', password: process.env.HEB_DEMO_PASSWORD }, customer);
    assert.equal(signedIn.status, 200, await signedIn.clone().text());
    const view = await signedIn.json(); assert.equal(view.state.customers.length, 1);
    assert.ok(!JSON.stringify(view).includes('HTTP Kalıcılık Testi'));
    assert.equal((await post('commands', { ...command, revision: state.revision, key: randomUUID(), actor: { role: 'admin' } }, customer)).status, 422);
    await post('login', { email: 'mert.kaya@ornek.test', password: process.env.HEB_DEMO_PASSWORD }, other);
    const job = state.state.jobs.find((j: any) => j.customerId === view.actor.customerId && !['Teslim edildi','İptal'].includes(j.status) && j.inspections.some((i: any) => i.customerVisible));
    const inspection = job.inspections.find((i: any) => i.customerVisible);
    const photo = new FormData(); photo.set('inspectionId', inspection.id);
    photo.set('file', new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4xkAAAAASUVORK5CYII=', 'base64')], 'test.png', { type: 'image/png' }));
    const uploaded = await fetch(base + '/api/photos', { method: 'POST', headers: { Origin: base, Cookie: cookieHeader(admin) }, body: photo });
    assert.equal(uploaded.status, 200, await uploaded.clone().text());
    const signed = await fetch(`${base}/api/photos?inspectionId=${inspection.id}`, { headers: { Cookie: cookieHeader(customer) } });
    assert.equal(signed.status, 200); const signedUrl = (await signed.json()).url;
    assert.equal((await fetch(signedUrl)).status, 200);
    assert.equal((await fetch(`${base}/api/photos?inspectionId=${inspection.id}`, { headers: { Cookie: cookieHeader(other) } })).status, 403);
    const malicious = new FormData(); malicious.set('inspectionId', inspection.id); malicious.set('file', new File(['<svg></svg>'], 'fake.png', { type: 'image/png' }));
    assert.equal((await fetch(base + '/api/photos', { method: 'POST', headers: { Origin: base, Cookie: cookieHeader(admin) }, body: malicious })).status, 415);
    await stop(); await start();
    const persisted = await fetch(base + '/api/session', { headers: { Cookie: cookieHeader(admin) } });
    assert.equal(persisted.status, 200); assert.ok((await persisted.json()).state.customers.some((c: any) => c.id === id));
    assert.equal((await post('logout', {}, admin)).status, 200);
    assert.equal((await fetch(base + '/api/session', { headers: { Cookie: cookieHeader(admin) } })).status, 401);
    console.log('HTTP testleri geçti: Supabase Auth, HttpOnly çerezler, PostgreSQL kalıcılığı, rol sınırları, özel fotoğraf yükleme ve süreli fotoğraf erişimi.');
  } finally { await stop(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'HTTP testi başarısız.'); process.exitCode = 1; });
