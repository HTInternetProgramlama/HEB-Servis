'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { Loading, Logo, ThemeToggle } from '@/components/shell';
import { Icon } from '@/components/icons';

export default function LoginPage() {
  const { ready, actor, login } = useStore();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (ready && actor) router.replace(actor.role === 'customer' ? '/portal' : '/'); }, [ready, actor, router]);
  if (!ready) return <Loading />;
  return <div className="login">
    <div className="login-panel">
      <div className="row-between"><Logo /><ThemeToggle /></div>
      <div>
        <h1>Oturum açın</h1>
        <p className="muted mt">Personel ve müşteri hesapları aynı girişi kullanır; yetkiler rolünüze göre açılır.</p>
      </div>
      <form className="form" onSubmit={async e => {
        e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError('');
        const err = await login(String(f.get('email')), String(f.get('password')));
        if (err) setError(err); setBusy(false);
      }}>
        <label className="field"><span className="field-label">E-posta</span><input name="email" type="email" autoComplete="username" required maxLength={254} placeholder="ad@firma.com" /></label>
        <label className="field"><span className="field-label">Parola</span><input name="password" type="password" autoComplete="current-password" required maxLength={128} /></label>
        {error && <div className="banner bad" role="alert"><Icon name="alert" size={15} />{error}</div>}
        <button className={'btn primary ' + (busy ? 'busy' : '')} disabled={busy}>Giriş yap<Icon name="arrow" size={15} /></button>
      </form>
      <div className="login-foot">
        <span><Icon name="lock" size={14} />Oturumlar şifreli çerezle korunur</span>
        <span><Icon name="user" size={14} />Hesabı servis yöneticisi açar</span>
      </div>
    </div>
  </div>;
}
