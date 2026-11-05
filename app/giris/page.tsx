'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { Loading, Logo } from '@/components/shell';
import { Avatar } from '@/components/ui';
import { Icon } from '@/components/icons';
import { roleLabel } from '@/lib/rules';
import type { Role } from '@/lib/types';

const order: Role[] = ['admin', 'advisor', 'technician', 'customer'];
const scope: Record<Role, string> = {
  admin: 'Tüm modüller, ayarlar, personel ve işlem günlüğü',
  advisor: 'Randevu, kabul, teklif, tahsilat ve müşteri ilişkileri',
  technician: 'Atanan iş emirleri, kontrol bulguları ve atölye panosu',
  customer: 'Kendi araçları, randevuları, teklif onayı ve servis geçmişi',
};

export default function LoginPage() {
  const { state, ready, actor, login, resetDemo } = useStore();
  const router = useRouter();
  const [tab, setTab] = useState<'staff' | 'customer'>('staff');
  useEffect(() => { if (ready && actor) router.replace(actor.role === 'customer' ? '/portal' : '/') }, [ready, actor, router]);
  if (!ready || !state) return <Loading />;
  const users = state.users.filter(u => u.active && (tab === 'customer' ? u.role === 'customer' : u.role !== 'customer')).sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));

  return <div className="login">
    <div className="login-panel">
      <Logo />
      <h1>Oturum aç</h1>
      <p className="muted">{state.settings.company.name} · {state.settings.company.branch}</p>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={tab === 'staff'} className={tab === 'staff' ? 'active' : ''} onClick={() => setTab('staff')}>Personel</button>
        <button role="tab" aria-selected={tab === 'customer'} className={tab === 'customer' ? 'active' : ''} onClick={() => setTab('customer')}>Müşteri</button>
      </div>
      <div className="notice"><Icon name="lock" size={15} /><div><strong>Demo oturumu</strong> Kimlik doğrulama sunucusu henüz bağlı değil. Hesap seçerek o rolün yetkileriyle giriş yapılır; bu bir güvenlik önlemi değildir. Yalnız kurgusal veri girin.</div></div>
      <ul className="account-list">
        {users.map(u => <li key={u.id}><button onClick={() => { login(u.id); router.replace(u.role === 'customer' ? '/portal' : '/') }}>
          <Avatar name={u.name} size={34} />
          <span className="acc-main"><strong>{u.name}</strong><small>{u.email}</small></span>
          <span className="acc-role"><b>{roleLabel[u.role]}</b><small>{scope[u.role]}</small></span>
          <Icon name="right" size={16} />
        </button></li>)}
      </ul>
      <button className="btn link sm" onClick={() => { if (confirm('Bu tarayıcıdaki tüm demo kayıtları silinip örnek veriler yeniden yüklenecek. Devam edilsin mi?')) resetDemo() }}><Icon name="refresh" size={14} />Örnek verileri sıfırla</button>
    </div>
    <aside className="login-side">
      <div>
        <span className="eyebrow">Araç Bakım ve Servis Yönetim Sistemi</span>
        <h2>Randevudan teslimata tek iş emri.</h2>
        <ol className="login-flow">
          {['Randevu talebi ve kaynak onayı', 'Araç kabul, hasar ve yakıt kaydı', 'Kontrol bulguları ve sürümlü teklif', 'Müşteri onayı, işlem ve son kontrol', 'Tahsilat, teslim ve bakım hatırlatma'].map((t, i) => <li key={t}><span>{String(i + 1).padStart(2, '0')}</span>{t}</li>)}
        </ol>
      </div>
      <small>v0.3 · Veriler bu tarayıcıda saklanır</small>
    </aside>
  </div>;
}
