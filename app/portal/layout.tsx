'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { Loading, Logo } from '@/components/shell';
import { Icon } from '@/components/icons';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { state, actor, ready, logout } = useStore();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!ready) return;
    if (!actor) router.replace('/giris');
    else if (actor.role !== 'customer') router.replace('/');
  }, [ready, actor, router]);
  if (!ready || !state || !actor || actor.role !== 'customer') return <Loading />;
  const links: [string, string][] = [['/portal', 'Araçlarım ve servis'], ['/portal/randevular', 'Randevularım']];
  return <div className="portal">
    <header className="portal-top">
      <div className="portal-inner">
        <Link href="/portal"><Logo /></Link>
        <nav>{links.map(([href, label]) => <Link key={href} href={href} className={path === href ? 'active' : ''}>{label}</Link>)}</nav>
        <div className="portal-user"><span>{actor.name}</span><button className="icon-btn" onClick={() => { logout(); router.replace('/giris') }} aria-label="Oturumu kapat" title="Oturumu kapat"><Icon name="logout" size={16} /></button></div>
      </div>
    </header>
    <main className="portal-inner portal-main">{children}</main>
    <footer className="portal-inner portal-foot">
      <span>{state.settings.company.name}</span>
      <span><Icon name="phone" size={13} /> {state.settings.company.phone}</span>
      <span>{state.settings.company.address}</span>
    </footer>
  </div>;
}
