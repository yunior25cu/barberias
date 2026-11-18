import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { withInitialBusiness } from "@/lib/business-route";
import type { BusinessContext } from "@/lib/business";
import { error, json } from "@/lib/http";
import { hasSameOrigin } from "@/lib/origin";
import { tenantRepository } from "@/lib/tenant-repository";
import { createServiceImageUploadUrl, deleteServiceImage, verifyAndFinalizeServiceImage } from "@/lib/service-image-storage";

const serviceIdSchema = z.string().min(1).max(40);
function parseJson(request: Request) { return request.json().catch(() => null); }
function expectedBlobName(businessId: string, serviceId: string) {
  return new RegExp(`^${businessId}/services/${serviceId}/[0-9a-f-]{36}\\.webp$`, "i");
}

export async function handlePOST(request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const body = z.object({ serviceId: serviceIdSchema }).safeParse(await parseJson(request));
  if (!body.success) return error("Elegí un servicio válido.");
  const tenant = tenantRepository(business);
  const service = await tenant.service.findFirst({ where: { id: body.data.serviceId }, select: { id: true } });
  if (!service) return error("No encontramos ese servicio.", 404);
  const blobName = `${business.id}/services/${service.id}/${randomUUID()}.webp`;
  try {
    return json({ blobName, ...await createServiceImageUploadUrl(blobName) });
  } catch {
    return error("El almacenamiento de imágenes todavía no está configurado.", 503);
  }
}

export async function handlePATCH(request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const body = z.object({ serviceId: serviceIdSchema, blobName: z.string().min(1).max(300) }).safeParse(await parseJson(request));
  if (!body.success) return error("No pudimos validar la imagen.");
  const tenant = tenantRepository(business);
  const service = await tenant.service.findFirst({ where: { id: body.data.serviceId }, select: { id: true, imageBlobName: true } });
  if (!service) return error("No encontramos ese servicio.", 404);
  if (!expectedBlobName(business.id, service.id).test(body.data.blobName)) return error("La imagen no corresponde a este servicio.", 422);
  try {
    await verifyAndFinalizeServiceImage(body.data.blobName);
    const updated = await tenant.$transaction(async tx => {
      await tx.lockOccupancy();
      await tx.assertBusinessActive();
      return tx.service.update({ where: { id: service.id }, data: { imageBlobName: body.data.blobName }, select: { imageBlobName: true } });
    });
    if (service.imageBlobName && service.imageBlobName !== updated.imageBlobName) await deleteServiceImage(service.imageBlobName).catch(() => undefined);
    return json({ ok: true });
  } catch (cause) {
    await deleteServiceImage(body.data.blobName).catch(() => undefined);
    if (cause instanceof Error && cause.message === "INVALID_SERVICE_IMAGE") return error("La imagen debe ser WebP, medir hasta 1600 px y pesar menos de 500 KB.", 422);
    return error("No pudimos guardar la imagen del servicio.", 503);
  }
}

export async function handleDELETE(request: Request, business: BusinessContext) {
  if (!await requireAdmin(business.id)) return error("Iniciá sesión.", 401);
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const body = z.object({ serviceId: serviceIdSchema }).safeParse(await parseJson(request));
  if (!body.success) return error("Elegí un servicio válido.");
  const tenant = tenantRepository(business);
  const service = await tenant.service.findFirst({ where: { id: body.data.serviceId }, select: { id: true, imageBlobName: true } });
  if (!service) return error("No encontramos ese servicio.", 404);
  if (!service.imageBlobName) return json({ ok: true });
  try {
    await tenant.$transaction(async tx => {
      await tx.lockOccupancy();
      await tx.assertBusinessActive();
      await tx.service.update({ where: { id: service.id }, data: { imageBlobName: null }, select: { id: true } });
    });
    await deleteServiceImage(service.imageBlobName).catch(() => undefined);
    return json({ ok: true });
  } catch {
    return error("No pudimos eliminar la imagen del servicio.", 503);
  }
}

export function POST(request: Request) { return withInitialBusiness(business => handlePOST(request, business)); }
export function PATCH(request: Request) { return withInitialBusiness(business => handlePATCH(request, business)); }
export function DELETE(request: Request) { return withInitialBusiness(business => handleDELETE(request, business)); }
