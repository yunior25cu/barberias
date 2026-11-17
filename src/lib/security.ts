import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
export const token = () => randomBytes(32).toString("base64url");
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export function safeEqual(a: string, b: string) { const aa=Buffer.from(a), bb=Buffer.from(b); return aa.length===bb.length && timingSafeEqual(aa,bb); }
export function phone(value: string) { const input=value.trim();let digits=input.replace(/\D/g, "");if(digits.startsWith("00"))digits=digits.slice(2);else if(!input.startsWith("+")&&!digits.startsWith("598")){if(digits.startsWith("0"))digits=digits.slice(1);digits=`598${digits}`;}return digits.length>=8&&digits.length<=15?`+${digits}`:null; }
