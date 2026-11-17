import { tenantRepository } from "@/lib/tenant-repository";
import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { hasSameOrigin } from "@/lib/origin";
import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { localDateKey, localMinute } from "@/lib/availability";
import { phone as normalizePhone, token, tokenHash } from "@/lib/security";
import { withInitialBusiness } from "@/lib/business-route";
import type { BusinessContext } from "@/lib/business";

const bookingProjection = {
  id: true, code: true, customerName: true, phoneNormalized: true, startsAt: true, endsAt: true, status: true,
  service: { select: { name: true, durationMinutes: true } },
  staff: { select: { id: true, name: true } },
} as const;

export async function handleGET(request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión para ver la agenda.", 401);
  const url = new URL(request.url);
  const start = new Date(url.searchParams.get("from") ?? new Date().toISOString());
  const end = new Date(url.searchParams.get("to") ?? new Date(start.getTime() + 86_400_000).toISOString());
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return error("Revisá el período de la agenda.");
  try {
    const bookings = await tenantRepository(business).booking.findMany({
      where: { startsAt: { gte: start, lt: end } },
      select: bookingProjection, orderBy: { startsAt: "asc" },
    });
    return json({ bookings });
  } catch {
    return error("No pudimos cargar la agenda.", 503);
  }
}

const manual = z.object({
  serviceId: z.string(), staffId: z.string(), startsAt: z.string().datetime(),
  name: z.string().trim().min(2).max(80), phone: z.string().min(8).max(32),
});
export async function handlePOST(request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const body = manual.safeParse(await request.json().catch(() => null));
  if (!body.success) return error("Revisá los datos de la reserva.");
  const start = new Date(body.data.startsAt);
  const normalizedPhone = normalizePhone(body.data.phone);
  if (!normalizedPhone) return error("Revisá el teléfono.");
  try {
    const tenant = tenantRepository(business);
    const booking = await tenant.$transaction(async tx => {
      await tx.lockOccupancy();
      await tx.assertBusinessActive();
      const service = await tx.service.findFirst({ where: { businessId: business.id, id: body.data.serviceId, active: true } });
      if (!service) throw new Error("SERVICE_UNAVAILABLE");
      const staff = await tx.staff.findFirst({
        where: { businessId: business.id, id: body.data.staffId, active: true, services: { some: { businessId: business.id, serviceId: body.data.serviceId } } },
        select: { id: true },
      });
      if (!staff) throw new Error("STAFF_UNAVAILABLE");
      const endsAt = new Date(start.getTime() + service.durationMinutes * 60_000);
      const weekday = new Date(`${localDateKey(start)}T00:00:00Z`).getUTCDay();
      const minute = localMinute(start);
      const hours = await tx.businessHours.findFirst({
        where: { businessId: business.id, staffId: staff.id, weekday, startMinute: { lte: minute }, endMinute: { gte: minute + service.durationMinutes } },
        select: { id: true },
      });
      if (!hours) throw new Error("OUTSIDE_BUSINESS_HOURS");
      const conflict = await tx.occupancy.findFirst({
        where: { businessId: business.id, staffId: staff.id, active: true, startsAt: { lt: endsAt }, endsAt: { gt: start } },
        select: { id: true },
      });
      if (conflict) throw new Error("SLOT_TAKEN");
      const id = randomUUID();
      const row = await tx.booking.create({
        data: {
          id, businessId: business.id, code: String(randomInt(100000, 999999)), serviceId: service.id, staffId: staff.id,
          customerName: body.data.name, phoneNormalized: normalizedPhone, startsAt: start, endsAt,
          manageTokenHash: tokenHash(token()), idempotencyKey: randomUUID(),
        },
        select: bookingProjection,
      });
      await tx.occupancy.create({ data: { businessId: business.id, staffId: staff.id, bookingId: id, startsAt: start, endsAt } });
      return row;
    }, { isolationLevel: "ReadCommitted" });
    return json({ booking }, 201);
  } catch (cause) {
    if (cause instanceof Error) {
      if (cause.message === "SERVICE_UNAVAILABLE") return error("El servicio ya no está disponible. Actualizá e intentá nuevamente.", 422);
      if (cause.message === "STAFF_UNAVAILABLE") return error("El profesional seleccionado no está activo o no realiza este servicio.", 422);
      if (cause.message === "OUTSIDE_BUSINESS_HOURS") return error("No hay horario configurado para ese profesional en este día, o el turno queda fuera de su jornada. Revisá Horarios.", 422);
      if (cause.message === "SLOT_TAKEN") return error("Ese horario ya está ocupado. Actualizá la agenda y elegí otro.", 409);
    }
    return error("No pudimos guardar la reserva. Probá nuevamente.", 503);
  }
}

const change = z.object({
  id: z.string(), status: z.enum(["confirmed", "cancelled", "completed", "no_show"]).optional(),
  startsAt: z.string().datetime().optional(), staffId: z.string().optional(), serviceId: z.string().optional(),
});
export async function handlePATCH(request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const body = change.safeParse(await request.json().catch(() => null));
  if (!body.success) return error("Revisá el cambio.");
  try {
    const tenant = tenantRepository(business);
    const result = await tenant.$transaction(async tx => {
      await tx.lockOccupancy();
      await tx.assertBusinessActive();
      const current = await tx.booking.findFirst({ where: { id: body.data.id, businessId: business.id } });
      if (!current) return null;
      if (current.status !== "confirmed") return { alreadyFinal: true, status: current.status };
      const status = body.data.status ?? current.status;
      if (status !== "confirmed") {
        const changed = await tx.booking.updateMany({
          where: { id: current.id, businessId: business.id, status: "confirmed" },
          data: { status },
        });
        if (changed.count !== 1) return { alreadyFinal: true, status: current.status };
        await tx.occupancy.updateMany({ where: { businessId: business.id, bookingId: current.id }, data: { active: false } });
        return { id: current.id, status };
      }
      const serviceId = body.data.serviceId ?? current.serviceId;
      const staffId = body.data.staffId ?? current.staffId;
      const service = await tx.service.findFirst({ where: { id: serviceId, businessId: business.id, active: true } });
      const staff = await tx.staff.findFirst({
        where: { id: staffId, businessId: business.id, active: true, services: { some: { businessId: business.id, serviceId } } },
        select: { id: true },
      });
      const startsAt = body.data.startsAt ? new Date(body.data.startsAt) : current.startsAt;
      if (!service || !staff) throw new Error("INVALID");
      const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
      const weekday = new Date(`${localDateKey(startsAt)}T00:00:00Z`).getUTCDay();
      const minute = localMinute(startsAt);
      const hours = await tx.businessHours.findFirst({
        where: { businessId: business.id, staffId, weekday, startMinute: { lte: minute }, endMinute: { gte: minute + service.durationMinutes } },
        select: { id: true },
      });
      if (!hours) throw new Error("INVALID");
      const conflict = await tx.occupancy.findFirst({
        where: { businessId: business.id, staffId, active: true, bookingId: { not: current.id }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
        select: { id: true },
      });
      if (conflict) throw new Error("SLOT_TAKEN");
      const changed = await tx.booking.updateMany({
        where: { id: current.id, businessId: business.id, status: "confirmed" },
        data: { status, serviceId, staffId, startsAt, endsAt },
      });
      if (changed.count !== 1) return { alreadyFinal: true, status: current.status };
      await tx.occupancy.deleteMany({ where: { businessId: business.id, bookingId: current.id } });
      await tx.occupancy.create({
        data: { businessId: business.id, bookingId: current.id, staffId, startsAt, endsAt },
      });
      return { id: current.id, status, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
    }, { isolationLevel: "ReadCommitted" });
    if (!result) return error("No encontramos la reserva.", 404);
    if ("alreadyFinal" in result) return error("La reserva ya fue actualizada por otra acción. Actualizá la agenda para ver su estado actual.", 409);
    return json(result);
  } catch (cause) {
    if (cause instanceof Error && cause.message === "INVALID") return error("El profesional no ofrece ese servicio en ese horario.", 422);
    if (cause instanceof Error && cause.message === "SLOT_TAKEN") return error("El nuevo horario está ocupado.", 409);
    return error("No pudimos cambiar la reserva.", 503);
  }
}

export function GET(request: Request) { return withInitialBusiness(business => handleGET(request, business)); }
export function POST(request: Request) { return withInitialBusiness(business => handlePOST(request, business)); }
export function PATCH(request: Request) { return withInitialBusiness(business => handlePATCH(request, business)); }
