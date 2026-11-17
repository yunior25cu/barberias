import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { tenantRepository } from "@/lib/tenant-repository";

const COOKIE = "alcorte_admin";
const SESSION_VERSION = 2;
type Claims = { sub: string; biz: string; aud: "tenant"; ver: number; v: number; exp: number };

function sign(value: string) {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET must be configured");
  return createHmac("sha256", env.SESSION_SECRET).update(value).digest("base64url");
}

export function sessionFor(admin: { id: string; businessId: string; sessionVersion: number }) {
  const payload = Buffer.from(JSON.stringify({
    sub: admin.id,
    biz: admin.businessId,
    aud: "tenant",
    ver: admin.sessionVersion,
    v: SESSION_VERSION,
    exp: Date.now() + 8 * 60 * 60 * 1000,
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

async function claimsForBusiness(businessId: string): Promise<Claims | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const [payload, signature, ...extra] = value.split(".");
  if (!payload || !signature || extra.length) return null;
  try {
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as Claims;
    if (claims.aud !== "tenant" || claims.v !== SESSION_VERSION || claims.biz !== businessId || claims.exp <= Date.now()
      || !claims.sub || !Number.isInteger(claims.ver)) return null;
    return claims;
  } catch {
    return null;
  }
}

export async function requireAdmin(businessId: string): Promise<{ id: string; businessId: string } | null> {
  const claims = await claimsForBusiness(businessId);
  if (!claims) return null;
  return tenantRepository({ id: businessId, status: "active" }).adminUser.findFirst({
    where: { id: claims.sub, businessId, active: true, sessionVersion: claims.ver, business: { status: "active" } },
    select: { id: true, businessId: true },
  });
}

export async function adminId(businessId: string): Promise<string | null> {
  return (await requireAdmin(businessId))?.id ?? null;
}

export const adminCookieName = COOKIE;
