// Starts `next dev` against the local Supabase test stack (.env.test.local) on port 3002.
// Process env wins over .env.local, so the cloud project is never touched.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const env = { ...process.env };
for (const line of readFileSync('.env.test.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].startsWith('"') ? JSON.parse(m[2]) : m[2];
}
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3002'], { env, stdio: 'inherit' });
child.on('exit', code => process.exit(code ?? 0));
