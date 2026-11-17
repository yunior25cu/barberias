import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { withInitialBusiness } from "@/lib/business-route";
import type { BusinessContext } from "@/lib/business";

export async function handleGET(_request: Request, business: BusinessContext) {
  try {
    return json({ authenticated: Boolean(await requireAdmin(business.id)) });
  } catch {
    return error("No pudimos validar la sesión.", 503);
  }
}

export function GET(request: Request) {
  return withInitialBusiness(business => handleGET(request, business));
}
