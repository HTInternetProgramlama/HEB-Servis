'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { Loading, Logo } from '@/components/shell';

export default function LoginPage() {
  const { ready, actor, login } = useStore();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (ready && actor) router.replace(actor.role === 'customer' ? '/portal' : '/'); }, [ready, actor, router]);
  if (!ready) return <Loading />;
  return <div className="login"><div className="login-panel">
    <Logo /><h1>Oturum aç</h1><p className="muted">Araç bakım ve servis yönetim sistemi</p>
    <form className="form" onSubmit={async e => {
      e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError('');
      const err = await login(String(f.get('email')), String(f.get('password')));
      if (err) setError(err); setBusy(false);
    }}>
      <label className="field"><span className="field-label">E-posta</span><input name="email" type="email" autoComplete="username" required maxLength={254} placeholder="yonetici@hebservis.test" /></label>
      <label className="field"><span className="field-label">Parola</span><input name="password" type="password" autoComplete="current-password" required maxLength={128} /></label>
      {error && <div className="banner bad" role="alert">{error}</div>}
      <button className="btn primary" disabled={busy}>{busy ? 'Giriş yapılıyor…' : 'Giriş yap'}</button>
    </form>
    <p className="small muted mt">Hesap ve parola işlemleri için servis yöneticinizle iletişime geçin.</p>
  </div><aside className="login-side"><div><span className="eyebrow">HEB Servis</span><h2>Randevudan teslimata tek iş emri.</h2>
    <ol className="login-flow">{['Randevu talebi ve kaynak onayı', 'Araç kabul, hasar ve yakıt kaydı', 'Kontrol bulguları ve sürümlü teklif', 'Müşteri onayı, işlem ve son kontrol', 'Tahsilat, teslim ve bakım hatırlatma'].map((t, i) => <li key={t}><span>{String(i + 1).padStart(2, '0')}</span>{t}</li>)}</ol>
  </div><small>HEB Servis · Personel ve müşteri portalı</small></aside></div>;
}
