import { z } from "zod";
import { tenantRepository } from "@/lib/tenant-repository";
import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { hasSameOrigin } from "@/lib/origin";
import { withInitialBusiness } from "@/lib/business-route";
import type { BusinessContext } from "@/lib/business";

const schema = z.object({
  businessName: z.string().trim().min(2).max(100).optional(), publicPhone: z.string().max(32).nullable().optional(),
  businessAddress: z.string().trim().max(300).nullable().optional(),
  timezone: z.literal("America/Montevideo").optional(), currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  minAdvanceMinutes: z.number().int().min(0).max(10080).optional(), maxAdvanceDays: z.number().int().min(1).max(365).optional(),
  slotStepMinutes: z.number().int().min(5).max(60).optional(), cancellationPolicy: z.string().max(500).optional(),
});
const projection = {
  businessName: true, publicPhone: true, businessAddress: true, timezone: true, currency: true, minAdvanceMinutes: true,
  maxAdvanceDays: true, slotStepMinutes: true, cancellationPolicy: true,
} as const;

export async function handleGET(_request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  const settings = await tenantRepository(business).settings.findUnique({ where: { businessId: business.id }, select: projection });
  if (!settings) return error("La configuración del negocio no está disponible.", 503);
  return json({ settings });
}
export async function handlePATCH(request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return error("Revisá los ajustes del local.");
  if (!body.data.businessName && !business.settings?.businessName) return error("El nombre del negocio es obligatorio.", 422);
  try {
    const tenant = tenantRepository(business);
    const settings = await tenant.$transaction(async tx => {
      await tx.lockOccupancy();
      await tx.assertBusinessActive();
      return tx.settings.upsert({
        where: { businessId: business.id },
        create: { businessId: business.id, ...body.data, businessName: body.data.businessName ?? business.settings!.businessName },
        update: body.data,
        select: projection,
      });
    });
    return json(settings);
  } catch {
    return error("No pudimos guardar los ajustes.", 503);
  }
}
export function GET(request: Request) { return withInitialBusiness(business => handleGET(request, business)); }
export function PATCH(request: Request) { return withInitialBusiness(business => handlePATCH(request, business)); }
