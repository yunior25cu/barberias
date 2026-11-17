import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
const COOKIE="alcorte_admin";
function sign(value:string){if(!env.SESSION_SECRET)throw new Error("SESSION_SECRET must be configured");return createHmac("sha256",env.SESSION_SECRET).update(value).digest("base64url");}
export function sessionFor(adminId:string){const payload=Buffer.from(JSON.stringify({sub:adminId,exp:Date.now()+8*60*60*1000})).toString("base64url");return `${payload}.${sign(payload)}`;}
export async function adminId(){const value=(await cookies()).get(COOKIE)?.value;if(!value)return null;const [payload,signature]=value.split(".");if(!payload||!signature)return null;const expected=Buffer.from(sign(payload)),actual=Buffer.from(signature);if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;try{const data=JSON.parse(Buffer.from(payload,"base64url").toString()) as {sub:string;exp:number};return data.exp>Date.now()?data.sub:null;}catch{return null;}}
export async function requireAdmin(){return (await adminId())!==null;}
export const adminCookieName=COOKIE;
