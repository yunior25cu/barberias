import bcrypt from "bcryptjs";
import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sessionFor, adminCookieName } from "@/lib/auth";
import { env } from "@/lib/env";
import { error, json } from "@/lib/http";
import { limited } from "@/lib/rate-limit";
const bodySchema=z.object({username:z.string().min(1).max(100),password:z.string().min(1).max(200)});
export async function POST(request:Request){const limit=await limited(request,"login",8,15*60_000);if(limit===true)return error("Demasiados intentos. Esperá unos minutos y probá de nuevo.",429);if(limit===null)return error("No pudimos iniciar sesión ahora. Probá de nuevo.",503);const body=bodySchema.safeParse(await request.json().catch(()=>null));if(!body.success)return error("Ingresá usuario y contraseña.");if(!env.SESSION_SECRET)return error("El acceso del administrador no está configurado.",503);try{const admin=await db.adminUser.findUnique({where:{username:body.data.username}});if(!admin||!await bcrypt.compare(body.data.password,admin.passwordHash))return error("El usuario o la contraseña no coinciden.",401);(await cookies()).set(adminCookieName,sessionFor(admin.id),{httpOnly:true,secure:env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:8*60*60});return json({ok:true});}catch{return error("No pudimos iniciar sesión. Revisá la configuración del servidor.",503);}}
