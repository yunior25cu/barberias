import { handleGET, handlePOST, handleDELETE } from "@/lib/api-handlers/admin-blocks";
import { withInitialBusiness } from "@/lib/business-route";
export function GET(request: Request) { return withInitialBusiness(business => handleGET(request, business)); }
export function POST(request: Request) { return withInitialBusiness(business => handlePOST(request, business)); }
export function DELETE(request: Request) { return withInitialBusiness(business => handleDELETE(request, business)); }
