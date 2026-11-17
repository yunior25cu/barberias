import { cookies } from "next/headers";
import { adminCookieName } from "@/lib/auth";
import { json } from "@/lib/http";
export async function POST(){(await cookies()).delete(adminCookieName);return json({ok:true});}
