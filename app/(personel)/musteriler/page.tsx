'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/store';
import { Button, Card, Empty, PageHeader, Score, Search } from '@/components/ui';
import { CustomerForm } from '@/components/forms';
import { balance, customerScore } from '@/lib/rules';
import { fmtDate, fold, money } from '@/lib/format';

export default function CustomersPage() {
  const { state } = useApp();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [form, setForm] = useState(false);
  const term = fold(q.trim()), digits = q.replace(/\D/g, '');
  const rows = state.customers.filter(c => (!kind || c.kind === kind) && (!term || fold(c.name + ' ' + c.no + ' ' + c.email).includes(term) || (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits))))
    .map(c => {
      const jobs = state.jobs.filter(j => j.customerId === c.id);
      const last = jobs.map(j => j.createdAt).sort().at(-1);
      return { c, vehicles: state.vehicles.filter(v => v.customerId === c.id).length, visits: jobs.length, last, open: jobs.reduce((s, j) => s + Math.max(0, balance(j)), 0), score: customerScore(state, c.id) };
    }).sort((a, b) => (b.last ?? '').localeCompare(a.last ?? ''));

  return <>
    <PageHeader title="Müşteriler" sub={`${state.customers.length} kayıt · bireysel ve kurumsal`} actions={<Button variant="primary" icon="plus" onClick={() => setForm(true)}>Yeni müşteri</Button>} />
    <div className="toolbar">
      <div className="seg">{[['', 'Tümü'], ['Bireysel', 'Bireysel'], ['Kurumsal', 'Kurumsal']].map(([k, l]) => <button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>{l}</button>)}</div>
      <div className="toolbar-end"><Search value={q} onChange={setQ} placeholder="Ad, müşteri no, telefon, e-posta" /></div>
    </div>
    <Card flush>
      {rows.length ? <div className="table-wrap"><table className="table">
        <thead><tr><th>Müşteri</th><th className="hide-sm">Telefon</th><th className="num">Araç</th><th className="num hide-sm">Ziyaret</th><th className="hide-sm">Son ziyaret</th><th className="hide-sm">Değerlendirme</th><th className="num">Açık bakiye</th></tr></thead>
        <tbody>{rows.map(({ c, vehicles, visits, last, open, score }) => <tr key={c.id} className="row-link" onClick={() => router.push(`/musteriler/${c.id}`)}>
          <td><Link href={`/musteriler/${c.id}`} className="strong" onClick={e => e.stopPropagation()}>{c.name}</Link><small className="cell-sub">{c.no} · {c.kind}</small></td>
          <td className="hide-sm">{c.phone}</td><td className="num">{vehicles}</td><td className="num hide-sm">{visits}</td>
          <td className="hide-sm">{last ? fmtDate(last) : '—'}</td>
          <td className="hide-sm">{score ? <Score value={score.overall} /> : <span className="muted small">Değerlendirme yok</span>}</td>
          <td className={'num ' + (open > 0 ? 'text-bad strong' : '')}>{open > 0 ? money(open) : '—'}</td>
        </tr>)}</tbody>
      </table></div> : <Empty icon="users" title="Müşteri bulunamadı" />}
    </Card>
    {form && <CustomerForm open onClose={() => setForm(false)} onSaved={id => router.push(`/musteriler/${id}`)} />}
  </>;
}
