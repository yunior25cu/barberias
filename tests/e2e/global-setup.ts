import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
export default async function globalSetup(){
  loadEnvConfig(process.cwd());const connection=process.env.DATABASE_URL??"";if(!/^sqlserver:\/\/(localhost|127\.0\.0\.1)(:\d+)?;/i.test(connection)||!/(?:^|;)database=barber_local(?:;|$)/i.test(connection))throw new Error("E2E only runs against local SQL Server database barber_local.");
  const db=new PrismaClient();try{
    const serviceIds=(await db.service.findMany({where:{name:{in:["Corte de prueba E2E","Servicio prueba admin"]}},select:{id:true}})).map(x=>x.id);const staffIds=(await db.staff.findMany({where:{name:{in:["Profesional de prueba","Profesional E2E B","Profesional prueba admin"]}},select:{id:true}})).map(x=>x.id);await db.booking.deleteMany({where:{serviceId:{in:serviceIds}}});await db.timeBlock.deleteMany({where:{staffId:{in:staffIds}}});await db.staff.deleteMany({where:{id:{in:staffIds}}});await db.service.deleteMany({where:{id:{in:serviceIds}}});await db.adminUser.deleteMany({where:{username:"e2e-owner"}});await db.rateLimit.deleteMany({where:{key:{startsWith:"availability:"}}});await db.rateLimit.deleteMany({where:{key:{startsWith:"booking:"}}});await db.rateLimit.deleteMany({where:{key:{startsWith:"manage:"}}});await db.rateLimit.deleteMany({where:{key:{startsWith:"login:"}}});
    await db.service.create({data:{id:"e2e-service",name:"Corte de prueba E2E",durationMinutes:30,active:true}});await db.staff.create({data:{id:"e2e-staff",name:"Profesional de prueba",services:{create:{serviceId:"e2e-service"}}}});
    await db.businessHours.createMany({data:Array.from({length:7},(_,weekday)=>({id:`e2e-hours-${weekday}`,staffId:"e2e-staff",weekday,startMinute:8*60,endMinute:20*60}))});
    await db.staff.create({data:{id:"e2e-staff-2",name:"Profesional E2E B",services:{create:{serviceId:"e2e-service"}}}});await db.businessHours.createMany({data:Array.from({length:7},(_,weekday)=>({id:`e2e-hours-b-${weekday}`,staffId:"e2e-staff-2",weekday,startMinute:8*60,endMinute:20*60}))});
    await db.adminUser.create({data:{username:"e2e-owner",passwordHash:await bcrypt.hash("E2E-only-password-123!",4)}});
  }finally{await db.$disconnect();}
}
