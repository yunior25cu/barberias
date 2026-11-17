import { z } from "zod";
import { tenantRepository } from "@/lib/tenant-repository";
import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { hasSameOrigin } from "@/lib/origin";
import { withInitialBusiness } from "@/lib/business-route";
import type { BusinessContext } from "@/lib/business";

const entry = z.object({ weekday: z.number().int().min(0).max(6), startMinute: z.number().int().min(0).max(1439), endMinute: z.number().int().min(1).max(1440) }).refine(value => value.endMinute > value.startMinute);
const staffProjection = {
  id: true, name: true, active: true,
  hours: { select: { id: true, weekday: true, startMinute: true, endMinute: true } },
  services: { select: { service: { select: { id: true, name: true, durationMinutes: true, active: true } } } },
} as const;

export async function handleGET(_request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  const staff = await tenantRepository(business).staff.findMany({ orderBy: { name: "asc" }, select: staffProjection });
  return json({ staff });
}
export async function handlePUT(request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const body = z.object({ staffId: z.string(), hours: z.array(entry).max(14) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return error("Revisá los horarios.");
  const sorted = [...body.data.hours].sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].weekday === sorted[i - 1].weekday && sorted[i].startMinute < sorted[i - 1].endMinute) return error("Los horarios se superponen.");
  }
  try {
    const tenant = tenantRepository(business);
    await tenant.$transaction(async tx => {
      await tx.lockOccupancy();
      await tx.assertBusinessActive();
      const staff = await tx.staff.findFirst({ where: { id: body.data.staffId, businessId: business.id }, select: { id: true } });
      if (!staff) throw new Error("NOT_FOUND");
      await tx.businessHours.deleteMany({ where: { businessId: business.id, staffId: staff.id } });
      if (sorted.length) await tx.businessHours.createMany({ data: sorted.map(hour => ({ ...hour, businessId: business.id, staffId: staff.id })) });
    });
    return json({ ok: true });
  } catch (cause) {
    return cause instanceof Error && cause.message === "NOT_FOUND"
      ? error("No encontramos ese profesional.", 404)
      : error("No pudimos guardar el horario.", 503);
  }
}
export function GET(request: Request) { return withInitialBusiness(business => handleGET(request, business)); }
export function PUT(request: Request) { return withInitialBusiness(business => handlePUT(request, business)); }
