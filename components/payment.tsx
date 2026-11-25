'use client';
import { useRef, useState } from 'react';
import { useApp } from './store';
import { Button, Field, FormError, Modal, useFormRunner } from './ui';
import { balance, recordPayment } from '@/lib/commands';
import { recordPayment as checkPayment } from '@/lib/rules';
import { money, moneyInput, parseMoney, plateText, uid } from '@/lib/format';
import type { Job, PaymentMethod } from '@/lib/types';

export function PaymentForm({ open, onClose, job }: { open: boolean; onClose: () => void; job: Job }) {
  const { state, actor, run } = useApp();
  const [key] = useState(() => uid());
  const [method, setMethod] = useState<PaymentMethod>('Kredi kartı');
  const { error, busy, submit } = useFormRunner();
  const submitting = useRef(false);
  const open_ = balance(job);
  const vehicle = state.vehicles.find(v => v.id === job.vehicleId)!;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const f = new FormData(e.currentTarget);
    try {
      await submit(async () => {
        const input = { key, amount: parseMoney(String(f.get('amount'))), method, note: String(f.get('note') ?? '').trim() };
        // Saf ön doğrulama; kayıt komutu yalnız run içinde çalışır.
        checkPayment(state, actor, job.id, input);
        return run((s, a) => recordPayment(s, a, job.id, input), `${money(input.amount)} tahsilat kaydedildi (${method})`, job.no);
      }, onClose);
    } finally { submitting.current = false }
  }

  return <Modal open={open} onClose={() => { if (!submitting.current) onClose() }} title="Tahsilat" sub={`${job.no} · ${plateText(vehicle.plate)} · kalan ${money(open_)}`} width={500}>
    <form className="form" onSubmit={save}>
      <FormError error={error} />
      <Field label="Ödeme yöntemi">
        <select value={method} disabled={busy} onChange={e => setMethod(e.target.value as PaymentMethod)}>
          {(['Kredi kartı', 'Nakit', 'Havale/EFT'] as const).map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </Field>
      <Field label="Tutar (₺)"><input name="amount" required disabled={busy} inputMode="decimal" defaultValue={moneyInput(open_)} className="num big-input" /></Field>
      <Field label="Açıklama"><input name="note" disabled={busy} maxLength={160} placeholder="İsteğe bağlı" /></Field>
      <div className="form-actions"><Button disabled={busy} onClick={onClose}>Vazgeç</Button><button type="submit" className="btn primary" disabled={busy || open_ <= 0}>{busy ? 'Kaydediliyor…' : 'Tahsilatı kaydet'}</button></div>
    </form>
  </Modal>;
}
