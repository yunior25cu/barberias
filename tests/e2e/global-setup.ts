import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { tokenHash } from "../../src/lib/security";

export default async function globalSetup() {
  loadEnvConfig(process.cwd());
  const connection = process.env.DATABASE_URL ?? "";
  if (!/^sqlserver:\/\/(localhost|127\.0\.0\.1)(:\d+)?;/i.test(connection) || !/(?:^|;)database=barber_local(?:;|$)/i.test(connection)) {
    throw new Error("E2E only runs against local SQL Server database barber_local.");
  }
  const db = new PrismaClient();
  const initialBusinessId = "al-corte";
  const secondBusinessId = "e2e-business";
  const allServiceIds = ["e2e-service", "e2e-service-b", "e2e-admin-service"];
  const allStaffIds = ["e2e-staff", "e2e-staff-2", "e2e-staff-b", "e2e-admin-staff"];
  try {
    const stalePlatformBusinesses = await db.business.findMany({ where: { slug: { startsWith: "e2e-platform-" } }, select: { id: true } });
    const stalePlatformIds = stalePlatformBusinesses.map(row => row.id);
    const stalePlatformServices = await db.service.findMany({ where: { businessId: { in: stalePlatformIds } }, select: { id: true } });
    const stalePlatformStaff = await db.staff.findMany({ where: { businessId: { in: stalePlatformIds } }, select: { id: true } });
    await db.booking.deleteMany({ where: { businessId: { in: stalePlatformIds } } });
    await db.occupancy.deleteMany({ where: { businessId: { in: stalePlatformIds } } });
    await db.businessHours.deleteMany({ where: { businessId: { in: stalePlatformIds } } });
    await db.staffService.deleteMany({ where: { businessId: { in: stalePlatformIds } } });
    await db.timeBlock.deleteMany({ where: { businessId: { in: stalePlatformIds } } });
    await db.staff.deleteMany({ where: { id: { in: stalePlatformStaff.map(row => row.id) } } });
    await db.service.deleteMany({ where: { id: { in: stalePlatformServices.map(row => row.id) } } });
    await db.platformAudit.deleteMany({ where: { businessId: { in: stalePlatformIds } } });
    await db.platformProvisioningRequest.deleteMany({ where: { businessId: { in: stalePlatformIds } } });
    await db.adminActivation.deleteMany({ where: { businessId: { in: stalePlatformIds } } });
    await db.settings.deleteMany({ where: { businessId: { in: stalePlatformIds } } });
    await db.adminUser.deleteMany({ where: { businessId: { in: stalePlatformIds } } });
    await db.business.deleteMany({ where: { id: { in: stalePlatformIds } } });
    const stalePlatformOwner = await db.platformAdmin.findUnique({ where: { username: "e2e-platform-owner" }, select: { id: true } });
    if (stalePlatformOwner) {
      await db.platformAudit.deleteMany({ where: { actorId: stalePlatformOwner.id } });
      await db.platformProvisioningRequest.deleteMany({ where: { actorId: stalePlatformOwner.id } });
    }
    await db.platformAdmin.deleteMany({ where: { username: "e2e-platform-owner" } });
    await db.booking.deleteMany({ where: { businessId: { in: [initialBusinessId, secondBusinessId] }, serviceId: { in: allServiceIds } } });
    await db.timeBlock.deleteMany({ where: { businessId: { in: [initialBusinessId, secondBusinessId] }, staffId: { in: allStaffIds } } });
    await db.occupancy.deleteMany({ where: { businessId: { in: [initialBusinessId, secondBusinessId] }, staffId: { in: allStaffIds } } });
    await db.businessHours.deleteMany({ where: { businessId: { in: [initialBusinessId, secondBusinessId] }, staffId: { in: allStaffIds } } });
    await db.staffService.deleteMany({ where: { businessId: { in: [initialBusinessId, secondBusinessId] }, staffId: { in: allStaffIds } } });
    await db.staff.deleteMany({ where: { businessId: { in: [initialBusinessId, secondBusinessId] }, id: { in: allStaffIds } } });
    await db.service.deleteMany({ where: { businessId: { in: [initialBusinessId, secondBusinessId] }, id: { in: allServiceIds } } });
    await db.adminUser.deleteMany({ where: { username: "e2e-owner", businessId: { in: [initialBusinessId, secondBusinessId] } } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: "tenant:" } } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: "global:" } } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: "identifier:" } } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: "identifier-ip:" } } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: "activation-ip:" } } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: "identifier:activation-token:" } } });

    await db.business.upsert({
      where: { id: secondBusinessId }, update: { slug: "e2e-b", status: "active" },
      create: { id: secondBusinessId, slug: "e2e-b", status: "active" },
    });
    await db.settings.upsert({
      where: { businessId: secondBusinessId }, update: { businessName: "Negocio E2E B" },
      create: { businessId: secondBusinessId, businessName: "Negocio E2E B" },
    });
    await db.service.create({ data: { id: "e2e-service", businessId: initialBusinessId, name: "Corte de prueba E2E", durationMinutes: 30, active: true } });
    await db.staff.create({
      data: { id: "e2e-staff", businessId: initialBusinessId, name: "Profesional de prueba" },
    });
    await db.staffService.create({ data: { businessId: initialBusinessId, staffId: "e2e-staff", serviceId: "e2e-service" } });
    await db.businessHours.createMany({ data: Array.from({ length: 7 }, (_, weekday) => ({
      id: `e2e-hours-${weekday}`, businessId: initialBusinessId, staffId: "e2e-staff", weekday, startMinute: 480, endMinute: 1200,
    })) });
    await db.staff.create({
      data: { id: "e2e-staff-2", businessId: initialBusinessId, name: "Profesional E2E B" },
    });
    await db.staffService.create({ data: { businessId: initialBusinessId, staffId: "e2e-staff-2", serviceId: "e2e-service" } });
    await db.businessHours.createMany({ data: Array.from({ length: 7 }, (_, weekday) => ({
      id: `e2e-hours-b-${weekday}`, businessId: initialBusinessId, staffId: "e2e-staff-2", weekday, startMinute: 480, endMinute: 1200,
    })) });
    await db.service.create({ data: { id: "e2e-service-b", businessId: secondBusinessId, name: "Servicio solo B", durationMinutes: 30, active: true } });
    await db.staff.create({
      data: { id: "e2e-staff-b", businessId: secondBusinessId, name: "Profesional solo B" },
    });
    await db.staffService.create({ data: { businessId: secondBusinessId, staffId: "e2e-staff-b", serviceId: "e2e-service-b" } });
    await db.businessHours.createMany({ data: Array.from({ length: 7 }, (_, weekday) => ({
      id: `e2e-hours-only-b-${weekday}`, businessId: secondBusinessId, staffId: "e2e-staff-b", weekday, startMinute: 480, endMinute: 1200,
    })) });
    const passwordHash = await bcrypt.hash("E2E-only-password-123!", 4);
    await db.adminUser.createMany({
      data: [
        { businessId: initialBusinessId, username: "e2e-owner", passwordHash },
        { businessId: secondBusinessId, username: "e2e-owner", passwordHash },
      ],
    });
    await db.platformAdmin.create({ data: {
      username: "e2e-platform-owner", passwordHash: await bcrypt.hash("E2E-platform-password-123!", 4), active: true,
    } });

    const sharedStart = new Date(Date.now() + 45 * 86_400_000);
    sharedStart.setUTCHours(3, 0, 0, 0);
    const sharedEnd = new Date(sharedStart.getTime() + 30 * 60_000);
    const requestKey = "e2e-shared-idempotency";
    for (const [businessId, bookingId, staffId, manageToken] of [
      [initialBusinessId, "e2e-repeat-a", "e2e-staff", "e2e-manage-token-for-business-a"],
      [secondBusinessId, "e2e-repeat-b", "e2e-staff-b", "e2e-manage-token-for-business-b"],
    ]) {
      const serviceId = businessId === initialBusinessId ? "e2e-service" : "e2e-service-b";
      await db.booking.create({
        data: {
          id: bookingId, businessId, code: "222222", serviceId, staffId, customerName: "CI tenant fixture", phoneNormalized: "",
          startsAt: sharedStart, endsAt: sharedEnd, manageTokenHash: tokenHash(manageToken), idempotencyKey: requestKey,
        },
      });
      await db.occupancy.create({ data: { id: `${bookingId}-occupancy`, businessId, staffId, bookingId, startsAt: sharedStart, endsAt: sharedEnd } });
    }
  } finally {
    await db.$disconnect();
  }
}
