import { randomUUID } from "node:crypto";
import { z } from "zod";
import { tenantRepository } from "@/lib/tenant-repository";
import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { hasSameOrigin } from "@/lib/origin";
import { withInitialBusiness } from "@/lib/business-route";
import type { BusinessContext } from "@/lib/business";

const schema = z.object({ name: z.string().trim().min(2).max(80), serviceIds: z.array(z.string().min(1)).min(1).max(30) });
const staffProjection = {
  id: true, name: true, active: true,
  services: { select: { service: { select: { id: true, name: true, durationMinutes: true, active: true } } } },
  hours: { select: { id: true, weekday: true, startMinute: true, endMinute: true } },
} as const;

export async function handleGET(_request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  const staff = await tenantRepository(business).staff.findMany({ orderBy: { name: "asc" }, select: staffProjection });
  return json({ staff });
}
export async function handlePOST(request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return error("Ingresá un nombre y al menos un servicio.");
  const serviceIds = [...new Set(body.data.serviceIds)];
  try {
    const tenant = tenantRepository(business);
    const staff = await tenant.$transaction(async tx => {
      await tx.lockOccupancy();
      await tx.assertBusinessActive();
      const services = await tx.service.findMany({ where: { businessId: business.id, id: { in: serviceIds } }, select: { id: true } });
      if (services.length !== serviceIds.length) throw new Error("FOREIGN_SERVICE");
      const row = await tx.staff.create({ data: { id: randomUUID(), businessId: business.id, name: body.data.name } });
      await tx.staffService.createMany({ data: serviceIds.map(serviceId => ({ businessId: business.id, staffId: row.id, serviceId })) });
      return tx.staff.findFirstOrThrow({ where: { id: row.id, businessId: business.id }, select: staffProjection });
    });
    return json(staff, 201);
  } catch (cause) {
    return cause instanceof Error && cause.message === "FOREIGN_SERVICE"
      ? error("Revisá los servicios seleccionados.", 422)
      : error("No pudimos crear el profesional. Verificá los servicios.", 409);
  }
}
export async function handlePATCH(request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const body = z.object({ id: z.string(), name: z.string().trim().min(2).max(80).optional(), active: z.boolean().optional(), serviceIds: z.array(z.string().min(1)).max(30).optional() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return error("Revisá los datos del profesional.");
  const { id, serviceIds: rawServiceIds, ...data } = body.data;
  const serviceIds = rawServiceIds === undefined ? undefined : [...new Set(rawServiceIds)];
  try {
    const tenant = tenantRepository(business);
    await tenant.$transaction(async tx => {
      await tx.lockOccupancy();
      await tx.assertBusinessActive();
      const existing = await tx.staff.findFirst({ where: { id, businessId: business.id }, select: { id: true } });
      if (!existing) throw new Error("NOT_FOUND");
      if (serviceIds) {
        const services = await tx.service.findMany({ where: { businessId: business.id, id: { in: serviceIds } }, select: { id: true } });
        if (services.length !== serviceIds.length) throw new Error("FOREIGN_SERVICE");
      }
      await tx.staff.update({ where: { id, businessId: business.id }, data });
      if (serviceIds) {
        await tx.staffService.deleteMany({ where: { businessId: business.id, staffId: id } });
        if (serviceIds.length) await tx.staffService.createMany({ data: serviceIds.map(serviceId => ({ businessId: business.id, staffId: id, serviceId })) });
      }
    });
    return json({ ok: true });
  } catch (cause) {
    if (cause instanceof Error && cause.message === "NOT_FOUND") return error("No encontramos ese profesional.", 404);
    if (cause instanceof Error && cause.message === "FOREIGN_SERVICE") return error("Revisá los servicios seleccionados.", 422);
    return error("No pudimos actualizar el profesional.", 409);
  }
}
export function GET(request: Request) { return withInitialBusiness(business => handleGET(request, business)); }
export function POST(request: Request) { return withInitialBusiness(business => handlePOST(request, business)); }
export function PATCH(request: Request) { return withInitialBusiness(business => handlePATCH(request, business)); }
