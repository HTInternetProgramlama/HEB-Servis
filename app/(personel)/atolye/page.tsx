'use client';
import { detailHref } from '@/lib/routes';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/store';
import { PageHeader, Search } from '@/components/ui';
import { JobTable } from '@/components/job-table';
import { jobActionLabel } from '@/components/job-action-label';
import { Icon } from '@/components/icons';
import { CarImage, Plate } from '@/components/vehicle-identity';
import { allowedMoves, moveJob, staffName, technicians, can } from '@/lib/commands';
import { fmtTime, fmtDate, fold, isoDay, today } from '@/lib/format';
import type { Job, JobStatus } from '@/lib/types';

const columns: { title: string; statuses: JobStatus[] }[] = [
  { title: 'Kabul', statuses: ['Kabul edildi', 'İnceleniyor'] },
  { title: 'Teklif/Onay', statuses: ['Onay bekliyor'] },
  { title: 'Serviste', statuses: ['İşlemde', 'Parça bekliyor', 'Son kontrol'] },
  { title: 'Hazır', statuses: ['Teslime hazır'] },
  { title: 'Teslim', statuses: ['Teslim edildi'] },
];

function columnOf(job: Job) {
  if (['Kabul edildi', 'İnceleniyor'].includes(job.status) && job.estimates.length > 0) return 1;
  return columns.findIndex(col => col.statuses.includes(job.status));
}

export default function Workshop() {
  const { state, actor, run } = useApp();
  const [tech, setTech] = useState(actor.role === 'technician' ? actor.userId : '');
  const [view, setView] = useState('board');
  const [mobileColumn, setMobileColumn] = useState(2);
  const [q, setQ] = useState('');
  const [dragged, setDragged] = useState('');
  const [notice, setNotice] = useState('');
  const [order, setOrder] = useState([0, 1, 2, 3, 4]);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('heb-workflow-columns') ?? 'null');
      if (Array.isArray(saved) && saved.length === 5 && new Set(saved).size === 5 && saved.every(i => Number.isInteger(i) && i >= 0 && i < 5)) setOrder(saved);
    } catch { /* Varsayılan sütun sırası korunur. */ }
  }, []);
  function changeOrder(next: number[]) { setOrder(next); try { localStorage.setItem('heb-workflow-columns', JSON.stringify(next)) } catch { /* Depolama kapalı olabilir. */ } }
  const jobs = state.jobs.filter(j => (actor.role !== 'technician' || j.technicianId === actor.userId) && (!tech || j.technicianId === tech) &&
    (view !== 'parts' || j.status === 'Parça bekliyor') && fold([j.no, state.vehicles.find(v => v.id === j.vehicleId)?.plate, state.customers.find(c => c.id === j.customerId)?.name].join(' ')).includes(fold(q)));

  const boardDay = today();
  const columnJobs = columns.map((_, index) => jobs.filter(j => columnOf(j) === index &&
    (index !== 4 || (!!j.deliveredAt && isoDay(j.deliveredAt) === boardDay))));

  return <>
    <PageHeader title="İş Akışı" sub="Kabulden teslime servis işleri" />
    <div className="toolbar workflow-toolbar">
      <div className="seg">{[['board', 'Sütunlar'], ['list', 'Liste'], ['parts', 'Parça durumu']].map(([v, label]) => <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{label}</button>)}</div>
      {actor.role !== 'technician' && <select className="select" value={tech} onChange={e => setTech(e.target.value)} aria-label="Teknisyen filtresi"><option value="">Tüm teknisyenler</option>{technicians(state).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
      <Search value={q} onChange={setQ} placeholder="Panoda ara" />
      <details className="board-settings"><summary className="btn">Sütun düzeni</summary><div>
        <p className="small muted">Sütun sırası bu tarayıcıda hatırlanır.</p>
        {order.map((index, position) => <label key={index}><span>{columns[index].title}</span><select className="select" aria-label={`${columns[index].title} sütun sırası`} value={position} onChange={e => {
          const next = [...order], target = Number(e.target.value); [next[position], next[target]] = [next[target], next[position]]; changeOrder(next);
        }}>{order.map((_, i) => <option key={i} value={i}>{i + 1}. sıra</option>)}</select></label>)}
        <button type="button" className="btn" onClick={() => changeOrder([0, 1, 2, 3, 4])}>Varsayılan düzene dön</button>
      </div></details>
      {can(actor, 'estimate.write') && <Link className="btn" href="/teklifler">Teklif onayları</Link>}
      {can(actor, 'payment.read') && <Link className="btn" href="/tahsilat">Tahsilatlar</Link>}
    </div>
    {view === 'parts' && <p className="banner">Parça bekleyen işler gösteriliyor. Bekleme gerekçesi iş emrinin notlarında bulunur.</p>}
    {notice && <p className="banner warn" role="status">{notice}</p>}
    {view !== 'list' && <div className="mobile-column-picker seg" role="group" aria-label="Gösterilen iş akışı sütunu">
      {order.map(index => <button key={index} type="button" className={mobileColumn === index ? 'active' : ''} aria-pressed={mobileColumn === index} onClick={() => setMobileColumn(index)}>
        {columns[index].title}{index === 4 ? ' · bugün' : ''}<span className="seg-count">{columnJobs[index].length}</span>
      </button>)}
    </div>}
    {view === 'list' ? <div className="card table-wrap"><JobTable jobs={jobs} /></div> : <div className="board" aria-label="İş akışı sütunları">
      {order.map(index => columns[index]).map(col => {
        const index = columns.indexOf(col);
        const items = columnJobs[index];
        return <section key={col.title} className={'board-col col-' + index + (mobileColumn === index ? ' mobile-selected' : '')} onDragOver={e => { if (dragged) e.preventDefault() }} onDrop={e => {
          e.preventDefault(); const job = jobs.find(j => j.id === dragged); setDragged('');
          if (!job || col.statuses.includes(job.status)) return;
          const move = allowedMoves(job, actor).find(m => col.statuses.includes(m));
          if (move) { setNotice(''); void run((s, a) => moveJob(s, a, job.id, move), `${job.no} → ${move}`, job.no) }
          else setNotice(`${job.no} bu sütuna doğrudan taşınamaz. İş emrindeki sıradaki işlemi tamamlayın.`);
        }}>
          <header><span>{col.title}{index === 4 && <small className="muted">Bugün</small>}</span><em>{items.length}</em></header>
          {index === 4 && <Link className="board-all" href="/is-emirleri?durum=teslim">Teslim edilenlerin tümü</Link>}
          <div className="board-items">
            {items.map(j => {
              const v = state.vehicles.find(x => x.id === j.vehicleId);
              const late = !['Teslime hazır', 'Teslim edildi'].includes(j.status) && new Date(j.promisedAt).getTime() < Date.now();
              const progress = ['Teslim edildi', 'Teslime hazır'].includes(j.status) ? 100 : j.status === 'Son kontrol' ? 85 : ['İşlemde', 'Parça bekliyor'].includes(j.status) ? 60 : j.status === 'Onay bekliyor' ? 35 : j.status === 'İnceleniyor' ? 20 : 5;
              const moves = allowedMoves(j, actor).filter(m => m !== 'İptal');
              const primaryMove = moves.find(m => m !== 'Parça bekliyor' && !(j.status === 'Son kontrol' && m === 'İşlemde')) ?? moves[0];
              const otherMoves = moves.filter(m => m !== primaryMove);
              const primaryLabel = primaryMove === 'Son kontrol' ? 'Son kontrol' : primaryMove === 'Parça bekliyor' ? 'Parça bekle' : primaryMove === 'Teslime hazır' ? 'Hazır işaretle' : primaryMove ? jobActionLabel(primaryMove, j.status) : '';
              return <article key={j.id} draggable={moves.length > 0} onDragStart={() => setDragged(j.id)} onDragEnd={() => setDragged('')} className={'board-card ' + (late ? 'late' : '')}>
                <Link href={detailHref('/is-emirleri/detay', j.id)} className="board-link">
                  <div className="row-between"><span className="mono small strong">{j.no}</span>{j.status === 'Parça bekliyor' ? <span className="tag orange">Parça bekliyor</span> : late ? <span className="tag red">Gecikme</span> : null}</div>
                  {v && <div className="board-art"><CarImage vehicle={v} /></div>}
                  {v && <div className="board-vehicle"><Plate value={v.plate} size="sm" /><span>{v.brand} {v.model}</span></div>}
                  <p className="board-complaint">{j.intake.complaint}</p>
                  <strong className="board-customer">{state.customers.find(c => c.id === j.customerId)?.name}</strong>
                  <div className="workflow-progress" role="progressbar" aria-label="İş akışı ilerlemesi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></div>
                  <small className="muted">Akış ilerlemesi %{progress}</small>
                  <div className="board-meta"><span><Icon name="user" size={15} />{staffName(state, j.technicianId)}</span><span><Icon name="clock" size={15} />Söz verilen: {isoDay(j.promisedAt) !== today() && fmtDate(j.promisedAt) + ' '}{fmtTime(j.promisedAt)}</span></div>
                </Link>
                {primaryMove && <div className="board-actions">
                  <button type="button" className="btn primary sm board-primary" title={jobActionLabel(primaryMove, j.status)} onClick={() => run((s, a) => moveJob(s, a, j.id, primaryMove), `${j.no} → ${primaryMove}`, j.no)}><span>{primaryLabel}</span></button>
                  {otherMoves.length > 0 && <details className="board-more">
                    <summary className="btn sm" aria-label={`${j.no} diğer geçişler`} title="Diğer geçişler">⋯</summary>
                    <div>{otherMoves.map(m => <button type="button" key={m} className="btn sm" onClick={e => {
                      e.currentTarget.closest('details')?.removeAttribute('open');
                      void run((s, a) => moveJob(s, a, j.id, m), `${j.no} → ${m}`, j.no);
                    }}>{jobActionLabel(m, j.status)}</button>)}</div>
                  </details>}
                </div>}
              </article>;
            })}
            {!items.length && <p className="board-empty">Kayıt yok</p>}
          </div>
        </section>;
      })}
    </div>}
  </>;
}
