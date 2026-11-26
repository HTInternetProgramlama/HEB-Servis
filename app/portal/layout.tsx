'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { Loading, Logo } from '@/components/shell';
import { Icon, type IconName } from '@/components/icons';
import { initials } from '@/lib/format';
import styles from '@/components/customer-portal.module.css';

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
  const company = state.settings.company;
  const links: { href: string; label: string; icon: IconName; active: boolean }[] = [
    { href: '/portal', label: 'Araçlarım & servis', icon: 'car', active: path === '/portal' || path.startsWith('/portal/servis') },
    { href: '/portal/randevular', label: 'Randevularım', icon: 'calendar', active: path.startsWith('/portal/randevular') },
  ];
  return <div className={styles.portalShell}>
    <a className={styles.skipLink} href="#portal-content">İçeriğe geç</a>
    <header className={styles.topbar}><div className={styles.topbarInner}>
      <Link href="/portal" className={styles.brand} aria-label={`${company.name} müşteri portalı`}><Logo /><span>Müşteri portalı</span></Link>
      <nav className={styles.navigation} aria-label="Müşteri menüsü">{links.map(link => <Link href={link.href} key={link.href} className={`${styles.navLink} ${link.active ? styles.navActive : ''}`} aria-current={link.active ? 'page' : undefined}><Icon name={link.icon} size={19} />{link.label}</Link>)}</nav>
      <div className={styles.account}><span className={styles.avatar} aria-hidden="true">{initials(actor.name)}</span><div className={styles.accountName}><small>Hoş geldiniz</small><strong>{actor.name}</strong></div><button className={styles.logout} onClick={() => void logout()} aria-label="Oturumu kapat" title="Oturumu kapat"><Icon name="logout" size={19} /></button></div>
    </div></header>
    <main id="portal-content" className={styles.main} tabIndex={-1}>{children}</main>
    <footer className={styles.footer}><div><strong>{company.name}</strong><span>Aracınızla ilgili her adımda yanınızdayız.</span></div><div className={styles.footerContact}>{company.phone && <a href={`tel:${company.phone.replace(/[^\d+]/g, '')}`}><Icon name="phone" size={15} />{company.phone}</a>}{company.email && <a href={`mailto:${company.email}`}><Icon name="mail" size={15} />{company.email}</a>}</div>{company.address && <p>{company.address}</p>}</footer>
  </div>;
}
