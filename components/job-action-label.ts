import type { JobStatus } from '@/lib/types';

/** Durum değerlerini değiştirmeden, geçişin ne yaptığını açıklar. */
export function jobActionLabel(target: JobStatus, current: JobStatus): string {
  switch (target) {
    case 'Kabul edildi': return 'Kabule geri al';
    case 'İnceleniyor': return current === 'Kabul edildi' ? 'İncelemeye başla' : 'İncelemeye geri al';
    case 'Onay bekliyor': return 'Müşteri onayına al';
    case 'İşlemde': return ['Parça bekliyor', 'Son kontrol', 'Teslime hazır'].includes(current) ? 'İşleme geri al' : 'İşe başla';
    case 'Parça bekliyor': return 'Parça beklemeye al';
    case 'Son kontrol': return 'Son kontrole al';
    case 'Teslime hazır': return current === 'Onay bekliyor' ? 'İşlemsiz teslime hazırla' : 'Hazır olarak işaretle';
    case 'Teslim edildi': return 'Teslim et';
    case 'İptal': return 'İptal et';
  }
}
