import { seed } from '../lib/seed';
import { stableUuid } from '../lib/server/repository';
import type { State } from '../lib/types';

export function databaseSeed(authIds: Map<string, string>, adminEmail: string): State {
  const s = seed();
  const id = (kind: string, value: string) => stableUuid(`${kind}:${value}`);
  s.users = s.users.map(u => ({ ...u, id: authIds.get(u.email)!, email: u.role === 'admin' ? adminEmail : u.email, customerId: u.customerId ? id('customer', u.customerId) : undefined }));
  const user = (old: string) => {
    const original = seed().users.find(u => u.id === old)!;
    return authIds.get(original.email)!;
  };
  s.settings.resources = s.settings.resources.map(r => ({ ...r, id: id('resource', r.id) }));
  s.settings.services = s.settings.services.map(r => ({ ...r, id: id('service', r.id), catalogIds: r.catalogIds.map(v => id('catalog', v)) }));
  s.catalog = s.catalog.map(c => ({ ...c, id: id('catalog', c.id) }));
  s.customers = s.customers.map(c => ({ ...c, id: id('customer', c.id) }));
  s.vehicles = s.vehicles.map(v => ({ ...v, id: id('vehicle', v.id), customerId: id('customer', v.customerId) }));
  s.appointments = s.appointments.map(a => ({ ...a, id: id('appointment', a.id), customerId: id('customer', a.customerId), vehicleId: id('vehicle', a.vehicleId), serviceId: id('service', a.serviceId), resourceId: id('resource', a.resourceId) }));
  s.jobs = s.jobs.map(j => ({ ...j, id: id('job', j.id), appointmentId: j.appointmentId ? id('appointment', j.appointmentId) : undefined, customerId: id('customer', j.customerId), vehicleId: id('vehicle', j.vehicleId), serviceId: id('service', j.serviceId), advisorId: user(j.advisorId), technicianId: user(j.technicianId),
    inspections: j.inspections.map(i => ({ ...i, id: id('inspection', `${j.id}:${i.id}`) })),
    estimates: j.estimates.map(e => ({ ...e, id: id('estimate', `${j.id}:${e.id}`), lines: e.lines.map((l, i) => ({ ...l, id: id('line', `${j.id}:${e.id}:${i}:${l.id}`) })) })),
    payments: j.payments.map(p => ({ ...p, id: id('payment', `${j.id}:${p.id}`) })),
  }));
  s.notes = s.notes.map(n => ({ ...n, id: id('note', n.id), customerId: id('customer', n.customerId), jobId: n.jobId ? id('job', n.jobId) : undefined }));
  s.evaluations = s.evaluations.map(e => ({ ...e, id: id('evaluation', e.id), customerId: id('customer', e.customerId), jobId: id('job', e.jobId) }));
  s.reminders = s.reminders.map(r => ({ ...r, id: id('reminder', r.id), vehicleId: id('vehicle', r.vehicleId) }));
  s.audit = s.audit.map(a => ({ ...a, id: id('audit', a.id) }));
  return s;
}
