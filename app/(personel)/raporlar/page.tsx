'use client';
import { useState } from 'react';
import { useApp } from '@/components/store';
import { Button, Card, Empty, PageHeader, Stat } from '@/components/ui';
import { amountDue, amountPaid, approvedEstimate, estimateTotals, serviceName, staffName, technicians } from '@/lib/rules';
import { addDays, fmtDate, isoDay, money, today } from '@/lib/format';

const dec = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function ReportsPage() {
  const { state } = useApp();
  const [from, setFrom] = useState(addDays(today(), -29));
  const [to, setTo] = useState(today());
  const inRange = (iso?: string) => !!iso && isoDay(iso) >= from && isoDay(iso) <= to;
  const delivered = state.jobs.filter(j => j.status === 'Teslim edildi' && inRange(j.deliveredAt));
  const opened = state.jobs.filter(j => inRange(j.createdAt));
  const revenue = delivered.reduce((s, j) => s + amountDue(j), 0);
  const collected = state.jobs.flatMap(j => j.payments).filter(p => inRange(p.at)).reduce((s, p) => s + p.amount, 0);
  const totals = delivered.map(j => approvedEstimate(j)).filter(Boolean).map(e => estimateTotals(e!));
  const parts = totals.reduce((s, t) => s + t.parts, 0), labor = totals.reduce((s, t) => s + t.labor, 0), discount = totals.reduce((s, t) => s + t.discount, 0), vat = totals.reduce((s, t) => s + t.vat, 0);
  const hours = delivered.map(j => (new Date(j.deliveredAt!).getTime() - new Date(j.createdAt).getTime()) / 3600000);
  const avgHours = hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : 0;
  const onTime = delivered.filter(j => new Date(j.deliveredAt!).getTime() <= new Date(j.promisedAt).getTime() + 30 * 60000).length;
  const sent = state.jobs.flatMap(j => j.estimates).filter(e => e.decision && inRange(e.decision.at));
  const approvalRate = sent.length ? sent.filter(e => e.decision!.result === 'Onaylandı').length / sent.length : 0;
  const appts = state.appointments.filter(a => a.date >= from && a.date <= to);
  const noShow = appts.filter(a => a.status === 'Gelmedi').length;

  const byService = state.settings.services.map(s => { const js = delivered.filter(j => j.serviceId === s.id); return { name: s.name, count: js.length, revenue: js.reduce((t, j) => t + amountDue(j), 0) } }).filter(r => r.count);
  const byTech = technicians(state).map(t => { const js = delivered.filter(j => j.technicianId === t.id); const h = js.map(j => (new Date(j.deliveredAt!).getTime() - new Date(j.createdAt).getTime()) / 3600000); return { name: t.name, count: js.length, revenue: js.reduce((s, j) => s + amountDue(j), 0), labor: js.reduce((s, j) => { const e = approvedEstimate(j); return s + (e ? estimateTotals(e).labor : 0) }, 0), avg: h.length ? h.reduce((a, b) => a + b, 0) / h.length : 0 } });
  const maxSvc = Math.max(...byService.map(r => r.revenue), 1);

  function exportCsv() {
    const head = ['İş emri', 'Kabul', 'Teslim', 'Plaka', 'Müşteri', 'Hizmet', 'Teknisyen', 'Durum', 'Onaylı tutar (TL)', 'Tahsilat (TL)'];
    const rows = state.jobs.filter(j => inRange(j.createdAt) || inRange(j.deliveredAt)).map(j => [j.no, fmtDate(j.createdAt), j.deliveredAt ? fmtDate(j.deliveredAt) : '', state.vehicles.find(v => v.id === j.vehicleId)?.plate ?? '', state.customers.find(c => c.id === j.customerId)?.name ?? '', serviceName(state, j.serviceId), staffName(state, j.technicianId), j.status, (amountDue(j) / 100).toFixed(2).replace('.', ','), (amountPaid(j) / 100).toFixed(2).replace('.', ',')]);
    const csv = '﻿' + [head, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `is-emirleri_${from}_${to}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  return <>
    <PageHeader title="Raporlar" sub="İşlem tutarı (teslim edilen işlerin onaylı teklifleri) ile tahsilat ayrı raporlanır. İç notlar ve puanlar raporlara dahil edilmez."
      actions={<><Button icon="download" onClick={exportCsv}>CSV dışa aktar</Button><Button icon="printer" onClick={() => print()}>Yazdır</Button></>} />
    <div className="toolbar">
      <label className="inline-field">Başlangıç<input type="date" value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} /></label>
      <label className="inline-field">Bitiş<input type="date" value={to} min={from} onChange={e => e.target.value && setTo(e.target.value)} /></label>
      <div className="btn-group">{[[7, '7 gün'], [30, '30 gün'], [90, '90 gün']].map(([d, l]) => <Button key={d} size="sm" onClick={() => { setFrom(addDays(today(), -(Number(d) - 1))); setTo(today()) }}>{l}</Button>)}</div>
    </div>
    <div className="stats six">
      <Stat label="Açılan iş emri" value={opened.length} />
      <Stat label="Teslim edilen" value={delivered.length} foot={delivered.length ? `%${Math.round(onTime / delivered.length * 100)} zamanında` : '—'} />
      <Stat label="İşlem tutarı (KDV dahil)" value={money(revenue)} />
      <Stat label="Tahsilat" value={money(collected)} />
      <Stat label="Ort. servis süresi" value={avgHours ? (avgHours < 24 ? `${dec(avgHours)} sa` : `${dec(avgHours / 24)} gün`) : '—'} foot="Kabulden teslime" />
      <Stat label="Teklif onay oranı" value={sent.length ? `%${Math.round(approvalRate * 100)}` : '—'} foot={`${sent.length} karar · ${noShow} gelmedi`} />
    </div>
    <div className="grid-main">
      <Card title="Hizmet türüne göre" sub="Teslim edilen işler" flush>
        {byService.length ? <table className="table"><thead><tr><th>Hizmet</th><th className="num">Adet</th><th className="hide-sm" style={{ width: '35%' }} /><th className="num">Tutar</th></tr></thead>
          <tbody>{byService.map(r => <tr key={r.name}><td>{r.name}</td><td className="num">{r.count}</td><td className="hide-sm"><div className="meter"><i style={{ width: `${r.revenue / maxSvc * 100}%` }} /></div></td><td className="num">{money(r.revenue)}</td></tr>)}</tbody></table>
          : <Empty icon="chart" title="Bu aralıkta teslim yok" />}
      </Card>
      <Card title="Gelir kırılımı" sub="Teslim edilen işlerin onaylı teklifleri">
        <dl className="sum">
          <div><dt>Parça</dt><dd>{money(parts)}</dd></div>
          <div><dt>İşçilik</dt><dd>{money(labor)}</dd></div>
          <div><dt>Verilen indirim</dt><dd>−{money(discount)}</dd></div>
          <div><dt>KDV</dt><dd>{money(vat)}</dd></div>
          <div className="total"><dt>Toplam</dt><dd>{money(revenue)}</dd></div>
        </dl>
      </Card>
    </div>
    <Card title="Teknisyen performansı" sub={`${fmtDate(from)} – ${fmtDate(to)}`} flush>
      <table className="table"><thead><tr><th>Teknisyen</th><th className="num">Teslim edilen iş</th><th className="num hide-sm">Ort. süre</th><th className="num hide-sm">İşçilik geliri</th><th className="num">Toplam iş tutarı</th></tr></thead>
        <tbody>{byTech.map(t => <tr key={t.name}><td>{t.name}</td><td className="num">{t.count}</td><td className="num hide-sm">{t.avg ? `${dec(t.avg)} sa` : '—'}</td><td className="num hide-sm">{money(t.labor)}</td><td className="num">{money(t.revenue)}</td></tr>)}</tbody></table>
    </Card>
  </>;
}
