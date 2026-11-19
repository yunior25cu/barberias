import { localMinute, localWeekday } from "@/lib/time";

export type ReportBooking = {
  startsAt: Date;
  endsAt: Date;
  status: string;
  serviceId: string;
  service: { name: string };
  staffId: string;
  staff: { name: string };
};

const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function summarizeBookings(bookings: ReportBooking[]) {
  const statuses = { confirmed: 0, completed: 0, cancelled: 0, no_show: 0 };
  const weekdayCounts = weekdays.map((label, day) => ({ day, label, count: 0 }));
  const hourCounts = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  const services = new Map<string, { id: string; name: string; count: number }>();
  const staff = new Map<string, { id: string; name: string; count: number; reservedMinutes: number }>();

  for (const booking of bookings) {
    if (Object.prototype.hasOwnProperty.call(statuses, booking.status)) {
      statuses[booking.status as keyof typeof statuses] += 1;
    }
    weekdayCounts[localWeekday(booking.startsAt)].count += 1;
    hourCounts[Math.floor(localMinute(booking.startsAt) / 60)].count += 1;

    const service = services.get(booking.serviceId) ?? { id: booking.serviceId, name: booking.service.name, count: 0 };
    service.count += 1;
    services.set(booking.serviceId, service);

    if (booking.status !== "cancelled") {
      const person = staff.get(booking.staffId) ?? { id: booking.staffId, name: booking.staff.name, count: 0, reservedMinutes: 0 };
      person.count += 1;
      person.reservedMinutes += Math.max(0, Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000));
      staff.set(booking.staffId, person);
    }
  }

  return {
    total: bookings.length,
    statuses,
    weekdays: weekdayCounts,
    busiestHours: hourCounts.filter(item => item.count > 0).sort((a, b) => b.count - a.count || a.hour - b.hour).slice(0, 5),
    services: [...services.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es-UY")).slice(0, 5),
    staff: [...staff.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es-UY")),
  };
}
