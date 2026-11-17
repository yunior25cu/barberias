import "server-only";
import { db } from "@/lib/db";

export type BusinessContext = {
  id: string;
  slug: string;
  status: "active";
  settings: {
    businessName: string; publicPhone: string | null; timezone: string; currency: string;
    minAdvanceMinutes: number; maxAdvanceDays: number; slotStepMinutes: number; cancellationPolicy: string;
  } | null;
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function resolveBusiness(slug: string): Promise<BusinessContext | null> {
  if (!slugPattern.test(slug)) return null;
  return db.business.findFirst({
    where: { slug, status: "active" },
    select: {
      id: true, slug: true, status: true,
      settings: { select: {
        businessName: true, publicPhone: true, timezone: true, currency: true,
        minAdvanceMinutes: true, maxAdvanceDays: true, slotStepMinutes: true, cancellationPolicy: true,
      } },
    },
  }) as Promise<BusinessContext | null>;
}

export async function resolveInitialBusiness(): Promise<BusinessContext | null> {
  return resolveBusiness("al-corte");
}

export function requireBusinessId(business: Pick<BusinessContext, "id" | "status">): string {
  if (!business?.id || business.status !== "active") throw new Error("ACTIVE_BUSINESS_CONTEXT_REQUIRED");
  return business.id;
}

