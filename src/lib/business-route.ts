import { error } from "@/lib/http";
import { resolveBusiness, type BusinessContext } from "@/lib/business";

export async function withBusiness(slug: string, run: (business: BusinessContext) => Promise<Response>): Promise<Response> {
  try {
    const business = await resolveBusiness(slug);
    if (!business) return error("Ese negocio no está disponible.", 404);
    return await run(business);
  } catch {
    return error("No pudimos cargar el negocio. Probá de nuevo.", 503);
  }
}

export function withInitialBusiness(run: (business: BusinessContext) => Promise<Response>): Promise<Response> {
  return withBusiness("al-corte", run);
}

