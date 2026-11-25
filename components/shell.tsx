'use client';
import { detailHref } from '@/lib/routes';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from './store';
import { Icon, type IconName } from './icons';
import { Avatar, MenuButton } from './ui';
import { Plate } from './vehicle-identity';
import { can, dueReminders, roleLabel, type Permission } from '@/lib/rules';
import { fmtLongDate, fold, normalizePlate, today } from '@/lib/format';
import type { Actor } from '@/lib/types';

interface SubItem { href: string; label: string; icon: IconName; perm?: Permission; badge?: number }
interface Section { key: string; label: string; href: string; icon: IconName; perm?: Permission; badge?: number; match: string[]; sub?: SubItem[]; hidden?: boolean }

/** Yazı logosu: lacivert çubukta beyaz, belgede koyu. */
export function Logo({ light }: { light?: boolean }) {
  return <span className={'logo ' + (light ? 'light' : '')}>
    <span className="logo-mark" aria-hidden="true">HEB</span>
    <span className="logo-text">Servis</span>
  </span>;
}

export function Loading() {
  return <div className="boot"><Logo /><div className="boot-bar" /><span className="small">Yükleniyor…</span></div>;
}

const show = (actor: Actor, perm?: Permission) => !perm || can(actor, perm);

/** Ana menü (en fazla 7 öğe) ve her bölümün alt sekmeleri. Ayrı menüden kaldırılan sayfalar burada alt sekme olarak yaşar. */
function sections(counts: { requests: number; approvals: number; reminders: number }): Section[] {
  return [
    { key: 'home', label: 'Ana Sayfa', href: '/', icon: 'dashboard', match: [] },
    { key: 'appt', label: 'Randevular', href: '/randevular', icon: 'calendar', perm: 'appointment.manage', badge: counts.requests, match: ['/randevular'] },
    { key: 'jobs', label: 'İş Emirleri', href: '/is-emirleri', icon: 'wrench', match: ['/is-emirleri', '/teklifler', '/tahsilat', '/atolye'], sub: [
      { href: '/is-emirleri', label: 'İş emri listesi', icon: 'wrench' },
      { href: '/teklifler', label: 'Teklif onayları', icon: 'receipt', perm: 'estimate.write', badge: counts.approvals },
      { href: '/tahsilat', label: 'Tahsilat', icon: 'wallet', perm: 'payment.read' },
    ] },
    { key: 'cust', label: 'Müşteriler', href: '/musteriler', icon: 'users', perm: 'customer.write', match: ['/musteriler'] },
    { key: 'veh', label: 'Araçlar', href: '/araclar', icon: 'car', match: ['/araclar', '/hatirlatmalar'], sub: [
      { href: '/araclar', label: 'Araç listesi', icon: 'car' },
      { href: '/hatirlatmalar', label: 'Bakım hatırlatmaları', icon: 'bell', perm: 'reminder.write', badge: counts.reminders },
    ] },
    { key: 'stock', label: 'Stok', href: '/katalog', icon: 'package', perm: 'estimate.write', match: ['/katalog'] },
    { key: 'rep', label: 'Raporlar', href: '/raporlar', icon: 'chart', perm: 'reports.read', match: ['/raporlar', '/yapay-zeka'], sub: [
      { href: '/raporlar', label: 'Rapor belgeleri', icon: 'chart', perm: 'reports.read' },
      { href: '/yapay-zeka', label: 'Yapay zekâ asistanı', icon: 'sparkle', perm: 'inspection.write' },
    ] },
    { key: 'admin', label: 'Yönetim', href: '/ayarlar', icon: 'settings', perm: 'settings.write', hidden: true, match: ['/ayarlar', '/gunluk'], sub: [
      { href: '/ayarlar', label: 'Ayarlar ve personel', icon: 'settings', perm: 'settings.write' },
      { href: '/gunluk', label: 'İşlem günlüğü', icon: 'history', perm: 'audit.read' },
    ] },
  ];
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

  const all = sections(counts);
  const nav = all.filter(s => !s.hidden && show(actor, s.perm));
  const p = path.replace(/\/$/, '') || '/';
  const current = all.find(s => s.match.some(m => p === m || p.startsWith(m + '/'))) ?? (p === '/' ? all[0] : undefined);
  const subs = (current?.sub ?? []).filter(i => show(actor, i.perm));
  const isDetail = p.includes('/detay');
  const userItems: SubItem[] = [
    { href: '/ayarlar', label: 'Ayarlar ve personel', icon: 'settings', perm: 'settings.write' },
    { href: '/gunluk', label: 'İşlem günlüğü', icon: 'history', perm: 'audit.read' },
    { href: '/yapay-zeka', label: 'Yapay zekâ asistanı', icon: 'sparkle', perm: 'inspection.write' },
  ].filter(i => show(actor, i.perm as Permission)) as SubItem[];
  const pages: PageLink[] = [
    ...nav.map(s => ({ href: s.href, label: s.label, icon: s.icon, group: 'Ana menü' })),
    ...all.flatMap(s => (s.sub ?? []).filter(i => show(actor, i.perm) && i.href !== s.href).map(i => ({ href: i.href, label: i.label, icon: i.icon, group: s.label }))),
  ].filter((x, i, arr) => arr.findIndex(y => y.href === x.href) === i);

  return <div className={'shell ' + (menu ? 'menu-open' : '')}>
    <header className="appbar">
      <div className="appbar-top">
        <button className="icon-btn menu-btn" onClick={() => setMenu(!menu)} aria-label="Ana menü" aria-expanded={menu}><Icon name="menu" size={18} /></button>
        <Link href="/" aria-label="Ana sayfa"><Logo light /></Link>
        <span className="appbar-branch hide-sm">{state.settings.company.branch}</span>
        <CommandPalette pages={pages} />
        <div className="appbar-right">
          <span className="top-date">{fmtLongDate(today())}</span>
          <MenuButton className="user-btn" title="Kullanıcı ve ayarlar menüsü" label={<><Avatar name={actor.name} size={26} /><span className="hide-sm"><b>{actor.name}</b><small>{roleLabel[actor.role]}</small></span></>}>
            <div className="dropdown-head"><b>{actor.name}</b><small>{roleLabel[actor.role]} · {state.settings.company.branch}</small></div>
            {userItems.map(i => <Link key={i.href} href={i.href} role="menuitem"><Icon name={i.icon} size={15} />{i.label}</Link>)}
            {userItems.length > 0 && <hr />}
            <button type="button" role="menuitem" onClick={() => setTheme()}><Icon name="moon" size={15} className="theme-icon-light" /><Icon name="sun" size={15} className="theme-icon-dark" />Açık / koyu tema</button>
            <hr />
            <button type="button" role="menuitem" onClick={async () => { await logout(); router.replace('/giris') }}><Icon name="logout" size={15} />Oturumu kapat</button>
          </MenuButton>
        </div>
      </div>
      <nav className="mainnav" aria-label="Ana menü">
        {nav.map(s => <Link key={s.key} href={s.href} className={current?.key === s.key ? 'active' : ''} aria-current={current?.key === s.key ? 'page' : undefined}>
          {s.label}{!!s.badge && <em className="nav-badge" title="Onay bekleyen talep">{s.badge}</em>}
        </Link>)}
      </nav>
      {subs.length > 1 && !isDetail && <nav className="subnav" aria-label={`${current?.label} alt sayfaları`}>
        {subs.map(i => <Link key={i.href} href={i.href} className={p === i.href ? 'active' : ''} aria-current={p === i.href ? 'page' : undefined}>{i.label}{!!i.badge && <em className="nav-badge">{i.badge}</em>}</Link>)}
      </nav>}
    </header>
    {loadError && <div className="banner warn"><Icon name="alert" size={15} />{loadError}</div>}
    <main className="main"><div className="content">{children}</div></main>
  </div>;
}

interface PageLink { href: string; label: string; icon: IconName; group: string }
interface PaletteItem { key: string; group: string; icon: IconName; title: React.ReactNode; label: string; sub?: string; run: () => void }

function setTheme(next?: 'light' | 'dark') {
  const t = next ?? (document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('heb-theme', t) } catch { /* private mode */ }
}

export function ThemeToggle() {
  return <button type="button" className="icon-btn" onClick={() => setTheme()} aria-label="Açık/koyu tema" title="Açık/koyu tema">
    <Icon name="moon" size={17} className="theme-icon-light" /><Icon name="sun" size={17} className="theme-icon-dark" />
  </button>;
}

function CommandPalette({ pages }: { pages: PageLink[] }) {
  const { state, actor, logout } = useStore();
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target;
      const typing = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
      if ((e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); setOpen(true) }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { setQ(''); setSel(0); d.showModal() }
    if (!open && d.open) d.close();
  }, [open]);
  const items = useMemo(() => {
    if (!state || !actor) return [] as PaletteItem[];
    const go = (href: string) => () => router.push(href);
    const term = fold(q.trim()), plate = normalizePlate(q), digits = q.replace(/\D/g, '');
    const found: PaletteItem[] = [];
    if (term.length >= 2) {
      for (const j of state.jobs) {
        const v = state.vehicles.find(x => x.id === j.vehicleId);
        if (fold(j.no).includes(term) || (v && plate && normalizePlate(v.plate).includes(plate)))
          found.push({ key: 'j' + j.id, group: 'İş emirleri', icon: 'wrench', label: j.no, title: <><b className="mono">{j.no}</b>{v && <Plate value={v.plate} size="sm" />}</>, sub: `${v ? v.brand + ' ' + v.model + ' · ' : ''}${j.status}`, run: go(detailHref('/is-emirleri/detay', j.id)) });
      }
      for (const v of state.vehicles)
        if ((plate && normalizePlate(v.plate).includes(plate)) || fold(v.brand + ' ' + v.model).includes(term) || v.vin.toLowerCase().includes(term))
          found.push({ key: 'v' + v.id, group: 'Araçlar', icon: 'car', label: v.plate, title: <Plate value={v.plate} size="sm" />, sub: `${v.brand} ${v.model} · ${v.year}`, run: go(detailHref('/araclar/detay', v.id)) });
      if (can(actor, 'customer.write')) for (const c of state.customers)
        if (fold(c.name).includes(term) || (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits)) || fold(c.no).includes(term))
          found.push({ key: 'c' + c.id, group: 'Müşteriler', icon: 'user', label: c.name, title: <b>{c.name}</b>, sub: `${c.no} · ${c.phone}`, run: go(detailHref('/musteriler/detay', c.id)) });
    }
    const actions: PaletteItem[] = [];
    if (can(actor, 'job.create')) actions.push({ key: 'a-intake', group: 'Komutlar', icon: 'plus', label: 'Yeni iş emri araç kabul', title: 'Yeni iş emri (araç kabul)', run: go('/is-emirleri?yeni=1') });
    if (can(actor, 'appointment.manage')) actions.push({ key: 'a-appt', group: 'Komutlar', icon: 'calendar', label: 'Randevu takvimi', title: 'Randevu takvimini aç', run: go('/randevular') });
    actions.push({ key: 'a-theme', group: 'Komutlar', icon: 'moon', label: 'Tema açık koyu karanlık', title: 'Açık/koyu temaya geç', run: () => setTheme() });
    actions.push({ key: 'a-out', group: 'Komutlar', icon: 'logout', label: 'Oturumu kapat çıkış', title: 'Oturumu kapat', run: () => { void logout().then(() => router.replace('/giris')) } });
    const pageItems: PaletteItem[] = pages.map(i => ({ key: 'p' + i.href, group: 'Sayfalar', icon: i.icon, label: i.label, title: i.label, sub: i.group, run: go(i.href) }));
    const match = (i: PaletteItem) => !term || fold(i.label + ' ' + (i.sub ?? '')).includes(term);
    return [...found.slice(0, 12), ...actions.filter(match), ...pageItems.filter(match)];
  }, [state, actor, q, pages, router, logout]);
  useEffect(() => { list.current?.querySelector('.cmdk-item.on')?.scrollIntoView({ block: 'nearest' }) }, [sel]);
  const choose = (i?: PaletteItem) => { if (!i) return; setOpen(false); i.run() };
  const rows: React.ReactNode[] = [];
  items.forEach((i, n) => {
    if (n === 0 || items[n - 1].group !== i.group) rows.push(<div key={'g' + i.group} className="cmdk-group">{i.group}</div>);
    rows.push(<button key={i.key} type="button" role="option" aria-selected={n === sel} className={'cmdk-item ' + (n === sel ? 'on' : '')} onMouseMove={() => setSel(n)} onClick={() => choose(i)}>
      <Icon name={i.icon} size={16} /><span className="title-row">{i.title}</span>{i.sub && <small>{i.sub}</small>}
    </button>);
  });
  return <>
    <button type="button" className="global-search" onClick={() => setOpen(true)} aria-label="Ara: plaka, iş emri, müşteri">
      <Icon name="search" size={15} /><span>Plaka, iş emri no, müşteri ara</span><kbd>Ctrl K</kbd>
    </button>
    <dialog ref={ref} className="cmdk" aria-label="Arama" onClose={() => setOpen(false)} onClick={e => { if (e.target === ref.current) setOpen(false) }}>
      {open && <>
        <div className="cmdk-input"><Icon name="search" size={17} />
          <input autoFocus value={q} placeholder="Plaka, iş emri no, müşteri adı veya sayfa" aria-label="Arama" aria-controls="cmdk-list"
            onChange={e => { setQ(e.target.value); setSel(0) }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(items.length - 1, s + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
              if (e.key === 'Enter') { e.preventDefault(); choose(items[sel]) }
            }} />
          <kbd className="kbd">Esc</kbd>
        </div>
        <div className="cmdk-list" id="cmdk-list" role="listbox" ref={list}>
          {rows}
          {!items.length && <div className="search-none">“{q}” için sonuç bulunamadı.</div>}
        </div>
        <div className="cmdk-foot"><span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> gezin</span><span><kbd className="kbd">Enter</kbd> aç</span><span><kbd className="kbd">Esc</kbd> kapat</span></div>
      </>}
    </dialog>
  </>;
}
