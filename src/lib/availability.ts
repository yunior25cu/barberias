import { tenantRepository } from "@/lib/tenant-repository";
import type { BusinessContext } from "@/lib/business";
import { localToUtc } from "@/lib/time";
export { localDateKey, localMinute, localWeekday, localToUtc } from "@/lib/time";

export async function slots(business: BusinessContext, serviceId: string, dateKey: string, staffId?: string) {
  const tenant = tenantRepository(business);
  const service = await tenant.service.findFirst({ where: { id: serviceId, active: true } });
  if (!service) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const staff = await tenant.staff.findMany({
    where: {
      active: true, ...(staffId ? { id: staffId } : {}),
      services: { some: { serviceId } },
      hours: { some: { weekday } },
    },
    include: { hours: { where: { weekday } } },
  });
  const settings = await tenant.settings.findUnique({ where: { businessId: business.id } });
  const result: { time: string; startsAt: string; staffId: string }[] = [];
  const earliest = Date.now() + (settings?.minAdvanceMinutes ?? 60) * 60_000;
  const latest = Date.now() + (settings?.maxAdvanceDays ?? 60) * 86_400_000;
  for (const person of staff) {
    for (const hours of person.hours) {
      for (let minute = hours.startMinute; minute + service.durationMinutes <= hours.endMinute; minute += settings?.slotStepMinutes ?? 15) {
        const start = localToUtc(dateKey, minute);
        const end = new Date(start.getTime() + service.durationMinutes * 60_000);
        if (start.getTime() < earliest || start.getTime() > latest) continue;
        const conflict = await tenant.occupancy.findFirst({
          where: { staffId: person.id, active: true, startsAt: { lt: end }, endsAt: { gt: start } },
        });
        if (!conflict) result.push({
          time: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
          startsAt: start.toISOString(),
          staffId: person.id,
        });
      }
    }
  }
  return [...new Map(result.map(item => [item.time, item])).values()].sort((a, b) => a.time.localeCompare(b.time));
}
