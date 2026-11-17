import { issueAdminActivation } from "@/lib/api-handlers/platform";
type Context = { params: Promise<{ businessId: string }> };
export async function POST(request: Request, { params }: Context) { return issueAdminActivation(request, (await params).businessId); }
