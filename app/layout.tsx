import './globals.css';
import './motion.css';
import type { Metadata, Viewport } from 'next';
import { StoreProvider } from '@/components/store';

export const metadata: Metadata = { title: { default: 'HEB Servis', template: '%s · HEB Servis' }, description: 'Araç bakım ve servis yönetim sistemi' };
export const viewport: Viewport = { themeColor: '#16191d' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="tr"><body><StoreProvider>{children}</StoreProvider></body></html>;
}
