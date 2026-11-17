import { z } from "zod";
import { slots } from "@/lib/availability";
import { error, json } from "@/lib/http";
import { limitedForBusiness } from "@/lib/rate-limit";
import { withInitialBusiness } from "@/lib/business-route";
import type { BusinessContext } from "@/lib/business";

const query = z.object({
  serviceId: z.string().min(1), staffId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const timestamp = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
  }),
});

export async function handleGET(request: Request, business: BusinessContext) {
  const limit = await limitedForBusiness(request, business.id, "availability", 90, 60_000, 360);
  if (limit === true) return error("Hiciste muchas consultas. Esperá un minuto y probá de nuevo.", 429);
  if (limit === null) return error("No pudimos consultar los horarios. Probá de nuevo.", 503);
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return error("Revisá el servicio y el día elegidos.");
  try {
    const result = await slots(business, parsed.data.serviceId, parsed.data.date, parsed.data.staffId);
    return result === null ? error("Ese servicio ya no está disponible.", 404) : json({ slots: result.map(({ time, startsAt }) => ({ time, startsAt })) });
  } catch {
    return error("No pudimos consultar los horarios. Probá de nuevo.", 503);
  }
}

export function GET(request: Request) {
  return withInitialBusiness(business => handleGET(request, business));
}

