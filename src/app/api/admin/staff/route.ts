import { handleGET, handlePOST, handlePATCH } from "@/lib/api-handlers/admin-staff";
import { withInitialBusiness } from "@/lib/business-route";
export function GET(request: Request) { return withInitialBusiness(business => handleGET(request, business)); }
export function POST(request: Request) { return withInitialBusiness(business => handlePOST(request, business)); }
export function PATCH(request: Request) { return withInitialBusiness(business => handlePATCH(request, business)); }
