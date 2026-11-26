'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from './store';
import { Icon } from './icons';
import { can, type Permission } from '@/lib/rules';

/** Personel sayfalarında adres çubuğundan yetkisiz erişimi engeller (menüde gizlemek yetmez). */
const rules: [string, Permission][] = [
  ['/tahsilat', 'payment.read'], ['/raporlar', 'reports.read'], ['/musteriler', 'customer.write'], ['/teklifler', 'estimate.write'],
  ['/randevular', 'appointment.manage'], ['/hatirlatmalar', 'reminder.write'], ['/katalog', 'estimate.write'],
  ['/ayarlar', 'settings.write'], ['/gunluk', 'audit.read'], ['/yapay-zeka', 'inspection.write'],
  ['/stok', 'stock.read'], ['/teknisyen-rozetleri', 'award.read'],
];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { actor } = useStore();
  const rule = rules.find(([p]) => path === p || path.startsWith(p + '/'));
  if (!actor || !rule || can(actor, rule[1])) return <>{children}</>;
  return <div className="empty" role="alert" style={{ minHeight: '50vh', justifyContent: 'center' }}>
    <Icon name="lock" size={22} /><strong>Bu sayfayı görüntüleme yetkiniz yok</strong>
    <p>Rolünüz için açık olan ekranlara ana sayfadan ulaşabilirsiniz.</p>
    <Link className="btn" href="/">Ana sayfaya dön</Link>
  </div>;
}
