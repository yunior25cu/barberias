import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const platformCookieName = "alcorte_platform";
const sessionVersion = 1;
type PlatformClaims = { sub: string; aud: "platform"; ver: number; v: number; exp: number };

function signature(payload: string) {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET must be configured");
  return createHmac("sha256", env.SESSION_SECRET).update(payload).digest("base64url");
}

export function platformSessionFor(admin: { id: string; sessionVersion: number }) {
  const payload = Buffer.from(JSON.stringify({
    sub: admin.id, aud: "platform", ver: admin.sessionVersion, v: sessionVersion,
    exp: Date.now() + 8 * 60 * 60 * 1000,
  })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

async function platformClaims(): Promise<PlatformClaims | null> {
  const value = (await cookies()).get(platformCookieName)?.value;
  if (!value) return null;
  const [payload, supplied, ...extra] = value.split(".");
  if (!payload || !supplied || extra.length) return null;
  try {
    const expected = Buffer.from(signature(payload));
    const actual = Buffer.from(supplied);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as PlatformClaims;
    if (claims.aud !== "platform" || claims.v !== sessionVersion || !claims.sub
      || !Number.isInteger(claims.ver) || claims.exp <= Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

export async function requirePlatformAdmin() {
  const claims = await platformClaims();
  if (!claims) return null;
  return db.platformAdmin.findFirst({
    where: { id: claims.sub, active: true, sessionVersion: claims.ver },
    select: { id: true, username: true },
  });
}

export async function setPlatformCookie(admin: { id: string; sessionVersion: number }) {
  (await cookies()).set(platformCookieName, platformSessionFor(admin), {
    httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 60 * 60,
  });
}

export async function clearPlatformCookie() {
  (await cookies()).set(platformCookieName, "", {
    httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0,
  });
}
