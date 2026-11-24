import { amountDue, approvedEstimate, estimateTotals, serviceName, technicians } from './rules';
import { addDays, daysBetween, isoDay } from './format';
import type { PaymentMethod, State } from './types';

/* Rapor ölçümleri. Atölye yazılımlarındaki "gün sonu", "teknisyen özeti" ve "satış özeti"
   raporlarının karşılığı: araç sayısı, ortalama iş emri tutarı, parça/işçilik ayrımı,
   tahsilat yöntemleri, teklif kapanma oranı, zamanında teslim. İç notlar ve puanlar dahil edilmez. */

export type ReportKind = 'yonetim' | 'gunsonu' | 'teknisyen' | 'musteri';
export const reportKinds: { id: ReportKind; title: string; sub: string }[] = [
  { id: 'yonetim', title: 'Yönetim raporu', sub: 'Dönem özeti, gelir kırılımı, eğilim ve hizmet dağılımı' },
  { id: 'gunsonu', title: 'Gün sonu raporu', sub: 'Kasa kapanışı: tahsilat yöntemleri, teslimler, açık bakiye' },
  { id: 'teknisyen', title: 'Teknisyen verimliliği', sub: 'İş adedi, işçilik geliri, süre ve zamanında teslim' },
  { id: 'musteri', title: 'Müşteri ve araç analizi', sub: 'Yeni/dönen müşteri, marka dağılımı, bulgu sağlığı' },
];

const hours = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 3600000;

function period(state: State, from: string, to: string) {
  const inRange = (iso?: string) => !!iso && isoDay(iso) >= from && isoDay(iso) <= to;
  const delivered = state.jobs.filter(j => j.status === 'Teslim edildi' && inRange(j.deliveredAt));
  const opened = state.jobs.filter(j => inRange(j.createdAt));
  const revenue = delivered.reduce((s, j) => s + amountDue(j), 0);
  const payments = state.jobs.flatMap(j => j.payments.map(p => ({ ...p, jobId: j.id }))).filter(p => inRange(p.at));
  const collected = payments.reduce((s, p) => s + p.amount, 0);
  const totals = delivered.map(j => approvedEstimate(j)).filter(Boolean).map(e => estimateTotals(e!));
  const sum = (k: 'parts' | 'labor' | 'discount' | 'vat') => totals.reduce((s, t) => s + t[k], 0);
  const decided = state.jobs.flatMap(j => j.estimates).filter(e => e.decision && inRange(e.decision.at));
  const approved = decided.filter(e => e.decision!.result === 'Onaylandı');
  const durations = delivered.map(j => hours(j.createdAt, j.deliveredAt!));
  const onTime = delivered.filter(j => new Date(j.deliveredAt!).getTime() <= new Date(j.promisedAt).getTime() + 30 * 60000).length;
  const appts = state.appointments.filter(a => a.date >= from && a.date <= to);
  return {
    inRange, delivered, opened, revenue, payments, collected,
    parts: sum('parts'), labor: sum('labor'), discount: sum('discount'), vat: sum('vat'),
    aro: delivered.length ? Math.round(revenue / delivered.length) : 0,
    closeRate: decided.length ? approved.length / decided.length : 0,
    decided: decided.length,
    avgHours: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    onTimeRate: delivered.length ? onTime / delivered.length : 0,
    appts: appts.length, noShow: appts.filter(a => a.status === 'Gelmedi').length,
  };
}

export function buildReport(state: State, from: string, to: string) {
  const cur = period(state, from, to);
  const span = daysBetween(from, to) + 1;
  const prev = period(state, addDays(from, -span), addDays(from, -1));
  const days = Array.from({ length: span }, (_, i) => addDays(from, i));
  const daily = days.map(d => ({
    d,
    revenue: cur.delivered.filter(j => isoDay(j.deliveredAt!) === d).reduce((s, j) => s + amountDue(j), 0),
    collected: cur.payments.filter(p => isoDay(p.at) === d).reduce((s, p) => s + p.amount, 0),
  }));
  const methods = (['Kredi kartı', 'Nakit', 'Havale/EFT'] as PaymentMethod[]).map(m => {
    const ps = cur.payments.filter(p => p.method === m);
    return { label: m, value: ps.reduce((s, p) => s + p.amount, 0), count: ps.length };
  });
  const byService = state.settings.services.map(s => {
    const js = cur.delivered.filter(j => j.serviceId === s.id);
    return { label: s.name, count: js.length, value: js.reduce((t, j) => t + amountDue(j), 0) };
  }).filter(r => r.count).sort((a, b) => b.value - a.value);
  const byTech = technicians(state).map(t => {
    const js = cur.delivered.filter(j => j.technicianId === t.id);
    const h = js.map(j => hours(j.createdAt, j.deliveredAt!));
    const labor = js.reduce((s, j) => { const e = approvedEstimate(j); return s + (e ? estimateTotals(e).labor : 0) }, 0);
    const open = state.jobs.filter(j => j.technicianId === t.id && !['Teslim edildi', 'İptal'].includes(j.status)).length;
    const onTime = js.filter(j => new Date(j.deliveredAt!).getTime() <= new Date(j.promisedAt).getTime() + 30 * 60000).length;
    const findings = state.jobs.filter(j => j.technicianId === t.id).flatMap(j => j.inspections).filter(i => cur.inRange(i.at)).length;
    return { name: t.name, count: js.length, labor, revenue: js.reduce((s, j) => s + amountDue(j), 0), avg: h.length ? h.reduce((a, b) => a + b, 0) / h.length : 0, onTime: js.length ? onTime / js.length : 0, open, findings };
  }).sort((a, b) => b.revenue - a.revenue);
  const brandMap = new Map<string, number>();
  for (const j of cur.opened) { const v = state.vehicles.find(x => x.id === j.vehicleId); if (v) brandMap.set(v.brand, (brandMap.get(v.brand) ?? 0) + 1) }
  const byBrand = [...brandMap].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const firstJob = new Map<string, string>();
  for (const j of [...state.jobs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) if (!firstJob.has(j.customerId)) firstJob.set(j.customerId, j.createdAt);
  const custs = [...new Set(cur.opened.map(j => j.customerId))];
  const newCustomers = custs.filter(c => cur.inRange(firstJob.get(c))).length;
  const findings = state.jobs.flatMap(j => j.inspections).filter(i => cur.inRange(i.at));
  const health = (['Uygun', 'Takip edilmeli', 'Acil'] as const).map(r => ({ label: r, value: findings.filter(i => i.result === r).length }));
  const topFindings = [...findings.filter(i => i.result !== 'Uygun').reduce((m, i) => m.set(i.item, (m.get(i.item) ?? 0) + 1), new Map<string, number>())]
    .map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  const topJobs = cur.delivered.map(j => ({ j, total: amountDue(j) })).sort((a, b) => b.total - a.total).slice(0, 5);
  const openBalance = state.jobs.filter(j => j.status !== 'İptal').reduce((s, j) => s + Math.max(0, amountDue(j) - j.payments.reduce((t, p) => t + p.amount, 0)), 0);
  const deliveredList = cur.delivered.map(j => ({ j, service: serviceName(state, j.serviceId) }));
  return { from, to, span, cur, prev, daily, methods, byService, byTech, byBrand, newCustomers, returning: custs.length - newCustomers, customers: custs.length, health, topFindings, topJobs, openBalance, deliveredList };
}
export type Report = ReturnType<typeof buildReport>;

/** Önceki döneme göre değişim yüzdesi; önceki değer yoksa null. */
export function delta(cur: number, prev: number) { return prev ? (cur - prev) / prev : null }
