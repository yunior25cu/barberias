import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
const initialBusinessId = "al-corte";
try {
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 14) {
    throw new Error("Set ADMIN_USERNAME and ADMIN_PASSWORD (at least 14 characters) to provision the administrator.");
  }
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  await db.business.upsert({
    where: { id: initialBusinessId },
    update: {},
    create: { id: initialBusinessId, slug: "al-corte", status: "active" },
  });
  await db.adminUser.upsert({
    where: { username_businessId: { username: process.env.ADMIN_USERNAME, businessId: initialBusinessId } },
    update: { passwordHash, sessionVersion: { increment: 1 } },
    create: { businessId: initialBusinessId, username: process.env.ADMIN_USERNAME, passwordHash },
  });
  await db.settings.upsert({ where: { businessId: initialBusinessId }, update: {}, create: { businessId: initialBusinessId, businessName: "Al Corte" } });
  if (process.env.SEED_DEMO_DATA === "true" && process.env.NODE_ENV !== "production") {
    const existing = await db.service.findFirst({ where: { businessId: initialBusinessId } });
    if (!existing) {
      const service = await db.service.create({
        data: { businessId: initialBusinessId, name: "Corte clásico", description: "Servicio de ejemplo editable", durationMinutes: 30, sortOrder: 1 },
      });
      const staff = await db.staff.create({
        data: {
          businessId: initialBusinessId, name: "Profesional de ejemplo",
          services: { create: { businessId: initialBusinessId, serviceId: service.id } },
        },
      });
      for (const weekday of [1, 2, 3, 4, 5, 6]) {
        await db.businessHours.create({ data: { businessId: initialBusinessId, staffId: staff.id, weekday, startMinute: 540, endMinute: 1080 } });
      }
      console.log("Added development-only sample service, staff, and hours.");
    }
  }
  console.log(`Administrator ${process.env.ADMIN_USERNAME} provisioned for the initial business.`);
} finally {
  await db.$disconnect();
}
