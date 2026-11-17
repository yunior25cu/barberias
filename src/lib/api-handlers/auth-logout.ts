import { cookies } from "next/headers";
import { adminCookieName } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { hasSameOrigin } from "@/lib/origin";

export async function handlePOST(request: Request) {
  if (!hasSameOrigin(request)) return error("Solicitud invalida.", 403);
  (await cookies()).delete(adminCookieName);
  return json({ ok: true });
}
