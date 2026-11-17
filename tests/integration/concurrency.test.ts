import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { lockOccupancy } from "@/lib/sql-lock";

const enabled = process.env.RUN_DB_TESTS === "1";
const suite = enabled ? describe : describe.skip;
const db = new PrismaClient();

function assertLocalSqlServer(): void {
  const connection = process.env.DATABASE_URL ?? "";
  const local = /^sqlserver:\/\/(localhost|127\.0\.0\.1)(:\d+)?;/i.test(connection);
  const database = connection.match(/(?:^|;)database=([^;]+)/i)?.[1];
  if (!local || database !== "barber_local") throw new Error("Integration tests are restricted to local SQL Server database barber_local.");
}

suite("Azure SQL serializa las reservas con sp_getapplock", () => {
  beforeAll(assertLocalSqlServer);

  it("acepta exactamente una de dos transacciones concurrentes para el mismo intervalo", async () => {
    const suffix = crypto.randomUUID();
    const serviceId = `s_${suffix}`;
    const staffId = `p_${suffix}`;
    const from = new Date(Date.now() + 3 * 86400_000);
    from.setUTCSeconds(0, 0);
    from.setUTCMinutes(Math.ceil(from.getUTCMinutes() / 30) * 30);
    const to = new Date(from.getTime() + 30 * 60_000);
    try {
      await db.service.create({ data: { id: serviceId, name: "Integration test", durationMinutes: 30 } });
      await db.staff.create({ data: { id: staffId, name: "Integration test", services: { create: { serviceId } } } });
      const attempt = (id: string, code: string) => db.$transaction(async tx => {
        await lockOccupancy(tx);
        const conflict = await tx.occupancy.findFirst({ where: { staffId, active: true, startsAt: { lt: to }, endsAt: { gt: from } } });
        if (conflict) throw new Error("SLOT_TAKEN");
        await tx.booking.create({ data: { id, code, serviceId, staffId, customerName: "Test", phoneNormalized: "+59899123456", startsAt: from, endsAt: to, manageTokenHash: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() } });
        await tx.occupancy.create({ data: { staffId, bookingId: id, startsAt: from, endsAt: to } });
      });
      const attempts = await Promise.allSettled([attempt(`b1_${suffix}`, `1${suffix.slice(0, 5)}`), attempt(`b2_${suffix}`, `2${suffix.slice(0, 5)}`)]);
      expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
      expect(attempts.filter(result => result.status === "rejected")).toHaveLength(1);
      expect(await db.booking.count({ where: { serviceId } })).toBe(1);
    } finally {
      await db.booking.deleteMany({ where: { serviceId } });
      await db.timeBlock.deleteMany({ where: { staffId } });
      await db.staff.deleteMany({ where: { id: staffId } });
      await db.service.deleteMany({ where: { id: serviceId } });
    }
  });

  it("rechaza por trigger SQL superposiciones aunque un escritor omita sp_getapplock desde Prisma", async () => {
    const suffix = crypto.randomUUID();
    const serviceId = `s_${suffix}`;
    const staffId = `p_${suffix}`;
    const from = new Date(Date.now() + 4 * 86400_000);
    from.setUTCSeconds(0, 0);
    const to = new Date(from.getTime() + 30 * 60_000);
    try {
      await db.service.create({ data: { id: serviceId, name: "Trigger test", durationMinutes: 30 } });
      await db.staff.create({ data: { id: staffId, name: "Trigger test", services: { create: { serviceId } } } });
      const bypassAppLock = (id: string, code: string) => db.$transaction(async tx => {
        await tx.booking.create({ data: { id, code, serviceId, staffId, customerName: "Test", phoneNormalized: "+59899123456", startsAt: from, endsAt: to, manageTokenHash: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() } });
        await tx.occupancy.create({ data: { staffId, bookingId: id, startsAt: from, endsAt: to } });
      });
      const attempts = await Promise.allSettled([bypassAppLock(`d1_${suffix}`, `3${suffix.slice(0, 5)}`), bypassAppLock(`d2_${suffix}`, `4${suffix.slice(0, 5)}`)]);
      expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
      expect(attempts.filter(result => result.status === "rejected")).toHaveLength(1);
      expect(await db.booking.count({ where: { serviceId } })).toBe(1);
    } finally {
      await db.booking.deleteMany({ where: { serviceId } });
      await db.timeBlock.deleteMany({ where: { staffId } });
      await db.staff.deleteMany({ where: { id: staffId } });
      await db.service.deleteMany({ where: { id: serviceId } });
    }
  });
});

afterAll(async () => db.$disconnect());
