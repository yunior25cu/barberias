import { cookies } from "next/headers";
import { adminCookieName } from "@/lib/auth";
import { json } from "@/lib/http";

export async function handlePOST() {
  (await cookies()).delete(adminCookieName);
  return json({ ok: true });
}

export function POST() {
  return handlePOST();
}
