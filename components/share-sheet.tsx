'use client';
import { useEffect, useState } from 'react';
import { Icon } from './icons';
import { mailUrl, smsUrl, waPhone, whatsappUrl } from '@/lib/share';

function WaGlyph() {
  return <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z" /></svg>;
}

/** Mesaj önizlemesi ve gönderim kanalları. Gönderim kullanıcının kendi WhatsApp / e-posta uygulamasında açılır; sistem otomatik mesaj göndermez. */
export function ShareSheet({ name, phone, email, subject, text, compact }: { name: string; phone: string; email?: string; subject: string; text: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 650); return () => clearTimeout(t) }, []);
  const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const validWa = !!waPhone(phone);
  return <div className={'share ' + (compact ? 'compact' : '')}>
    <div className="chat" aria-label="Mesaj önizlemesi">
      <div className="chat-head"><span className="chat-avatar">{name.split(' ').map(p => p[0]).slice(0, 2).join('')}</span><div><strong>{name}</strong><small>{phone}</small></div></div>
      <div className="chat-body">
        {!shown ? <div className="bubble typing" aria-hidden="true"><i /><i /><i /></div>
          : <div className="bubble out">{text}<span className="bubble-meta">{time} <svg viewBox="0 0 18 11" width="15" height="10" aria-hidden="true"><path d="M1 6l3 3 6-7M7 9l1 1 8-9" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg></span></div>}
      </div>
    </div>
    <div className="share-actions">
      <a className={'share-btn wa ' + (validWa ? '' : 'disabled')} href={validWa ? whatsappUrl(phone, text) : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!validWa}><WaGlyph /><span><b>WhatsApp ile gönder</b><small>{validWa ? 'Mesaj hazır açılır, siz gönderirsiniz' : 'Telefon numarası geçersiz'}</small></span></a>
      <a className="share-btn" href={smsUrl(phone, text)}><Icon name="phone" size={16} /><span><b>SMS</b><small>{phone}</small></span></a>
      {email && <a className="share-btn" href={mailUrl(email, subject, text)}><Icon name="mail" size={16} /><span><b>E-posta</b><small>{email}</small></span></a>}
      <button type="button" className="share-btn" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* izin yok */ } }}>
        <Icon name={copied ? 'check' : 'file'} size={16} /><span><b>{copied ? 'Kopyalandı' : 'Metni kopyala'}</b><small>Başka bir kanala yapıştırın</small></span></button>
    </div>
  </div>;
}
