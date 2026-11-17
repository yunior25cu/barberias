import { tenantRepository } from "@/lib/tenant-repository";
import { error, json } from "@/lib/http";
import { withInitialBusiness } from "@/lib/business-route";
import type { BusinessContext } from "@/lib/business";

export async function handleGET(_request: Request, business: BusinessContext) {
  const tenant = tenantRepository(business);
  const rows = await tenant.service.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, name: true, description: true, durationMinutes: true, priceCents: true,
      staff: { where: { staff: { active: true } }, select: { staff: { select: { id: true, name: true } } } },
    },
  });
  const services = rows.map(({ staff, ...service }) => ({ ...service, staff: staff.map(item => item.staff) }));
  return json({
    services,
    currency: business.settings?.currency ?? "UYU",
    cancellationPolicy: business.settings?.cancellationPolicy ?? "Consultá al local para cambiar o cancelar.",
  });
}

export function GET(request: Request) {
  return withInitialBusiness(business => handleGET(request, business)).catch(() => error("No pudimos cargar los servicios. Probá de nuevo.", 503));
}
