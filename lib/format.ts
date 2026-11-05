const TZ = 'Europe/Istanbul';

export function today(clock = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(clock);
}
export function nowIso(clock = new Date()) { return clock.toISOString() }
export function uid() { return crypto.randomUUID() }

export function addDays(date: string, days: number) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function addMonths(date: string, months: number) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(from: string, to: string) {
  return Math.round((new Date(to + 'T12:00:00Z').getTime() - new Date(from + 'T12:00:00Z').getTime()) / 86400000);
}
export function isoDay(iso: string) { return today(new Date(iso)) }
export function weekday(date: string) { const d = new Date(date + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d }

export function fmtDate(value: string | undefined, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }) {
  if (!value) return '—';
  const d = value.length === 10 ? new Date(value + 'T12:00:00+03:00') : new Date(value);
  return d.toLocaleDateString('tr-TR', { ...opts, timeZone: TZ });
}
export function fmtLongDate(value: string) { return fmtDate(value, { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }) }
export function fmtDateTime(iso: string | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('tr-TR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) }

export function minutes(time: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Geçerli bir saat seçin.');
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
export function hhmm(total: number) { return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0') }

const tl = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Kuruşu "1.250,50 ₺" biçiminde gösterir. */
export function money(kurus: number) {
  const sign = kurus < 0 ? '-' : '';
  return sign + tl.format(Math.abs(kurus) / 100) + ' ₺';
}
export function moneyShort(kurus: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(kurus / 100)) + ' ₺';
}

/** "1.250,5" veya "1250.50" girişini kayan nokta kullanmadan kuruşa çevirir. */
export function parseMoney(input: string): number {
  return parseHundredths(input, 'Tutar');
}
/** Miktarı yüzde birlik tamsayıya çevirir (1,5 → 150). */
export function parseQty(input: string): number {
  return parseHundredths(input, 'Miktar');
}
function parseHundredths(input: string, label: string) {
  let s = String(input).trim().replace(/\s|₺/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) ?? []).length > 1 || /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`${label} geçerli bir sayı olmalı (en fazla 2 ondalık).`);
  const [int, frac = ''] = s.split('.');
  return Number(int) * 100 + Number((frac + '00').slice(0, 2));
}
export function qtyText(hundredths: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(hundredths / 100);
}
export function moneyInput(kurus: number) {
  return (kurus / 100).toFixed(2).replace('.', ',');
}

export function km(value: number) { return value.toLocaleString('tr-TR') + ' km' }
export function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toLocaleUpperCase('tr') }
export function normalizePlate(value: string) { return value.toLocaleUpperCase('tr-TR').replace(/\s+/g, '').trim() }
export function plateText(value: string) {
  const m = normalizePlate(value).match(/^(\d{2})([A-ZÇĞİÖŞÜ]{1,3})(\d{2,5})$/);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : value;
}
export function fold(text: string) { return text.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i') }
