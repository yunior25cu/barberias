import { businessDetail } from "@/lib/api-handlers/platform";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ businessId: string }> };
export async function GET(request: Request, { params }: Context) { return businessDetail(request, (await params).businessId, "GET"); }
export async function PATCH(request: Request, { params }: Context) { return businessDetail(request, (await params).businessId, "PATCH"); }
