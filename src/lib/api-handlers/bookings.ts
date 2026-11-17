import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { tenantRepository } from "@/lib/tenant-repository";
import { localDateKey, localMinute } from "@/lib/availability";
import { error, json } from "@/lib/http";
import { phone, tokenHash } from "@/lib/security";
import { limitedForBusiness } from "@/lib/rate-limit";
import { withInitialBusiness } from "@/lib/business-route";
import type { BusinessContext } from "@/lib/business";

const schema = z.object({
  serviceId: z.string().min(1), staffId: z.string().optional(), startsAt: z.string().datetime(),
  name: z.string().trim().min(2).max(80), phone: z.string().trim().max(32).optional().default(""),
  manageToken: z.string().min(32).max(128),
});

export async function handlePOST(request: Request, business: BusinessContext) {
  const tenant = tenantRepository(business);
  const limit = await limitedForBusiness(request, business.id, "booking", 8, 60 * 60_000, 40);
  if (limit === true) return error("Llegaron muchos intentos desde este dispositivo. Probá más tarde.", 429);
  if (limit === null) return error("No pudimos guardar la reserva ahora. Probá nuevamente.", 503);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error("Completá tu nombre.");
  const normalizedPhone = parsed.data.phone.trim() ? phone(parsed.data.phone) : "";
  if (normalizedPhone === null) return error("Revisá el número de teléfono.");
  const start = new Date(parsed.data.startsAt);
  if (start.getUTCSeconds() !== 0 || start.getUTCMilliseconds() !== 0) return error("Ese horario ya no está disponible. Elegí otro.", 409);
  const duration = await tenant.service.findFirst({ where: { id: parsed.data.serviceId, active: true }, select: { id: true, durationMinutes: true } });
  if (!duration) return error("El servicio ya no está disponible.", 404);
  const end = new Date(start.getTime() + duration.durationMinutes * 60_000);
  const manage = parsed.data.manageToken;
  const key = request.headers.get("Idempotency-Key") || randomUUID();
  try {
    const booking = await tenant.$transaction(async tx => {
      await tx.lockOccupancy();
      await tx.assertBusinessActive();
      const existing = await tx.booking.findFirst({ where: { businessId: business.id, idempotencyKey: key } });
      if (existing) {
        const sameRequest = existing.serviceId === parsed.data.serviceId
          && existing.startsAt.getTime() === start.getTime()
          && existing.customerName === parsed.data.name
          && existing.phoneNormalized === normalizedPhone
          && (!parsed.data.staffId || existing.staffId === parsed.data.staffId)
          && existing.manageTokenHash === tokenHash(manage);
        if (!sameRequest) throw new Error("IDEMPOTENCY_KEY_REUSED");
        return existing;
      }
      const weekday = new Date(`${localDateKey(start)}T00:00:00Z`).getUTCDay();
      const minute = localMinute(start);
      const settings = business.settings;
      if (start.getTime() < Date.now() + (settings?.minAdvanceMinutes ?? 60) * 60_000
        || start.getTime() > Date.now() + (settings?.maxAdvanceDays ?? 60) * 86_400_000
        || minute % (settings?.slotStepMinutes ?? 15) !== 0) throw new Error("INVALID_SLOT");
      const staff = await tx.staff.findMany({
        where: {
          businessId: business.id, active: true, ...(parsed.data.staffId ? { id: parsed.data.staffId } : {}),
          services: { some: { businessId: business.id, serviceId: duration.id } },
          hours: { some: { businessId: business.id, weekday, startMinute: { lte: minute }, endMinute: { gte: minute + duration.durationMinutes } } },
        },
        orderBy: { name: "asc" }, select: { id: true },
      });
      for (const person of staff) {
        const conflict = await tx.occupancy.findFirst({
          where: { businessId: business.id, staffId: person.id, active: true, startsAt: { lt: end }, endsAt: { gt: start } },
          select: { id: true },
        });
        if (conflict) continue;
        const id = randomUUID();
        const row = await tx.booking.create({
          data: {
            id, businessId: business.id, code: String(randomInt(100000, 999999)), serviceId: duration.id, staffId: person.id,
            customerName: parsed.data.name, phoneNormalized: normalizedPhone, startsAt: start, endsAt: end,
            manageTokenHash: tokenHash(manage), idempotencyKey: key,
          },
        });
        await tx.occupancy.create({ data: { businessId: business.id, staffId: person.id, bookingId: id, startsAt: start, endsAt: end } });
        return row;
      }
      throw new Error("SLOT_TAKEN");
    }, { isolationLevel: "ReadCommitted" });
    return json({ code: booking.code, manageToken: manage, startsAt: booking.startsAt.toISOString(), status: booking.status });
  } catch (e) {
    if (e instanceof Error && e.message === "BUSINESS_INACTIVE") return error("Ese negocio no está disponible.", 404);
    if (e instanceof Error && e.message === "IDEMPOTENCY_KEY_REUSED") return error("No pudimos verificar esta solicitud. Iniciá una reserva nueva.", 409);
    if (e instanceof Error && e.message === "SLOT_TAKEN") return error("Ese horario se acaba de ocupar. Elegí otro.", 409);
    if (e instanceof Error && e.message === "INVALID_SLOT") return error("Ese horario ya no está disponible. Elegí otro.", 409);
    return error("No pudimos guardar la reserva. Probá nuevamente.", 503);
  }
}

export function POST(request: Request) {
  return withInitialBusiness(business => handlePOST(request, business));
}
