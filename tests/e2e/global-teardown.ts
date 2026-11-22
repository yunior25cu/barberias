import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

export default async function globalTeardown() {
  loadEnvConfig(process.cwd());
  const connection = process.env.DATABASE_URL ?? "";
  if (!/^sqlserver:\/\/(localhost|127\.0\.0\.1)(:\d+)?;/i.test(connection) || !/(?:^|;)database=barber_local(?:;|$)/i.test(connection)) {
    throw new Error("E2E teardown only runs against local SQL Server database barber_local.");
  }
  const db = new PrismaClient();
  const businessIds = ["al-corte", "e2e-business"];
  try {
    const platformBusinesses = await db.business.findMany({ where: { slug: { startsWith: "e2e-platform-" } }, select: { id: true } });
    const platformIds = platformBusinesses.map(row => row.id);
    const platformOwner = await db.platformAdmin.findUnique({ where: { username: "e2e-platform-owner" }, select: { id: true } });
    await db.platformAudit.deleteMany({ where: { businessId: { in: platformIds } } });
    if (platformOwner) await db.platformAudit.deleteMany({ where: { actorId: platformOwner.id } });
    await db.platformProvisioningRequest.deleteMany({ where: { businessId: { in: platformIds } } });
    if (platformOwner) await db.platformProvisioningRequest.deleteMany({ where: { actorId: platformOwner.id } });
    await db.adminActivation.deleteMany({ where: { businessId: { in: platformIds } } });
    await db.booking.deleteMany({ where: { businessId: { in: platformIds } } });
    await db.occupancy.deleteMany({ where: { businessId: { in: platformIds } } });
    await db.businessHours.deleteMany({ where: { businessId: { in: platformIds } } });
    await db.staffService.deleteMany({ where: { businessId: { in: platformIds } } });
    await db.timeBlock.deleteMany({ where: { businessId: { in: platformIds } } });
    await db.staff.deleteMany({ where: { businessId: { in: platformIds } } });
    await db.service.deleteMany({ where: { businessId: { in: platformIds } } });
    await db.settings.deleteMany({ where: { businessId: { in: platformIds } } });
    await db.adminUser.deleteMany({ where: { businessId: { in: platformIds } } });
    await db.business.deleteMany({ where: { id: { in: platformIds } } });
    if (platformOwner) await db.platformAdmin.delete({ where: { id: platformOwner.id } });
    const serviceIds = (await db.service.findMany({
      where: { businessId: { in: businessIds }, name: { in: ["Corte de prueba E2E", "Servicio prueba admin", "Servicio solo B", "Servicio dinámico 45", "Imagen E2E"] } }, select: { id: true },
    })).map(row => row.id);
    const staffIds = (await db.staff.findMany({
      where: { businessId: { in: businessIds }, name: { in: ["Profesional de prueba", "Profesional E2E B", "Profesional prueba admin", "Profesional solo B"] } }, select: { id: true },
    })).map(row => row.id);
    await db.booking.deleteMany({ where: { businessId: { in: businessIds }, id: { in: ["e2e-repeat-a", "e2e-repeat-b"] } } });
    await db.booking.deleteMany({ where: { businessId: { in: businessIds }, serviceId: { in: serviceIds } } });
    await db.timeBlock.deleteMany({ where: { businessId: { in: businessIds }, staffId: { in: staffIds } } });
    await db.occupancy.deleteMany({ where: { businessId: { in: businessIds }, staffId: { in: staffIds } } });
    await db.businessHours.deleteMany({ where: { businessId: { in: businessIds }, staffId: { in: staffIds } } });
    await db.staffService.deleteMany({ where: { businessId: { in: businessIds }, staffId: { in: staffIds } } });
    await db.staff.deleteMany({ where: { businessId: { in: businessIds }, id: { in: staffIds } } });
    await db.service.deleteMany({ where: { businessId: { in: businessIds }, id: { in: serviceIds } } });
    await db.adminUser.deleteMany({ where: { username: "e2e-owner", businessId: { in: businessIds } } });
    await db.settings.deleteMany({ where: { businessId: "e2e-business" } });
    await db.business.deleteMany({ where: { id: "e2e-business" } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: "tenant:" } } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: "global:" } } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: "platform-login" } } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: "identifier-ip:" } } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: "identifier-global:" } } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: "identifier:" } } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: "activation-ip" } } });
  } finally {
    await db.$disconnect();
  }
}
