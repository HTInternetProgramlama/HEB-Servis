/**
 * Kayıt bazında eşzamanlılık koruması (istemci ve sunucu ortak kullanır).
 *
 * Global revizyon her değişiklikte artar; yalnız ona bakmak, ilgisiz bir kayıt değişse bile
 * herkese 409 döndürür. Bunun yerine istemci, komutun hedef aldığı iş emri/randevunun kendi
 * gördüğü halinin parmak izini gönderir. Sunucu aynı kaydın kullanıcıya görünen güncel halinin
 * parmak izini hesaplar: eşitse komut en güncel duruma uygulanır, farklıysa 409 döner.
 */
import type { Command } from './command-list';
import type { State } from './types';

export type GuardKind = 'job' | 'appointment';
export interface Target { kind: GuardKind; id: string; key: string }
const target = (kind: GuardKind, id: unknown): Target[] => typeof id === 'string' && id ? [{ kind, id, key: `${kind}:${id}` }] : [];

const jobCommands = new Set<Command['name']>(['moveJob', 'reassignJob', 'addInspection', 'toggleInspectionVisibility', 'createEstimateDraft', 'upsertLine', 'removeLine', 'setEstimateNote', 'sendEstimate', 'decideEstimate', 'recordPayment', 'deliverJob']);
const appointmentCommands = new Set<Command['name']>(['confirmAppointment', 'rescheduleAppointment', 'setAppointmentStatus']);

/** Yalnız yeni kayıt ekleyen, mevcut bir kaydın durumuna dayanmayan komutlar. Eklenen kayıt iş kurallarından güncel veride geçer. */
export const appendOnlyCommands = new Set<Command['name']>(['addCustomer', 'addVehicle', 'requestAppointment', 'addNote', 'evaluateVisit', 'evaluateCustomer', 'logReminder', 'recordStockMovement', 'awardTechnician']);
/** Bir kaydın tamamını istemcinin gördüğü haliyle üzerine yazan komutlar: global revizyon birebir tutmalı. */
export const overwriteCommands = new Set<Command['name']>(['updateCustomer', 'updateVehicle', 'editNote', 'upsertCatalog', 'updateSettings', 'upsertUser', 'upsertStockItem']);

export function commandTargets(c: Command): Target[] {
  if (jobCommands.has(c.name)) return target('job', c.args[0]);
  if (appointmentCommands.has(c.name)) return target('appointment', c.args[0]);
  if (c.name === 'openJob') return target('appointment', (c.args[0] as { appointmentId?: unknown } | undefined)?.appointmentId);
  return [];
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(v => v === undefined ? 'null' : stable(v)).join(',')}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`;
}
/** cyrb53: kriptografik değil; amaç değişikliği algılamak. Alan sırasından bağımsızdır. */
function hash(text: string) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) { const ch = text.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
export function fingerprint(state: State, t: Pick<Target, 'kind' | 'id'>): string {
  const entity = t.kind === 'job' ? state.jobs.find(j => j.id === t.id) : state.appointments.find(a => a.id === t.id);
  return entity ? hash(stable(entity)) : 'yok';
}
/** İstemci: gönderilecek komutların hedeflerinin, kullanıcının gördüğü haliyle parmak izleri. */
export function guardsFor(commands: Command[], state: State): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of commands) for (const t of commandTargets(c)) out[t.key] ??= fingerprint(state, t);
  return out;
}
