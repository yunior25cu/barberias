import { describe, expect, it } from "vitest";
import { retryAzureSqlConnection } from "../../src/lib/sql-connection-retry";

describe("reanudación de conexiones a Azure SQL", () => {
  it("reintenta solo el handshake ante 40613 y respeta el backoff acotado", async () => {
    const waits: number[] = [];
    let attempts = 0;

    const connected = await retryAzureSqlConnection(
      async () => {
        attempts += 1;
        if (attempts < 3) throw { originalError: { info: { number: 40613 } } };
        return "connected";
      },
      { delaysMs: [1_000, 2_000], wait: async (ms) => { waits.push(ms); } },
    );

    expect(connected).toBe("connected");
    expect(attempts).toBe(3);
    expect(waits).toEqual([1_000, 2_000]);
  });

  it("no reintenta errores permanentes de autenticación", async () => {
    const failure = Object.assign(new Error("login failed"), { code: "ELOGIN" });
    let attempts = 0;

    await expect(retryAzureSqlConnection(async () => {
      attempts += 1;
      throw failure;
    }, { wait: async () => undefined })).rejects.toBe(failure);

    expect(attempts).toBe(1);
  });

  it("se detiene al agotar los intentos configurados", async () => {
    const failure = Object.assign(new Error("40613 database unavailable"), { code: "40613" });
    const waits: number[] = [];
    let attempts = 0;

    await expect(retryAzureSqlConnection(async () => {
      attempts += 1;
      throw failure;
    }, { delaysMs: [500, 1_000], wait: async (ms) => { waits.push(ms); } })).rejects.toBe(failure);

    expect(attempts).toBe(3);
    expect(waits).toEqual([500, 1_000]);
  });
});