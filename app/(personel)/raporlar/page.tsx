'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/components/store';
import { Button, PageHeader } from '@/components/ui';
import { Icon, type IconName } from '@/components/icons';
import { ReportDoc } from '@/components/report-doc';
import { ReportsNav } from '@/components/subnavs';
import { buildReport, reportKinds, type ReportKind } from '@/lib/report';
import { amountDue, amountPaid, serviceName, staffName } from '@/lib/rules';
import { addDays, fmtDate, isoDay, today } from '@/lib/format';

const icons: Record<ReportKind, IconName> = { yonetim: 'chart', gunsonu: 'wallet', teknisyen: 'wrench', musteri: 'users' };

export default function ReportsPage() {
  const { state, actor } = useApp();
  const [kind, setKind] = useState<ReportKind>('yonetim');
  const [from, setFrom] = useState(addDays(today(), -29));
  const [to, setTo] = useState(today());
  const r = useMemo(() => buildReport(state, from, to), [state, from, to]);
  const meta = reportKinds.find(k => k.id === kind)!;
  const stage = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = stage.current; if (!el) return;
    // A4 genişliği (794 px) sahneye sığmazsa önizleme küçültülür; yazdırmada her zaman gerçek boyut.
    const ro = new ResizeObserver(() => setZoom(Math.min(1, (el.clientWidth - 2 * parseFloat(getComputedStyle(el).paddingLeft)) / 794)));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  useEffect(() => {
    // PDF kaydında dosya adı belge başlığından gelir.
    const old = document.title;
    const before = () => { document.title = `${meta.title} ${from}_${to}`.replaceAll(' ', '-') };
    const after = () => { document.title = old };
    addEventListener('beforeprint', before); addEventListener('afterprint', after);
    return () => { removeEventListener('beforeprint', before); removeEventListener('afterprint', after) };
  }, [meta.title, from, to]);

  const preset = (days: number) => { setFrom(addDays(today(), -(days - 1))); setTo(today()) };
  const pick = (k: ReportKind) => { setKind(k); if (k === 'gunsonu') { setFrom(today()); setTo(today()) } };

  function exportCsv() {
    const head = ['İş emri', 'Kabul', 'Teslim', 'Plaka', 'Marka', 'Model', 'Hizmet', 'Teknisyen', 'Durum', 'Onaylı tutar (TL)', 'Tahsilat (TL)'];
    const inRange = (iso?: string) => !!iso && isoDay(iso) >= from && isoDay(iso) <= to;
    const rows = state.jobs.filter(j => inRange(j.createdAt) || inRange(j.deliveredAt)).map(j => { const v = state.vehicles.find(x => x.id === j.vehicleId); return [j.no, fmtDate(j.createdAt), j.deliveredAt ? fmtDate(j.deliveredAt) : '', v?.plate ?? '', v?.brand ?? '', v?.model ?? '', serviceName(state, j.serviceId), staffName(state, j.technicianId), j.status, (amountDue(j) / 100).toFixed(2).replace('.', ','), (amountPaid(j) / 100).toFixed(2).replace('.', ',')] });
    const csv = '﻿' + [head, ...rows].map(x => x.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `is-emirleri_${from}_${to}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  return <div className="reports">
    <div className="no-print">
      <PageHeader title="Raporlar"
        actions={<><Button icon="download" onClick={exportCsv}>Excel (CSV)</Button><Button variant="primary" icon="printer" onClick={() => print()}>PDF indir</Button></>} />
      <ReportsNav />
    </div>
    <div className="report-layout">
      <aside className="report-controls no-print">
        <div className="report-kinds" role="radiogroup" aria-label="Rapor türü">
          {reportKinds.map(k => <button key={k.id} role="radio" aria-checked={kind === k.id} className={kind === k.id ? 'active' : ''} onClick={() => pick(k.id)}>
            <span className="rk-icon"><Icon name={icons[k.id]} size={17} /></span><span><b>{k.title}</b><small>{k.sub}</small></span>
          </button>)}
        </div>
        <div className="report-range">
          <span className="eyebrow">Dönem</span>
          <div className="chips">{([[1, 'Bugün'], [7, '7 gün'], [30, '30 gün'], [90, '90 gün']] as const).map(([d, l]) => <button key={d} className={'chip ' + (from === addDays(today(), -(d - 1)) && to === today() ? 'on' : '')} onClick={() => preset(d)}>{l}</button>)}</div>
          <label className="field"><span>Başlangıç</span><input type="date" value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} /></label>
          <label className="field"><span>Bitiş</span><input type="date" value={to} min={from} max={today()} onChange={e => e.target.value && setTo(e.target.value)} /></label>
        </div>
        <p className="report-hint"><Icon name="bulb" size={14} /><span>PDF için yazdırma penceresinde hedef olarak <b>PDF olarak kaydet</b>i seçin. Belge A4 dikey hazırlanır.</span></p>
      </aside>
      <div className="report-stage" ref={stage} style={{ ['--paper-zoom' as string]: zoom }}><ReportDoc kind={kind} r={r} state={state} by={actor.name} /></div>
    </div>
  </div>;
}
