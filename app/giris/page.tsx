'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { Loading, Logo, ThemeToggle } from '@/components/shell';
import { Icon } from '@/components/icons';

/** Kurumsal oturum açma ekranı: lacivert üst çubuk, ortada tek form. */
export default function LoginPage() {
  const { ready, actor, login } = useStore();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (ready && actor) router.replace(actor.role === 'customer' ? '/portal' : '/'); }, [ready, actor, router]);
  if (!ready) return <Loading />;
  return <div className="login">
    <header className="login-bar"><Logo light /><span className="appbar-branch">Araç Bakım ve Servis Yönetim Sistemi</span><span className="login-bar-end"><ThemeToggle /></span></header>
    <main className="login-main">
      <section className="login-panel" aria-labelledby="login-title">
        <header><h1 id="login-title">Oturum aç</h1><p className="muted small">Personel ve müşteri hesapları aynı girişi kullanır; menü ve yetkiler rolünüze göre açılır.</p></header>
        <form className="form" onSubmit={async e => {
          e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError('');
          const err = await login(String(f.get('email')), String(f.get('password')));
          if (err) setError(err); setBusy(false);
        }}>
          <label className="field"><span className="field-label">E-posta</span><input name="email" type="email" autoComplete="username" required maxLength={254} placeholder="ad@firma.com" /></label>
          <label className="field"><span className="field-label">Parola</span><input name="password" type="password" autoComplete="current-password" required maxLength={128} /></label>
          {error && <div className="form-error" role="alert"><Icon name="alert" size={15} />{error}</div>}
          <button className={'btn primary ' + (busy ? 'busy' : '')} disabled={busy}>Giriş yap</button>
        </form>
        <footer className="login-foot">
          <span><Icon name="lock" size={14} />Oturumlar şifreli çerezle korunur</span>
          <span><Icon name="user" size={14} />Hesapları servis yöneticisi açar</span>
        </footer>
      </section>
    </main>
    <footer className="login-legal">HEB Servis · Next.js, PostgreSQL ve Supabase Auth</footer>
  </div>;
}
