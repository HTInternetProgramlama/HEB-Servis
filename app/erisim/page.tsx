'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/shell';
import { useStore } from '@/components/store';

export default function CustomerActivationPage() {
  const { reload } = useStore();
  const tokens = useRef({ accessToken: '', refreshToken: '' });
  const [valid, setValid] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (tokens.current.accessToken) return;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    tokens.current = { accessToken: hash.get('access_token') || '', refreshToken: hash.get('refresh_token') || '' };
    setValid(!!tokens.current.accessToken && !!tokens.current.refreshToken);
    if (!tokens.current.accessToken) setError('Erişim bağlantısı eksik veya süresi dolmuş. Servisten yeni şifre e-postası isteyin.');
    window.history.replaceState(null, '', '/erisim');
  }, []);
  return <main style={{ maxWidth: 480, margin: '8vh auto', padding: 24 }}>
    <Logo /><h1 className="mt">Müşteri şifrenizi belirleyin</h1>
    <p className="muted mt">Portalda araçlarınızı, servis durumunu ve tekliflerinizi takip edebilirsiniz.</p>
    {done ? <div className="banner mt" role="status">Şifreniz kaydedildi. <Link href="/portal">Müşteri portalına geçin</Link></div> : <form className="form mt" onSubmit={async e => {
      e.preventDefault(); setError('');
      const f = new FormData(e.currentTarget), password = String(f.get('password'));
      if (password !== f.get('repeat')) { setError('Şifreler aynı olmalı.'); return; }
      setBusy(true);
      try {
        const r = await fetch('/api/customer-access/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...tokens.current, password }) });
        const result = await r.json();
        if (!r.ok) throw new Error(result.error || 'Şifre kaydedilemedi.');
        await reload(); tokens.current = { accessToken: '', refreshToken: '' }; setDone(true);
      } catch (e) { setError(e instanceof Error ? e.message : 'Bağlantı hatası.'); }
      finally { setBusy(false); }
    }}>
      <label className="field"><span className="field-label">Yeni şifre</span><input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required disabled={!valid} /></label>
      <label className="field"><span className="field-label">Şifreyi tekrar girin</span><input name="repeat" type="password" autoComplete="new-password" minLength={10} maxLength={128} required disabled={!valid} /></label>
      <button className="btn primary" disabled={busy || !valid}>{busy ? 'Kaydediliyor…' : 'Şifremi kaydet'}</button>
    </form>}
    {error && <p className="banner bad mt" role="alert">{error}</p>}
    <p className="mt"><Link href="/giris">Giriş sayfasına dön</Link></p>
  </main>;
}
