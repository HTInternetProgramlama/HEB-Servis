/**
 * Harici yapay zekâ servisine gidecek serbest metindeki kişisel verileri maskeler.
 * Amaç kusursuz anonimleştirme değil: yaygın kalıplar (telefon, e-posta, T.C. kimlik no, IBAN,
 * plaka) ve kayıttan bilinen kişi adları modele gitmesin, teknik içerik (km, yıl, OBD/parça kodu) bozulmasın.
 */

/** T.C. kimlik numarası sağlama algoritması; 11 haneli parça numaralarını kimlik sanmamak için. */
export function isTcKimlik(value: string) {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = [...value].map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8], even = d[1] + d[3] + d[5] + d[7];
  return ((odd * 7 - even) % 10 + 10) % 10 === d[9] && d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

const sep = '[\\s.-]?';
const patterns: [RegExp, string | ((m: string) => string)][] = [
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[E-POSTA]'],
  [/\bTR\s?\d{2}(\s?\d{4}){5}\s?\d{2}\b/gi, '[IBAN]'],
  [/(?<!\d)[1-9]\d{10}(?!\d)/g, m => isTcKimlik(m) ? '[KİMLİK NO]' : m],
  // Ülke/alan koduyla: +90 532 123 45 67, 0212.123.45.67, (0532) 1234567
  [new RegExp(`(?<![\\d\\w])(\\+?90${sep}|0)\\(?[2-5]\\d{2}\\)?${sep}\\d{3}${sep}\\d{2}${sep}\\d{2}(?!\\d)`, 'g'), '[TELEFON]'],
  // Kodsuz yalnız cep telefonu: 532 123 45 67, 5321234567
  [new RegExp(`(?<![\\d\\w])5\\d{2}${sep}\\d{3}${sep}\\d{2}${sep}\\d{2}(?!\\d)`, 'g'), '[TELEFON]'],
  // Plaka: il kodu 01-81, 1-3 büyük harf, 2-5 rakam. Ardından rakam grubu geliyorsa parça kodudur (03L 906 023).
  [/(?<![\dA-Z])(0[1-9]|[1-7]\d|8[01])\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,5}(?![\s.-]?\d)(?![A-Z])/g, '[PLAKA]'],
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function maskPersonal(text: string, knownNames: string[] = []): string {
  let out = text;
  for (const [re, label] of patterns) out = out.replace(re, label as string);
  // Kayıttaki ad/soyadlar kayıttaki yazımıyla ("Ahmet", "Yılmaz'ın") ve 4+ harfliyse tamamen büyük harfle ("YILMAZ") maskelenir.
  // Küçük harf ve 3 harfli büyük yazım eşleştirilmez: "Can" adı teknik "CAN-bus" terimini silmesin.
  const words = [...new Set(knownNames.flatMap(n => n.split(/\s+/)).filter(w => w.length >= 3))];
  const forms = [...new Set(words.flatMap(w => w.length >= 4 ? [w, w.toLocaleUpperCase('tr')] : [w]))];
  for (const w of forms) out = out.replace(new RegExp(`(?<![\\p{L}\\d])${escape(w)}(?![\\p{L}\\d])`, 'gu'), '[KİŞİ]');
  return out;
}
