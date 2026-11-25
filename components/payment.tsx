'use client';
import { useState } from 'react';
import { useApp } from './store';
import { Button, Field, FormError, Modal } from './ui';
import { Icon } from './icons';
import { ShareSheet } from './share-sheet';
import { balance, recordPayment } from '@/lib/commands';
import { recordPayment as checkPayment } from '@/lib/rules';
import { money, moneyInput, parseMoney, plateText, uid } from '@/lib/format';
import { receiptMessage } from '@/lib/share';
import type { Job, Payment, PaymentMethod } from '@/lib/types';

/**
 * Tahsilat kaydı: yöntem, tutar, açıklama → kaydet. Gerçek kart çekimi yapılmaz; bu ekran kayıt tutar.
 * Tutar önce iş kuralında kuru çalıştırılır, kayıt run(recordPayment) ile yapılır.
 */
export function PaymentForm({ open, onClose, job }: { open: boolean; onClose: () => void; job: Job }) {
  const { state, run } = useApp();
  const [key] = useState(() => uid());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Payment | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('Kredi kartı');
  const open_ = balance(job);
  const customer = state.customers.find(c => c.id === job.customerId)!;
  const vehicle = state.vehicles.find(v => v.id === job.vehicleId)!;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('');
    const f = new FormData(e.currentTarget);
    const note = String(f.get('note') ?? '');
    let amount: number;
    try {
      amount = parseMoney(String(f.get('amount')));
      checkPayment(state, { userId: 'dry', name: 'dry', role: 'advisor' }, job.id, { key: key + '-dry', amount, method, note: '' });
    } catch (err) { setError(err instanceof Error ? err.message : 'Tutar geçersiz.'); return }
    setBusy(true);
    const err = await run((s, a) => recordPayment(s, a, job.id, { key, amount, method, note }), `${money(amount)} tahsilat kaydedildi (${method})`, job.no);
    setBusy(false);
    if (err) setError(err);
    else setDone({ id: key, key, amount, method, note, at: new Date().toISOString(), by: '' });
  }

  return <Modal open={open} onClose={onClose} title={done ? 'Tahsilat kaydedildi' : 'Ödeme al'}
    sub={`${job.no} · ${plateText(vehicle.plate)} · kalan ${money(open_).replace(/ /g, ' ')}`} width={done ? 640 : 480}>
    {!done ? <form className="form" onSubmit={save}>
      <FormError error={error} />
      <div className="seg pay-methods" role="radiogroup" aria-label="Ödeme yöntemi">
        {(['Kredi kartı', 'Nakit', 'Havale/EFT'] as const).map(m => <button type="button" role="radio" aria-checked={method === m} key={m} className={method === m ? 'active' : ''} onClick={() => setMethod(m)}>{m}</button>)}
      </div>
      <div className="grid-2">
        <Field label="Tutar (₺)"><input name="amount" required inputMode="decimal" defaultValue={moneyInput(open_)} className="num" /></Field>
        <Field label={method === 'Havale/EFT' ? 'Dekont no / açıklama' : method === 'Kredi kartı' ? 'POS onay kodu (isteğe bağlı)' : 'Açıklama'}><input name="note" maxLength={160} /></Field>
      </div>
      <p className="form-note"><Icon name="lock" size={14} />Aynı tahsilat iki kez kaydedilmez. Bu ekran kayıt tutar, kart çekimi yapmaz.</p>
      <div className="form-actions"><Button onClick={onClose}>Vazgeç</Button><button className="btn primary" disabled={busy || open_ <= 0}><Icon name="check" size={15} />Tahsilatı kaydet</button></div>
    </form> : <div className="stack">
      <div className="banner ok"><Icon name="check" size={15} /><div><strong>{money(done.amount)}</strong> · {done.method} · kalan {money(balance(job))}</div></div>
      <ShareSheet compact name={customer.name} phone={customer.phone} email={customer.email || undefined} subject={`${job.no} tahsilat bilgisi`}
        text={receiptMessage(state, { ...job, payments: [...job.payments.filter(p => p.key !== key), done] }, done, typeof location !== 'undefined' ? location.origin : '')} />
      <div className="form-actions"><Button variant="primary" onClick={onClose}>Kapat</Button></div>
    </div>}
  </Modal>;
}
