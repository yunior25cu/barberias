import { createHash } from "node:crypto";
import { db } from "@/lib/db";
export async function limited(request:Request,bucket:string,max:number,windowMs:number):Promise<boolean|null>{
  const forwarded=request.headers.get("x-real-ip")??request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()??"unknown";
  const key=`${bucket}:${createHash("sha256").update(forwarded).digest("hex")}`;const now=new Date();const reset=new Date(now.getTime()+windowMs);
  try{const rows=await db.$queryRaw<{hits:number}[]>`INSERT INTO "RateLimit"("key","hits","resetAt") VALUES(${key},1,${reset}) ON CONFLICT("key") DO UPDATE SET "hits"=CASE WHEN "RateLimit"."resetAt"<${now} THEN 1 ELSE "RateLimit"."hits"+1 END,"resetAt"=CASE WHEN "RateLimit"."resetAt"<${now} THEN ${reset} ELSE "RateLimit"."resetAt" END RETURNING "hits"`;if(Math.random()<0.01)await db.rateLimit.deleteMany({where:{resetAt:{lt:new Date(now.getTime()-86400_000)}}});return rows[0].hits>max;}catch{return null;}
}
