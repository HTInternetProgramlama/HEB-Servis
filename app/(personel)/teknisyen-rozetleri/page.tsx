'use client';
import { useState } from 'react';
import { useApp } from '@/components/store';
import { Button, Card, Empty, Field, FormError, Modal, PageHeader, Stat, useFormRunner } from '@/components/ui';
import { awardTechnician, can, staffName, technicians } from '@/lib/commands';
import { fmtDateTime } from '@/lib/format';
import type { TechnicianBadge } from '@/lib/types';
import styles from '@/components/operations.module.css';

export default function TechnicianAwardsPage() {
  const { state, actor } = useApp();
  const [open, setOpen] = useState(false);
  const [technician, setTechnician] = useState('');
  if (!can(actor, 'award.read')) return <Empty title="Rozet kayıtlarını görme yetkiniz yok" />;
  const all = (state.technicianAwards ?? []).filter(a => actor.role !== 'technician' || a.technicianId === actor.userId);
  const awards = all.filter(a => !technician || a.technicianId === technician).slice().reverse();
  return <div className={styles.operations}><PageHeader title="Teknisyen rozetleri ve ödüller" sub={actor.role === 'technician' ? 'Katkılarınız için verilen rozet ve ödüller' : 'Teknisyen katkılarını gerekçeleriyle kaydedin ve izleyin'} actions={can(actor, 'award.write') && <Button variant="primary" icon="star" onClick={() => setOpen(true)}>Rozet / ödül ver</Button>} />
    <div className="stats"><Stat label="Verilen rozet" value={all.length} /><Stat label="Ödüllendirilen teknisyen" value={new Set(all.map(a => a.technicianId)).size} /><Stat label="Ek ödül" value={all.filter(a => a.reward).length} /></div>
    {actor.role !== 'technician' && <div className="toolbar"><select aria-label="Teknisyene göre filtrele" value={technician} onChange={e => setTechnician(e.target.value)}><option value="">Tüm teknisyenler</option>{state.users.filter(u => u.role === 'technician').map(u => <option key={u.id} value={u.id}>{u.name}{u.active ? '' : ' (pasif)'}</option>)}</select></div>}
    <Card title="Ödül geçmişi">{awards.length ? <div className={styles.awards}>{awards.map(a => <article className={styles.award} key={a.id}><span className={styles.badge}>★ {a.badge}</span><h3>{a.title}</h3><strong>{staffName(state, a.technicianId)}</strong><p>{a.reason}</p>{a.reward && <p><strong>Ödül:</strong> {a.reward}</p>}{a.jobId && <small>İş emri: {state.jobs.find(j => j.id === a.jobId)?.no ?? 'Kayıtlı iş emri'}</small>}<small className="muted">{a.by} · {fmtDateTime(a.at)}</small></article>)}</div> : <Empty icon="star" title="Henüz rozet veya ödül yok" />}</Card>
    {open && <AwardForm onClose={() => setOpen(false)} />}
  </div>;
}
function AwardForm({ onClose }: { onClose: () => void }) {
  const { state, run } = useApp();
  const { error, busy, submit } = useFormRunner();
  const [technicianId, setTechnicianId] = useState(technicians(state)[0]?.id ?? '');
  return <Modal open title="Teknisyene rozet / ödül ver" onClose={onClose}><form className="form" onSubmit={e => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const input = { technicianId, badge: String(f.get('badge')) as TechnicianBadge, title: String(f.get('title')), reason: String(f.get('reason')), reward: String(f.get('reward')), jobId: String(f.get('jobId')) || undefined };
    void submit(() => run((s, a) => awardTechnician(s, a, input), 'Teknisyen rozeti kaydedildi'), onClose);
  }}><FormError error={error} /><div className="form-grid"><Field label="Teknisyen"><select required value={technicianId} onChange={e => setTechnicianId(e.target.value)}><option value="" disabled>Teknisyen seçin</option>{technicians(state).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field><Field label="Rozet"><select name="badge">{['Kalite', 'Dakiklik', 'İşbirliği', 'Ustalık'].map(b => <option key={b}>{b}</option>)}</select></Field><Field label="Başlık" wide><input name="title" required minLength={3} maxLength={100} /></Field><Field label="Gerekçe" wide><textarea name="reason" required minLength={5} maxLength={500} rows={3} /></Field><Field label="Ek ödül (isteğe bağlı)" wide><input name="reward" maxLength={200} placeholder="Örneğin eğitim katılımı veya teşekkür belgesi" /></Field><Field label="İlgili iş emri (isteğe bağlı)" wide><select key={technicianId} name="jobId"><option value="">İş emrine bağlı değil</option>{state.jobs.filter(j => j.technicianId === technicianId).map(j => <option key={j.id} value={j.id}>{j.no} · {j.status}</option>)}</select></Field></div><div className="form-actions"><Button onClick={onClose}>Vazgeç</Button><button className="btn primary" disabled={busy || !technicianId}>Rozeti kaydet</button></div></form></Modal>;
}
