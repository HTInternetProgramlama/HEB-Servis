'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './store';
import { Button, Field, FormError, Modal } from './ui';
import { Icon } from './icons';
import { ShareSheet } from './share-sheet';
import { balance, recordPayment } from '@/lib/rules';
import { money, moneyInput, parseMoney, plateText, uid } from '@/lib/format';
import { receiptMessage } from '@/lib/share';
import type { Job, PaymentMethod } from '@/lib/types';

type Phase = 'form' | 'device' | 'done';
interface Draft { amount: number; method: PaymentMethod; note: string; at: string; auth: string; ref: string; last4: string }

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

/**
 * Tahsilat: kartlı ödemede ekranda POS cihazı, nakit/havalede fiş yazıcısı canlandırılır.
 * Bu bir kayıt ekranıdır; gerçek kart işlemi yapılmaz. Kayıt, cihaz "onaylandı" anında iş kuralından geçirilir.
 */
export function PaymentForm({ open, onClose, job }: { open: boolean; onClose: () => void; job: Job }) {
  const { state, run } = useApp();
  const [key] = useState(() => uid());
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('Kredi kartı');
  const open_ = balance(job);
  const customer = state.customers.find(c => c.id === job.customerId)!;
  const vehicle = state.vehicles.find(v => v.id === job.vehicleId)!;

  function start(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('');
    const f = new FormData(e.currentTarget);
    try {
      const amount = parseMoney(String(f.get('amount')));
      // Animasyondan önce kuralı kuru çalıştır: hatalı tutarda cihaz hiç açılmaz.
      recordPayment(state, { userId: 'dry', name: 'dry', role: 'advisor' }, job.id, { key: key + '-dry', amount, method, note: '' });
      setDraft({ amount, method, note: String(f.get('note') ?? ''), at: new Date().toISOString(), auth: digits(6), ref: digits(12), last4: digits(4) });
      setPhase('device');
    } catch (err) { setError(err instanceof Error ? err.message : 'Tutar geçersiz.') }
  }
  async function commit() {
    if (!draft) return 'Tutar yok';
    return run((s, a) => recordPayment(s, a, job.id, { key, amount: draft.amount, method: draft.method, note: draft.note || (draft.method === 'Kredi kartı' ? `Onay ${draft.auth}` : '') }), `${money(draft.amount)} tahsilat kaydedildi (${draft.method})`, job.no);
  }

  const title = phase === 'form' ? 'Tahsilat' : phase === 'device' ? (method === 'Kredi kartı' ? 'Kartla ödeme' : method === 'Nakit' ? 'Nakit tahsilat' : 'Havale / EFT kaydı') : 'Tahsilat tamamlandı';
  return <Modal open={open} onClose={onClose} title={title} sub={`${job.no} · ${plateText(vehicle.plate)} · kalan ${money(open_)}`} width={phase === 'form' ? 500 : 860}>
    {phase === 'form' && <form className="form" onSubmit={start}>
      <FormError error={error} />
      <div className="method-pick" role="radiogroup" aria-label="Ödeme yöntemi">
        {([['Kredi kartı', 'wallet', 'POS ile kart'], ['Nakit', 'receipt', 'Kasaya nakit'], ['Havale/EFT', 'building', 'Banka dekontu']] as const).map(([m, icon, sub]) =>
          <button type="button" role="radio" aria-checked={method === m} key={m} className={method === m ? 'active' : ''} onClick={() => setMethod(m)}><Icon name={icon} size={18} /><b>{m}</b><small>{sub}</small></button>)}
      </div>
      <div className="grid-2">
        <Field label="Tutar (₺)"><input name="amount" required inputMode="decimal" defaultValue={moneyInput(open_)} className="num big-input" /></Field>
        <Field label={method === 'Havale/EFT' ? 'Dekont / açıklama' : 'Açıklama'}><input name="note" maxLength={160} placeholder={method === 'Havale/EFT' ? 'Ör. dekont no' : 'İsteğe bağlı'} /></Field>
      </div>
      <p className="form-note"><Icon name="lock" size={14} />İşlem anahtarı <code>{key.slice(0, 8)}</code> — aynı tahsilat iki kez kaydedilmez. Ekrandaki cihaz canlandırmadır; gerçek kart çekimi yapılmaz.</p>
      <div className="form-actions"><Button onClick={onClose}>Vazgeç</Button><button className="btn primary" disabled={open_ <= 0}>{method === 'Kredi kartı' ? 'POS’a gönder' : 'Tahsilatı kaydet'}<Icon name="arrow" size={14} /></button></div>
    </form>}

    {phase !== 'form' && draft && <PaymentStage draft={draft} job={job} done={phase === 'done'} commit={commit}
      onFail={msg => { setError(msg); setPhase('form') }} onDone={() => setPhase('done')}
      share={<ShareSheet compact name={customer.name} phone={customer.phone} email={customer.email || undefined} subject={`${job.no} tahsilat bilgisi`} text={receiptMessage(state, { ...job, payments: [...job.payments.filter(p => p.key !== key), { id: key, key, amount: draft.amount, method: draft.method, note: '', at: draft.at, by: '' }] }, { id: key, key, amount: draft.amount, method: draft.method, note: '', at: draft.at, by: '' }, typeof location !== 'undefined' ? location.origin : '')} />}
      onClose={onClose} />}
  </Modal>;
}

type Step = 'boot' | 'tap' | 'read' | 'bank' | 'approved' | 'print' | 'printed' | 'torn';

function PaymentStage({ draft, job, done, commit, onFail, onDone, onClose, share }: { draft: Draft; job: Job; done: boolean; commit: () => Promise<string | null>; onFail: (m: string) => void; onDone: () => void; onClose: () => void; share: React.ReactNode }) {
  const card = draft.method === 'Kredi kartı';
  const [step, setStep] = useState<Step>('boot');
  const committed = useRef(false);
  const feed = useRef<HTMLDivElement>(null);
  const [feedH, setFeedH] = useState(0);
  useLayoutEffect(() => setFeedH(feed.current?.scrollHeight ?? 0), []);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const fast = reduced();
    const plan: [Step, number][] = card
      ? [['tap', 500], ['read', 1900], ['bank', 2900], ['approved', 4100], ['print', 4700], ['printed', 7400]]
      : [['print', 500], ['printed', 3000]];
    const at = (ms: number) => fast ? Math.min(ms, 50) : ms;
    timers.current = plan.map(([s, ms]) => setTimeout(() => setStep(s), at(ms)));
    return () => timers.current.forEach(clearTimeout);
  }, [card]);

  // Cihaz "onaylandı" (kart) veya yazdırma başlangıcı (nakit/havale) anında kaydı oluştur.
  useEffect(() => {
    if (committed.current || !(step === 'approved' || (!card && step === 'print'))) return;
    committed.current = true;
    commit().then(err => { if (err) { timers.current.forEach(clearTimeout); onFail(err) } });
  }, [step, card, commit, onFail]);

  function skip() { timers.current.forEach(clearTimeout); if (!committed.current) { committed.current = true; commit().then(err => err ? onFail(err) : setStep('printed')) } else setStep('printed') }
  function tear() { setStep('torn'); setTimeout(onDone, reduced() ? 0 : 650) }
  const printing = ['print', 'printed', 'torn'].includes(step);

  const screen = { boot: <><small>HEB SERVİS</small><span className="pos-wait" /></>,
    tap: <><small>TUTAR</small><strong>{money(draft.amount)}</strong><span className="pos-nfc"><i /><i /><i /></span><em>Kartı yaklaştırın veya takın</em></>,
    read: <><small>TUTAR</small><strong>{money(draft.amount)}</strong><span className="pos-dots"><i /><i /><i /><i /></span><em>Kart okunuyor</em></>,
    bank: <><small>BANKA</small><span className="pos-spin" /><em>Provizyon alınıyor</em></>,
    approved: <><span className="pos-ok"><Icon name="check" size={28} /></span><strong>ONAYLANDI</strong><em>Onay kodu {draft.auth}</em></>,
  } as Record<string, React.ReactNode>;
  const lcd = screen[step] ?? screen.approved;

  return <div className={'pay-stage ' + (done ? 'is-done' : '')}>
    <div className="pay-left">
      <div className={'pay-device ' + (card ? 'pos' : 'tprinter') + ' step-' + step}>
        <div ref={feed} className={'receipt-feed ' + (step === 'torn' ? 'torn' : '')} style={{ height: printing ? feedH : 0 }}>
          <Receipt draft={draft} job={job} />
        </div>
        {card ? <div className="pos-body">
          <div className="pos-slot" />
          <div className="pos-screen">{lcd}</div>
          <div className="pos-keys">{['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(k => <span key={k}>{k}</span>)}<span className="k-red">✕</span><span className="k-yel">‹</span><span className="k-grn">✓</span></div>
          <div className="pos-brand">HEB · POS</div>
        </div> : <div className="tp-body"><div className="pos-slot" /><span className="tp-led" /><span className="tp-label">{draft.method === 'Nakit' ? 'KASA YAZICISI' : 'DEKONT YAZICISI'}</span></div>}
        {card && <div className={'pay-card ' + (['tap', 'read'].includes(step) ? 'in' : '')}><span className="pc-chip" /><span className="pc-nfc">)))</span><span className="pc-no">•••• •••• •••• {draft.last4}</span><span className="pc-name">DEMO KART</span></div>}
      </div>
    </div>
    <div className="pay-right">
      {!done ? <div className="pay-status">
        <ol className="pay-steps">
          {(card ? [['tap', 'Kart bekleniyor'], ['read', 'Kart okunuyor'], ['bank', 'Bankadan provizyon'], ['approved', 'Onaylandı, kayıt oluşturuldu'], ['printed', 'Fiş yazdırıldı']] : [['print', 'Tahsilat kaydı oluşturuldu'], ['printed', 'Fiş yazdırıldı']]).map(([s, label]) => {
            const order: Step[] = ['boot', 'tap', 'read', 'bank', 'approved', 'print', 'printed', 'torn'];
            const state = order.indexOf(step) > order.indexOf(s as Step) || (s === 'printed' && step === 'printed') || step === 'torn' ? 'done' : order.indexOf(step) === order.indexOf(s as Step) ? 'now' : '';
            return <li key={s} className={state}><span>{state === 'done' ? <Icon name="check" size={12} /> : null}</span>{label}</li>;
          })}
        </ol>
        <div className="pay-amount"><small>{draft.method}</small><strong>{money(draft.amount)}</strong></div>
        <div className="btn-row">
          {step === 'printed' ? <Button variant="primary" icon="receipt" onClick={tear}>Fişi kopar</Button> : <Button variant="ghost" onClick={skip}>Animasyonu atla</Button>}
        </div>
      </div> : <div className="pay-done">
        <div className="pay-done-head"><span className="done-check"><Icon name="check" size={22} /></span><div><strong>{money(draft.amount)} tahsil edildi</strong><small>Fişi müşteriye iletebilirsiniz.</small></div></div>
        {share}
        <div className="form-actions"><Button icon="printer" onClick={() => print()}>Fişi yazdır</Button><Button variant="primary" onClick={onClose}>Kapat</Button></div>
      </div>}
    </div>
  </div>;
}

function Receipt({ draft, job }: { draft: Draft; job: Job }) {
  const { state } = useApp();
  const co = state.settings.company, v = state.vehicles.find(x => x.id === job.vehicleId)!;
  const d = new Date(draft.at);
  const bars = useMemo(() => Array.from({ length: 46 }, (_, i) => 1 + ((i * 7 + Number(draft.ref[i % 12])) % 3)), [draft.ref]);
  const row = (k: string, val: string) => <div className="r-row"><span>{k}</span><span>{val}</span></div>;
  return <div className="receipt" aria-label="Tahsilat fişi">
    <div className="r-center r-strong">{co.name.toLocaleUpperCase('tr')}</div>
    <div className="r-center">{co.branch}</div>
    <div className="r-center r-small">{co.address}</div>
    <div className="r-center r-small">TEL {co.phone} · VKN {co.taxNo}</div>
    <div className="r-sep" />
    <div className="r-center r-strong">{draft.method === 'Kredi kartı' ? 'SATIŞ' : draft.method === 'Nakit' ? 'NAKİT TAHSİLAT' : 'HAVALE / EFT TAHSİLAT'}</div>
    {row('TARİH', d.toLocaleDateString('tr-TR'))}
    {row('SAAT', d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))}
    {row('İŞ EMRİ', job.no)}
    {row('PLAKA', plateText(v.plate))}
    {draft.method === 'Kredi kartı' && <>
      {row('KART', `**** **** **** ${draft.last4}`)}
      {row('İŞLEM', 'TEMASSIZ')}
      {row('ONAY KODU', draft.auth)}
      {row('REF NO', draft.ref)}
    </>}
    {draft.note && row('AÇIKLAMA', draft.note.slice(0, 22))}
    <div className="r-sep" />
    <div className="r-total"><span>TUTAR</span><span>{money(draft.amount)}</span></div>
    <div className="r-sep" />
    <div className="r-center r-strong">{draft.method === 'Kredi kartı' ? 'İŞLEM ONAYLANDI' : 'TAHSİL EDİLDİ'}</div>
    {draft.method === 'Kredi kartı' && <div className="r-center r-small">KARŞILIĞI MAL/HİZMET ALDIM</div>}
    <div className="r-barcode" aria-hidden="true">{bars.map((w, i) => <i key={i} style={{ width: w }} />)}</div>
    <div className="r-center r-small">{draft.ref}</div>
    <div className="r-center r-small r-demo">DEMO FİŞ · MALİ DEĞERİ YOKTUR</div>
  </div>;
}
