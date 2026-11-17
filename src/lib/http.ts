import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
function requestId(){return randomUUID();}
export function json(data: unknown, status = 200) { const id=requestId();console.log(JSON.stringify({timestamp:new Date().toISOString(),level:"info",event:"http_response",requestId:id,status}));return NextResponse.json(data, { status, headers: { "X-Request-Id": id, "Cache-Control": "no-store" } }); }
export function error(message: string, status = 400) { const id=requestId();console.log(JSON.stringify({timestamp:new Date().toISOString(),level:status>=500?"error":"warn",event:"http_error",requestId:id,status,message}));return NextResponse.json({error:message},{status,headers:{"X-Request-Id":id,"Cache-Control":"no-store"}}); }
