import { describe, expect, it } from "vitest";
import { localDateKey, localMinute, localToUtc, localWeekday, overlaps } from "../../src/lib/time";
import { phone } from "../../src/lib/security";

describe("hora local del negocio", () => {
  it("convierte la hora de Montevideo a un instante UTC inequívoco", () => {
    expect(localToUtc("2026-11-16", 9 * 60).toISOString()).toBe("2026-11-16T12:00:00.000Z");
  });
  it("deriva fecha, día y minuto usando America/Montevideo", () => {
    const instant = new Date("2026-11-16T12:45:00.000Z");
    expect(localDateKey(instant)).toBe("2026-11-16");
    expect(localWeekday(instant)).toBe(1);
    expect(localMinute(instant)).toBe(9 * 60 + 45);
  });
  it("respeta el cambio de mes al generar la fecha local", () => {
    expect(localDateKey(new Date("2026-12-01T02:00:00.000Z"))).toBe("2026-11-30");
  });
  it("trata los intervalos como semiabiertos: turnos contiguos no chocan",()=>{
    const a=new Date("2026-11-16T12:00:00Z"),b=new Date("2026-11-16T12:30:00Z"),c=new Date("2026-11-16T13:00:00Z");
    expect(overlaps(a,b,b,c)).toBe(false);expect(overlaps(a,c,b,c)).toBe(true);
  });
  it("normaliza números uruguayos locales y conserva prefijos internacionales",()=>{
    expect(phone("099 123 456")).toBe("+59899123456");expect(phone("+1 (415) 555-2671")).toBe("+14155552671");expect(phone("00 1 415 555 2671")).toBe("+14155552671");expect(phone("12")).toBeNull();
  });
});
