const TRANSIENT_AZURE_SQL_CODES = new Set([
  "40613",
  "40197",
  "40501",
  "10928",
  "10929",
  "ESOCKET",
  "ECONNCLOSED",
  "ETIMEOUT",
  "ETIMEDOUT",
]);

type RetryOptions = {
  delaysMs?: readonly number[];
  wait?: (milliseconds: number) => Promise<void>;
};

function isTransientConnectionFailure(error: unknown): boolean {
  const pending: unknown[] = [error];
  const visited = new Set<object>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== "object" || current === null || visited.has(current)) continue;
    visited.add(current);
    const value = current as Record<string, unknown>;

    for (const key of ["code", "number", "errno"]) {
      const candidate = value[key];
      if (candidate !== undefined && TRANSIENT_AZURE_SQL_CODES.has(String(candidate).toUpperCase())) {
        return true;
      }
    }

    const message = typeof value.message === "string" ? value.message : "";
    if (/\b(?:40613|40197|40501|10928|10929)\b/i.test(message) ||
        /database.{0,80}(?:unavailable|not currently available)/i.test(message) ||
        /operation timed out for an unknown reason/i.test(message)) {
      return true;
    }

    for (const key of ["cause", "originalError", "info", "precedingErrors", "innerError"]) {
      const nested = value[key];
      if (Array.isArray(nested)) pending.push(...nested);
      else if (nested !== undefined) pending.push(nested);
    }
  }

  return false;
}

const defaultWait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function retryAzureSqlConnection<T>(
  connect: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const delays = options.delaysMs ?? [1_000, 2_000, 4_000, 8_000, 8_000, 8_000, 8_000, 8_000];
  const wait = options.wait ?? defaultWait;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await connect();
    } catch (error) {
      const delay = delays[attempt];
      if (delay === undefined || !isTransientConnectionFailure(error)) throw error;
      await wait(delay);
    }
  }
}