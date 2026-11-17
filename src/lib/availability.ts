import { db } from "@/lib/db";
import { localToUtc } from "@/lib/time";
export { localDateKey, localMinute, localWeekday, localToUtc } from "@/lib/time";
export async function slots(serviceId: string, dateKey: string, staffId?:string) {
  const service=await db.service.findFirst({where:{id:serviceId,active:true}}); if(!service) return null;
  const [y,m,d]=dateKey.split("-").map(Number); const weekday=new Date(Date.UTC(y,m-1,d)).getUTCDay();
  const staff=await db.staff.findMany({where:{active:true,...(staffId?{id:staffId}:{}),services:{some:{serviceId}},hours:{some:{weekday}}},include:{hours:{where:{weekday}}}});
  const result: {time:string; startsAt:string; staffId:string}[]=[]; const settings=await db.settings.findFirst(); const earliest=Date.now()+(settings?.minAdvanceMinutes??60)*60_000; const latest=Date.now()+(settings?.maxAdvanceDays??60)*86400_000;
  for(const person of staff) for(const hours of person.hours) for(let minute=hours.startMinute;minute+service.durationMinutes<=hours.endMinute;minute+=settings?.slotStepMinutes??15){const start=localToUtc(dateKey,minute), end=new Date(start.getTime()+service.durationMinutes*60_000); if(start.getTime()<earliest||start.getTime()>latest)continue; const conflict=await db.occupancy.findFirst({where:{staffId:person.id,active:true,startsAt:{lt:end},endsAt:{gt:start}}}); if(!conflict)result.push({time:`${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`,startsAt:start.toISOString(),staffId:person.id}); }
  return [...new Map(result.map(item=>[item.time,item])).values()].sort((a,b)=>a.time.localeCompare(b.time));
}
