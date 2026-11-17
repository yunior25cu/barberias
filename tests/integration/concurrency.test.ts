import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { lockOccupancy } from "@/lib/sql-lock";

const enabled = process.env.RUN_DB_TESTS === "1";
const suite = enabled ? describe : describe.skip;
const db = new PrismaClient();
const initialBusinessId = "al-corte";
const secondBusinessId = "e2e-business";

function assertLocalSqlServer(): void {
  const connection = process.env.DATABASE_URL ?? "";
  const local = /^sqlserver:\/\/(localhost|127\.0\.0\.1)(:\d+)?;/i.test(connection);
  const database = connection.match(/(?:^|;)database=([^;]+)/i)?.[1];
  if (!local || database !== "barber_local") throw new Error("Integration tests are restricted to local SQL Server database barber_local.");
}

async function ensureBusiness() {
  await db.business.upsert({
    where: { id: secondBusinessId }, update: { slug: "e2e-b", status: "active" },
    create: { id: secondBusinessId, slug: "e2e-b", status: "active" },
  });
  await db.settings.upsert({ where: { businessId: secondBusinessId }, update: {}, create: { businessId: secondBusinessId, businessName: "Tenant B CI" } });
}

async function createResources(businessId: string, suffix: string) {
  const serviceId = `s_${suffix}`, staffId = `p_${suffix}`;
  await db.service.create({ data: { id: serviceId, businessId, name: "Integration test", durationMinutes: 30 } });
  await db.staff.create({ data: { id: staffId, businessId, name: "Integration test" } });
  await db.staffService.create({ data: { businessId, staffId, serviceId } });
  return { serviceId, staffId };
}

async function removeResources(serviceIds: string[], staffIds: string[]) {
  await db.booking.deleteMany({ where: { serviceId: { in: serviceIds } } });
  await db.timeBlock.deleteMany({ where: { staffId: { in: staffIds } } });
  await db.occupancy.deleteMany({ where: { staffId: { in: staffIds } } });
  await db.businessHours.deleteMany({ where: { staffId: { in: staffIds } } });
  await db.staffService.deleteMany({ where: { staffId: { in: staffIds } } });
  await db.staff.deleteMany({ where: { id: { in: staffIds } } });
  await db.service.deleteMany({ where: { id: { in: serviceIds } } });
}

suite("Azure SQL serializa la agenda por negocio", () => {
  beforeAll(async () => { assertLocalSqlServer(); await ensureBusiness(); });

  it("acepta exactamente una de dos reservas concurrentes para el mismo intervalo en un negocio", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
    const { serviceId, staffId } = await createResources(initialBusinessId, suffix);
    const from = new Date(Date.now() + 3 * 86_400_000);
    from.setUTCSeconds(0, 0);
    from.setUTCMinutes(Math.ceil(from.getUTCMinutes() / 30) * 30);
    const to = new Date(from.getTime() + 30 * 60_000);
    try {
      const attempt = (id: string, code: string) => db.$transaction(async tx => {
        await lockOccupancy(tx, initialBusinessId);
        const conflict = await tx.occupancy.findFirst({ where: { businessId: initialBusinessId, staffId, active: true, startsAt: { lt: to }, endsAt: { gt: from } } });
        if (conflict) throw new Error("SLOT_TAKEN");
        await tx.booking.create({
          data: {
            id, businessId: initialBusinessId, code, serviceId, staffId, customerName: "Test", phoneNormalized: "+59899123456",
            startsAt: from, endsAt: to, manageTokenHash: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(),
          },
        });
        await tx.occupancy.create({ data: { businessId: initialBusinessId, staffId, bookingId: id, startsAt: from, endsAt: to } });
      });
      const attempts = await Promise.allSettled([attempt(`b1_${suffix}`, `1${suffix}`), attempt(`b2_${suffix}`, `2${suffix}`)]);
      expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
      expect(attempts.filter(result => result.status === "rejected")).toHaveLength(1);
      expect(await db.booking.count({ where: { businessId: initialBusinessId, serviceId } })).toBe(1);
    } finally {
      await removeResources([serviceId], [staffId]);
    }
  });

  it("rechaza solapamientos SQL si el escritor omite el lock de aplicación", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
    const { serviceId, staffId } = await createResources(initialBusinessId, suffix);
    const from = new Date(Date.now() + 4 * 86_400_000);
    from.setUTCSeconds(0, 0);
    const to = new Date(from.getTime() + 30 * 60_000);
    try {
      const bypassAppLock = (id: string, code: string) => db.$transaction(async tx => {
        await tx.booking.create({
          data: {
            id, businessId: initialBusinessId, code, serviceId, staffId, customerName: "Test", phoneNormalized: "+59899123456",
            startsAt: from, endsAt: to, manageTokenHash: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(),
          },
        });
        await tx.occupancy.create({ data: { businessId: initialBusinessId, staffId, bookingId: id, startsAt: from, endsAt: to } });
      });
      const attempts = await Promise.allSettled([bypassAppLock(`d1_${suffix}`, `3${suffix}`), bypassAppLock(`d2_${suffix}`, `4${suffix}`)]);
      expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
      expect(attempts.filter(result => result.status === "rejected")).toHaveLength(1);
      expect(await db.booking.count({ where: { businessId: initialBusinessId, serviceId } })).toBe(1);
    } finally {
      await removeResources([serviceId], [staffId]);
    }
  });

  it("permite códigos e idempotency keys iguales en negocios distintos", async () => {
    const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 14);
    const a = await createResources(initialBusinessId, `a${suffix}`);
    const b = await createResources(secondBusinessId, `b${suffix}`);
    const start = new Date(Date.now() + 20 * 86_400_000);
    start.setUTCHours(15, 0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60_000);
    try {
      await Promise.all([
        db.booking.create({ data: { businessId: initialBusinessId, id: `ba_${suffix}`, code: "454545", idempotencyKey: "same-key", serviceId: a.serviceId, staffId: a.staffId, customerName: "Test A", phoneNormalized: "", startsAt: start, endsAt: end, manageTokenHash: `hash-a-${suffix}` } }),
        db.booking.create({ data: { businessId: secondBusinessId, id: `bb_${suffix}`, code: "454545", idempotencyKey: "same-key", serviceId: b.serviceId, staffId: b.staffId, customerName: "Test B", phoneNormalized: "", startsAt: start, endsAt: end, manageTokenHash: `hash-b-${suffix}` } }),
      ]);
      expect(await db.booking.count({ where: { businessId: { in: [initialBusinessId, secondBusinessId] }, code: "454545", idempotencyKey: "same-key" } })).toBe(2);
    } finally {
      await removeResources([a.serviceId, b.serviceId], [a.staffId, b.staffId]);
    }
  });

  it("mantiene locks independientes para negocios distintos", async () => {
    let releaseA!: () => void;
    let lockedA!: () => void;
    const holdA = new Promise<void>(resolve => { releaseA = resolve; });
    const startedA = new Promise<void>(resolve => { lockedA = resolve; });
    const transactionA = db.$transaction(async tx => {
      await lockOccupancy(tx, initialBusinessId);
      lockedA();
      await holdA;
    });
    await startedA;
    let acquiredB: Promise<boolean> | undefined;
    try {
      acquiredB = db.$transaction(tx => lockOccupancy(tx, secondBusinessId)).then(() => true);
      const result = await Promise.race([acquiredB, new Promise<false>(resolve => setTimeout(() => resolve(false), 2_000))]);
      expect(result).toBe(true);
    } finally {
      releaseA();
      await Promise.all([transactionA, acquiredB?.catch(() => false)]);
    }
  });
});

afterAll(async () => db.$disconnect());
