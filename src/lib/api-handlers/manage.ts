import { z } from "zod";
import { tenantRepository } from "@/lib/tenant-repository";
import { tokenHash } from "@/lib/security";
import { error, json } from "@/lib/http";
import { limitedForBusiness } from "@/lib/rate-limit";
import { localDateKey, localMinute } from "@/lib/availability";
import { withInitialBusiness } from "@/lib/business-route";
import type { BusinessContext } from "@/lib/business";

const bodySchema = z.object({
  code: z.string().regex(/^\d{6}$/), manageToken: z.string().min(32).max(128),
  action: z.enum(["cancel", "reschedule"]), startsAt: z.string().datetime().optional(),
});

export async function handlePOST(request: Request, business: BusinessContext) {
  const tenant = tenantRepository(business);
  const limit = await limitedForBusiness(request, business.id, "manage", 10, 60 * 60_000, 50);
  if (limit === true) return error("Hiciste demasiados intentos. Probá más tarde.", 429);
  if (limit === null) return error("No pudimos gestionar la reserva ahora. Probá nuevamente.", 503);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success || (body.data.action === "reschedule" && !body.data.startsAt)) return error("No pudimos verificar la reserva.", 404);
  try {
    const result = await tenant.$transaction(async tx => {
      await tx.lockOccupancy();
      const booking = await tx.booking.findFirst({
        where: { businessId: business.id, code: body.data.code, manageTokenHash: tokenHash(body.data.manageToken) },
      });
      if (!booking) return null;
      if (booking.status !== "confirmed") return { already: true };
      if (body.data.action === "cancel") {
        await tx.booking.update({ where: { id: booking.id, businessId: business.id }, data: { status: "cancelled" } });
        await tx.occupancy.updateMany({ where: { businessId: business.id, bookingId: booking.id }, data: { active: false } });
        return { already: false };
      }
      const start = new Date(body.data.startsAt!);
      const service = await tx.service.findFirst({
        where: { id: booking.serviceId, businessId: business.id, active: true },
        select: { id: true, durationMinutes: true },
      });
      if (!service) return { unavailable: true };
      const end = new Date(start.getTime() + service.durationMinutes * 60_000);
      const weekday = new Date(`${localDateKey(start)}T00:00:00Z`).getUTCDay();
      const minute = localMinute(start);
      const settings = business.settings;
      if (start.getTime() < Date.now() + (settings?.minAdvanceMinutes ?? 60) * 60_000
        || start.getTime() > Date.now() + (settings?.maxAdvanceDays ?? 60) * 86_400_000
        || minute % (settings?.slotStepMinutes ?? 15) !== 0) return { unavailable: true };
      const staff = await tx.staff.findMany({
        where: {
          businessId: business.id, active: true,
          services: { some: { businessId: business.id, serviceId: service.id } },
          hours: { some: { businessId: business.id, weekday, startMinute: { lte: minute }, endMinute: { gte: minute + service.durationMinutes } } },
        },
        orderBy: { name: "asc" }, select: { id: true },
      });
      for (const person of staff) {
        const conflict = await tx.occupancy.findFirst({
          where: { businessId: business.id, staffId: person.id, active: true, bookingId: { not: booking.id }, startsAt: { lt: end }, endsAt: { gt: start } },
          select: { id: true },
        });
        if (conflict) continue;
        await tx.occupancy.deleteMany({ where: { businessId: business.id, bookingId: booking.id } });
        await tx.booking.update({ where: { id: booking.id, businessId: business.id }, data: { staffId: person.id, startsAt: start, endsAt: end } });
        await tx.occupancy.create({
          data: { businessId: business.id, bookingId: booking.id, staffId: person.id, startsAt: start, endsAt: end },
        });
        return { already: false, startsAt: start.toISOString() };
      }
      return { unavailable: true };
    }, { isolationLevel: "ReadCommitted" });
    if (!result) return error("No pudimos verificar la reserva.", 404);
    if ("unavailable" in result) return error("Ese horario ya no está disponible. Elegí otro.", 409);
    return json({ cancelled: body.data.action === "cancel", already: result.already, ...("startsAt" in result ? { startsAt: result.startsAt } : {}) });
  } catch (cause) {
    if (process.env.CI === "true") {
      const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "unknown";
      console.error("MANAGE_RESCHEDULE_FAILED", { name: cause instanceof Error ? cause.name : "unknown", code });
    }
    return error("No pudimos cambiar la reserva ahora. Probá más tarde.", 503);
  }
}

export function POST(request: Request) {
  return withInitialBusiness(business => handlePOST(request, business));
}
