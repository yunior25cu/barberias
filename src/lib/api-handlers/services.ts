import { tenantRepository } from "@/lib/tenant-repository";
import { error, json } from "@/lib/http";
import { withInitialBusiness } from "@/lib/business-route";
import type { BusinessContext } from "@/lib/business";
import { createServiceImageReadUrl } from "@/lib/service-image-storage";

export async function handleGET(_request: Request, business: BusinessContext) {
  const tenant = tenantRepository(business);
  const rows = await tenant.service.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, name: true, description: true, durationMinutes: true, priceCents: true, imageBlobName: true,
      staff: { where: { staff: { active: true } }, select: { staff: { select: { id: true, name: true } } } },
    },
  });
  const services = await Promise.all(rows.map(async ({ staff, imageBlobName, ...service }) => ({
    ...service,
    imageUrl: imageBlobName ? await createServiceImageReadUrl(imageBlobName) : null,
    staff: staff.map(item => item.staff),
  })));
  return json({
    services,
    currency: business.settings?.currency ?? "UYU",
    cancellationPolicy: business.settings?.cancellationPolicy ?? "Consultá al local para cambiar o cancelar.",
    businessAddress: business.settings?.businessAddress ?? null,
  });
}

export function GET(request: Request) {
  return withInitialBusiness(business => handleGET(request, business)).catch(() => error("No pudimos cargar los servicios. Probá de nuevo.", 503));
}
