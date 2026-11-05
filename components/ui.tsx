'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from './icons';

const tones: Record<string, string> = {
  'Bekliyor': 'amber', 'Onaylı': 'blue', 'Geldi': 'teal', 'İş emri açıldı': 'slate', 'İptal': 'red', 'Gelmedi': 'red',
  'Kabul edildi': 'slate', 'İnceleniyor': 'blue', 'Onay bekliyor': 'amber', 'İşlemde': 'teal', 'Parça bekliyor': 'orange',
  'Son kontrol': 'violet', 'Teslime hazır': 'green', 'Teslim edildi': 'muted',
  'Taslak': 'slate', 'Gönderildi': 'amber', 'Onaylandı': 'green', 'Reddedildi': 'red', 'Geçersiz': 'muted',
  'Uygun': 'green', 'Takip edilmeli': 'amber', 'Acil': 'red',
};
export function Status({ value, tone }: { value: string; tone?: string }) {
  return <span className={'status ' + (tone ?? tones[value] ?? 'slate')}><i />{value}</span>;
}

export function PageHeader({ title, sub, crumbs, actions }: { title: React.ReactNode; sub?: React.ReactNode; crumbs?: [string, string?][]; actions?: React.ReactNode }) {
  return <div className="page-head">
    <div className="page-head-main">
      {crumbs && <nav className="crumbs" aria-label="Konum">{crumbs.map(([label, href], i) => <span key={i}>{href ? <Link href={href}>{label}</Link> : label}{i < crumbs.length - 1 && <Icon name="right" size={12} />}</span>)}</nav>}
      <h1>{title}</h1>
      {sub && <p className="page-sub">{sub}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>;
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

export function Stat({ label, value, foot, tone, href }: { label: string; value: React.ReactNode; foot?: React.ReactNode; tone?: 'warn' | 'ok' | 'bad'; href?: string }) {
  const body = <><span className="stat-label">{label}</span><strong className={'stat-value ' + (tone ?? '')}>{value}</strong>{foot && <span className="stat-foot">{foot}</span>}</>;
  return href ? <Link href={href} className="stat link">{body}</Link> : <div className="stat">{body}</div>;
}
