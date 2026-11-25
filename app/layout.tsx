import './globals.css';
import './motion.css';
import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { StoreProvider } from '@/components/store';

const plexSans = IBM_Plex_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-plex', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = { title: { default: 'HEB Servis', template: '%s · HEB Servis' }, description: 'Araç bakım ve servis yönetim sistemi' };
export const viewport: Viewport = { themeColor: [{ media: '(prefers-color-scheme: light)', color: '#1f3a5f' }, { media: '(prefers-color-scheme: dark)', color: '#0f1724' }] };

// Applies the saved (or system) theme before first paint to avoid a light/dark flash.
const themeScript = `try{var t=localStorage.getItem('heb-theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="tr" suppressHydrationWarning className={`${plexSans.variable} ${plexMono.variable}`}>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body><StoreProvider>{children}</StoreProvider></body>
  </html>;
}
