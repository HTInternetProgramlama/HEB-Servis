'use client';
import { detailHref } from '@/lib/routes';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from './store';
import { Icon, type IconName } from './icons';
import { Avatar } from './ui';
import { IntakeForm } from './forms';
import { Plate } from './vehicle-identity';
import { DriftLoader } from './car-art';
import { can, roleLabel, type Permission } from '@/lib/rules';
import { fold, normalizePlate } from '@/lib/format';

interface NavItem { href: string; label: string; icon: IconName; perm?: Permission; badge?: number; tech?: boolean; hot?: boolean }

export function Logo({ light }: { light?: boolean }) {
  return <span className={'logo ' + (light ? 'light' : '')}>
    <svg className="logo-mark" viewBox="0 0 48 48" width="32" height="32" aria-hidden="true"><rect width="48" height="48" rx="12" fill="var(--accent, #d9480f)" /><path d="M11 12h7v11h12V12h7v24h-7v-7H18v7h-7Z" fill="#fff" /><path d="M23 11h2v6h-2zm0 22h2v5h-2z" fill="#fff" opacity=".65" /></svg>
    <span className="logo-text"><b>HEB</b> Servis</span>
  </span>;
}

export function Loading() {
  return <div className="boot"><Logo /><DriftLoader label="Atölye hazırlanıyor…" /></div>;
}

export function StaffShell({ children }: { children: React.ReactNode }) {
  const { state, actor, ready, logout, loadError } = useStore();
  const router = useRouter();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [intake, setIntake] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!actor) router.replace('/giris');
    else if (actor.role === 'customer') router.replace('/portal');
  }, [ready, actor, router]);
  useEffect(() => setMenu(false), [path]);

  if (!ready || !state || !actor || actor.role === 'customer') return <Loading />;

  const groups: [string, NavItem[]][] = [
    ['Çalışma alanı', [
      { href: '/', label: 'İş Akışı', icon: 'board', tech: true },
      { href: '/randevular', label: 'Takvim', icon: 'calendar', perm: 'appointment.manage' },
      { href: '/musteriler', label: 'Müşteriler', icon: 'users', perm: 'customer.write' },
      { href: '/katalog', label: 'Stok', icon: 'package', perm: 'estimate.write' },
      { href: '/raporlar', label: 'Raporlar', icon: 'chart', perm: 'reports.read' },
    ]],
  ];
  const utilities: NavItem[] = [
    { href: '/ayarlar', label: 'Ayarlar', icon: 'settings', perm: 'settings.write' },
    { href: '/hatirlatmalar', label: 'Hatırlatmalar', icon: 'bell', perm: 'reminder.write' },
    { href: '/gunluk', label: 'İşlem günlüğü', icon: 'history', perm: 'audit.read' },
    { href: '/yapay-zeka', label: 'Yapay zekâ asistanı', icon: 'sparkle', perm: 'inspection.write' },
  ].filter(i => can(actor, i.perm as Permission)) as NavItem[];
  /* İkincil araçlar alt menüde ve genel aramada erişilebilir. */
  const visible = groups.map(([g, items]) => [g, items.filter(i => i.perm ? can(actor, i.perm) : i.tech)] as [string, NavItem[]]).filter(([, items]) => items.length);
  const active = (href: string) => href === '/' ? path === '/' || path.startsWith('/atolye') || path.startsWith('/is-emirleri') : path.startsWith(href) || (href === '/musteriler' && path.startsWith('/araclar'));

  return <div className={'shell ' + (menu ? 'menu-open' : '')}>
    <aside className="sidebar">
      <div className="side-top"><Link href="/" aria-label="HEB Servis · İş Akışı"><Logo /></Link></div>
      <nav className="side-nav">
        {visible.map(([g, items]) => <div key={g} className="side-group"><span className="side-label">{g}</span>
          {items.map(i => <Link key={i.href} href={i.href} title={i.label} className={'side-link ' + (active(i.href) ? 'active' : '')} aria-current={active(i.href) ? 'page' : undefined}>
            <Icon name={i.icon} size={16} /><span>{i.label}</span>{!!i.badge && <em className={'side-badge ' + (i.hot ? 'hot' : '')}>{i.badge}</em>}
          </Link>)}
        </div>)}
      </nav>
      <div className="side-foot">
        <details className="rail-tools"><summary title="Ayarlar ve araçlar"><Icon name="settings" size={20} /><span>Ayarlar</span></summary><div>{utilities.map(i => <Link key={i.href} href={i.href}><Icon name={i.icon} size={16} />{i.label}</Link>)}</div></details>
        <div className="side-user" title={`${actor.name} · ${roleLabel[actor.role]}`}><Avatar name={actor.name} size={30} /><div><strong>{actor.name}</strong><small>{roleLabel[actor.role]}</small></div>
          <button className="icon-btn" onClick={async () => { await logout(); router.replace('/giris') }} aria-label="Oturumu kapat" title="Oturumu kapat"><Icon name="logout" size={16} /></button></div>
      </div>
    </aside>
    <button className="scrim" aria-label="Menüyü kapat" onClick={() => setMenu(false)} />
    <div className="main">
      <header className="topbar">
        <button className="icon-btn menu-btn" onClick={() => setMenu(!menu)} aria-label="Menü" aria-expanded={menu}><Icon name="menu" size={18} /></button>
        <CommandPalette groups={[...visible, ['Araçlar', utilities]]} onNewJob={() => setIntake(true)} />
        <div className="top-right">
          {can(actor, 'job.create') && <button type="button" className="btn primary new-job" onClick={() => setIntake(true)}><Icon name="plus" size={18} />Yeni iş</button>}
          <ThemeToggle />
        </div>
      </header>
      {loadError && <div className="banner warn"><Icon name="alert" size={15} />{loadError}</div>}
      <main className="content">{children}</main>
      {intake && can(actor, 'job.create') && <IntakeForm open onClose={() => setIntake(false)} onDone={id => { setIntake(false); router.push(detailHref('/is-emirleri/detay', id)) }} />}
    </div>
  </div>;
}

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

function CommandPalette({ groups, onNewJob }: { groups: [string, NavItem[]][]; onNewJob: () => void }) {
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
        if (actor.role === 'technician' && j.technicianId !== actor.userId) continue;
        const v = state.vehicles.find(x => x.id === j.vehicleId);
        if (fold(j.no).includes(term) || (v && plate && normalizePlate(v.plate).includes(plate)))
          found.push({ key: 'j' + j.id, group: 'İş emirleri', icon: 'wrench', label: j.no, title: <><b className="mono">{j.no}</b>{v && <Plate value={v.plate} size="sm" />}</>, sub: `${v ? v.brand + ' ' + v.model + ' · ' : ''}${j.status}`, run: go(detailHref('/is-emirleri/detay', j.id)) });
      }
      for (const v of state.vehicles.filter(v => actor.role !== 'technician' || state.jobs.some(j => j.vehicleId === v.id && j.technicianId === actor.userId)))
        if ((plate && normalizePlate(v.plate).includes(plate)) || fold(v.brand + ' ' + v.model).includes(term) || v.vin.toLowerCase().includes(term))
          found.push({ key: 'v' + v.id, group: 'Araçlar', icon: 'car', label: v.plate, title: <Plate value={v.plate} size="sm" />, sub: `${v.brand} ${v.model} · ${v.year}`, run: go(detailHref('/araclar/detay', v.id)) });
      if (can(actor, 'customer.write')) for (const c of state.customers)
        if (fold(c.name).includes(term) || (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits)) || fold(c.no).includes(term))
          found.push({ key: 'c' + c.id, group: 'Müşteriler', icon: 'user', label: c.name, title: <b>{c.name}</b>, sub: `${c.no} · ${c.phone}`, run: go(detailHref('/musteriler/detay', c.id)) });
    }
    const actions: PaletteItem[] = [];
    if (can(actor, 'job.create')) actions.push({ key: 'a-intake', group: 'Komutlar', icon: 'plus', label: 'Yeni araç kabul iş emri', title: 'Yeni araç kabul', sub: 'İş emri aç', run: onNewJob });
    if (can(actor, 'appointment.manage')) actions.push({ key: 'a-appt', group: 'Komutlar', icon: 'calendar', label: 'Randevu takvimi', title: 'Randevu takvimini aç', run: go('/randevular') });
    actions.push({ key: 'a-theme', group: 'Komutlar', icon: 'moon', label: 'Tema açık koyu karanlık', title: 'Açık/koyu temaya geç', run: () => setTheme() });
    actions.push({ key: 'a-out', group: 'Komutlar', icon: 'logout', label: 'Oturumu kapat çıkış', title: 'Oturumu kapat', run: () => { void logout().then(() => router.replace('/giris')) } });
    const pages: PaletteItem[] = groups.flatMap(([g, entries]) => entries.map(i => ({ key: 'p' + i.href, group: 'Sayfalar', icon: i.icon, label: i.label, title: i.label, sub: g, run: go(i.href) })));
    const match = (i: PaletteItem) => !term || fold(i.label + ' ' + (i.sub ?? '')).includes(term);
    return [...found.slice(0, 12), ...actions.filter(match), ...pages.filter(match)];
  }, [state, actor, q, groups, router, logout, onNewJob]);
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
    <button type="button" className="global-search" onClick={() => setOpen(true)} aria-label="Ara veya komut çalıştır">
      <Icon name="search" size={19} /><span>Plaka, müşteri veya iş emri ara…</span><kbd>Ctrl K</kbd>
    </button>
    <dialog ref={ref} className="cmdk" aria-label="Komut paleti" onClose={() => setOpen(false)} onClick={e => { if (e.target === ref.current) setOpen(false) }}>
      {open && <>
        <div className="cmdk-input"><Icon name="search" size={17} />
          <input autoFocus value={q} placeholder="Ne arıyorsunuz?" aria-label="Arama" aria-controls="cmdk-list"
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
