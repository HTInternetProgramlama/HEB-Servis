'use client';
import { detailHref } from '@/lib/routes';
import { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/store';
import { PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';
import { Plate } from '@/components/vehicle-identity';
import { allowedMoves, moveJob, serviceName, staffName, technicians } from '@/lib/rules';
import { fmtTime, isoDay, today } from '@/lib/format';
import type { JobStatus } from '@/lib/types';

const columns: { title: string; statuses: JobStatus[] }[] = [
  { title: 'Kabul / inceleme', statuses: ['Kabul edildi', 'İnceleniyor'] },
  { title: 'Müşteri onayı', statuses: ['Onay bekliyor'] },
  { title: 'İşlemde', statuses: ['İşlemde', 'Parça bekliyor'] },
  { title: 'Son kontrol', statuses: ['Son kontrol'] },
  { title: 'Teslime hazır', statuses: ['Teslime hazır'] },
];

export default function Workshop() {
  const { state, actor, run } = useApp();
  const [tech, setTech] = useState(actor.role === 'technician' ? actor.userId : '');
  const jobs = state.jobs.filter(j => !tech || j.technicianId === tech);
  const deliveredToday = state.jobs.filter(j => j.deliveredAt && isoDay(j.deliveredAt) === today()).length;

  return <>
    <PageHeader title="Atölye panosu" sub={`Araçların iş akışındaki yeri · bugün ${deliveredToday} teslim`}
      actions={<select className="select" value={tech} onChange={e => setTech(e.target.value)} aria-label="Teknisyen filtresi"><option value="">Tüm teknisyenler</option>{technicians(state).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>} />
    <div className="board">
      {columns.map(col => {
        const items = jobs.filter(j => col.statuses.includes(j.status));
        return <section key={col.title} className="board-col">
          <header><span>{col.title}</span><em>{items.length}</em></header>
          <div className="board-items">
            {items.map(j => {
              const v = state.vehicles.find(x => x.id === j.vehicleId);
              const late = j.status !== 'Teslime hazır' && new Date(j.promisedAt).getTime() < Date.now();
              const moves = allowedMoves(j, actor).filter(m => m !== 'İptal');
              return <article key={j.id} className={'board-card ' + (late ? 'late' : '')}>
                <Link href={detailHref('/is-emirleri/detay', j.id)} className="board-link">
                  <div className="row-between"><span className="mono small strong">{j.no}</span>{j.status === 'Parça bekliyor' ? <span className="tag orange">Parça bekliyor</span> : late ? <span className="tag red">Gecikme</span> : null}</div>
                  {v && <div className="board-vehicle"><Plate value={v.plate} size="sm" /><span>{v.brand} {v.model}</span></div>}
                  <p className="board-complaint">{j.intake.complaint}</p>
                  <div className="board-meta"><span><Icon name="wrench" size={12} />{serviceName(state, j.serviceId)}</span><span><Icon name="user" size={12} />{staffName(state, j.technicianId).split(' ')[0]}</span><span><Icon name="clock" size={12} />{isoDay(j.promisedAt) === today() ? fmtTime(j.promisedAt) : new Date(j.promisedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}</span></div>
                </Link>
                {moves.length > 0 && <div className="board-actions">{moves.map(m => <button key={m} className="btn sm" onClick={() => run((s, a) => moveJob(s, a, j.id, m), `${j.no} → ${m}`, j.no)}>{m} <Icon name="arrow" size={12} /></button>)}</div>}
              </article>;
            })}
            {!items.length && <p className="board-empty">Kayıt yok</p>}
          </div>
        </section>;
      })}
    </div>
  </>;
}
