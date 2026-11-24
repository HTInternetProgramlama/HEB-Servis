import { NextRequest, NextResponse } from 'next/server';
import { ApiError, authenticate, login, logout, mutate, setPassword, snapshot } from '@/lib/server/service';
import { requestAuth, type RequestAuth } from '@/lib/server/supabase';
import { signedPhoto, uploadPhoto } from '@/lib/server/photos';
import { aiStatus, aiUsage, assist, technicalDraft } from '@/lib/server/ai';
import { RuleError } from '@/lib/rules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  let auth: RequestAuth | undefined;
  const respond = (data: unknown, status = 200) => { const r = json(data, status); return auth ? auth.finish(r) : r; };
  try {
    const path = (await context.params).path.join('/');
    auth = requestAuth(request);
    if (request.method === 'GET') {
      const actor = await authenticate(auth);
      if (path === 'session') return respond(await snapshot(actor));
      if (path === 'ai/usage') return respond(await aiUsage(actor));
      if (path === 'ai/status') return respond(await aiStatus(actor));
      if (path === 'photos') return respond(await signedPhoto(actor, request.nextUrl.searchParams.get('inspectionId') || ''));
      throw new ApiError(404, 'Uç nokta bulunamadı.');
    }
    const origin = request.headers.get('origin');
    const expectedOrigin = `${request.nextUrl.protocol}//${request.headers.get('host')}`;
    if (!origin || origin !== expectedOrigin) throw new ApiError(403, 'İstek kaynağı doğrulanamadı.');
    const length = Number(request.headers.get('content-length') || 0);
    if (length > (path === 'photos' ? 5 * 1024 * 1024 + 8192 : 256000)) throw new ApiError(413, 'İstek çok büyük.');
    if (path === 'photos') {
      const actor = await authenticate(auth);
      await uploadPhoto(actor, await request.formData()); return respond(await snapshot(actor));
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 256000) throw new ApiError(413, 'İstek çok büyük.');
    let body;
    try { body = JSON.parse(raw); } catch { throw new ApiError(400, 'Geçersiz JSON.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'Geçersiz istek.');
    if (path === 'login') return respond(await snapshot(await login(auth, body.email, body.password)));
    if (path === 'logout') { await logout(auth); return respond({ ok: true }); }
    const actor = await authenticate(auth);
    if (path === 'commands') return respond(await mutate(actor, body));
    if (path === 'ai/technical') return respond(await technicalDraft(actor, body.jobId));
    if (path === 'ai/assist') return respond(await assist(actor, body));
    if (path === 'password') { await setPassword(auth, actor, body.userId, body.password, body.currentPassword); return respond({ ok: true }); }
    throw new ApiError(404, 'Uç nokta bulunamadı.');
  } catch (e) {
    if (e instanceof ApiError) return respond({ error: e.message }, e.status);
    if (e instanceof RuleError) return respond({ error: e.message }, 422);
    const code = e && typeof e === 'object' && 'code' in e ? String(e.code) : '';
    if (code === '23P01') return respond({ error: 'Seçilen servis alanında randevu çakışması var.' }, 409);
    if (code === '23505') return respond({ error: 'Bu kayıt veya işlem anahtarı zaten kullanılıyor.' }, 409);
    if (['23503', '23514', '22P02'].includes(code)) return respond({ error: 'İlişkili kayıtları ve alan değerlerini kontrol edin.' }, 422);
    if (e instanceof TypeError || e instanceof RangeError) return respond({ error: 'Alanları kontrol edin; istek biçimi geçersiz.' }, 400);
    console.error('HEB API hatası:', code || (e instanceof Error ? e.name : 'Unknown'));
    return respond({ error: 'Sunucu işlemi tamamlayamadı. PostgreSQL ve Supabase bağlantısını kontrol edin.' }, 503);
  }
}
export const GET = handle;
export const POST = handle;
