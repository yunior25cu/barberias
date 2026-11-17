import { error } from "@/lib/http";
import { withBusiness } from "@/lib/business-route";
import type { BusinessContext } from "@/lib/business";
import { handleGET as servicesGET } from "@/lib/api-handlers/services";
import { handleGET as availabilityGET } from "@/lib/api-handlers/availability";
import { handlePOST as bookingsPOST } from "@/lib/api-handlers/bookings";
import { handlePOST as managePOST } from "@/lib/api-handlers/manage";
import { handlePOST as loginPOST } from "@/lib/api-handlers/auth-login";
import { handleGET as sessionGET } from "@/lib/api-handlers/auth-session";
import { handlePOST as logoutPOST } from "@/lib/api-handlers/auth-logout";
import { handleGET as adminBookingsGET, handlePOST as adminBookingsPOST, handlePATCH as adminBookingsPATCH } from "@/lib/api-handlers/admin-bookings";
import { handleGET as adminServicesGET, handlePOST as adminServicesPOST, handlePATCH as adminServicesPATCH } from "@/lib/api-handlers/admin-services";
import { handleGET as adminStaffGET, handlePOST as adminStaffPOST, handlePATCH as adminStaffPATCH } from "@/lib/api-handlers/admin-staff";
import { handleGET as adminHoursGET, handlePUT as adminHoursPUT } from "@/lib/api-handlers/admin-hours";
import { handleGET as adminBlocksGET, handlePOST as adminBlocksPOST, handleDELETE as adminBlocksDELETE } from "@/lib/api-handlers/admin-blocks";
import { handleGET as adminSettingsGET, handlePATCH as adminSettingsPATCH } from "@/lib/api-handlers/admin-settings";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Handler = (request: Request, business: BusinessContext) => Promise<Response>;
const routes: Record<string, Partial<Record<Method, Handler>>> = {
  services: { GET: servicesGET },
  availability: { GET: availabilityGET },
  bookings: { POST: bookingsPOST },
  manage: { POST: managePOST },
  "auth/login": { POST: loginPOST },
  "auth/session": { GET: sessionGET },
  "auth/logout": { POST: logoutPOST },
  "admin/bookings": { GET: adminBookingsGET, POST: adminBookingsPOST, PATCH: adminBookingsPATCH },
  "admin/services": { GET: adminServicesGET, POST: adminServicesPOST, PATCH: adminServicesPATCH },
  "admin/staff": { GET: adminStaffGET, POST: adminStaffPOST, PATCH: adminStaffPATCH },
  "admin/hours": { GET: adminHoursGET, PUT: adminHoursPUT },
  "admin/blocks": { GET: adminBlocksGET, POST: adminBlocksPOST, DELETE: adminBlocksDELETE },
  "admin/settings": { GET: adminSettingsGET, PATCH: adminSettingsPATCH },
};

async function dispatch(method: Method, request: Request, context: { params: Promise<{ slug: string; segments?: string[] }> }) {
  const { slug, segments } = await context.params;
  const handler = routes[(segments ?? []).join("/") ]?.[method];
  if (!handler) return error("La operación no está disponible.", 404);
  return withBusiness(slug, business => handler(request, business));
}
export function GET(request: Request, context: { params: Promise<{ slug: string; segments?: string[] }> }) { return dispatch("GET", request, context); }
export function POST(request: Request, context: { params: Promise<{ slug: string; segments?: string[] }> }) { return dispatch("POST", request, context); }
export function PUT(request: Request, context: { params: Promise<{ slug: string; segments?: string[] }> }) { return dispatch("PUT", request, context); }
export function PATCH(request: Request, context: { params: Promise<{ slug: string; segments?: string[] }> }) { return dispatch("PATCH", request, context); }
export function DELETE(request: Request, context: { params: Promise<{ slug: string; segments?: string[] }> }) { return dispatch("DELETE", request, context); }
