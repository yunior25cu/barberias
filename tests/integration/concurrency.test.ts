import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
const enabled=process.env.RUN_DB_TESTS==="1";
const suite=enabled?describe:describe.skip;
const db=new PrismaClient();
suite("PostgreSQL evita dobles reservas concurrentes",()=>{
  beforeAll(()=>{const url=new URL(process.env.DATABASE_URL??"");if(!["localhost","127.0.0.1"].includes(url.hostname)||url.pathname!=="/alcorte")throw new Error("Integration tests are restricted to the local alcorte database.");});
  it("confirma exactamente una de dos reservas transaccionales para la misma hora",async()=>{
    const suffix=crypto.randomUUID();const serviceId=`s_${suffix}`;const staffId=`p_${suffix}`;const firstId=`b1_${suffix}`;const secondId=`b2_${suffix}`;const from=new Date(Date.now()+86400_000);from.setUTCSeconds(0,0);const to=new Date(from.getTime()+30*60_000);
    try{await db.service.create({data:{id:serviceId,name:"Integration test",durationMinutes:30}});await db.staff.create({data:{id:staffId,name:"Integration test",services:{create:{serviceId}}}});
      const attempt=(id:string,code:string)=>db.$transaction(async tx=>{await tx.booking.create({data:{id,code,serviceId,staffId,customerName:"Test",phoneNormalized:"+59899123456",startsAt:from,endsAt:to,manageTokenHash:crypto.randomUUID()}});await tx.occupancy.create({data:{id:`o_${id}`,staffId,bookingId:id,startsAt:from,endsAt:to}});},{isolationLevel:"ReadCommitted"});
      const attempts=await Promise.allSettled([attempt(firstId,`1${suffix.slice(0,5)}`),attempt(secondId,`2${suffix.slice(0,5)}`)]);
      expect(attempts.filter(x=>x.status==="fulfilled")).toHaveLength(1);expect(attempts.filter(x=>x.status==="rejected")).toHaveLength(1);expect(await db.booking.count({where:{serviceId}})).toBe(1);
    }finally{await db.booking.deleteMany({where:{serviceId}});await db.timeBlock.deleteMany({where:{staffId}});await db.staff.deleteMany({where:{id:staffId}});await db.service.deleteMany({where:{id:serviceId}});}
  });
});
afterAll(async()=>db.$disconnect());
