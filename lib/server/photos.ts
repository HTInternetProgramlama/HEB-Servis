import { randomUUID } from 'node:crypto';
import type { Actor } from '../types';
import { fail } from './errors';
import { readState, transaction, writeState } from './database';
import { supabaseAdmin } from './supabase';

function photoJob(state: Awaited<ReturnType<typeof readState>>['state'], actor: Actor, inspectionId: string, write: boolean) {
  const job = state.jobs.find(j => j.inspections.some(i => i.id === inspectionId));
  if (!job) return fail(404, 'Kontrol bulgusu bulunamadı.');
  const inspection = job.inspections.find(i => i.id === inspectionId)!;
  if (actor.role === 'customer' && (write || job.customerId !== actor.customerId || !inspection.customerVisible)) return fail(403, 'Bu fotoğrafa erişiminiz yok.');
  if (actor.role === 'technician' && job.technicianId !== actor.userId) return fail(403, 'Yalnız size atanan işlere erişebilirsiniz.');
  if (write && ['Teslim edildi', 'İptal'].includes(job.status)) return fail(422, 'Kapanmış işe fotoğraf eklenemez.');
  return { job, inspection };
}
export function photoType(bytes: Uint8Array): { mime: string; extension: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: 'image/jpeg', extension: 'jpg' };
  if (Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime: 'image/png', extension: 'png' };
  if (Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF' && Buffer.from(bytes.subarray(8, 12)).toString() === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
  return null;
}
export async function uploadPhoto(actor: Actor, form: FormData) {
  const inspectionId = form.get('inspectionId'); const file = form.get('file');
  if (typeof inspectionId !== 'string' || !(file instanceof File)) return fail(400, 'Bulgu ve fotoğraf seçin.');
  if (!file.size || file.size > 5 * 1024 * 1024) return fail(413, 'Fotoğraf en fazla 5 MB olabilir.');
  const bytes = new Uint8Array(await file.arrayBuffer()); const type = photoType(bytes);
  if (!type) return fail(415, 'Yalnız JPEG, PNG veya WebP fotoğraf yüklenebilir.');
  const { job } = photoJob((await readState()).state, actor, inspectionId, true);
  const path = `${job.id}/${inspectionId}/${randomUUID()}.${type.extension}`;
  const storage = supabaseAdmin().storage.from('service-photos');
  const uploaded = await storage.upload(path, bytes, { contentType: type.mime, upsert: false });
  if (uploaded.error) return fail(502, 'Fotoğraf özel dosya alanına yüklenemedi.');
  try {
    await transaction(async client => {
      await client.query('select id from app_control where id=1 for update');
      const profile = (await client.query('select role from profiles where id=$1 and active', [actor.userId])).rows[0];
      if (!profile || profile.role !== actor.role) return fail(403, 'Kullanıcı yetkisi değişti. Yeniden giriş yapın.');
      const current = await readState(client);
      photoJob(current.state, actor, inspectionId, true);
      const next = { ...current.state,
        jobs: current.state.jobs.map(j => j.id !== job.id ? j : { ...j, inspections: j.inspections.map(i => i.id === inspectionId ? { ...i, photoPath: path } : i) }),
        audit: [{ id: randomUUID(), at: new Date().toISOString(), by: actor.name, role: actor.role, action: 'Kontrol bulgusuna fotoğraf eklendi', ref: job.no }, ...current.state.audit].slice(0, 1000),
      };
      await writeState(client, current.state, next, current.revision + 1);
    });
  } catch (error) { await storage.remove([path]); throw error; }
}
export async function signedPhoto(actor: Actor, inspectionId: string) {
  const { inspection } = photoJob((await readState()).state, actor, inspectionId, false);
  if (!inspection.photoPath) return fail(404, 'Bu bulguda fotoğraf yok.');
  const { data, error } = await supabaseAdmin().storage.from('service-photos').createSignedUrl(inspection.photoPath, 300);
  if (error || !data.signedUrl) return fail(502, 'Fotoğraf bağlantısı oluşturulamadı.');
  return { url: data.signedUrl, expiresIn: 300 };
}
