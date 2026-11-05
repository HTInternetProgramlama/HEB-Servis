import { detailHref, pagesBasePath } from '@/lib/routes';
import type { Customer, Estimate, Job, Payment, State, Vehicle } from './types';
import { amountDue, balance, estimateTotals } from './rules';
import { fmtDate, fmtDateTime, km, money, plateText } from './format';

/** 0555 123 45 67 → 905551234567 (wa.me biçimi). Geçersizse boş döner. */
export function waPhone(phone: string) {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('0')) d = '9' + d;
  else if (d.length === 10 && d.startsWith('5')) d = '90' + d;
  return /^90\d{10}$/.test(d) ? d : '';
}
export function whatsappUrl(phone: string, text: string) {
  const p = waPhone(phone);
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}
export function smsUrl(phone: string, text: string) { return `sms:${phone.replace(/\s/g, '')}?body=${encodeURIComponent(text)}` }
export function mailUrl(email: string, subject: string, text: string) { return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}` }

function ctx(state: State, job: Job) {
  const c = state.customers.find(x => x.id === job.customerId) as Customer;
  const v = state.vehicles.find(x => x.id === job.vehicleId) as Vehicle;
  return { c, v, co: state.settings.company };
}
const first = (name: string) => name.split(' ')[0];

export function receiptMessage(state: State, job: Job, p: Payment, origin: string) {
  const { c, v, co } = ctx(state, job);
  return [
    `Sayın ${c.kind === 'Kurumsal' ? c.name : first(c.name)},`,
    `${plateText(v.plate)} plakalı aracınız için ${money(p.amount)} tutarındaki ${p.method.toLocaleLowerCase('tr')} ödemeniz alınmıştır.`,
    '',
    `İş emri: ${job.no}`,
    `Tarih: ${fmtDateTime(p.at)}`,
    `Kalan bakiye: ${money(balance(job))}`,
    '',
    `Servis kaydınız: ${origin}${pagesBasePath}${detailHref('/portal/servis', job.id)}`,
    `${co.name} · ${co.phone}`,
  ].join('\n');
}

export function serviceFormMessage(state: State, job: Job, origin: string) {
  const { c, v, co } = ctx(state, job);
  const done = job.status === 'Teslim edildi';
  return [
    `Sayın ${c.kind === 'Kurumsal' ? c.name : first(c.name)},`,
    done ? `${plateText(v.plate)} plakalı ${v.brand} ${v.model} aracınızın servis işlemleri tamamlanmıştır.` : `${plateText(v.plate)} plakalı ${v.brand} ${v.model} aracınızın servis formu ektedir.`,
    '',
    `İş emri: ${job.no}`,
    `Kabul: ${fmtDate(job.createdAt)} · ${km(job.intake.km)}`,
    `Durum: ${job.status}`,
    `Onaylı tutar: ${money(amountDue(job))}`,
    v.nextServiceDate ? `Sonraki bakım: ${fmtDate(v.nextServiceDate)}${v.nextServiceKm ? ` veya ${km(v.nextServiceKm)}` : ''}` : '',
    '',
    `Servis formu: ${origin}${pagesBasePath}${detailHref('/servis-formu', job.id)}`,
    `${co.name} · ${co.phone}`,
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}

export function estimateMessage(state: State, job: Job, e: Estimate, origin: string) {
  const { c, v, co } = ctx(state, job);
  const t = estimateTotals(e);
  return [
    `Sayın ${c.kind === 'Kurumsal' ? c.name : first(c.name)},`,
    `${plateText(v.plate)} plakalı aracınızın kontrolü tamamlandı. Önerilen işlemler için teklifimiz (sürüm ${e.version}):`,
    '',
    ...e.lines.map(l => `• ${l.name}`),
    '',
    `Toplam (KDV dahil): ${money(t.total)}`,
    '',
    `Onay veya ret için: ${origin}${pagesBasePath}${detailHref('/portal/servis', job.id)}`,
    `Sorularınız için: ${co.phone}`,
  ].join('\n');
}
