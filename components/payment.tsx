'use client';
import { useState } from 'react';
import { useApp } from './store';
import { Button, Field, FormError, Modal, useFormRunner } from './ui';
import { Icon } from './icons';
import { ShareSheet } from './share-sheet';
import { balance, recordPayment } from '@/lib/commands';
import { money, moneyInput, parseMoney, plateText, uid } from '@/lib/format';
import { receiptMessage } from '@/lib/share';
import type { Job, PaymentMethod } from '@/lib/types';

/**
 * Tahsilat kaydı: yöntem, tutar ve açıklama girilir; kayıt iş kuralından geçer.
 * Bu bir kayıt ekranıdır, çevrim içi ödeme almaz. Kayıttan sonra makbuz bilgisi müşteriye iletilebilir.
 */
export function PaymentForm({ open, onClose, job }: { open: boolean; onClose: () => void; job: Job }) {
  const { state, run } = useApp();
  const [key] = useState(() => uid());
  const [method, setMethod] = useState<PaymentMethod>('Kredi kartı');
  const [done, setDone] = useState(false);
  const { error, busy, submit, setError } = useFormRunner();
  const open_ = balance(job);
  const customer = state.customers.find(c => c.id === job.customerId)!;
  const vehicle = state.vehicles.find(v => v.id === job.vehicleId)!;
  const current = state.jobs.find(j => j.id === job.id) ?? job;
  const paid = current.payments.find(p => p.key === key);

  return <Modal open={open} onClose={onClose} title={done ? 'Tahsilat kaydedildi' : 'Tahsilat al'} sub={`${job.no} · ${plateText(vehicle.plate)} · ${customer.name}`} width={done ? 760 : 520}>
    {!done ? <form className="form" onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      let amount = 0;
      try { amount = parseMoney(String(f.get('amount'))) } catch (err) { setError(err instanceof Error ? err.message : 'Tutar geçersiz.'); return }
      const note = String(f.get('note') ?? '');
      submit(() => run((s, a) => recordPayment(s, a, job.id, { key, amount, method, note }), `${money(amount)} tahsilat kaydedildi (${method})`, job.no), () => setDone(true));
    }}>
      <FormError error={error} />
      <dl className="fact-list boxed">
        <div><dt>Kalan bakiye</dt><dd className="strong">{money(open_)}</dd></div>
      </dl>
      <fieldset className="radio-row"><legend className="field-label">Ödeme yöntemi</legend>
        {(['Kredi kartı', 'Nakit', 'Havale/EFT'] as PaymentMethod[]).map(m => <label key={m} className="check inline"><input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} />{m}</label>)}
      </fieldset>
      <div className="grid-2">
        <Field label="Tutar (₺)"><input name="amount" required inputMode="decimal" defaultValue={moneyInput(open_)} className="num" /></Field>
        <Field label={method === 'Havale/EFT' ? 'Dekont no / açıklama' : method === 'Kredi kartı' ? 'POS onay kodu / açıklama' : 'Açıklama'}><input name="note" maxLength={160} placeholder="İsteğe bağlı" /></Field>
      </div>
      <p className="form-note"><Icon name="lock" size={14} />İşlem anahtarı <code>{key.slice(0, 8)}</code>: aynı tahsilat iki kez kaydedilmez.</p>
      <div className="form-actions"><Button onClick={onClose}>Vazgeç</Button><button className="btn primary" disabled={busy || open_ <= 0}>Tahsilatı kaydet</button></div>
    </form> : <div className="stack">
      <div className="banner ok"><Icon name="check" size={15} /><div><strong>{paid ? money(paid.amount) : ''} tahsil edildi</strong> · {method} · kalan bakiye {money(balance(current))}</div></div>
      {paid && <ShareSheet compact name={customer.name} phone={customer.phone} email={customer.email || undefined} subject={`${job.no} tahsilat bilgisi`} text={receiptMessage(state, current, paid, location.origin)} />}
      <div className="form-actions"><Button variant="primary" onClick={onClose}>Kapat</Button></div>
    </div>}
  </Modal>;
}
