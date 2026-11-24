import './globals.css';
import './motion.css';
import './tablet.css';
import type { Metadata, Viewport } from 'next';
import { StoreProvider } from '@/components/store';

export const metadata: Metadata = { title: { default: 'HEB Servis', template: '%s · HEB Servis' }, description: 'Araç bakım ve servis yönetim sistemi' };
export const viewport: Viewport = { themeColor: [{ media: '(prefers-color-scheme: light)', color: '#fafafa' }, { media: '(prefers-color-scheme: dark)', color: '#142020' }] };

// Applies the saved (or system) theme before first paint to avoid a light/dark flash.
const themeScript = `try{var t=localStorage.getItem('heb-theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="tr" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body><StoreProvider>{children}</StoreProvider></body>
  </html>;
}
