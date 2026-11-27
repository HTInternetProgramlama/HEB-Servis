'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Actor, State } from '@/lib/types';
import { collect, replay } from '@/lib/commands';
import { guardsFor } from '@/lib/entity-guard';

interface Snapshot { state: State; actor: Actor; revision: number }
interface Toast { id: number; text: string; tone: 'ok' | 'error' }
interface StoreValue {
  state: State | null; actor: Actor | null; ready: boolean; loadError: string;
  run: (change: (s: State, a: Actor) => State, message: string, ref?: string) => Promise<string | null>;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  notify: (text: string, tone?: Toast['tone']) => void;
}
const Ctx = createContext<StoreValue | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const current = useRef<Snapshot | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const apply = useCallback((value: Snapshot | null) => {
    if (value && current.current?.actor.userId === value.actor.userId && current.current.revision > value.revision) return;
    current.current = value; setSnapshot(value);
  }, []);
  const notify = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);
  const refresh = useCallback(async () => {
    const started = generation.current;
    try {
      const response = await fetch('/api/session', { cache: 'no-store' });
      if (started !== generation.current) return;
      if (response.status === 401) { apply(null); setLoadError(''); return; }
      const data = await response.json();
      if (started !== generation.current) return;
      if (!response.ok) throw new Error(data.error);
      apply(data); setLoadError('');
    } catch { setLoadError('Sunucuya ulaşılamadı. Bağlantıyı kontrol edip sayfayı yenileyin.'); }
    finally { setReady(true); }
  }, [apply]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { if (!busy.current && document.visibilityState === 'visible') void refresh(); }, 15000);
    const focus = () => { if (!busy.current) void refresh(); };
    window.addEventListener('focus', focus);
    return () => { clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [refresh]);
  const login = useCallback<StoreValue['login']>(async (email, password) => {
    generation.current++;
    try {
      const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) return data.error || 'Giriş yapılamadı.';
      apply(data); setLoadError(''); return null;
    } catch { return 'Sunucuya ulaşılamadı.'; }
  }, [apply]);
  const logout = useCallback(async () => {
    generation.current++;
    try {
      const response = await fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error();
      apply(null);
    } catch { notify('Oturum kapatılamadı. Yeniden deneyin.', 'error'); }
  }, [apply, notify]);
  const run = useCallback<StoreValue['run']>(async (change, message, ref) => {
    const start = current.current;
    if (!start) return 'Oturum bulunamadı.';
    if (busy.current) return 'Önceki işlemin tamamlanmasını bekleyin.';
    busy.current = true;
    const started = generation.current;
    try {
      const commands = collect(change, start.state, start.actor);
      if (!commands.length) return null;
      const response = await fetch('/api/commands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commands, revision: start.revision, guards: guardsFor(commands, start.state), key: crypto.randomUUID(), message, ref }) });
      const data = await response.json();
      if (started !== generation.current) return 'Oturum değişti. İşlem durumunu yeniden giriş yaparak kontrol edin.';
      if (!response.ok) {
        if (response.status === 401) apply(null);
        if (response.status === 409) await refresh();
        throw new Error(data.error || 'İşlem tamamlanamadı.');
      }
      apply(data);
      replay(change, data.state, data.actor);
      notify(message); return null;
    } catch (e) {
      const error = e instanceof Error ? e.message : 'İşlem tamamlanamadı.';
      notify(error, 'error'); return error;
    } finally { busy.current = false; }
  }, [apply, notify, refresh]);
  const value = useMemo(() => ({ state: snapshot?.state ?? null, actor: snapshot?.actor ?? null, ready, loadError, run, login, logout, reload: refresh, notify }), [snapshot, ready, loadError, run, login, logout, refresh, notify]);
  return <Ctx.Provider value={value}>{children}
    {loadError && <div className="banner bad" role="alert">{loadError}<button onClick={() => void refresh()}>Yeniden dene</button></div>}
    <div className="toasts" role="status" aria-live="polite">{toasts.map(t => <div key={t.id} className={'toast ' + t.tone}>{t.text}</div>)}</div>
  </Ctx.Provider>;
}
export function useStore() { const v = useContext(Ctx); if (!v) throw new Error('StoreProvider eksik'); return v; }
export function useApp() { return useStore() as StoreValue & { state: State; actor: Actor }; }
