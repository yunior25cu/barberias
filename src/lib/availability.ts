import { tenantRepository } from "@/lib/tenant-repository";
import type { BusinessContext } from "@/lib/business";
import { localToUtc } from "@/lib/time";
import { localDateKey, localMinute } from "@/lib/time";
import { candidateStartMinutes } from "@/lib/slot-policy";
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
  const mode = settings?.calendarMode === "dynamic" ? "dynamic" : "fixed";
  const occupancyEnds = new Map<string, number[]>();
  if (mode === "dynamic" && staff.length) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const nextDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
    const [dayStart, dayEnd] = [localToUtc(dateKey, 0), localToUtc(nextDate, 0)];
    const occupied = await tenant.occupancy.findMany({
      where: { staffId: { in: staff.map(person => person.id) }, active: true, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
      select: { staffId: true, endsAt: true },
    });
    for (const item of occupied) {
      if (localDateKey(item.endsAt) !== dateKey) continue;
      const ends = occupancyEnds.get(item.staffId) ?? [];
      ends.push(localMinute(item.endsAt));
      occupancyEnds.set(item.staffId, ends);
    }
  }
  for (const person of staff) {
    for (const hours of person.hours) {
      const candidates = candidateStartMinutes(
        hours.startMinute,
        hours.endMinute,
        service.durationMinutes,
        settings?.slotStepMinutes ?? 15,
        mode,
        occupancyEnds.get(person.id),
      );
      for (const minute of candidates) {
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
