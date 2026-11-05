'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Actor, State } from '@/lib/types';
import { seed } from '@/lib/seed';
import { uid } from '@/lib/format';

const KEY = 'heb-servis-v3';
const SESSION = 'heb-servis-oturum';

function parse(raw: string | null): State | null {
  if (!raw) return null;
  const s = JSON.parse(raw);
  const lists = ['users', 'customers', 'vehicles', 'appointments', 'jobs', 'notes', 'evaluations', 'catalog', 'reminders', 'audit'];
  if (!s || s.version !== 3 || !s.settings || !s.seq || !lists.every(k => Array.isArray(s[k]))) throw new Error('Kayıt biçimi tanınmadı.');
  return s as State;
}

interface Toast { id: number; text: string; tone: 'ok' | 'error' }
interface StoreValue {
  state: State | null;
  actor: Actor | null;
  ready: boolean;
  loadError: string;
  /** İş kuralını uygular, işlem günlüğüne yazar ve kaydeder. Hata metnini döndürür; başarıda null. */
  run: (change: (s: State, a: Actor) => State, message: string, ref?: string) => Promise<string | null>;
  login: (userId: string) => void;
  logout: () => void;
  resetDemo: () => void;
  notify: (text: string, tone?: Toast['tone']) => void;
}

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let initial: State;
    try { initial = parse(localStorage.getItem(KEY)) ?? seed(); if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(initial)) }
    catch { initial = seed(); setLoadError('Yerel kayıt okunamadı; örnek veriler gösteriliyor. Mevcut kayıt silinmedi.') }
    setState(initial);
    try { setUserId(sessionStorage.getItem(SESSION)) } catch { /* oturum yok */ }
    setReady(true);
    const sync = (e: StorageEvent) => { if (e.key === KEY && e.newValue) { try { setState(parse(e.newValue)) } catch { /* yoksay */ } } };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const notify = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);

  const user = state?.users.find(u => u.id === userId && u.active);
  const actor: Actor | null = user ? { userId: user.id, name: user.name, role: user.role, customerId: user.customerId } : null;

  const run = useCallback<StoreValue['run']>(async (change, message, ref) => {
    if (!state || !actor) return 'Oturum bulunamadı.';
    let error: string | null = null;
    const op = () => {
      try {
        const current = parse(localStorage.getItem(KEY)) ?? state;
        const changed = change(current, actor);
        if (changed === current) return;
        const next: State = { ...changed, audit: [{ id: uid(), at: new Date().toISOString(), by: actor.name, role: actor.role, action: message, ref }, ...changed.audit].slice(0, 500) };
        localStorage.setItem(KEY, JSON.stringify(next));
        setState(next);
      } catch (e) { error = e instanceof Error ? e.message : 'İşlem tamamlanamadı.' }
    };
    if (typeof navigator !== 'undefined' && navigator.locks) await navigator.locks.request(KEY, op); else op();
    if (error) notify(error, 'error'); else notify(message);
    return error;
  }, [state, actor, notify]);

  const login = useCallback((id: string) => { sessionStorage.setItem(SESSION, id); setUserId(id) }, []);
  const logout = useCallback(() => { sessionStorage.removeItem(SESSION); setUserId(null) }, []);
  const resetDemo = useCallback(() => { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); setState(s); notify('Örnek veriler yeniden yüklendi.') }, [notify]);

  const value = useMemo(() => ({ state, actor, ready, loadError, run, login, logout, resetDemo, notify }), [state, actor, ready, loadError, run, login, logout, resetDemo, notify]);
  return <Ctx.Provider value={value}>
    {children}
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map(t => <div key={t.id} className={'toast ' + t.tone}>{t.text}</div>)}
    </div>
  </Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider eksik');
  return v;
}
/** Sayfalarda kullanılacak: durum ve aktör hazır olduğunda döner. */
export function useApp() {
  const v = useStore();
  return v as StoreValue & { state: State; actor: Actor };
}
