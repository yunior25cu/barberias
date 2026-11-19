import { describe, expect, it } from "vitest";
import { summarizeBookings } from "@/lib/reports";

describe("informes de reservas", () => {
  it("agrupa estados, demanda local, servicios y carga excluyendo cancelaciones", () => {
    const report = summarizeBookings([
      {
        startsAt: new Date("2026-11-18T12:00:00.000Z"), endsAt: new Date("2026-11-18T12:30:00.000Z"),
        status: "completed", serviceId: "cut", service: { name: "Corte" }, staffId: "staff-a", staff: { name: "Yunior" },
      },
      {
        startsAt: new Date("2026-11-18T12:00:00.000Z"), endsAt: new Date("2026-11-18T13:00:00.000Z"),
        status: "cancelled", serviceId: "cut", service: { name: "Corte" }, staffId: "staff-a", staff: { name: "Yunior" },
      },
      {
        startsAt: new Date("2026-11-19T14:00:00.000Z"), endsAt: new Date("2026-11-19T14:45:00.000Z"),
        status: "no_show", serviceId: "beard", service: { name: "Barba" }, staffId: "staff-b", staff: { name: "Nico" },
      },
    ]);

    expect(report.total).toBe(3);
    expect(report.statuses).toEqual({ confirmed: 0, completed: 1, cancelled: 1, no_show: 1 });
    expect(report.weekdays[3]).toEqual({ day: 3, label: "Miércoles", count: 2 });
    expect(report.busiestHours.slice(0, 2)).toEqual([{ hour: 9, count: 2 }, { hour: 11, count: 1 }]);
    expect(report.services[0]).toEqual({ id: "cut", name: "Corte", count: 2 });
    expect(report.staff).toEqual([
      { id: "staff-b", name: "Nico", count: 1, reservedMinutes: 45 },
      { id: "staff-a", name: "Yunior", count: 1, reservedMinutes: 30 },
    ]);
  });

  it("devuelve agregados vacíos sin inventar actividad", () => {
    expect(summarizeBookings([])).toMatchObject({
      total: 0,
      statuses: { confirmed: 0, completed: 0, cancelled: 0, no_show: 0 },
      services: [],
      staff: [],
      busiestHours: [],
    });
  });
});
