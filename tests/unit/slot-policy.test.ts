import { describe, expect, it } from "vitest";
import { candidateStartMinutes, isOnFixedGrid } from "../../src/lib/slot-policy";

describe("política de inicios de agenda", () => {
  it("mantiene la grilla fija sin añadir finales de ocupación", () => {
    expect(candidateStartMinutes(480, 1200, 45, 30, "fixed", [705])).toContain(690);
    expect(candidateStartMinutes(480, 1200, 45, 30, "fixed", [705])).not.toContain(705);
  });

  it("añade el final de una ocupación activa como inicio dinámico", () => {
    const starts = candidateStartMinutes(480, 1200, 45, 30, "dynamic", [660, 705]);
    expect(starts).toContain(660);
    expect(starts).toContain(705);
    expect(starts).not.toContain(735);
  });

  it("solo ofrece un final dinámico si entra completo en la jornada", () => {
    expect(candidateStartMinutes(480, 720, 45, 30, "dynamic", [675, 700])).toEqual([480, 510, 540, 570, 600, 630, 660, 675]);
  });

  it("alinea la grilla con la apertura del profesional", () => {
    expect(isOnFixedGrid(550, 550, 30)).toBe(true);
    expect(isOnFixedGrid(580, 550, 30)).toBe(true);
    expect(isOnFixedGrid(570, 550, 30)).toBe(false);
  });
});
