import { Pool, types, type PoolClient } from 'pg';
import { SUPABASE_ROOT_CA } from './supabase-ca';
import { fail } from './errors';
import { readRelationalState, writeRelationalState } from './repository';
import type { State } from '../types';

types.setTypeParser(20, value => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new RangeError('Veritabanındaki sayı güvenli aralığı aşıyor.');
  return n;
});
types.setTypeParser(1082, value => value);
let connection: Pool | undefined;
export function db() {
  if (connection) return connection;
  const configured = process.env.DATABASE_URL;
  if (!configured || /BURAYA|YOUR_|REPLACE_|PROJE_REF|SESSION_POOLER/i.test(configured)) return fail(503, 'PostgreSQL bağlantısı henüz yapılandırılmadı.');
  const parsed = new URL(configured.replace('[YOUR-PASSWORD]', ''));
  // The separate field is authoritative; URL.password also percent-encodes special characters.
  if (process.env.DATABASE_PASSWORD) parsed.password = process.env.DATABASE_PASSWORD;
  const url = parsed.toString();
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  connection = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10000, idleTimeoutMillis: 20000,
    ...(local ? {} : { ssl: { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n') || SUPABASE_ROOT_CA } }),
  });
  connection.on('error', () => console.error('PostgreSQL bağlantısı kapandı. Sonraki istek yeni bağlantı açacak.'));
  return connection;
}
export async function transaction<T>(work: (client: PoolClient) => Promise<T>, readOnly = false): Promise<T> {
  const client = await db().connect();
  try {
    await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
    const result = await work(client);
    await client.query('COMMIT'); return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function readState(client?: PoolClient, options: { fullAudit?: boolean } = {}): Promise<{ state: State; revision: number }> {
  if (client) return readRelationalState(client, options);
  // Tek SELECT ifadesi PostgreSQL'de tutarlı bir anlık görüntü okur; BEGIN/COMMIT iki gidiş-dönüş daha ekler.
  return readRelationalState(db(), options);
}
export async function writeState(client: PoolClient, before: State | null, next: State, revision: number) {
  await writeRelationalState(client, before, next);
  await client.query('UPDATE app_control SET revision=$1,seq_customer=$2,seq_appointment=$3,seq_job=$4 WHERE id=1', [revision, next.seq.customer, next.seq.appointment, next.seq.job]);
}
