'use client';
import { useState } from 'react';
import { useApp } from '@/components/store';
import { Card, Empty, PageHeader, Search } from '@/components/ui';
import { can, roleLabel } from '@/lib/rules';
import { fmtDateTime, fold } from '@/lib/format';

export default function AuditPage() {
  const { state, actor } = useApp();
  const [q, setQ] = useState('');
  if (!can(actor, 'audit.read')) return <Empty icon="lock" title="Bu sayfa yalnız yöneticiye açıktır" />;
  const rows = state.audit.filter(a => !q || fold(`${a.action} ${a.by} ${a.ref ?? ''}`).includes(fold(q)));
  return <>
    <PageHeader title="İşlem günlüğü" sub="Kim, ne zaman, hangi işlemi yaptı. Son 500 kayıt bu tarayıcıda tutulur." />
    <div className="toolbar"><Search value={q} onChange={setQ} placeholder="İşlem, kullanıcı veya kayıt no" /></div>
    <Card flush>{rows.length ? <div className="table-wrap"><table className="table">
      <thead><tr><th>Zaman</th><th>Kullanıcı</th><th className="hide-sm">Rol</th><th>İşlem</th><th className="hide-sm">Kayıt</th></tr></thead>
      <tbody>{rows.map(a => <tr key={a.id}><td className="nowrap small">{fmtDateTime(a.at)}</td><td>{a.by}</td><td className="hide-sm small">{roleLabel[a.role]}</td><td>{a.action}</td><td className="hide-sm mono small">{a.ref ?? '—'}</td></tr>)}</tbody>
    </table></div> : <Empty icon="history" title="Kayıt yok" />}</Card>
  </>;
}
