import { handleGET, handlePATCH } from "@/lib/api-handlers/admin-settings";
import { withInitialBusiness } from "@/lib/business-route";
export function GET(request: Request) { return withInitialBusiness(business => handleGET(request, business)); }
export function PATCH(request: Request) { return withInitialBusiness(business => handlePATCH(request, business)); }
