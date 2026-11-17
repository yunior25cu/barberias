import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
const schema=z.object({businessName:z.string().trim().min(2).max(100).optional(),publicPhone:z.string().max(32).nullable().optional(),timezone:z.literal("America/Montevideo").optional(),currency:z.string().regex(/^[A-Z]{3}$/).optional(),minAdvanceMinutes:z.number().int().min(0).max(10080).optional(),maxAdvanceDays:z.number().int().min(1).max(365).optional(),slotStepMinutes:z.number().int().min(5).max(60).optional(),cancellationPolicy:z.string().max(500).optional()});
export async function GET(){if(!await requireAdmin())return error("Iniciá sesión.",401);return json({settings:await db.settings.upsert({where:{id:1},create:{id:1},update:{}})});}
export async function PATCH(request:Request){if(!await requireAdmin())return error("Iniciá sesión.",401);const body=schema.safeParse(await request.json().catch(()=>null));if(!body.success)return error("Revisá los ajustes del local.");try{return json(await db.settings.upsert({where:{id:1},create:{id:1,...body.data},update:body.data}));}catch{return error("No pudimos guardar los ajustes.",503);}}
