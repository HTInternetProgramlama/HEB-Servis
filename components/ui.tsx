'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from './icons';

const tones: Record<string, string> = {
  'Bekliyor': 'amber', 'Onaylı': 'blue', 'Geldi': 'teal', 'İş emri açıldı': 'slate', 'İptal': 'red', 'Gelmedi': 'red',
  'Kabul edildi': 'slate', 'İnceleniyor': 'blue', 'Onay bekliyor': 'amber', 'İşlemde': 'blue', 'Parça bekliyor': 'orange',
  'Son kontrol': 'violet', 'Teslime hazır': 'green', 'Teslim edildi': 'muted',
  'Taslak': 'slate', 'Gönderildi': 'amber', 'Onaylandı': 'green', 'Reddedildi': 'red', 'Geçersiz': 'muted',
  'Uygun': 'green', 'Takip edilmeli': 'amber', 'Acil': 'red',
};
/** Soluk zemin + koyu yazı durum rozeti; renkler tek yerde (tones) tanımlıdır. */
export function Status({ value, tone }: { value: string; tone?: string }) {
  return <span className={'status ' + (tone ?? tones[value] ?? 'slate')}>{value}</span>;
}

/**
 * Sayfa başlığı ve altındaki eylem çubuğu (Business Central tarzı).
 * `actions` eylem çubuğuna yerleşir: metin düğmeler, "Yazdır" gibi açılır menüler.
 */
export function PageHeader({ title, sub, crumbs, actions, aside }: { title: React.ReactNode; sub?: React.ReactNode; crumbs?: [string, string?][]; actions?: React.ReactNode; aside?: React.ReactNode }) {
  return <header className="page-header">
    <div className="page-head">
      <div className="page-head-main">
        {crumbs && <nav className="crumbs" aria-label="Konum">{crumbs.map(([label, href], i) => <span key={i}>{href ? <Link href={href}>{label}</Link> : label}{i < crumbs.length - 1 && <Icon name="right" size={12} />}</span>)}</nav>}
        <h1>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {aside && <div className="page-head-aside">{aside}</div>}
    </div>
    {actions && <div className="action-strip page-actions" role="toolbar" aria-label="Sayfa eylemleri">{actions}</div>}
  </header>;
}

/** Açılır menü düğmesi (Yazdır, kullanıcı menüsü vb.). Öğeye tıklanınca kapanır. */
export function MenuButton({ label, icon, children, align = 'right', className = 'btn', title, caret = true }: { label?: React.ReactNode; icon?: IconName; children: React.ReactNode; align?: 'left' | 'right'; className?: string; title?: string; caret?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) };
  }, [open]);
  return <div className="menu-wrap" ref={ref}>
    <button type="button" className={className} aria-haspopup="menu" aria-expanded={open} title={title} aria-label={title} onClick={() => setOpen(o => !o)}>
      {icon && <Icon name={icon} size={15} />}{label}{caret && <Icon name="down" size={13} />}
    </button>
    {open && <div className={'dropdown ' + align} role="menu" onClick={e => { if ((e.target as HTMLElement).closest('a, button')) setOpen(false) }}>{children}</div>}
  </div>;
}

/** Katlanabilir belge bölümü (FastTab). Kapalıyken başlığın yanında kısa özet gösterir. */
export function FastTab({ title, summary, open: initial = true, mobileOpen, actions, children, flush, id }: { title: React.ReactNode; summary?: React.ReactNode; open?: boolean; mobileOpen?: boolean; actions?: React.ReactNode; children: React.ReactNode; flush?: boolean; id?: string }) {
  const [open, setOpen] = useState(initial);
  // Dar ekranda belge kısa kalsın: yalnız mobileOpen işaretli bölümler açık başlar.
  useEffect(() => { if (!mobileOpen && window.matchMedia('(max-width: 720px)').matches) setOpen(false) }, [mobileOpen]);
  return <section className={'fasttab ' + (open ? 'open' : '')} id={id}>
    <header className="fasttab-head">
      <button type="button" className="fasttab-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon name={open ? 'down' : 'right'} size={14} /><span>{title}</span></button>
      {summary && <span className="fasttab-summary">{summary}</span>}
      {open && actions && <div className="fasttab-actions">{actions}</div>}
    </header>
    {open && <div className={flush ? 'fasttab-flush' : 'fasttab-body'}>{children}</div>}
  </section>;
}

/** Sağdaki dar bilgi kutusu bölümü (FactBox). */
export function FactBox({ title, children, actions }: { title: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode }) {
  return <section className="factbox"><header><h2>{title}</h2>{actions}</header><div className="factbox-body">{children}</div></section>;
}

/** Rol merkezi sayaç kutucuğu: tıklanınca filtrelenmiş listeyi açar. */
export function Cue({ label, value, href, tone, foot }: { label: string; value: React.ReactNode; href: string; tone?: 'warn' | 'bad' | 'ok'; foot?: React.ReactNode }) {
  return <Link href={href} className={'cue ' + (tone ? 'tone-' + tone : '')}>
    <span className="cue-label">{label}</span>
    <strong className="cue-value">{value}</strong>
    {foot && <span className="cue-foot">{foot}</span>}
  </Link>;
}

/** Alanlı filtre şeridi (Durum, Tarih, Teknisyen …). */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="filter-bar" role="search">{children}</div>;
}

export function Card({ title, actions, children, className, flush, sub }: { title?: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean }) {
  return <section className={'card ' + (className ?? '')}>
    {(title || actions) && <header className="card-head"><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>{actions && <div className="card-actions">{actions}</div>}</header>}
    <div className={flush ? 'card-flush' : 'card-body'}>{children}</div>
  </section>;
}

export function Empty({ icon = 'clipboard', title, children }: { icon?: IconName; title: string; children?: React.ReactNode }) {
  return <div className="empty"><Icon name={icon} size={22} /><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}

export function Button({ icon, children, variant = 'default', size, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName; variant?: 'default' | 'primary' | 'ghost' | 'danger' | 'link'; size?: 'sm' }) {
  return <button type="button" {...rest} className={`btn ${variant} ${size ?? ''} ${rest.className ?? ''}`}>{icon && <Icon name={icon} size={size === 'sm' ? 14 : 15} />}{children}</button>;
}

export function Modal({ open, title, sub, onClose, children, width = 560, footer }: { open: boolean; title: string; sub?: string; onClose: () => void; children: React.ReactNode; width?: number; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const last = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { last.current = document.activeElement as HTMLElement; d.showModal() }
    if (!open && d.open) { d.close(); last.current?.focus() }
  }, [open]);
  return <dialog ref={ref} className="modal" style={{ width: `min(${width}px, calc(100vw - 24px))` }} onCancel={e => { e.preventDefault(); onClose() }} onClick={e => { if (e.target === ref.current) onClose() }}>
    {open && <>
      <header className="modal-head"><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div><button type="button" className="icon-btn" aria-label="Kapat" onClick={onClose}><Icon name="x" /></button></header>
      <div className="modal-body">{children}</div>
      {footer && <footer className="modal-foot">{footer}</footer>}
    </>}
  </dialog>;
}

/** Form gönderimini yönetir: hata gösterir, başarısız kayıtta yazılanları korur. */
export function useFormRunner() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(fn: () => Promise<string | null> | string | null, onDone?: () => void) {
    setBusy(true); setError('');
    try { const err = await fn(); if (err) setError(err); else onDone?.() }
    catch (e) { setError(e instanceof Error ? e.message : 'İşlem tamamlanamadı.') }
    finally { setBusy(false) }
  }
  return { error, busy, submit, setError };
}

export function FormError({ error }: { error: string }) {
  return error ? <div className="form-error" role="alert"><Icon name="alert" size={15} />{error}</div> : null;
}

export function Field({ label, hint, children, wide }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={'field ' + (wide ? 'wide' : '')}><span className="field-label">{label}</span>{children}{hint && <small className="field-hint">{hint}</small>}</label>;
}

export function KV({ items, cols = 2 }: { items: [string, React.ReactNode][]; cols?: number }) {
  return <dl className="kv" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>{items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string, number?][] }) {
  return <div className="tabs" role="tablist">{items.map(([v, label, count]) => <button key={v} role="tab" aria-selected={v === value} className={v === value ? 'active' : ''} onClick={() => onChange(v)}>{label}{count !== undefined && <span className="tab-count">{count}</span>}</button>)}</div>;
}

export function Score({ value }: { value: number }) {
  return <span className="score" title={value.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' / 5'}><span className="score-bar"><i style={{ width: `${(value / 5) * 100}%` }} /></span>{value.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>;
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toLocaleUpperCase('tr');
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>{ini}</span>;
}

export function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <div className="search-input"><Icon name="search" size={15} /><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />{value && <button type="button" aria-label="Temizle" onClick={() => onChange('')}><Icon name="x" size={13} /></button>}</div>;
}

/** Küçük eğilim çizgisi; değerler eşit aralıklı kabul edilir. */
export function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 64, h = 26, max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - ((v - min) / (max - min || 1)) * (h - 4)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><path className="area" d={`${line} L${w} ${h} L0 ${h}Z`} /><path className="line" d={line} /></svg>;
}

export function Stat({ label, value, foot, tone, href, spark }: { label: string; value: React.ReactNode; foot?: React.ReactNode; tone?: 'warn' | 'ok' | 'bad'; href?: string; spark?: number[] }) {
  const body = <><span className="stat-label">{label}</span><strong className={'stat-value ' + (tone ?? '')}>{value}</strong>{foot && <span className="stat-foot">{foot}</span>}{spark && <Spark values={spark} />}</>;
  const cls = 'stat ' + (tone ? 'tone-' + tone : '');
  return href ? <Link href={href} className={cls + ' link'}>{body}</Link> : <div className={cls}>{body}</div>;
}
