'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { Loading, Logo, ThemeToggle } from '@/components/shell';
import { Icon } from '@/components/icons';

/** Müşteri portalı: personel ekranıyla aynı lacivert üst çubuk ve yatay menü. */
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
  const p = path.replace(/\/$/, '') || '/';
  return <div className="portal">
    <header className="appbar">
      <div className="appbar-top">
        <Link href="/portal" aria-label="Portal ana sayfası"><Logo light /></Link>
        <span className="appbar-branch hide-sm">Müşteri portalı · {state.settings.company.branch}</span>
        <div className="appbar-right">
          <span className="portal-name hide-sm">{actor.name}</span>
          <ThemeToggle />
          <button className="icon-btn" onClick={async () => { await logout(); router.replace('/giris') }} aria-label="Oturumu kapat" title="Oturumu kapat"><Icon name="logout" size={16} /></button>
        </div>
      </div>
      <nav className="mainnav portal-nav" aria-label="Portal menüsü">
        {links.map(([href, label]) => <Link key={href} href={href} className={p === href ? 'active' : ''} aria-current={p === href ? 'page' : undefined}>{label}</Link>)}
      </nav>
    </header>
    <main className="portal-inner portal-main">{children}</main>
    <footer className="portal-inner portal-foot">
      <span>{state.settings.company.name}</span>
      <span><Icon name="phone" size={13} /> {state.settings.company.phone}</span>
      <span>{state.settings.company.address}</span>
    </footer>
  </div>;
}
