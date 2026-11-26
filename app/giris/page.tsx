'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { Loading, Logo, ThemeToggle } from '@/components/shell';
import { Status } from '@/components/ui';
import { Icon } from '@/components/icons';

const flow = ['Randevu', 'Araç kabul', 'Bulgu ve teklif', 'Müşteri onayı', 'İşlem', 'Tahsilat ve teslim'];

export default function LoginPage() {
  const { ready, actor, login } = useStore();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [entry, setEntry] = useState<'staff' | 'customer'>('staff');
  useEffect(() => { if (ready && actor) router.replace(actor.role === 'customer' ? '/portal' : '/'); }, [ready, actor, router]);
  if (!ready) return <Loading />;
  return <div className="login">
    <div className="login-panel">
      <div className="row-between"><Logo /><ThemeToggle /></div>
      <div>
        <h1>{entry === 'customer' ? 'Müşteri girişi' : 'Personel girişi'}</h1>
        <p className="muted mt">{entry === 'customer' ? 'Araçlarınızı, servis durumunu, randevularınızı ve tekliflerinizi takip edin. Hesabınızı servis danışmanınız açar; şifrenizi e-postanıza gelen bağlantıdan belirleyin.' : 'Servis operasyonlarını ve müşteri kayıtlarını hesabınızın yetkileriyle yönetin.'}</p>
      </div>
      <div className="seg" aria-label="Giriş türü"><button type="button" className={entry === 'staff' ? 'active' : ''} onClick={() => setEntry('staff')}>Personel</button><button type="button" className={entry === 'customer' ? 'active' : ''} onClick={() => setEntry('customer')}>Müşteri</button></div>
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
    <aside className="login-side" aria-label="Ürün önizlemesi">
      <div>
        <span className="eyebrow">Araç bakım ve servis yönetimi</span>
        <h2 className="mt">Randevudan teslimata <em>tek iş emri</em>, tek ekran.</h2>
      </div>
      <ol className="login-flow">{flow.map((t, i) => <li key={t}><span>{i + 1}</span>{t}</li>)}</ol>
      <div aria-hidden="true">
        <div className="preview-card">
          <div className="preview-head"><strong>İE-2026-0148</strong><Status value="İşlemde" /></div>
          <div className="preview-body">
            <div className="preview-row"><span>Ön fren balata değişimi</span><span className="mono">1.850,00 ₺</span></div>
            <div className="preview-row"><span>Fren hidroliği yenileme</span><span className="mono">640,00 ₺</span></div>
            <div className="preview-row"><span>İşçilik · 1,5 saat</span><span className="mono">1.200,00 ₺</span></div>
            <div className="preview-total"><span className="muted small">KDV dahil toplam</span><b>4.428,00 ₺</b></div>
          </div>
        </div>
        <div className="preview-card">
          <div className="preview-head"><span className="small strong">Müşteri onayı</span><Status value="Onaylandı" /></div>
          <div className="preview-body"><div className="preview-row"><span>Portal üzerinden onaylandı</span><span className="muted">14:32</span></div></div>
        </div>
      </div>
      <small>HEB Servis · Next.js, PostgreSQL ve Supabase Auth</small>
    </aside>
  </div>;
}
