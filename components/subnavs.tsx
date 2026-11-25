'use client';
import { useApp } from './store';
import { SubNav } from './ui';
import { can, dueReminders } from '@/lib/rules';

type Item = [href: string, label: string, count?: number];
const keep = (xs: (Item | false)[]) => xs.filter(Boolean) as Item[];

/** Müşteriler menüsünün altı: müşteri kayıtları, araçlar, bakım hatırlatmaları. */
export function RecordsNav() {
  const { state, actor } = useApp();
  return <SubNav items={keep([
    can(actor, 'customer.write') && ['/musteriler', 'Müşteriler'],
    ['/araclar', 'Araçlar'],
    can(actor, 'reminder.write') && ['/hatirlatmalar', 'Bakım hatırlatmaları', dueReminders(state).filter(r => !r.hasAppointment).length],
  ])} />;
}

/** Raporlar menüsünün altı: A4 rapor belgeleri ve tahsilat hareketleri. */
export function ReportsNav() {
  const { actor } = useApp();
  return <SubNav items={keep([can(actor, 'reports.read') && ['/raporlar', 'Rapor belgeleri'], can(actor, 'payment.read') && ['/tahsilat', 'Tahsilat']])} />;
}

/** Ayarlar altı: servis ayarları ve işlem günlüğü. */
export function SettingsNav() {
  const { actor } = useApp();
  return <SubNav items={keep([can(actor, 'settings.write') && ['/ayarlar', 'Servis ayarları'], can(actor, 'audit.read') && ['/gunluk', 'İşlem günlüğü']])} />;
}
