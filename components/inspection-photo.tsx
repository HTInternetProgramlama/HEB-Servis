'use client';
import { useRef, useState } from 'react';
import { useStore } from './store';
import { Button, Modal } from './ui';

export function InspectionPhoto({ id, hasPhoto, writable = false }: { id: string; hasPhoto: boolean; writable?: boolean }) {
  const { notify, reload } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [exists, setExists] = useState(hasPhoto);
  async function show() {
    setBusy(true);
    try {
      const response = await fetch(`/api/photos?inspectionId=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setUrl(data.url);
    } catch (error) { notify(error instanceof Error ? error.message : 'Fotoğraf açılamadı.', 'error'); }
    finally { setBusy(false); }
  }
  return <span className="btn-row">
    {(exists || hasPhoto) && <Button size="sm" disabled={busy} onClick={() => void show()}>Fotoğrafı aç</Button>}
    {writable && <>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={async event => {
        const file = event.target.files?.[0]; if (!file) return;
        if (file.size > 5 * 1024 * 1024) { notify('Fotoğraf en fazla 5 MB olabilir.', 'error'); return; }
        setBusy(true);
        try {
          const form = new FormData(); form.set('inspectionId', id); form.set('file', file);
          const response = await fetch('/api/photos', { method: 'POST', body: form });
          const data = await response.json(); if (!response.ok) throw new Error(data.error);
          setExists(true); await reload(); notify('Fotoğraf özel dosya alanına kaydedildi.');
        } catch (error) { notify(error instanceof Error ? error.message : 'Fotoğraf yüklenemedi.', 'error'); }
        finally { setBusy(false); if (input.current) input.current.value = ''; }
      }} />
      <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Yükleniyor…' : exists || hasPhoto ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'}</Button>
    </>}
    {url && <Modal open title="Kontrol fotoğrafı" onClose={() => setUrl('')} width={850}>
      <img src={url} alt="Servis kontrol bulgusuna ait fotoğraf" style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', margin: 'auto', objectFit: 'contain' }} />
      <p className="small muted">Bu özel bağlantı beş dakika geçerlidir.</p>
    </Modal>}
  </span>;
}
