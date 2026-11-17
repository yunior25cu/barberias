import { handleGET, handlePUT } from "@/lib/api-handlers/admin-hours";
import { withInitialBusiness } from "@/lib/business-route";
export function GET(request: Request) { return withInitialBusiness(business => handleGET(request, business)); }
export function PUT(request: Request) { return withInitialBusiness(business => handlePUT(request, business)); }
