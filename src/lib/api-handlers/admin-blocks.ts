import { randomUUID } from "node:crypto";
import { z } from "zod";
import { tenantRepository } from "@/lib/tenant-repository";
import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { hasSameOrigin } from "@/lib/origin";
import { withInitialBusiness } from "@/lib/business-route";
import type { BusinessContext } from "@/lib/business";

const input = z.object({
  staffId: z.string(), startsAt: z.string().datetime(), endsAt: z.string().datetime(), reason: z.string().max(120).optional(),
}).refine(value => new Date(value.endsAt) > new Date(value.startsAt));
const blockProjection = { id: true, staffId: true, startsAt: true, endsAt: true, reason: true, active: true } as const;

export async function handleGET(_request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  const blocks = await tenantRepository(business).timeBlock.findMany({
    where: { businessId: business.id, active: true }, orderBy: { startsAt: "asc" }, select: blockProjection,
  });
  return json({ blocks });
}
export async function handlePOST(request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const body = input.safeParse(await request.json().catch(() => null));
  if (!body.success) return error("Revisá el horario a bloquear.");
  try {
    const tenant = tenantRepository(business);
    const result = await tenant.$transaction(async tx => {
      await tx.lockOccupancy();
      const staff = await tx.staff.findFirst({ where: { businessId: business.id, id: body.data.staffId, active: true }, select: { id: true } });
      if (!staff) throw new Error("STAFF_UNAVAILABLE");
      const startsAt = new Date(body.data.startsAt), endsAt = new Date(body.data.endsAt);
      const conflict = await tx.occupancy.findFirst({
        where: { businessId: business.id, staffId: staff.id, active: true, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
        select: { id: true },
      });
      if (conflict) throw new Error("SLOT_TAKEN");
      const id = randomUUID();
      const block = await tx.timeBlock.create({
        data: { id, businessId: business.id, staffId: staff.id, startsAt, endsAt, reason: body.data.reason },
        select: blockProjection,
      });
      await tx.occupancy.create({ data: { businessId: business.id, staffId: staff.id, blockId: id, startsAt, endsAt } });
      return block;
    }, { isolationLevel: "ReadCommitted" });
    return json(result, 201);
  } catch (cause) {
    if (cause instanceof Error && cause.message === "STAFF_UNAVAILABLE") return error("No encontramos ese profesional.", 404);
    return error("El horario se superpone con otro turno o bloqueo.", 409);
  }
}
export async function handleDELETE(request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return error("Falta el bloqueo.");
  try {
    const tenant = tenantRepository(business);
    await tenant.$transaction(async tx => {
      await tx.lockOccupancy();
      const block = await tx.timeBlock.findFirst({ where: { businessId: business.id, id }, select: { id: true } });
      if (!block) throw new Error("NOT_FOUND");
      await tx.occupancy.updateMany({ where: { businessId: business.id, blockId: id }, data: { active: false } });
      await tx.timeBlock.update({ where: { id, businessId: business.id }, data: { active: false } });
    }, { isolationLevel: "ReadCommitted" });
    return json({ ok: true });
  } catch (cause) {
    return cause instanceof Error && cause.message === "NOT_FOUND"
      ? error("No encontramos ese bloqueo.", 404)
      : error("No pudimos quitar ese bloqueo.", 409);
  }
}
export function GET(request: Request) { return withInitialBusiness(business => handleGET(request, business)); }
export function POST(request: Request) { return withInitialBusiness(business => handlePOST(request, business)); }
export function DELETE(request: Request) { return withInitialBusiness(business => handleDELETE(request, business)); }
