'use client';
import { useState } from 'react';
import { useApp } from './store';
import { Button, Field, FormError, Modal, useFormRunner } from './ui';
import { Icon } from './icons';
import {
  addCustomer, addNote, addVehicle, balance, deliverJob, evaluateVisit, openJob, recordPayment, requestAppointment,
  rescheduleAppointment, suggestedNextService, technicians, updateCustomer, updateVehicle, upsertLine, type CustomerInput, type VehicleInput,
} from '@/lib/rules';
import { addDays, hhmm, minutes, money, moneyInput, parseMoney, parseQty, qtyText, today, uid } from '@/lib/format';
import type { Appointment, Customer, Damage, DamageKind, EstimateLine, Job, NoteCategory, PaymentMethod, Vehicle } from '@/lib/types';

const str = (f: FormData, k: string) => String(f.get(k) ?? '');

/* ───────── Müşteri ───────── */
export function CustomerForm({ open, onClose, customer, onSaved }: { open: boolean; onClose: () => void; customer?: Customer; onSaved?: (id: string) => void }) {
  const { run } = useApp();
  const { error, busy, submit } = useFormRunner();
  const [kind, setKind] = useState<Customer['kind']>(customer?.kind ?? 'Bireysel');
  return <Modal open={open} onClose={onClose} title={customer ? 'Müşteri bilgilerini düzenle' : 'Yeni müşteri'} sub={customer?.no}>
    <form className="form" onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      const input: CustomerInput = { kind, name: str(f, 'name'), phone: str(f, 'phone'), email: str(f, 'email'), address: str(f, 'address'), taxNo: str(f, 'taxNo'), preference: str(f, 'preference') as Customer['preference'], consent: f.get('consent') === 'on' };
      let newId = '';
      submit(() => run((s, a) => { if (customer) return updateCustomer(s, a, customer.id, input); const n = addCustomer(s, a, input); newId = n.customers.at(-1)!.id; return n }, customer ? `${input.name} müşteri kaydı güncellendi` : `${input.name} müşteri olarak kaydedildi`, customer?.no), () => { onClose(); if (newId) onSaved?.(newId) });
    }}>
      <FormError error={error} />
      <div className="seg small">{(['Bireysel', 'Kurumsal'] as const).map(k => <button type="button" key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>{k}</button>)}</div>
      <div className="grid-2">
        <Field label={kind === 'Kurumsal' ? 'Firma unvanı' : 'Ad soyad'} wide><input name="name" required minLength={3} maxLength={120} defaultValue={customer?.name} /></Field>
        <Field label="Telefon"><input name="phone" type="tel" required maxLength={20} placeholder="0555 123 45 67" defaultValue={customer?.phone} /></Field>
        <Field label="E-posta"><input name="email" type="email" maxLength={120} defaultValue={customer?.email} /></Field>
        <Field label={kind === 'Kurumsal' ? 'Vergi no' : 'T.C. kimlik no (isteğe bağlı)'}><input name="taxNo" inputMode="numeric" maxLength={11} defaultValue={customer?.taxNo} required={kind === 'Kurumsal'} /></Field>
        <Field label="İletişim tercihi"><select name="preference" defaultValue={customer?.preference ?? 'Telefon'}><option>Telefon</option><option>SMS</option><option>E-posta</option></select></Field>
        <Field label="Adres" wide><textarea name="address" rows={2} maxLength={300} defaultValue={customer?.address} /></Field>
      </div>
      <label className="check"><input type="checkbox" name="consent" defaultChecked={customer?.consent} /> KVKK aydınlatma metni müşteriye iletildi ve açık rıza alındı.</label>
      <div className="form-actions"><Button onClick={onClose}>Vazgeç</Button><button className="btn primary" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button></div>
    </form>
  </Modal>;
}

/* ───────── Araç ───────── */
export function VehicleForm({ open, onClose, vehicle, customerId }: { open: boolean; onClose: () => void; vehicle?: Vehicle; customerId?: string }) {
  const { state, run } = useApp();
  const { error, busy, submit } = useFormRunner();
  return <Modal open={open} onClose={onClose} title={vehicle ? 'Araç bilgilerini düzenle' : 'Yeni araç'} width={620}>
    <form className="form" onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      const input: VehicleInput = { customerId: str(f, 'customerId'), plate: str(f, 'plate'), brand: str(f, 'brand'), model: str(f, 'model'), year: Number(str(f, 'year')), km: Number(str(f, 'km')), vin: str(f, 'vin').trim(), fuel: str(f, 'fuel') as Vehicle['fuel'], transmission: str(f, 'transmission') as Vehicle['transmission'], color: str(f, 'color') };
      submit(() => run((s, a) => vehicle ? updateVehicle(s, a, vehicle.id, input) : addVehicle(s, a, input), vehicle ? `${input.plate.toLocaleUpperCase('tr')} araç kaydı güncellendi` : `${input.plate.toLocaleUpperCase('tr')} plakalı araç eklendi`), onClose);
    }}>
      <FormError error={error} />
      <div className="grid-3">
        <Field label="Araç sahibi" wide><select name="customerId" defaultValue={vehicle?.customerId ?? customerId ?? ''} required><option value="" disabled>Müşteri seçin</option>{state.customers.map(c => <option key={c.id} value={c.id}>{c.name} · {c.no}</option>)}</select></Field>
        <Field label="Plaka"><input name="plate" required maxLength={12} placeholder="58 ABC 123" defaultValue={vehicle?.plate} className="mono upper" /></Field>
        <Field label="Marka"><input name="brand" required maxLength={40} defaultValue={vehicle?.brand} list="brands" /></Field>
        <Field label="Model"><input name="model" required maxLength={40} defaultValue={vehicle?.model} /></Field>
        <Field label="Model yılı"><input name="year" type="number" min={1950} max={new Date().getFullYear() + 1} required defaultValue={vehicle?.year ?? new Date().getFullYear() - 3} /></Field>
        <Field label="Kilometre"><input name="km" type="number" min={0} required defaultValue={vehicle?.km ?? 0} /></Field>
        <Field label="Yakıt"><select name="fuel" defaultValue={vehicle?.fuel ?? 'Benzin'}>{['Benzin', 'Dizel', 'Hibrit', 'Elektrik', 'LPG'].map(x => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Vites"><select name="transmission" defaultValue={vehicle?.transmission ?? 'Manuel'}><option>Manuel</option><option>Otomatik</option></select></Field>
        <Field label="Renk"><input name="color" maxLength={30} defaultValue={vehicle?.color} /></Field>
        <Field label="Şasi no (VIN)" hint="17 karakter; ruhsattan" wide><input name="vin" maxLength={17} defaultValue={vehicle?.vin} className="mono upper" /></Field>
      </div>
      <datalist id="brands">{['Volkswagen', 'Renault', 'Fiat', 'Ford', 'Toyota', 'Hyundai', 'Peugeot', 'Dacia', 'Opel', 'Citroën', 'Skoda', 'Honda', 'BMW', 'Mercedes-Benz', 'Audi'].map(b => <option key={b} value={b} />)}</datalist>
      <div className="form-actions"><Button onClick={onClose}>Vazgeç</Button><button className="btn primary" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button></div>
    </form>
  </Modal>;
}

/* ───────── Randevu ───────── */
export function AppointmentForm({ open, onClose, preset, editing, portal }: { open: boolean; onClose: () => void; preset?: Partial<Appointment>; editing?: Appointment; portal?: boolean }) {
  const { state, actor, run } = useApp();
  const { error, busy, submit } = useFormRunner();
  const [customerId, setCustomerId] = useState(editing?.customerId ?? preset?.customerId ?? (portal ? actor.customerId! : ''));
  const [serviceId, setServiceId] = useState(editing?.serviceId ?? preset?.serviceId ?? state.settings.services[0].id);
  const service = state.settings.services.find(s => s.id === serviceId);
  const vehicles = state.vehicles.filter(v => v.customerId === customerId);
  const slots: string[] = [];
  for (let m = minutes(state.settings.workStart); m < minutes(state.settings.workEnd); m += 15) slots.push(hhmm(m));
  return <Modal open={open} onClose={onClose} title={editing ? `Randevuyu değiştir · ${editing.no}` : portal ? 'Randevu talebi' : 'Yeni randevu'} sub={portal ? 'Talebiniz servis danışmanı onayıyla kesinleşir.' : 'Talep olarak açılır; onay sırasında servis alanı çakışması denetlenir.'} width={620}>
    <form className="form" onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      const slot = { date: str(f, 'date'), time: str(f, 'time'), duration: Number(str(f, 'duration')), resourceId: str(f, 'resourceId') };
      if (editing) return submit(() => run((s, a) => rescheduleAppointment(s, a, editing.id, slot), `${editing.no} randevusu ${slot.date} ${slot.time} olarak güncellendi`, editing.no), onClose);
      const input = { ...slot, customerId, vehicleId: str(f, 'vehicleId'), serviceId, note: str(f, 'note'), source: (portal ? 'Portal' : str(f, 'source')) as Appointment['source'] };
      submit(() => run((s, a) => requestAppointment(s, a, input), portal ? 'Randevu talebiniz alındı' : 'Randevu talebi oluşturuldu'), onClose);
    }}>
      <FormError error={error} />
      <div className="grid-2">
        {!portal && <Field label="Müşteri" wide><select value={customerId} disabled={!!editing} onChange={e => setCustomerId(e.target.value)} required><option value="" disabled>Müşteri seçin</option>{state.customers.map(c => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></Field>}
        <Field label="Araç" wide><select key={customerId} name="vehicleId" required disabled={!!editing} defaultValue={editing?.vehicleId ?? preset?.vehicleId ?? (vehicles.length === 1 ? vehicles[0].id : '')}><option value="" disabled>{customerId ? 'Araç seçin' : 'Önce müşteri seçin'}</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model}</option>)}</select></Field>
        <Field label="Hizmet"><select value={serviceId} disabled={!!editing} onChange={e => setServiceId(e.target.value)}>{state.settings.services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Süre (dk)"><input key={serviceId} name="duration" type="number" min={15} max={480} step={15} required defaultValue={editing?.duration ?? service?.duration ?? 60} readOnly={portal} /></Field>
        <Field label="Tarih"><input type="date" name="date" min={today()} max={addDays(today(), 90)} required defaultValue={editing?.date ?? preset?.date ?? today()} /></Field>
        <Field label="Saat"><select name="time" required defaultValue={editing?.time ?? preset?.time ?? '10:00'}>{slots.map(t => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Servis alanı"><select name="resourceId" defaultValue={editing?.resourceId ?? preset?.resourceId ?? state.settings.resources[0].id}>{state.settings.resources.filter(r => r.active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
        {!portal && !editing && <Field label="Talep kanalı"><select name="source" defaultValue="Telefon"><option>Telefon</option><option>Şube</option></select></Field>}
        {!editing && <Field label="Açıklama / şikâyet" wide><textarea name="note" rows={2} maxLength={500} placeholder="Ör. sabahları ilk çalıştırmada ses geliyor" /></Field>}
      </div>
      <p className="form-note"><Icon name="clock" size={14} />Çalışma saatleri {state.settings.workStart}–{state.settings.workEnd}, öğle arası {state.settings.breakStart}–{state.settings.breakEnd}. {portal && 'Randevuya 2 saatten fazla varken portaldan iptal edebilirsiniz.'}</p>
      <div className="form-actions"><Button onClick={onClose}>Vazgeç</Button><button className="btn primary" disabled={busy || (!editing && !vehicles.length)}>{busy ? 'Kaydediliyor…' : editing ? 'Değişikliği kaydet' : portal ? 'Talep gönder' : 'Randevu talebi oluştur'}</button></div>
    </form>
  </Modal>;
}

/* ───────── Araç kabul ───────── */
const zones: { id: string; d: string; label: string }[] = [
  { id: 'Ön tampon', label: 'Ön tampon', d: 'M60 12h80v18H60z' },
  { id: 'Kaput', label: 'Kaput', d: 'M58 32h84v52H58z' },
  { id: 'Ön cam', label: 'Ön cam', d: 'M62 86h76v18H62z' },
  { id: 'Tavan', label: 'Tavan', d: 'M62 106h76v74H62z' },
  { id: 'Arka cam', label: 'Arka cam', d: 'M62 182h76v16H62z' },
  { id: 'Bagaj', label: 'Bagaj', d: 'M58 200h84v40H58z' },
  { id: 'Arka tampon', label: 'Arka tampon', d: 'M60 242h80v18H60z' },
  { id: 'Sol ön çamurluk', label: 'Sol ön çamurluk', d: 'M30 32h26v62H30z' },
  { id: 'Sol ön kapı', label: 'Sol ön kapı', d: 'M30 96h26v56H30z' },
  { id: 'Sol arka kapı', label: 'Sol arka kapı', d: 'M30 154h26v46H30z' },
  { id: 'Sol arka çamurluk', label: 'Sol arka çamurluk', d: 'M30 202h26v40H30z' },
  { id: 'Sağ ön çamurluk', label: 'Sağ ön çamurluk', d: 'M144 32h26v62h-26z' },
  { id: 'Sağ ön kapı', label: 'Sağ ön kapı', d: 'M144 96h26v56h-26z' },
  { id: 'Sağ arka kapı', label: 'Sağ arka kapı', d: 'M144 154h26v46h-26z' },
  { id: 'Sağ arka çamurluk', label: 'Sağ arka çamurluk', d: 'M144 202h26v40h-26z' },
];
export function DamageMap({ damages, onToggle, readOnly }: { damages: Damage[]; onToggle?: (area: string) => void; readOnly?: boolean }) {
  return <svg viewBox="0 0 200 272" className="damage-map" role="group" aria-label="Kaporta hasar haritası">
    <rect x="28" y="8" width="144" height="256" rx="34" className="dm-body" />
    {zones.map(z => {
      const marked = damages.some(d => d.area === z.id);
      return <path key={z.id} d={z.d} className={'dm-zone ' + (marked ? 'marked' : '') + (readOnly ? ' ro' : '')} tabIndex={readOnly ? -1 : 0} role={readOnly ? undefined : 'button'} aria-label={z.label + (marked ? ' – hasar işaretli' : '')}
        onClick={() => !readOnly && onToggle?.(z.id)} onKeyDown={e => { if (!readOnly && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onToggle?.(z.id) } }}><title>{z.label}</title></path>;
    })}
    <text x="100" y="6" textAnchor="middle" className="dm-label">ÖN</text>
    <text x="100" y="271" textAnchor="middle" className="dm-label">ARKA</text>
  </svg>;
}
export function FuelGauge({ value }: { value: number }) {
  return <span className="fuel-gauge" aria-label={`Yakıt ${value}/8`}>{Array.from({ length: 8 }, (_, i) => <i key={i} className={i < value ? 'on' : ''} />)}<small>{value}/8</small></span>;
}

export function IntakeForm({ open, onClose, appointment, onDone }: { open: boolean; onClose: () => void; appointment?: Appointment; onDone?: (jobId: string) => void }) {
  const { state, run } = useApp();
  const { error, busy, submit } = useFormRunner();
  const [customerId, setCustomerId] = useState(appointment?.customerId ?? '');
  const [vehicleId, setVehicleId] = useState(appointment?.vehicleId ?? '');
  const [fuel, setFuel] = useState(4);
  const [damages, setDamages] = useState<Damage[]>([]);
  const vehicle = state.vehicles.find(v => v.id === vehicleId);
  const techs = technicians(state);
  const load = (id: string) => state.jobs.filter(j => j.technicianId === id && !['Teslim edildi', 'İptal', 'Teslime hazır'].includes(j.status)).length;
  // Varsayılan teslim: 3 saat sonrası; mesai bitimini aşıyorsa ertesi gün kapanıştan yarım saat önce.
  const promised = (() => {
    const end = minutes(state.settings.workEnd) - 30, d = new Date(), target = d.getHours() * 60 + d.getMinutes() + 180;
    return target <= end ? `${today()}T${hhmm(Math.ceil(target / 30) * 30)}` : `${addDays(today(), 1)}T${hhmm(end)}`;
  })();
  function toggle(area: string) { setDamages(d => d.some(x => x.area === area) ? d.filter(x => x.area !== area) : [...d, { area, kind: 'Çizik', note: '' }]) }
  return <Modal open={open} onClose={onClose} title="Araç kabul formu" sub={appointment ? `Randevu ${appointment.no} · ${appointment.time}` : 'Randevusuz kabul'} width={880}>
    <form className="form" onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      const input = { appointmentId: appointment?.id, customerId, vehicleId, serviceId: str(f, 'serviceId'), technicianId: str(f, 'technicianId'), km: Number(str(f, 'km')), fuel, complaint: str(f, 'complaint'), damages, belongings: str(f, 'belongings'), customerAck: f.get('ack') === 'on', promisedAt: new Date(str(f, 'promisedAt') + ':00+03:00').toISOString() };
      let jobId = '';
      submit(() => run((s, a) => { const n = openJob(s, a, input); jobId = n.jobs.at(-1)!.id; return n }, 'Araç kabul edildi, iş emri açıldı', appointment?.no), () => { onClose(); if (jobId) onDone?.(jobId) });
    }}>
      <FormError error={error} />
      <div className="intake">
        <div className="intake-main">
          <h3 className="form-section">Araç ve müşteri</h3>
          <div className="grid-2">
            <Field label="Müşteri"><select value={customerId} disabled={!!appointment} onChange={e => { setCustomerId(e.target.value); setVehicleId('') }} required><option value="" disabled>Müşteri seçin</option>{state.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Araç"><select value={vehicleId} disabled={!!appointment} onChange={e => setVehicleId(e.target.value)} required><option value="" disabled>Araç seçin</option>{state.vehicles.filter(v => v.customerId === customerId).map(v => <option key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model}</option>)}</select></Field>
            <Field label="Hizmet türü"><select name="serviceId" defaultValue={appointment?.serviceId ?? state.settings.services[0].id}>{state.settings.services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Teknisyen"><select name="technicianId" required defaultValue=""><option value="" disabled>Teknisyen seçin</option>{techs.map(t => <option key={t.id} value={t.id}>{t.name} · {load(t.id)} açık iş</option>)}</select></Field>
          </div>
          <h3 className="form-section">Kabul bilgileri</h3>
          <div className="grid-2">
            <Field label="Kilometre" hint={vehicle ? `Son kayıt: ${vehicle.km.toLocaleString('tr-TR')} km` : undefined}><input key={vehicleId} name="km" type="number" min={vehicle?.km ?? 0} required defaultValue={vehicle?.km} /></Field>
            <Field label="Tahmini teslim"><input name="promisedAt" type="datetime-local" required defaultValue={promised} /></Field>
            <div className="field wide"><span className="field-label">Yakıt seviyesi</span><div className="fuel-pick">{Array.from({ length: 9 }, (_, i) => <button type="button" key={i} className={fuel === i ? 'active' : ''} onClick={() => setFuel(i)} aria-label={`Yakıt ${i}/8`}>{i === 0 ? 'E' : i === 8 ? 'F' : i === 4 ? '½' : ''}</button>)}</div></div>
            <Field label="Müşteri şikâyeti / talebi" wide><textarea name="complaint" rows={3} required minLength={5} maxLength={800} defaultValue={appointment?.note} placeholder="Müşterinin kendi ifadesiyle" /></Field>
            <Field label="Araçta bırakılan eşyalar" wide><input name="belongings" maxLength={200} placeholder="Ör. çocuk koltuğu, yedek anahtar" /></Field>
          </div>
        </div>
        <div className="intake-side">
          <h3 className="form-section">Mevcut hasarlar</h3>
          <p className="muted small">Kabul anında var olan hasarları işaretleyin. Kontrol bulguları ayrıca kaydedilir.</p>
          <DamageMap damages={damages} onToggle={toggle} />
          <ul className="damage-list">
            {damages.map((d, i) => <li key={d.area}><strong>{d.area}</strong>
              <select value={d.kind} aria-label={`${d.area} hasar türü`} onChange={e => setDamages(ds => ds.map((x, j) => j === i ? { ...x, kind: e.target.value as DamageKind } : x))}>{['Çizik', 'Göçük', 'Kırık', 'Boya farkı', 'Diğer'].map(k => <option key={k}>{k}</option>)}</select>
              <input value={d.note} maxLength={80} placeholder="Not" aria-label={`${d.area} notu`} onChange={e => setDamages(ds => ds.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} />
              <button type="button" className="icon-btn" aria-label="Kaldır" onClick={() => toggle(d.area)}><Icon name="x" size={14} /></button></li>)}
            {!damages.length && <li className="muted small">Hasar işaretlenmedi.</li>}
          </ul>
        </div>
      </div>
      <label className="check"><input type="checkbox" name="ack" /> Kabul bilgileri, hasarlar ve eşyalar müşteriyle birlikte kontrol edildi.</label>
      <div className="form-actions"><Button onClick={onClose}>Vazgeç</Button><button className="btn primary" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kabul et ve iş emri aç'}</button></div>
    </form>
  </Modal>;
}

/* ───────── Teklif kalemi ───────── */
export function LineForm({ open, onClose, job, line }: { open: boolean; onClose: () => void; job: Job; line?: EstimateLine }) {
  const { state, run } = useApp();
  const { error, busy, submit } = useFormRunner();
  const [pick, setPick] = useState('');
  const item = state.catalog.find(c => c.id === pick);
  const src = item ?? line;
  return <Modal open={open} onClose={onClose} title={line ? 'Kalemi düzenle' : 'Teklife kalem ekle'} width={600}>
    <form className="form" key={pick} onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      submit(() => {
        const input = { kind: str(f, 'kind') as EstimateLine['kind'], code: str(f, 'code').trim(), name: str(f, 'name'), unit: str(f, 'unit'), qty: parseQty(str(f, 'qty')), unitPrice: parseMoney(str(f, 'unitPrice')), discountPct: Number(str(f, 'discountPct') || 0) };
        return run((s, a) => upsertLine(s, a, job.id, input, line?.id), line ? 'Teklif kalemi güncellendi' : `Teklife "${input.name}" eklendi`, job.no);
      }, onClose);
    }}>
      <FormError error={error} />
      {!line && <Field label="Katalogdan seç" hint="Seçim alanları doldurur; fiyatı bu teklif için değiştirebilirsiniz."><select value={pick} onChange={e => setPick(e.target.value)}><option value="">Elle giriş</option>{(['Parça', 'İşçilik'] as const).map(k => <optgroup key={k} label={k}>{state.catalog.filter(c => c.active && c.kind === k).map(c => <option key={c.id} value={c.id}>{c.code} · {c.name} · {money(c.unitPrice)}/{c.unit}</option>)}</optgroup>)}</select></Field>}
      <div className="grid-3">
        <Field label="Tür"><select name="kind" defaultValue={src?.kind ?? 'Parça'}><option>Parça</option><option>İşçilik</option></select></Field>
        <Field label="Kod"><input name="code" maxLength={20} defaultValue={src?.code} className="mono upper" /></Field>
        <Field label="Birim"><select name="unit" defaultValue={src?.unit ?? 'adet'}>{['adet', 'takım', 'lt', 'saat', 'metre', 'kg'].map(u => <option key={u}>{u}</option>)}</select></Field>
        <Field label="Açıklama" wide><input name="name" required maxLength={120} defaultValue={src?.name} /></Field>
        <Field label="Miktar"><input name="qty" required inputMode="decimal" defaultValue={line ? qtyText(line.qty) : '1'} /></Field>
        <Field label="Birim fiyat (KDV hariç, ₺)"><input name="unitPrice" required inputMode="decimal" defaultValue={src ? moneyInput(src.unitPrice) : ''} className="num" /></Field>
        <Field label="İndirim %"><input name="discountPct" type="number" min={0} max={100} defaultValue={line?.discountPct ?? 0} /></Field>
      </div>
      <div className="form-actions"><Button onClick={onClose}>Vazgeç</Button><button className="btn primary" disabled={busy}>{line ? 'Güncelle' : 'Ekle'}</button></div>
    </form>
  </Modal>;
}

/* ───────── Teslim ───────── */
export function DeliveryForm({ open, onClose, job, onDone }: { open: boolean; onClose: () => void; job: Job; onDone?: () => void }) {
  const { state, actor, run } = useApp();
  const { error, busy, submit } = useFormRunner();
  const next = suggestedNextService(state, job);
  const open_ = balance(job);
  return <Modal open={open} onClose={onClose} title="Araç teslimi" sub={job.no} width={520}>
    <form className="form" onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      submit(() => run((s, a) => deliverJob(s, a, job.id, { note: str(f, 'note'), nextServiceDate: str(f, 'nextDate'), nextServiceKm: Number(str(f, 'nextKm') || 0), allowBalance: f.get('allow') === 'on' }), `${job.no} müşteriye teslim edildi`, job.no), () => { onClose(); onDone?.() });
    }}>
      <FormError error={error} />
      {open_ > 0 && <div className="banner warn"><Icon name="alert" size={15} />Açık bakiye: <strong>{money(open_)}</strong>. Bakiye kapanmadan teslim yalnız yönetici onayıyla yapılabilir.</div>}
      <div className="grid-2">
        <Field label="Sonraki bakım tarihi"><input type="date" name="nextDate" defaultValue={next.date} /></Field>
        <Field label="Sonraki bakım km"><input type="number" name="nextKm" defaultValue={next.km} min={job.intake.km + 1} /></Field>
        <Field label="Teslim notu" wide><textarea name="note" rows={2} maxLength={300} placeholder="Ör. değişen parçalar müşteriye gösterildi" /></Field>
      </div>
      {open_ > 0 && actor.role === 'admin' && <label className="check"><input type="checkbox" name="allow" /> Açık bakiyeyle teslimi onaylıyorum (yönetici).</label>}
      <div className="form-actions"><Button onClick={onClose}>Vazgeç</Button><button className="btn primary" disabled={busy}>Teslimi kaydet</button></div>
    </form>
  </Modal>;
}

/* ───────── İç not ───────── */
export function NoteForm({ open, onClose, customerId }: { open: boolean; onClose: () => void; customerId: string }) {
  const { state, run } = useApp();
  const { error, busy, submit } = useFormRunner();
  const jobs = state.jobs.filter(j => j.customerId === customerId);
  return <Modal open={open} onClose={onClose} title="İç not ekle" sub="Yalnız yönetici ve servis danışmanları görür. Portalda, servis formunda ve ön değerlendirmede yer almaz." width={520}>
    <form className="form" onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      submit(() => run((s, a) => addNote(s, a, { customerId, category: str(f, 'category') as NoteCategory, text: str(f, 'text'), jobId: str(f, 'jobId') }), 'Müşteri iç notu eklendi'), onClose);
    }}>
      <FormError error={error} />
      <div className="grid-2">
        <Field label="Kategori"><select name="category">{['İletişim tercihi', 'Ziyaret gözlemi', 'Ödeme', 'Genel'].map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="İlgili ziyaret"><select name="jobId" defaultValue=""><option value="">Genel</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.no}</option>)}</select></Field>
        <Field label="Not" wide><textarea name="text" rows={4} required minLength={3} maxLength={1000} /></Field>
      </div>
      <div className="form-actions"><Button onClick={onClose}>Vazgeç</Button><button className="btn primary" disabled={busy}>Notu kaydet</button></div>
    </form>
  </Modal>;
}

/* ───────── Ziyaret değerlendirmesi ───────── */
export function EvaluationForm({ open, onClose, job }: { open: boolean; onClose: () => void; job: Job }) {
  const { state, run } = useApp();
  const { error, busy, submit } = useFormRunner();
  const current = state.evaluations.find(e => e.jobId === job.id);
  const [v, setV] = useState({ punctuality: current?.punctuality ?? 0, payment: current?.payment ?? 0, communication: current?.communication ?? 0 });
  const crit: [keyof typeof v, string, string][] = [['punctuality', 'Randevuya uyum', 'Zamanında geldi mi, iptal/erteleme bildirdi mi'], ['payment', 'Ödeme düzeni', 'Ödemeyi zamanında ve sorunsuz yaptı mı'], ['communication', 'İletişim / işbirliği', 'Onaylara ve aramalara dönüş']];
  return <Modal open={open} onClose={onClose} title="Ziyaret değerlendirmesi" sub={`${job.no} · yalnız yetkili personel görür, fiyat veya hizmet kararı üretmez`} width={540}>
    <form className="form" onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      submit(() => run((s, a) => evaluateVisit(s, a, { jobId: job.id, ...v, reason: str(f, 'reason') }), current ? 'Ziyaret değerlendirmesi güncellendi' : 'Ziyaret değerlendirildi', job.no), onClose);
    }}>
      <FormError error={error} />
      {crit.map(([k, label, hint]) => <div key={k} className="rate-row"><div><strong>{label}</strong><small>{hint}</small></div>
        <div className="rate" role="radiogroup" aria-label={label}>{[1, 2, 3, 4, 5].map(n => <button type="button" role="radio" aria-checked={v[k] === n} key={n} className={v[k] >= n ? 'on' : ''} onClick={() => setV({ ...v, [k]: n })}>{n}</button>)}</div></div>)}
      <Field label="Gerekçe"><textarea name="reason" rows={3} required minLength={5} maxLength={500} defaultValue={current?.reason} /></Field>
      <div className="form-actions"><Button onClick={onClose}>Vazgeç</Button><button className="btn primary" disabled={busy}>Kaydet</button></div>
    </form>
  </Modal>;
}
