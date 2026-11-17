import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
const entry=z.object({weekday:z.number().int().min(0).max(6),startMinute:z.number().int().min(0).max(1439),endMinute:z.number().int().min(1).max(1440)}).refine(x=>x.endMinute>x.startMinute);
export async function GET(){if(!await requireAdmin())return error("Iniciá sesión.",401);return json({staff:await db.staff.findMany({include:{hours:true,services:{include:{service:true}}}})});}
export async function PUT(request:Request){if(!await requireAdmin())return error("Iniciá sesión.",401);const body=z.object({staffId:z.string(),hours:z.array(entry).max(14)}).safeParse(await request.json().catch(()=>null));if(!body.success)return error("Revisá los horarios.");const sorted=[...body.data.hours].sort((a,b)=>a.weekday-b.weekday||a.startMinute-b.startMinute);for(let i=1;i<sorted.length;i++)if(sorted[i].weekday===sorted[i-1].weekday&&sorted[i].startMinute<sorted[i-1].endMinute)return error("Los horarios se superponen.");try{await db.$transaction(async tx=>{await tx.businessHours.deleteMany({where:{staffId:body.data.staffId}});await tx.businessHours.createMany({data:sorted.map(h=>({...h,staffId:body.data.staffId}))});});return json({ok:true});}catch{return error("No pudimos guardar el horario.",503);}}
