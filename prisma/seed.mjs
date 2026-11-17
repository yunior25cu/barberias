import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
try {
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 14) {
    throw new Error("Set ADMIN_USERNAME and ADMIN_PASSWORD (at least 14 characters) to provision the administrator.");
  }
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  await db.adminUser.upsert({ where: { username: process.env.ADMIN_USERNAME }, update: { passwordHash }, create: { username: process.env.ADMIN_USERNAME, passwordHash } });
  await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  if (process.env.SEED_DEMO_DATA === "true" && process.env.NODE_ENV !== "production") {
    const existing = await db.service.findFirst();
    if (!existing) {
      const service = await db.service.create({ data: { name: "Corte clásico", description: "Servicio de ejemplo editable", durationMinutes: 30, sortOrder: 1 } });
      const staff = await db.staff.create({ data: { name: "Profesional de ejemplo", services: { create: { serviceId: service.id } } } });
      for (const weekday of [1, 2, 3, 4, 5, 6]) await db.businessHours.create({ data: { staffId: staff.id, weekday, startMinute: 9 * 60, endMinute: 18 * 60 } });
      console.log("Added development-only sample service, staff, and hours.");
    }
  }
  console.log(`Administrator ${process.env.ADMIN_USERNAME} provisioned.`);
} finally { await db.$disconnect(); }
