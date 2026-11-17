import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { tenantRepository } from "@/lib/tenant-repository";
import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { hasSameOrigin } from "@/lib/origin";
import { withInitialBusiness } from "@/lib/business-route";
import type { BusinessContext } from "@/lib/business";

const input = z.object({
  name: z.string().trim().min(2).max(80), description: z.string().max(240).nullable().optional(),
  durationMinutes: z.number().int().min(5).max(480), priceCents: z.number().int().min(0).nullable().optional(), active: z.boolean().optional(),
});
const projection = { id: true, name: true, description: true, durationMinutes: true, priceCents: true, active: true, sortOrder: true } as const;

export async function handleGET(_request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  const services = await tenantRepository(business).service.findMany({ orderBy: { sortOrder: "asc" }, select: projection });
  return json({ services });
}
export async function handlePOST(request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const body = input.safeParse(await request.json().catch(() => null));
  if (!body.success) return error("Revisá los datos del servicio.");
  try {
    const tenant = tenantRepository(business);
    const service = await tenant.$transaction(async tx => {
      await tx.lockOccupancy();
      await tx.assertBusinessActive();
      return tx.service.create({ data: body.data as Prisma.ServiceUncheckedCreateInput, select: projection });
    });
    return json(service, 201);
  } catch {
    return error("No pudimos guardar el servicio.", 503);
  }
}
export async function handlePATCH(request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const body = z.object({ id: z.string(), ...input.partial().shape }).safeParse(await request.json().catch(() => null));
  if (!body.success) return error("Revisá los datos del servicio.");
  const { id, ...data } = body.data;
  try {
    const tenant = tenantRepository(business);
    const service = await tenant.$transaction(async tx => {
      await tx.lockOccupancy();
      await tx.assertBusinessActive();
      return tx.service.update({ where: { id }, data, select: projection });
    });
    return json(service);
  } catch {
    return error("No pudimos actualizar el servicio.", 404);
  }
}
export function GET(request: Request) { return withInitialBusiness(business => handleGET(request, business)); }
export function POST(request: Request) { return withInitialBusiness(business => handlePOST(request, business)); }
export function PATCH(request: Request) { return withInitialBusiness(business => handlePATCH(request, business)); }
