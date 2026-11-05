'use client';
import { useState } from 'react';
import { useApp } from '@/components/store';
import { Button, Card, Empty, Field, FormError, Modal, PageHeader, Status, Tabs, useFormRunner } from '@/components/ui';
import { Icon } from '@/components/icons';
import { can, roleLabel, updateSettings, upsertUser } from '@/lib/rules';
import { uid } from '@/lib/format';
import type { Resource, Role, ServiceType, Settings, User } from '@/lib/types';

const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export default function SettingsPage() {
  const { state, actor, run, resetDemo } = useApp();
  const [tab, setTab] = useState<'company' | 'hours' | 'staff' | 'data'>('company');
  const [s, setS] = useState<Settings>(state.settings);
  const [user, setUser] = useState<null | { u?: User }>(null);
  const { error, busy, submit } = useFormRunner();
  if (!can(actor, 'settings.write')) return <Empty icon="lock" title="Bu sayfa yalnız yöneticiye açıktır" />;
  const dirty = JSON.stringify(s) !== JSON.stringify(state.settings);
  const save = () => submit(() => run((st, a) => updateSettings(st, a, s), 'Servis ayarları güncellendi'));
  const co = (k: keyof Settings['company'], v: string) => setS({ ...s, company: { ...s.company, [k]: v } });
  const res = (i: number, p: Partial<Resource>) => setS({ ...s, resources: s.resources.map((r, j) => j === i ? { ...r, ...p } : r) });
  const svc = (i: number, p: Partial<ServiceType>) => setS({ ...s, services: s.services.map((r, j) => j === i ? { ...r, ...p } : r) });

  return <>
    <PageHeader title="Ayarlar ve personel" sub="Firma bilgileri servis formunda kullanılır. Çalışma saatleri ve servis alanları randevu kontrolünü belirler."
      actions={tab !== 'staff' && tab !== 'data' && <><Button disabled={!dirty} onClick={() => setS(state.settings)}>Geri al</Button><Button variant="primary" disabled={!dirty || busy} onClick={save}>Değişiklikleri kaydet</Button></>} />
    <Tabs value={tab} onChange={setTab} items={[['company', 'Firma'], ['hours', 'Çalışma düzeni'], ['staff', 'Kullanıcılar', state.users.length], ['data', 'Veri']]} />
    <FormError error={error} />
    {tab === 'company' && <Card title="Firma ve şube">
      <div className="grid-2 form">
        <Field label="Ticari unvan" wide><input value={s.company.name} onChange={e => co('name', e.target.value)} /></Field>
        <Field label="Şube"><input value={s.company.branch} onChange={e => co('branch', e.target.value)} /></Field>
        <Field label="Telefon"><input value={s.company.phone} onChange={e => co('phone', e.target.value)} /></Field>
        <Field label="E-posta"><input value={s.company.email} onChange={e => co('email', e.target.value)} /></Field>
        <Field label="Vergi dairesi"><input value={s.company.taxOffice} onChange={e => co('taxOffice', e.target.value)} /></Field>
        <Field label="Vergi no"><input value={s.company.taxNo} onChange={e => co('taxNo', e.target.value)} /></Field>
        <Field label="Adres" wide><textarea rows={2} value={s.company.address} onChange={e => co('address', e.target.value)} /></Field>
        <Field label="KDV oranı (%)" hint="Yeni teklif sürümlerine uygulanır"><input type="number" min={0} max={50} value={s.vatRate} onChange={e => setS({ ...s, vatRate: Number(e.target.value) })} /></Field>
        <Field label="Bakım aralığı" hint="Teslimde sonraki bakım önerisi"><div className="input-pair"><input type="number" min={1000} step={1000} value={s.serviceIntervalKm} onChange={e => setS({ ...s, serviceIntervalKm: Number(e.target.value) })} /><span>km /</span><input type="number" min={1} max={36} value={s.serviceIntervalMonths} onChange={e => setS({ ...s, serviceIntervalMonths: Number(e.target.value) })} /><span>ay</span></div></Field>
      </div>
    </Card>}
    {tab === 'hours' && <>
      <Card title="Çalışma saatleri">
        <div className="grid-3 form">
          <Field label="Açılış"><input type="time" step={900} value={s.workStart} onChange={e => setS({ ...s, workStart: e.target.value })} /></Field>
          <Field label="Kapanış"><input type="time" step={900} value={s.workEnd} onChange={e => setS({ ...s, workEnd: e.target.value })} /></Field>
          <div />
          <Field label="Öğle arası başlangıç"><input type="time" step={900} value={s.breakStart} onChange={e => setS({ ...s, breakStart: e.target.value })} /></Field>
          <Field label="Öğle arası bitiş"><input type="time" step={900} value={s.breakEnd} onChange={e => setS({ ...s, breakEnd: e.target.value })} /></Field>
        </div>
        <div className="field mt"><span className="field-label">Çalışma günleri</span><div className="seg">{dayNames.map((d, i) => <button key={d} className={s.workDays.includes(i + 1) ? 'active' : ''} onClick={() => setS({ ...s, workDays: s.workDays.includes(i + 1) ? s.workDays.filter(x => x !== i + 1) : [...s.workDays, i + 1].sort() })}>{d}</button>)}</div></div>
      </Card>
      <Card title="Servis alanları" sub="Randevu çakışma kontrolü alan bazında yapılır" flush actions={<Button size="sm" icon="plus" onClick={() => setS({ ...s, resources: [...s.resources, { id: uid(), name: `Lift ${s.resources.length + 1}`, kind: 'Lift', active: true }] })}>Alan ekle</Button>}>
        <table className="table"><thead><tr><th>Ad</th><th>Tür</th><th>Durum</th></tr></thead>
          <tbody>{s.resources.map((r, i) => <tr key={r.id}><td><input className="cell-input" value={r.name} onChange={e => res(i, { name: e.target.value })} aria-label="Alan adı" /></td>
            <td><select className="cell-input" value={r.kind} onChange={e => res(i, { kind: e.target.value as Resource['kind'] })}><option>Lift</option><option>Kontrol</option><option>Hizmet</option></select></td>
            <td><label className="check"><input type="checkbox" checked={r.active} onChange={e => res(i, { active: e.target.checked })} /> Aktif</label></td></tr>)}</tbody></table>
      </Card>
      <Card title="Hizmet türleri" sub="Varsayılan randevu süresi ve teklife önerilen katalog kalemleri" flush actions={<Button size="sm" icon="plus" onClick={() => setS({ ...s, services: [...s.services, { id: uid(), name: 'Yeni hizmet', duration: 60, catalogIds: [] }] })}>Hizmet ekle</Button>}>
        <table className="table"><thead><tr><th>Hizmet</th><th className="num">Süre (dk)</th><th className="hide-sm">Önerilen kalemler</th></tr></thead>
          <tbody>{s.services.map((r, i) => <tr key={r.id}><td><input className="cell-input" value={r.name} onChange={e => svc(i, { name: e.target.value })} aria-label="Hizmet adı" /></td>
            <td className="num"><input className="cell-input num" type="number" min={15} max={480} step={15} value={r.duration} onChange={e => svc(i, { duration: Number(e.target.value) })} aria-label="Süre" /></td>
            <td className="hide-sm small">{r.catalogIds.map(id => state.catalog.find(c => c.id === id)?.code).filter(Boolean).join(', ') || '—'}</td></tr>)}</tbody></table>
      </Card>
    </>}
    {tab === 'staff' && <Card title="Kullanıcı hesapları" sub="Personel hesaplarını yönetici açar. Müşteri portal hesabı bir müşteri kaydına bağlanır." flush actions={<Button size="sm" icon="plus" onClick={() => setUser({})}>Kullanıcı ekle</Button>}>
      <div className="table-wrap"><table className="table"><thead><tr><th>Ad soyad</th><th className="hide-sm">E-posta</th><th>Rol</th><th className="hide-sm">Bağlı müşteri</th><th>Durum</th><th /></tr></thead>
        <tbody>{state.users.map(u => <tr key={u.id} className={u.active ? '' : 'dim'}><td>{u.name}</td><td className="hide-sm">{u.email}</td><td>{roleLabel[u.role]}</td><td className="hide-sm">{state.customers.find(c => c.id === u.customerId)?.name ?? '—'}</td><td><Status value={u.active ? 'Aktif' : 'Pasif'} tone={u.active ? 'green' : 'muted'} /></td>
          <td className="actions"><button className="icon-btn" aria-label="Düzenle" onClick={() => setUser({ u })}><Icon name="edit" size={14} /></button></td></tr>)}</tbody></table></div>
    </Card>}
    {tab === 'data' && <Card title="Yerel veri">
      <p>Bu sürümde kayıtlar yalnız bu tarayıcının yerel depolamasında tutulur; sunucuya gönderilmez ve diğer cihazlarla paylaşılmaz. PostgreSQL şeması <code>db/schema.sql</code> dosyasında hazırdır.</p>
      <div className="btn-row mt"><Button icon="download" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); a.download = `heb-servis-yedek-${new Date().toISOString().slice(0, 10)}.json`; a.click() }}>JSON yedeği indir</Button>
        <Button variant="danger" icon="refresh" onClick={() => { if (confirm('Tüm yerel kayıtlar silinip örnek veriler yüklenecek. Emin misiniz?')) resetDemo() }}>Örnek verilere sıfırla</Button></div>
    </Card>}
    {user && <UserModal user={user.u} onClose={() => setUser(null)} />}
  </>;
}

function UserModal({ user, onClose }: { user?: User; onClose: () => void }) {
  const { state, run } = useApp();
  const { error, busy, submit } = useFormRunner();
  const [role, setRole] = useState<Role>(user?.role ?? 'advisor');
  return <Modal open title={user ? 'Kullanıcıyı düzenle' : 'Yeni kullanıcı'} onClose={onClose} width={520}>
    <form className="form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const input = { name: String(f.get('name')), email: String(f.get('email')), phone: String(f.get('phone')), role, customerId: role === 'customer' ? String(f.get('customerId')) : undefined, active: f.get('active') === 'on' }; submit(() => run((s, a) => upsertUser(s, a, input, user?.id), `${input.name} kullanıcı hesabı ${user ? 'güncellendi' : 'açıldı'}`), onClose) }}>
      <FormError error={error} />
      <div className="grid-2">
        <Field label="Ad soyad" wide><input name="name" required defaultValue={user?.name} /></Field>
        <Field label="E-posta"><input name="email" type="email" required defaultValue={user?.email} /></Field>
        <Field label="Telefon"><input name="phone" defaultValue={user?.phone} /></Field>
        <Field label="Rol"><select value={role} onChange={e => setRole(e.target.value as Role)}>{(['admin', 'advisor', 'technician', 'customer'] as Role[]).map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}</select></Field>
        {role === 'customer' && <Field label="Bağlı müşteri kaydı"><select name="customerId" defaultValue={user?.customerId} required>{state.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
      </div>
      <label className="check"><input type="checkbox" name="active" defaultChecked={user?.active ?? true} /> Hesap aktif</label>
      <p className="form-note"><Icon name="lock" size={14} />Parola yönetimi kimlik doğrulama hizmeti bağlandığında e-posta daveti ile yapılacak.</p>
      <div className="form-actions"><Button onClick={onClose}>Vazgeç</Button><button className="btn primary" disabled={busy}>Kaydet</button></div>
    </form>
  </Modal>;
}
