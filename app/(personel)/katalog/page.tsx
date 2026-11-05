'use client';
import { useState } from 'react';
import { useApp } from '@/components/store';
import { Button, Card, Empty, Field, FormError, Modal, PageHeader, Search, useFormRunner } from '@/components/ui';
import { Icon } from '@/components/icons';
import { can, upsertCatalog } from '@/lib/rules';
import { fold, money, moneyInput, parseMoney } from '@/lib/format';
import type { CatalogItem, LineKind } from '@/lib/types';

export default function CatalogPage() {
  const { state, actor, run } = useApp();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'' | LineKind>('');
  const [edit, setEdit] = useState<null | { item?: CatalogItem }>(null);
  const { error, busy, submit } = useFormRunner();
  const writable = can(actor, 'catalog.write');
  const rows = state.catalog.filter(c => (!kind || c.kind === kind) && (!q || fold(c.code + ' ' + c.name).includes(fold(q))));

  return <>
    <PageHeader title="Parça ve işçilik fiyat listesi" sub={`Teklif kalemlerinde kullanılan liste fiyatları (KDV hariç). Kapsamlı stok/depo takibi bu sürümün kapsamı dışındadır.${writable ? '' : ' Fiyatları yalnız yönetici değiştirebilir.'}`}
      actions={writable && <Button variant="primary" icon="plus" onClick={() => setEdit({})}>Yeni kalem</Button>} />
    <div className="toolbar">
      <div className="seg">{([['', 'Tümü'], ['Parça', 'Parça'], ['İşçilik', 'İşçilik']] as const).map(([k, l]) => <button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>{l}</button>)}</div>
      <div className="toolbar-end"><Search value={q} onChange={setQ} placeholder="Kod veya ad ara" /></div>
    </div>
    <Card flush>{rows.length ? <div className="table-wrap"><table className="table">
      <thead><tr><th>Kod</th><th>Ad</th><th>Tür</th><th>Birim</th><th className="num">Birim fiyat</th><th>Durum</th>{writable && <th />}</tr></thead>
      <tbody>{rows.map(c => <tr key={c.id} className={c.active ? '' : 'dim'}>
        <td className="mono small">{c.code}</td><td>{c.name}</td><td><span className={'tag ' + (c.kind === 'Parça' ? 'blue' : 'violet')}>{c.kind}</span></td><td>{c.unit}</td>
        <td className="num strong">{money(c.unitPrice)}</td><td>{c.active ? 'Aktif' : <span className="muted">Pasif</span>}</td>
        {writable && <td className="actions"><button className="icon-btn" aria-label="Düzenle" onClick={() => setEdit({ item: c })}><Icon name="edit" size={14} /></button></td>}
      </tr>)}</tbody>
    </table></div> : <Empty icon="package" title="Kayıt yok" />}</Card>
    {edit && <Modal open title={edit.item ? 'Kalemi düzenle' : 'Yeni kalem'} onClose={() => setEdit(null)} width={520}>
      <form className="form" onSubmit={e => {
        e.preventDefault(); const f = new FormData(e.currentTarget);
        submit(() => { const item = { kind: String(f.get('kind')) as LineKind, code: String(f.get('code')), name: String(f.get('name')), unit: String(f.get('unit')), unitPrice: parseMoney(String(f.get('price'))), active: f.get('active') === 'on' }; return run((s, a) => upsertCatalog(s, a, item, edit.item?.id), `${item.code} fiyat listesinde ${edit.item ? 'güncellendi' : 'oluşturuldu'}`) }, () => setEdit(null));
      }}>
        <FormError error={error} />
        <div className="grid-2">
          <Field label="Tür"><select name="kind" defaultValue={edit.item?.kind ?? 'Parça'}><option>Parça</option><option>İşçilik</option></select></Field>
          <Field label="Kod"><input name="code" required maxLength={20} defaultValue={edit.item?.code} className="mono upper" /></Field>
          <Field label="Ad" wide><input name="name" required maxLength={120} defaultValue={edit.item?.name} /></Field>
          <Field label="Birim"><select name="unit" defaultValue={edit.item?.unit ?? 'adet'}>{['adet', 'takım', 'lt', 'saat', 'metre', 'kg'].map(u => <option key={u}>{u}</option>)}</select></Field>
          <Field label="Birim fiyat (KDV hariç, ₺)"><input name="price" required inputMode="decimal" defaultValue={edit.item ? moneyInput(edit.item.unitPrice) : ''} /></Field>
        </div>
        <label className="check"><input type="checkbox" name="active" defaultChecked={edit.item?.active ?? true} /> Aktif (teklif ekranında listelenir)</label>
        <p className="form-note">Fiyat değişikliği yalnız yeni eklenen kalemleri etkiler; gönderilmiş teklifler değişmez.</p>
        <div className="form-actions"><Button onClick={() => setEdit(null)}>Vazgeç</Button><button className="btn primary" disabled={busy}>Kaydet</button></div>
      </form>
    </Modal>}
  </>;
}
