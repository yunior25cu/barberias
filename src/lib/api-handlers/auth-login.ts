import bcrypt from "bcryptjs";
import { z } from "zod";
import { cookies } from "next/headers";
import { tenantRepository } from "@/lib/tenant-repository";
import { sessionFor, adminCookieName } from "@/lib/auth";
import { env } from "@/lib/env";
import { error, json } from "@/lib/http";
import { limitedForBusiness } from "@/lib/rate-limit";
import { withInitialBusiness } from "@/lib/business-route";
import type { BusinessContext } from "@/lib/business";

const bodySchema = z.object({ username: z.string().trim().min(1).max(100), password: z.string().min(1).max(200) });

export async function handlePOST(request: Request, business: BusinessContext) {
  const limit = await limitedForBusiness(request, business.id, "login", 8, 15 * 60_000, 24);
  if (limit === true) return error("Demasiados intentos. Esperá unos minutos y probá de nuevo.", 429);
  if (limit === null) return error("No pudimos iniciar sesión ahora. Probá de nuevo.", 503);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return error("Ingresá usuario y contraseña.");
  if (!env.SESSION_SECRET) return error("El acceso del administrador no está configurado.", 503);
  try {
    const admin = await tenantRepository(business).adminUser.findFirst({
      where: { businessId: business.id, username: body.data.username, active: true, business: { status: "active" } },
      select: { id: true, businessId: true, passwordHash: true, sessionVersion: true },
    });
    if (!admin || !await bcrypt.compare(body.data.password, admin.passwordHash)) return error("El usuario o la contraseña no coinciden.", 401);
    (await cookies()).set(adminCookieName, sessionFor(admin), {
      httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 60 * 60,
    });
    return json({ ok: true });
  } catch {
    return error("No pudimos iniciar sesión. Revisá la configuración del servidor.", 503);
  }
}

export function POST(request: Request) {
  return withInitialBusiness(business => handlePOST(request, business));
}
