import { handleGET } from "@/lib/api-handlers/services";
import { withInitialBusiness } from "@/lib/business-route";
export function GET(request: Request) { return withInitialBusiness(business => handleGET(request, business)); }
