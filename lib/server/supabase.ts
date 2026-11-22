import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import { fail } from './errors';

function setting(name: string) {
  const value = process.env[name];
  if (!value || /BURAYA|YOUR_|REPLACE_|placeholder/i.test(value)) return fail(503, 'Supabase kurulumu tamamlanmadı. Bağlantı ayarlarını kontrol edin.');
  return value;
}
export function supabaseAdmin() {
  return createClient(setting('NEXT_PUBLIC_SUPABASE_URL'), setting('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function requestAuth(request: NextRequest) {
  const cookies: { name: string; value: string; options: CookieOptions }[] = [];
  const headers: Record<string, string> = {};
  const client = createServerClient(setting('NEXT_PUBLIC_SUPABASE_URL'), setting('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', path: '/' },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, cacheHeaders) {
        values.forEach(value => { request.cookies.set(value.name, value.value); cookies.push(value); });
        Object.assign(headers, cacheHeaders);
      },
    },
  });
  return { client, finish(response: NextResponse) {
    cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return response;
  } };
}
export type RequestAuth = ReturnType<typeof requestAuth>;
