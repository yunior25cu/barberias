export type CalendarMode = "fixed" | "dynamic";

/** Regular grid starts plus, in dynamic mode, ends of current occupancies. */
export function candidateStartMinutes(
  openingMinute: number,
  closingMinute: number,
  durationMinutes: number,
  stepMinutes: number,
  mode: CalendarMode,
  occupancyEnds: readonly number[] = [],
) {
  const candidates = new Set<number>();
  for (let minute = openingMinute; minute + durationMinutes <= closingMinute; minute += stepMinutes) {
    candidates.add(minute);
  }
  if (mode === "dynamic") {
    for (const minute of occupancyEnds) {
      if (minute >= openingMinute && minute + durationMinutes <= closingMinute) candidates.add(minute);
    }
  }
  return [...candidates].sort((a, b) => a - b);
}

/** Grid alignment is relative to the start of each work-hours interval. */
export function isOnFixedGrid(minute: number, openingMinute: number, stepMinutes: number) {
  return minute >= openingMinute && (minute - openingMinute) % stepMinutes === 0;
}
