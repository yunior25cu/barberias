import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
const input=z.object({name:z.string().trim().min(2).max(80),description:z.string().max(240).nullable().optional(),durationMinutes:z.number().int().min(5).max(480),priceCents:z.number().int().min(0).nullable().optional(),active:z.boolean().optional()});
export async function GET(){if(!await requireAdmin())return error("Iniciá sesión.",401);return json({services:await db.service.findMany({orderBy:{sortOrder:"asc"}})});}
export async function POST(request:Request){if(!await requireAdmin())return error("Iniciá sesión.",401);const body=input.safeParse(await request.json().catch(()=>null));if(!body.success)return error("Revisá los datos del servicio.");try{return json(await db.service.create({data:body.data}),201);}catch{return error("No pudimos guardar el servicio.",503);}}
export async function PATCH(request:Request){if(!await requireAdmin())return error("Iniciá sesión.",401);const body=z.object({id:z.string(),...input.partial().shape}).safeParse(await request.json().catch(()=>null));if(!body.success)return error("Revisá los datos del servicio.");const{id,...data}=body.data;try{return json(await db.service.update({where:{id},data}));}catch{return error("No pudimos actualizar el servicio.",404);}}
