import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const values = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY || status.ANON_KEY,
  SUPABASE_SECRET_KEY: status.SECRET_KEY || status.SERVICE_ROLE_KEY,
  DATABASE_URL: status.DB_URL, DATABASE_PASSWORD: 'postgres',
  HEB_ADMIN_EMAIL: 'admin@hebservis.test', HEB_ADMIN_PASSWORD: 'LocalAdmin2026!', HEB_DEMO_PASSWORD: 'LocalDemo2026!',
};
if (Object.values(values).some(v => !v)) throw new Error('Yerel Supabase bilgileri eksik.');
writeFileSync('.env.test.local', Object.entries(values).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join('\n') + '\n', { mode: 0o600 });
console.log('Ayrı yerel test ayarları hazırlandı. Bulut bağlantı dosyası değiştirilmedi.');
