import { requireAdmin } from "@/lib/auth";
import { tenantRepository } from "@/lib/tenant-repository";
import { error, json } from "@/lib/http";
import { localToUtc } from "@/lib/time";
import { summarizeBookings } from "@/lib/reports";
import type { BusinessContext } from "@/lib/business";

const MAX_RANGE_DAYS = 90;

function parseDateKey(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

function nextDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function handleGET(request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión para ver los informes.", 401);

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const startDate = parseDateKey(from);
  const endDate = parseDateKey(to);
  if (!from || !to || !startDate || !endDate || endDate < startDate) {
    return error("Indicá un período válido para los informes.", 400);
  }
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  if (days > MAX_RANGE_DAYS) return error("El período no puede superar los 90 días.", 400);

  try {
    const bookings = await tenantRepository(business).booking.findMany({
      where: {
        startsAt: {
          gte: localToUtc(from, 0),
          lt: localToUtc(nextDateKey(to), 0),
        },
      },
      select: {
        startsAt: true,
        endsAt: true,
        status: true,
        serviceId: true,
        service: { select: { name: true } },
        staffId: true,
        staff: { select: { name: true } },
      },
      orderBy: { startsAt: "asc" },
    });

    return json({ from, to, report: summarizeBookings(bookings) });
  } catch {
    return error("No pudimos generar los informes.", 503);
  }
}
