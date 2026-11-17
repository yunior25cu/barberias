import { createBusiness, listBusinesses } from "@/lib/api-handlers/platform";
export const dynamic = "force-dynamic";
export const GET = listBusinesses;
export const POST = createBusiness;
