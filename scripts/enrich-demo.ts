/** Additive demo enrichment. Default is dry-run; only *.test customers are used. */
import assert from 'node:assert/strict';
import { loadConfig } from './env';
import { db, readState, transaction, writeState } from '../lib/server/database';
import { stableUuid } from '../lib/server/repository';
import { addDays, minutes, today, weekday } from '../lib/format';
import { approvedEstimate, estimateTotals, findClash } from '../lib/rules';
import type { State, Job, Appointment } from '../lib/types';

const demo = (email:string) => /^[^\s@]+@[^\s@]+\.test$/i.test(email);
export function enrichDemo(before: State, clock=new Date()): State {
  const s=structuredClone(before), date=today(clock), monday=addDays(date,1-weekday(date));
  const id=(key:string)=>stableUuid(`heb-enrich-v1:${monday}:${key}`);
  const at=(day:string,time='10:00')=>new Date(`${day}T${time}:00+03:00`).toISOString();
  const actor=s.users.find(u=>u.active&&u.role==='admin') || s.users.find(u=>u.active&&u.role==='advisor');
  assert.ok(actor,'Etkin personel gerekli.');
  const customers=s.customers.filter(c=>demo(c.email)&&!c.no.startsWith('QA-'));
  const allowed=new Set(customers.map(c=>c.id));
  const originals=before.jobs.filter(j=>allowed.has(j.customerId)&&j.status==='Teslim edildi'&&approvedEstimate(j));
  for(let i=0;i<Math.min(3,originals.length);i++) {
    const source=originals[i], jobId=id(`job:${i}`); if(s.jobs.some(j=>j.id===jobId))continue;
    const vehicle=s.vehicles.find(v=>v.id===source.vehicleId&&v.customerId===source.customerId); if(!vehicle)continue;
    const day=addDays(date,-6+i*2), estimate=structuredClone(approvedEstimate(source)!);
    estimate.id=id(`estimate:${i}`); estimate.version=1; estimate.lines=estimate.lines.map((l,k)=>({...l,id:id(`line:${i}:${k}`)}));
    estimate.createdAt=at(day,'09:00'); estimate.sentAt=at(day,'09:10');
    estimate.decision={result:'Onaylandı',channel:'Şube',note:'Kurgusal demo servis onayı',by:actor.name,at:at(day,'09:20')};
    const total=estimateTotals(estimate).total; if(total<=0)continue;
    const no=`İE-${String(++s.seq.job).padStart(5,'0')}`;
    const job:Job={...structuredClone(source),id:jobId,no,appointmentId:undefined,status:'Teslim edildi',
      intake:{...source.intake,km:vehicle.km,at:at(day,'08:45'),by:actor.name,complaint:'Kurgusal demo: periyodik bakım ve kontrol',damages:[]},
      inspections:source.inspections.map((v,k)=>({...v,id:id(`inspection:${i}:${k}`),photoPath:undefined,at:at(day,'09:00')})),
      estimates:[estimate],payments:[{id:id(`payment:${i}`),key:`demo-enrich:${monday}:${i}`,amount:total,method:(['Nakit','Kredi kartı','Havale/EFT'] as const)[i%3],note:'Kurgusal demo tahsilatı; gerçek ödeme değildir.',at:at(day,'16:45'),by:actor.name}],
      history:[{status:'Kabul edildi',at:at(day,'08:45'),by:actor.name,note:'Kurgusal demo kaydı'},{status:'Teslime hazır',at:at(day,'16:30'),by:actor.name,note:'Son kontrol tamamlandı'},{status:'Teslim edildi',at:at(day,'17:00'),by:actor.name,note:'Demo teslimi'}],
      createdAt:at(day,'08:45'),promisedAt:at(day,'17:00'),deliveredAt:at(day,'17:00'),deliveryNote:'Yalnız kurgusal demo verisi.'};
    s.jobs.push(job);
    if(!s.evaluations.some(e=>e.customerId===job.customerId&&!e.jobId))s.evaluations.push({id:id(`evaluation:${i}`),customerId:job.customerId,jobId:'',punctuality:5-i%2,payment:5,communication:4+i%2,reason:'Kurgusal demo müşteri iletişimi değerlendirmesi.',at:at(day,'17:10'),by:actor.name});
  }
  const service=s.settings.services[0];
  for(let i=0;i<Math.min(6,customers.length);i++) {
    const customer=customers[i], appointmentId=id(`appointment:${i}`); if(s.appointments.some(a=>a.id===appointmentId))continue;
    const vehicle=s.vehicles.find(v=>v.customerId===customer.id); if(!vehicle||!service)continue;
    let slot:Pick<Appointment,'date'|'time'|'resourceId'>|undefined;
    const duration=service.duration;
    for(let d=0;d<7&&!slot;d++) {
      const day=addDays(date,(i+d)%7);if(!s.settings.workDays.includes(weekday(day)))continue;
      for(let m=minutes(s.settings.workStart);m+duration<=minutes(s.settings.workEnd)&&!slot;m+=30) {
        if(m<minutes(s.settings.breakEnd)&&m+duration>minutes(s.settings.breakStart))continue;
        if(day===date&&at(day,`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`)<=clock.toISOString())continue;
        const time=`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
        for(const r of s.settings.resources.filter(r=>r.active))if(!findClash(s,{id:appointmentId,date:day,time,duration,resourceId:r.id})) {slot={date:day,time,resourceId:r.id};break;}
      }
    }
    if(slot)s.appointments.push({id:appointmentId,no:`R-${String(++s.seq.appointment).padStart(5,'0')}`,customerId:customer.id,vehicleId:vehicle.id,serviceId:service.id,...slot,duration,status:'Onaylı',source:'Telefon',note:'Kurgusal demo: yaklaşan bakım randevusu.',createdAt:clock.toISOString(),createdBy:actor.name});
    const reminderId=id(`reminder:${i}`);
    if(!s.reminders.some(r=>r.id===reminderId))s.reminders.push({id:reminderId,vehicleId:vehicle.id,result:slot?'Randevu alındı':'Daha sonra aranacak',note:'Kurgusal demo bakım hatırlatma görüşmesi.',at:clock.toISOString(),by:actor.name});
  }
  s.stockItems??=[];s.stockMovements??=[];s.technicianAwards??=[];
  const stock=[['DEMO-YAG-5W30','Demo motor yağı 5W-30','lt',2000,6000,450],['DEMO-YAG-FLT','Demo yağ filtresi','adet',500,400,100],['DEMO-BALATA','Demo ön fren balatası','takım',300,200,100]] as const;
  for(const [i,[code,name,unit,minimum,incoming,outgoing]] of stock.entries()) {
    const itemId=stableUuid(`heb-enrich-v1:stock:${code}`);
    const existing=s.stockItems.find(v=>v.code.toLowerCase()===code.toLowerCase());
    if(existing&&existing.id!==itemId)continue; // Never adopt or change an existing stock card.
    if(!existing)s.stockItems.push({id:itemId,code,name,unit,minimum,active:true});
    if(!s.stockItems.find(v=>v.id===itemId)?.active)continue;
    for(const [kind,quantity] of [['Giriş',incoming],['Çıkış',outgoing]] as const) {
      const movementId=stableUuid(`heb-enrich-v1:stock:${code}:${kind}`);if(s.stockMovements.some(m=>m.id===movementId))continue;
      s.stockMovements.push({id:movementId,itemId,kind,quantity,reason:`Kurgusal demo ${kind==='Giriş'?'başlangıç stoğu':'servis tüketimi'}`,at:at(addDays(date,-3+i)),by:actor.name});
    }
  }
  const techs=s.users.filter(u=>u.role==='technician'&&u.active);
  for(let i=0;i<Math.min(3,techs.length);i++) {const awardId=id(`award:${i}`);if(!s.technicianAwards.some(a=>a.id===awardId))s.technicianAwards.push({id:awardId,technicianId:techs[i].id,badge:(['Kalite','İşbirliği','Ustalık'] as const)[i],title:['Titiz son kontrol','Ekip desteği','Bakım uzmanlığı'][i],reason:'Kurgusal demo: servis kontrol ve ekip çalışması başarısı.',reward:'Kurgusal teşekkür belgesi',at:at(addDays(date,-i-1),'17:00'),by:actor.name});}
  return s;
}
export function additions(before:State,after:State) {
  const arrays=['jobs','appointments','reminders','evaluations','stockItems','stockMovements','technicianAwards'] as const;
  return Object.fromEntries(arrays.map(k=>[k,(after[k]?.length??0)-(before[k]?.length??0)]));
}
async function main() {
  loadConfig();
  const apply=process.argv.includes('--apply');
  if(apply)assert.ok(['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname)||process.argv.includes('--allow-cloud'),'Bulut ekleme için ayrıca --allow-cloud gerekir; varsayılan yalnız önizlemedir.');
  await transaction(async pg=>{
    await pg.query('select id from app_control where id=1 for update');
    const {state:before,revision}=await readState(pg), after=enrichDemo(before), counts=additions(before,after);
    assert.deepEqual(enrichDemo(after),after,'Aynı haftada tekrar çalıştırma kayıt çoğaltmamalı.');
    console.log(JSON.stringify({mode:apply?'apply':'dry-run',additions:counts}));
    if(apply&&Object.values(counts).some(n=>n>0))await writeState(pg,before,after,revision+1);
  });
}
if(process.argv[1]?.endsWith('enrich-demo.ts'))main().catch(error=>{console.error(error instanceof assert.AssertionError?error.message:'Demo zenginleştirme tamamlanamadı; migration ve ortam ayarlarını kontrol edin.');process.exitCode=1;}).finally(()=>db().end());
