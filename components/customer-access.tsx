'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from './store';
import { Button, Card } from './ui';
import { fmtDateTime } from '@/lib/format';
import type { Customer } from '@/lib/types';

interface Access {
  localEmailDelivery?: boolean;
  account: { email: string; active: boolean } | null;
  deliveries: { id: string; email: string; status: 'pending' | 'sent' | 'failed'; created_at: string; completed_at?: string | null; error_code?: string | null }[];
}
// UI explanations are also allowlisted. Never render arbitrary provider/API text.
const deliveryMessages: Record<string, string> = {
  email_address_not_authorized: 'Hesap hazır. Varsayılan gönderici bu alıcıya e-posta göndermeye yetkili değil. Yönetici özel SMTP ayarlarını kontrol etmeli.',
  over_email_send_rate_limit: 'Hesap hazır. Sağlayıcının e-posta gönderim limiti doldu; bekleyip tekrar deneyin.',
  over_request_rate_limit: 'Hesap hazır. Sağlayıcının istek limiti doldu; yeni bir deneme için bekleyin.',
  email_address_invalid: 'Hesap hazır. Sağlayıcı alıcı adresini geçersiz buldu. Gerçek e-posta adresini kontrol edin; hesap adresini yönetici eşitlemeli.',
  smtp_send_failed: 'Hesap hazır. Auth e-posta gönderimi tamamlanamadı. Yönetici SMTP bağlantısını, gönderici doğrulamasını ve sağlayıcı durumunu kontrol etmeli.',
  email_delivery_unknown: 'Hesap hazır. Gönderim doğrulanamadı; güvenli bir sağlayıcı hata nedeni alınamadı. Yönetici e-posta ayarlarını kontrol etmeli.',
  test_address_not_deliverable: 'Hesap hazır. .test uzantısı kurgusal adresler içindir; gerçek e-posta gönderimi yapılmadı. Yönetici elle parola belirleyebilir.',
};
function deliveryMessage(code: string | null | undefined) {
  return code && Object.hasOwn(deliveryMessages, code) ? deliveryMessages[code] : 'Gönderim başarısız. Bu eski kayıt için ayrıntılı güvenli tanı bulunmuyor.';
}
const businessMessages = new Set([
  'Önce müşteri kartına geçerli e-posta girin.',
  'Portal açmadan önce müşterinin araç bilgilerini kaydedin.',
  'Yeni erişim e-postası için bir dakika bekleyin.',
  'Portal hesabı pasif. Yönetici önce hesabı etkinleştirmeli.',
  'Portal hesabı e-postası müşteri kartıyla farklı. Yönetici Ayarlar bölümünden hesabın e-postasını eşitlemeli.',
  'Bu e-posta başka bir hesaba bağlı.',
  'Portal hesabı açılamadı. E-posta başka bir Auth hesabında kullanılıyor olabilir.',
  'Müşteri bulunamadı.',
]);
function safeRequestError(result: { error?: unknown; code?: unknown }, status: number) {
  if (typeof result.code === 'string' && Object.hasOwn(deliveryMessages, result.code)) return deliveryMessages[result.code];
  if (typeof result.error === 'string' && businessMessages.has(result.error)) return result.error;
  if (status === 429) return 'Gönderim veya istek sınırına ulaşıldı. Yeni denemeden önce bekleyin.';
  if (status === 401 || status === 403) return 'Bu işlem için oturumunuzu ve yetkinizi kontrol edin.';
  return 'İşlem tamamlanamadı. Güncel hesap durumu ve gönderim geçmişini kontrol edin.';
}
async function accessStatus(id: string): Promise<Access> {
  const response = await fetch(`/api/customer-access?customerId=${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Portal durumu alınamadı.');
  return response.json();
}
export function CustomerAccess({ customer }: { customer: Customer }) {
  const { reload, actor } = useApp();
  const [data, setData] = useState<Access | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const testAddress = customer.email.trim().toLowerCase().split('@').at(-1)?.replace(/\.$/, '').endsWith('.test') ?? false;
  const blockedTestAddress = testAddress && !data?.localEmailDelivery;
  useEffect(() => {
    let active = true;
    setLoading(true); setData(null); setMessage(''); setError('');
    accessStatus(customer.id).then(result => {
      if (active) setData(result);
    }).catch(() => active && setError('Portal durumu alınamadı. Bağlantınızı kontrol edip sayfayı yenileyin.')).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [customer.id, customer.email]);
  async function send() {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    const previousDelivery = data?.deliveries[0]?.id;
    try {
      const r = await fetch('/api/customer-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: customer.id }) });
      const result = await r.json();
      if (r.ok) {
        setData(result);
        setMessage('Şifre oluşturma isteği sağlayıcı tarafından kabul edildi. Bu bilgi e-postanın gelen kutusuna teslim edildiğini doğrulamaz.');
      } else {
        let failure = safeRequestError(result, r.status);
        // Account creation may have committed even though email delivery failed.
        try {
          const fresh = await accessStatus(customer.id); setData(fresh);
          const latest = fresh.deliveries[0];
          if (latest?.status === 'failed' && latest.id !== previousDelivery && fresh.account) failure = deliveryMessage(latest.error_code);
        } catch { /* Keep the safe request explanation if status refresh fails. */ }
        setError(failure);
      }
      // Refresh created profiles after success AND provider failure, without
      // interpreting an email failure as a failed account transaction.
      await reload();
    } catch { setError('İşlem sonucu alınamadı. Yeniden göndermeden önce güncel hesap durumunu kontrol edin.');
      try { setData(await accessStatus(customer.id)); await reload(); } catch { /* No raw network errors. */ }
    }
    finally { setBusy(false); }
  }
  return <Card title="Müşteri portalı" sub="Araçlarını, servis durumunu ve tekliflerini kendi hesabından takip etsin.">
    <p className="small"><strong>{loading ? 'Hesap durumu yükleniyor…' : data ? data.account ? data.account.active ? 'Hesap hazır ve etkin' : 'Hesap pasif' : 'Portal hesabı henüz açılmadı' : 'Hesap durumu alınamadı'}</strong></p>
    <p className="muted small mt">{customer.email || 'Önce müşteri e-postasını kaydedin.'}</p>
    <p className="small muted mt">Gerçek e-posta adreslerinde bağlantı ile şifre belirlenir. Giriş adresi: /giris. Önce müşterinin araç bilgilerini kaydedin.</p>
    {data && testAddress && <p className="banner mt" role="note">{data.localEmailDelivery ? 'Yerel test ortamı: .test gönderimleri yerel test posta kutusuna iletilebilir. Gerçek bir alıcıya teslim sayılmaz.' : 'Bu adres .test uzantılı kurgusal bir adrestir. E-posta gönderilmeyecek; hesap hazırlanabilir ve parolayı yönetici elle belirleyebilir.'}</p>}
    <div className="mt"><Button size="sm" icon={blockedTestAddress ? 'user' : 'mail'} disabled={busy || loading || !data || !customer.email || data.account?.active === false || (blockedTestAddress && !!data.account)} onClick={send}>{busy ? 'İşlem yapılıyor…' : blockedTestAddress ? data?.account ? 'Hesap hazır · e-posta gönderilmez' : 'Kurgusal adres için hesabı hazırla' : data?.account ? 'Şifre e-postasını yeniden gönder' : 'Hesabı aç ve e-posta gönder'}</Button></div>
    {error && <p className="banner bad mt" role="alert">{error}</p>}
    {message && <p className="banner mt" role="status">{message}</p>}
    {data?.account && <p className="small muted mt">E-posta gönderimi başarısız olsa da hesap korunur. {actor.role === 'admin' ? <><Link href="/ayarlar">Ayarlar</Link> → Kullanıcılar bölümünde bu müşteri hesabını düzenleyip parolasını belirleyebilirsiniz.</> : 'Elle parola belirleme veya hesap e-postasını eşitleme için yöneticiye başvurun.'} Parola bu kartta gösterilmez.</p>}
    {!!data?.deliveries.length && <details className="mt small"><summary>Gönderim geçmişi ({data.deliveries.length})</summary><ul className="note-list">{data.deliveries.map(d => <li key={d.id}><strong>{d.status === 'sent' ? 'Sağlayıcı kabul etti · teslim doğrulanmadı' : d.status === 'failed' ? d.error_code === 'test_address_not_deliverable' ? 'Gönderilmedi · kurgusal adres' : 'Gönderim başarısız' : 'Sonuç bekleniyor'}</strong><br />{d.email}<br /><span className="muted">İstek: {fmtDateTime(d.created_at)}{d.completed_at && <> · Sonuç: {fmtDateTime(d.completed_at)}</>}</span>{d.status === 'failed' && <p className="mt">{deliveryMessage(d.error_code)}{d.error_code && Object.hasOwn(deliveryMessages, d.error_code) && <small className="cell-sub mono">Tanı: {d.error_code}</small>}</p>}</li>)}</ul></details>}
  </Card>;
}
