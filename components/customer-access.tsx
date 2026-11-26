'use client';
import { useEffect, useState } from 'react';
import { useApp } from './store';
import { Button, Card } from './ui';
import { fmtDateTime } from '@/lib/format';
import type { Customer } from '@/lib/types';

interface Access {
  account: { email: string; active: boolean } | null;
  deliveries: { id: string; email: string; status: 'pending' | 'sent' | 'failed'; created_at: string }[];
}
export function CustomerAccess({ customer }: { customer: Customer }) {
  const { reload } = useApp();
  const [data, setData] = useState<Access | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    fetch(`/api/customer-access?customerId=${encodeURIComponent(customer.id)}`, { cache: 'no-store' }).then(async r => {
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || 'Portal durumu alınamadı.');
      if (active) { setData(result); setError(''); }
    }).catch(e => active && setError(e instanceof Error ? e.message : 'Bağlantı hatası.'));
    return () => { active = false; };
  }, [customer.id, customer.email]);
  async function send() {
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await fetch('/api/customer-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: customer.id }) });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || 'Erişim e-postası gönderilemedi.');
      setData(result); setMessage(result.message); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Bağlantı hatası.'); }
    finally { setBusy(false); }
  }
  return <Card title="Müşteri portalı" sub="Araçlarını, servis durumunu ve tekliflerini kendi hesabından takip etsin.">
    <p className="small"><strong>{data?.account ? data.account.active ? 'Hesap etkin' : 'Hesap pasif' : 'Portal hesabı henüz açılmadı'}</strong></p>
    <p className="muted small mt">{customer.email || 'Önce müşteri e-postasını kaydedin.'}</p>
    <p className="small muted mt">E-postadaki bağlantı ile şifre belirlenir. Giriş adresi: /giris. Önce müşterinin araç bilgilerini kaydedin.</p>
    <div className="mt"><Button size="sm" icon="mail" disabled={busy || !customer.email || data?.account?.active === false} onClick={send}>{busy ? 'Gönderiliyor…' : data?.account ? 'Şifre e-postasını yeniden gönder' : 'Hesabı aç ve e-posta gönder'}</Button></div>
    {error && <p className="banner bad mt" role="alert">{error}</p>}
    {message && <p className="banner mt" role="status">{message}</p>}
    {!!data?.deliveries.length && <details className="mt small"><summary>Gönderim geçmişi ({data.deliveries.length})</summary><ul className="note-list">{data.deliveries.map(d => <li key={d.id}><strong>{d.status === 'sent' ? 'Sağlayıcıya iletildi' : d.status === 'failed' ? 'Gönderim başarısız' : 'Gönderiliyor'}</strong><br />{d.email}<br /><span className="muted">{fmtDateTime(d.created_at)}</span></li>)}</ul></details>}
  </Card>;
}
