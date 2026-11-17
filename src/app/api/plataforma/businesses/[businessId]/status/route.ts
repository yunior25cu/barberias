import { changeBusinessStatus } from "@/lib/api-handlers/platform";
type Context = { params: Promise<{ businessId: string }> };
export async function PATCH(request: Request, { params }: Context) { return changeBusinessStatus(request, (await params).businessId); }
