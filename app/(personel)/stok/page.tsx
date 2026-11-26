'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/store';
import { Button, Card, Empty, Field, FormError, Modal, PageHeader, Search, Stat, useFormRunner } from '@/components/ui';
import { can, lowStockItems, recordStockMovement, stockBalance, upsertStockItem } from '@/lib/commands';
import { fmtDateTime, fold } from '@/lib/format';
import { detailHref } from '@/lib/routes';
import type { StockItem, StockMovement } from '@/lib/types';
import styles from '@/components/operations.module.css';

const quantity = (n: number) => (n / 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
export default function StockPage() {
  const { state, actor } = useApp();
  const [q, setQ] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<StockItem | 'new' | null>(null);
  const [movement, setMovement] = useState<StockItem | null>(null);
  const [historyItem, setHistoryItem] = useState('');
  if (!can(actor, 'stock.read')) return <Empty title="Stok kayıtlarını görme yetkiniz yok" />;
  const items = state.stockItems ?? [];
  const low = lowStockItems(state);
  const rows = items.filter(i => (!lowOnly || low.some(x => x.id === i.id)) && fold(`${i.code} ${i.name}`).includes(fold(q)));
  const movements = (state.stockMovements ?? []).filter(m => !historyItem || m.itemId === historyItem).slice().reverse();
  return <div className={styles.operations}>
    <PageHeader title="Stok takibi" sub="Parça ve sarf stokları · miktarlar kartın kendi birimiyle izlenir" actions={can(actor, 'stock.write') && <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>Stok kartı ekle</Button>} />
    <div className="stats"><Stat label="Stok kartı" value={items.filter(i => i.active).length} /><Stat label="Düşük stok" value={low.length} foot="Minimum seviyede veya altında" tone={low.length ? 'bad' : undefined} /><Stat label="Kayıtlı hareket" value={(state.stockMovements ?? []).length} /></div>
    <div className="toolbar"><label><input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} /> Yalnız düşük stok</label><Search value={q} onChange={setQ} placeholder="Stok kodu veya parça adı" /></div>
    <Card title="Stok kartları" flush>{rows.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Kod / ad</th><th className="num">Mevcut</th><th className="num">Minimum</th><th>Durum</th><th>İşlemler</th></tr></thead><tbody>{rows.map(i => {
      const current = stockBalance(state, i.id);
      return <tr key={i.id}><td><strong>{i.name}</strong><small className="cell-sub mono">{i.code}</small></td><td className={'num ' + (i.active && current <= i.minimum ? 'text-bad strong' : '')}>{quantity(current)} {i.unit}</td><td className="num">{quantity(i.minimum)} {i.unit}</td><td>{!i.active ? 'Pasif' : current <= i.minimum ? <span className="tag red">Düşük stok</span> : <span className="tag green">Yeterli</span>}</td><td><div className="btn-row"><Button size="sm" onClick={() => setHistoryItem(i.id)}>Hareketler</Button>{can(actor, 'stock.write') && <><Button size="sm" onClick={() => setEditing(i)}>Düzenle</Button>{i.active && <Button size="sm" onClick={() => setMovement(i)}>Giriş / çıkış</Button>}</>}</div></td></tr>;
    })}</tbody></table></div> : <Empty title="Stok kartı bulunamadı">Yeni kart açıp giriş hareketiyle başlangıç stokunu kaydedin.</Empty>}</Card>
    <Card title="Stok hareketleri" sub="Hareketler korunur. Düzeltme için gerekçeli ters hareket girin." actions={<select aria-label="Hareketleri stok kartına göre filtrele" value={historyItem} onChange={e => setHistoryItem(e.target.value)}><option value="">Tüm stoklar</option>{items.map(i => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}</select>} flush>
      {movements.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Tarih / personel</th><th>Stok</th><th>Hareket</th><th className="num">Miktar</th><th>Gerekçe / iş emri</th></tr></thead><tbody>{movements.map(m => { const i = items.find(i => i.id === m.itemId); return <tr key={m.id}><td>{fmtDateTime(m.at)}<small className="cell-sub">{m.by}</small></td><td>{i?.name}<small className="cell-sub mono">{i?.code}</small></td><td><span className={'tag ' + (m.kind === 'Giriş' ? 'green' : 'amber')}>{m.kind}</span></td><td className="num">{quantity(m.quantity)} {i?.unit}</td><td>{m.reason}{m.jobId && <small className="cell-sub"><Link href={detailHref('/is-emirleri/detay', m.jobId)}>{state.jobs.find(j => j.id === m.jobId)?.no}</Link></small>}</td></tr>; })}</tbody></table></div> : <Empty title="Henüz stok hareketi yok" />}
    </Card>
    {editing && <StockCardForm key={editing === 'new' ? 'new' : editing.id} item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    {movement && <MovementForm item={movement} onClose={() => setMovement(null)} />}
  </div>;
}
function StockCardForm({ item, onClose }: { item?: StockItem; onClose: () => void }) {
  const { run, state } = useApp();
  const { error, busy, submit } = useFormRunner();
  const hasMovements = !!item && (state.stockMovements ?? []).some(m => m.itemId === item.id);
  return <Modal open title={item ? 'Stok kartını düzenle' : 'Yeni stok kartı'} onClose={onClose}><form className="form" onSubmit={e => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const input = { code: String(f.get('code')), name: String(f.get('name')), unit: String(f.get('unit')), minimum: Math.round(Number(f.get('minimum')) * 100), active: f.get('active') === 'on' };
    void submit(() => run((s, a) => upsertStockItem(s, a, input, item?.id), 'Stok kartı kaydedildi'), onClose);
  }}><FormError error={error} /><div className="form-grid"><Field label="Stok kodu"><input name="code" required maxLength={50} defaultValue={item?.code} /></Field><Field label="Parça / sarf adı"><input name="name" required minLength={2} maxLength={150} defaultValue={item?.name} /></Field><Field label="Birim"><input name="unit" required maxLength={30} readOnly={hasMovements} defaultValue={item?.unit ?? 'adet'} /></Field><Field label="Minimum stok"><input name="minimum" type="number" required min={0} max={1000000} step="0.01" defaultValue={(item?.minimum ?? 0) / 100} /></Field></div><label><input name="active" type="checkbox" defaultChecked={item?.active ?? true} /> Aktif stok kartı</label><p className="form-note">Başlangıç miktarını giriş hareketiyle kaydedin. Hareket görmüş kartın birimi korunur.</p><div className="form-actions"><Button onClick={onClose}>Vazgeç</Button><button className="btn primary" disabled={busy}>Kaydet</button></div></form></Modal>;
}
function MovementForm({ item, onClose }: { item: StockItem; onClose: () => void }) {
  const { state, run } = useApp();
  const { error, busy, submit } = useFormRunner();
  return <Modal open title={`Stok hareketi · ${item.name}`} sub={`Mevcut: ${quantity(stockBalance(state, item.id))} ${item.unit}`} onClose={onClose}><form className="form" onSubmit={e => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const input = { itemId: item.id, kind: String(f.get('kind')) as StockMovement['kind'], quantity: Math.round(Number(f.get('quantity')) * 100), reason: String(f.get('reason')), jobId: String(f.get('jobId')) || undefined };
    void submit(() => run((s, a) => recordStockMovement(s, a, input), 'Stok hareketi kaydedildi', item.code), onClose);
  }}><FormError error={error} /><div className="form-grid"><Field label="Hareket türü"><select name="kind"><option>Giriş</option><option>Çıkış</option></select></Field><Field label={`Miktar (${item.unit})`}><input name="quantity" type="number" min="0.01" max={1000000} step="0.01" required /></Field><Field label="İş emri (isteğe bağlı)" wide><select name="jobId"><option value="">İş emrine bağlı değil</option>{state.jobs.map(j => <option key={j.id} value={j.id}>{j.no} · {j.status}</option>)}</select></Field><Field label="Gerekçe" wide><textarea name="reason" required minLength={3} maxLength={500} rows={3} placeholder="Satın alma, başlangıç sayımı, iş emrinde kullanım, iade veya sayım düzeltmesi…" /></Field></div><div className="form-actions"><Button onClick={onClose}>Vazgeç</Button><button className="btn primary" disabled={busy}>Hareketi kaydet</button></div></form></Modal>;
}
