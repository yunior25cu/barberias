import { requireAdmin } from "@/lib/auth";
import { json } from "@/lib/http";
export async function GET(){return json({authenticated:await requireAdmin()});}
