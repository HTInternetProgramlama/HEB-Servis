'use client';
import { detailHref } from '@/lib/routes';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from './store';
import { Icon, type IconName } from './icons';
import { Avatar } from './ui';
import { Plate } from './vehicle-identity';
import { can, dueReminders, roleLabel, type Permission } from '@/lib/rules';
import { fmtLongDate, fold, normalizePlate, today } from '@/lib/format';

interface NavItem { href: string; label: string; icon: IconName; perm?: Permission; badge?: number; tech?: boolean }

export function Logo({ light }: { light?: boolean }) {
  return <span className={'logo ' + (light ? 'light' : '')}>
    <svg className="logo-mark" viewBox="0 0 48 48" width="34" height="34" aria-hidden="true"><rect width="48" height="48" rx="13" fill="#e8590c" /><path d="M11 12h7v11h12V12h7v24h-7v-7H18v7h-7Z" fill="#fff" /><path d="M23 11h2v6h-2zm0 22h2v5h-2z" fill="#fff" opacity=".65" /></svg>
    <span className="logo-text"><b>HEB</b> Servis</span>
  </span>;
}

export function Loading() {
  return <div className="boot"><Logo /><span>Yükleniyor…</span></div>;
}

export function StaffShell({ children }: { children: React.ReactNode }) {
  const { state, actor, ready, logout, loadError } = useStore();
  const router = useRouter();
  const path = usePathname();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!actor) router.replace('/giris');
    else if (actor.role === 'customer') router.replace('/portal');
  }, [ready, actor, router]);
  useEffect(() => setMenu(false), [path]);

  const counts = useMemo(() => {
    if (!state) return { requests: 0, approvals: 0, reminders: 0 };
    return {
      requests: state.appointments.filter(a => a.status === 'Bekliyor').length,
      approvals: state.jobs.filter(j => j.estimates.at(-1)?.status === 'Gönderildi').length,
      reminders: dueReminders(state).filter(r => !r.hasAppointment).length,
    };
  }, [state]);

  if (!ready || !state || !actor || actor.role === 'customer') return <Loading />;

  const groups: [string, NavItem[]][] = [
    ['Operasyon', [
      { href: '/', label: 'Genel bakış', icon: 'dashboard', tech: true },
      { href: '/randevular', label: 'Randevu takvimi', icon: 'calendar', perm: 'appointment.manage', badge: counts.requests },
      { href: '/atolye', label: 'Atölye panosu', icon: 'board', tech: true },
      { href: '/is-emirleri', label: 'İş emirleri', icon: 'wrench', tech: true },
      { href: '/teklifler', label: 'Teklif onayları', icon: 'receipt', perm: 'estimate.write', badge: counts.approvals },
    ]],
    ['Kayıtlar', [
      { href: '/musteriler', label: 'Müşteriler', icon: 'users', perm: 'customer.write' },
      { href: '/araclar', label: 'Araçlar', icon: 'car', tech: true },
      { href: '/hatirlatmalar', label: 'Bakım hatırlatmaları', icon: 'bell', perm: 'reminder.write', badge: counts.reminders },
    ]],
    ['Finans ve rapor', [
      { href: '/tahsilat', label: 'Tahsilat', icon: 'wallet', perm: 'payment.read' },
      { href: '/raporlar', label: 'Raporlar', icon: 'chart', perm: 'reports.read' },
    ]],
    ['Yönetim', [
      { href: '/katalog', label: 'Parça ve işçilik', icon: 'package', perm: 'estimate.write' },
      { href: '/ayarlar', label: 'Ayarlar ve personel', icon: 'settings', perm: 'settings.write' },
      { href: '/gunluk', label: 'İşlem günlüğü', icon: 'history', perm: 'audit.read' },
    ]],
  ];
  const visible = groups.map(([g, items]) => [g, items.filter(i => i.perm ? can(actor, i.perm) : i.tech)] as [string, NavItem[]]).filter(([, items]) => items.length);
  const active = (href: string) => href === '/' ? path === '/' : path.startsWith(href);

  return <div className={'shell ' + (menu ? 'menu-open' : '')}>
    <aside className="sidebar">
      <div className="side-top"><Link href="/" aria-label="Genel bakış"><Logo light /></Link></div>
      <div className="side-branch"><Icon name="building" size={15} /><div><strong>{state.settings.company.branch}</strong><small>{state.settings.company.address.split(',').at(-1)?.trim()}</small></div></div>
      <nav className="side-nav">
        {visible.map(([g, items]) => <div key={g} className="side-group"><span className="side-label">{g}</span>
          {items.map(i => <Link key={i.href} href={i.href} className={'side-link ' + (active(i.href) ? 'active' : '')} aria-current={active(i.href) ? 'page' : undefined}>
            <Icon name={i.icon} size={16} /><span>{i.label}</span>{!!i.badge && <em className="side-badge">{i.badge}</em>}
          </Link>)}
        </div>)}
      </nav>
      <div className="side-foot">
        <div className="side-user"><Avatar name={actor.name} size={30} /><div><strong>{actor.name}</strong><small>{roleLabel[actor.role]}</small></div>
          <button className="icon-btn dark" onClick={() => { logout(); router.replace('/giris') }} aria-label="Oturumu kapat" title="Oturumu kapat"><Icon name="logout" size={16} /></button></div>
      </div>
    </aside>
    <button className="scrim" aria-label="Menüyü kapat" onClick={() => setMenu(false)} />
    <div className="main">
      <header className="topbar">
        <button className="icon-btn menu-btn" onClick={() => setMenu(!menu)} aria-label="Menü" aria-expanded={menu}><Icon name="menu" size={18} /></button>
        <GlobalSearch />
        <div className="top-right">
          <span className="top-date">{fmtLongDate(today())}</span>
          <span className="env-chip" title="Veriler yalnız bu tarayıcıda saklanır; sunucu ve gerçek kimlik doğrulama bağlı değildir.">Yerel demo</span>
        </div>
      </header>
      {loadError && <div className="banner warn"><Icon name="alert" size={15} />{loadError}</div>}
      <main className="content">{children}</main>
    </div>
  </div>;
}

function GlobalSearch() {
  const { state, actor } = useStore();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) };
    const k = (e: KeyboardEvent) => { if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); box.current?.querySelector('input')?.focus() } };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) };
  }, []);
  if (!state || !actor) return null;
  const term = fold(q.trim()), plate = normalizePlate(q);
  const results: { href: string; title: React.ReactNode; sub: string; kind: string }[] = [];
  if (term.length >= 2) {
    for (const j of state.jobs) {
      const v = state.vehicles.find(v => v.id === j.vehicleId);
      if (fold(j.no).includes(term) || (v && normalizePlate(v.plate).includes(plate))) results.push({ href: detailHref('/is-emirleri/detay', j.id), title: j.no, sub: `${v ? v.brand + ' ' + v.model : ''} · ${j.status}`, kind: 'İş emri' });
    }
    for (const v of state.vehicles) if (normalizePlate(v.plate).includes(plate) || fold(v.brand + ' ' + v.model).includes(term) || v.vin.toLowerCase().includes(term)) results.push({ href: detailHref('/araclar/detay', v.id), title: <Plate value={v.plate} size="sm" />, sub: `${v.brand} ${v.model} · ${v.year}`, kind: 'Araç' });
    if (can(actor, 'customer.write')) for (const c of state.customers) if (fold(c.name).includes(term) || c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '#') || fold(c.no).includes(term)) results.push({ href: detailHref('/musteriler/detay', c.id), title: c.name, sub: `${c.no} · ${c.phone}`, kind: 'Müşteri' });
  }
  const shown = results.slice(0, 9);
  return <div className="global-search" ref={box}>
    <Icon name="search" size={15} />
    <input value={q} onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} placeholder="Plaka, iş emri no, müşteri veya telefon ara" aria-label="Genel arama"
      onKeyDown={e => { if (e.key === 'Enter' && shown[0]) { router.push(shown[0].href); setOpen(false); setQ('') } if (e.key === 'Escape') setOpen(false) }} />
    <kbd>/</kbd>
    {open && term.length >= 2 && <div className="search-pop">
      {shown.map((r, i) => <Link key={i} href={r.href} className="search-row" onClick={() => { setOpen(false); setQ('') }}><span className="search-kind">{r.kind}</span><span className="search-title">{r.title}</span><small>{r.sub}</small></Link>)}
      {!shown.length && <div className="search-none">“{q}” için kayıt bulunamadı.</div>}
    </div>}
  </div>;
}
