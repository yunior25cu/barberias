import { handlePOST } from "@/lib/api-handlers/auth-login";
import { withInitialBusiness } from "@/lib/business-route";
export function POST(request: Request) { return withInitialBusiness(business => handlePOST(request, business)); }
