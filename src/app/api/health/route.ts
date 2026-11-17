import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

function diagnosticsAuthorized(request: Request) {
  const expected = env.SESSION_SECRET;
  const supplied = request.headers.get("x-alcorte-health-diagnostics");
  if (!expected || !supplied) return false;

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function errorSummary(error: unknown) {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const cause = value.cause && typeof value.cause === "object" ? value.cause as Record<string, unknown> : {};
  return {
    name: typeof value.name === "string" ? value.name : "UnknownError",
    code: typeof value.code === "string" ? value.code : null,
    causeCode: typeof cause.code === "string" ? cause.code : null,
  };
}

export async function GET(request: Request) {
  try {
    await db.$queryRaw`SELECT 1`;
    return json({ status: "ok", database: "ok", time: new Date().toISOString() });
  } catch (error) {
    const diagnostic = diagnosticsAuthorized(request) ? {
      runtime: {
        authMode: process.env.AZURE_SQL_AUTH_MODE ?? null,
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        hasServer: Boolean(process.env.AZURE_SQL_SERVER),
        hasDatabase: Boolean(process.env.AZURE_SQL_DATABASE),
        hasClientId: Boolean(process.env.AZURE_SQL_CLIENT_ID),
        hasClientSecret: Boolean(process.env.AZURE_SQL_CLIENT_SECRET),
        hasTenantId: Boolean(process.env.AZURE_SQL_TENANT_ID),
        hasSessionSecret: Boolean(process.env.SESSION_SECRET),
        nodeEnv: process.env.NODE_ENV ?? null,
      },
      error: errorSummary(error),
    } : undefined;

    return json({ status: "unavailable", database: "unavailable", ...(diagnostic ? { diagnostic } : {}) }, 503);
  }
}
