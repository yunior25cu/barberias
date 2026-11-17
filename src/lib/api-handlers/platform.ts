import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { error, json } from "@/lib/http";
import { hasSameOrigin } from "@/lib/origin";
import { limited, limitedForIdentifier } from "@/lib/rate-limit";
import { tokenHash } from "@/lib/security";
import { adminCookieName, sessionFor } from "@/lib/auth";
import { clearPlatformCookie, requirePlatformAdmin, setPlatformCookie } from "@/lib/platform-auth";
import type { Prisma } from "@prisma/client";

const usernameSchema = z.string().trim().min(1).max(100).transform(value => value.toLowerCase());
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const reservedSlugs = new Set([
  "admin", "activar", "api", "plataforma", "_next",
]);
const createSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(1).max(63).transform(value => value.toLowerCase()).refine(value => slugPattern.test(value), "El enlace debe usar letras ASCII, números y guiones internos."),
  username: usernameSchema,
  publicPhone: z.string().trim().max(32).optional().default(""),
  currency: z.string().regex(/^[A-Z]{3}$/).default("UYU"),
}).strict();

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function activationLink(token: string, request: Request) {
  const configured = env.APP_URL === "http://localhost:3000" ? new URL(request.url).origin : env.APP_URL.replace(/\/$/, "");
  return `${configured}/activar#token=${encodeURIComponent(token)}`;
}
function isUniqueViolation(cause: unknown) { return Boolean(cause && typeof cause === "object" && "code" in cause && cause.code === "P2002"); }

async function acquireLock(tx: Prisma.TransactionClient, resource: string) {
  const rows = await tx.$queryRaw<{ result: number }[]>`
    DECLARE @result int;
    EXEC @result = sys.sp_getapplock @Resource = ${resource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
    SELECT @result AS result;
  `;
  if (!rows.length || rows[0].result < 0) throw new Error("PLATFORM_LOCK_FAILED");
}

export async function platformLogin(request: Request) {
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const parsed = z.object({ username: usernameSchema, password: z.string().min(1).max(200) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error("Ingresá usuario y contraseña.");
  const ipLimit = await limited(request, "platform-login-ip", 20, 15 * 60_000);
  const userLimit = await limitedForIdentifier(request, "platform-login-user", parsed.data.username, 8, 15 * 60_000);
  if (ipLimit === null || userLimit === null) return error("No pudimos iniciar sesión ahora. Probá de nuevo.", 503);
  if (ipLimit || userLimit) return error("Demasiados intentos. Esperá unos minutos y probá de nuevo.", 429);
  if (!env.SESSION_SECRET) return error("El acceso de plataforma no está configurado.", 503);
  try {
    const admin = await db.platformAdmin.findUnique({ where: { username: parsed.data.username } });
    if (!admin || !admin.active || !await bcrypt.compare(parsed.data.password, admin.passwordHash)) return error("El usuario o la contraseña no coinciden.", 401);
    await setPlatformCookie(admin);
    return json({ ok: true, username: admin.username });
  } catch {
    return error("No pudimos iniciar sesión ahora.", 503);
  }
}

export async function platformSession() {
  const admin = await requirePlatformAdmin();
  return admin ? json({ authenticated: true, username: admin.username }) : error("Iniciá sesión.", 401);
}

export async function platformLogout(request: Request) {
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  await clearPlatformCookie();
  return json({ ok: true });
}

export async function listBusinesses(request: Request) {
  const actor = await requirePlatformAdmin();
  if (!actor) return error("Iniciá sesión.", 401);
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20));
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const status = url.searchParams.get("status");
  const where = {
    ...(status === "active" || status === "inactive" ? { status } : {}),
    ...(q ? { OR: [{ slug: { contains: q.toLowerCase() } }, { settings: { is: { businessName: { contains: q } } } }] } : {}),
  };
  const [total, businesses] = await db.$transaction([
    db.business.count({ where }),
    db.business.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize,
      select: { id: true, slug: true, status: true, createdAt: true, settings: { select: { businessName: true, publicPhone: true } } } }),
  ]);
  return json({ businesses: businesses.map(business => ({ ...business, publicUrl: `/${business.slug}/reservar`, adminUrl: `/${business.slug}/admin` })), page, pageSize, total, pages: Math.ceil(total / pageSize) });
}

export async function createBusiness(request: Request) {
  const actor = await requirePlatformAdmin();
  if (!actor) return error("Iniciá sesión.", 401);
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return error("Revisá el nombre, enlace, usuario y moneda del negocio.");
  if (reservedSlugs.has(body.data.slug)) return error("Ese enlace está reservado para el sistema.", 409);
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 100) return error("No pudimos verificar el alta. Volvé a intentarlo.", 400);
  const requestHash = hash(JSON.stringify({ ...body.data, publicPhone: body.data.publicPhone.trim() }));
  const activation = randomBytes(32).toString("base64url");
  const activationHash = tokenHash(activation);
  const fakePasswordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);
  const expiration = new Date(Date.now() + 24 * 60 * 60_000);
  try {
    const result = await db.$transaction(async tx => {
      await acquireLock(tx, `AlCorte:Platform:Request:${idempotencyKey}`);
      const previous = await tx.platformProvisioningRequest.findUnique({ where: { idempotencyKey } });
      if (previous) {
        if (previous.actorId !== actor.id || previous.requestHash !== requestHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
        const business = await tx.business.findUnique({ where: { id: previous.businessId }, select: { id: true, slug: true, status: true, settings: { select: { businessName: true, publicPhone: true } } } });
        return { business, replay: true };
      }
      await acquireLock(tx, `AlCorte:Platform:Slug:${body.data.slug}`);
      if (await tx.business.findUnique({ where: { slug: body.data.slug }, select: { id: true } })) throw new Error("SLUG_TAKEN");
      const business = await tx.business.create({ data: {
        id: randomUUID(), slug: body.data.slug, status: "active",
        settings: { create: { businessName: body.data.businessName, publicPhone: body.data.publicPhone || null, timezone: "America/Montevideo", currency: body.data.currency } },
        adminUsers: { create: { username: body.data.username, active: false, isInitialOwner: true, passwordHash: fakePasswordHash } },
      }, select: { id: true, slug: true, status: true, settings: { select: { businessName: true, publicPhone: true } }, adminUsers: { where: { isInitialOwner: true }, select: { id: true } } } });
      const admin = business.adminUsers[0];
      await tx.adminActivation.create({ data: { businessId: business.id, adminUserId: admin.id, purpose: "initial-owner", tokenHash: activationHash, expiresAt: expiration } });
      await tx.platformProvisioningRequest.create({ data: { actorId: actor.id, idempotencyKey, requestHash, businessId: business.id } });
      await tx.platformAudit.create({ data: { actorId: actor.id, businessId: business.id, action: "business.created", result: "success", changesJson: JSON.stringify({ businessName: body.data.businessName, slug: body.data.slug, status: "active", publicPhoneConfigured: Boolean(body.data.publicPhone.trim()) }) } });
      const publicBusiness = { id: business.id, slug: business.slug, status: business.status, settings: business.settings };
      return { business: publicBusiness, replay: false };
    }, { isolationLevel: "ReadCommitted" });
    if (result.replay) return json({ created: false, business: result.business, activationLink: null, activationRequired: true });
    return json({ created: true, business: result.business, activationLink: activationLink(activation, request), expiresAt: expiration.toISOString(), activationRequired: true }, 201);
  } catch (cause) {
    if (cause instanceof Error && cause.message === "IDEMPOTENCY_KEY_REUSED") return error("La clave de solicitud ya se usó con otros datos.", 409);
    if (cause instanceof Error && cause.message === "SLUG_TAKEN") return error("Ese enlace ya está en uso. Elegí otro.", 409);
    if (isUniqueViolation(cause)) return error("El enlace o usuario ya está en uso.", 409);
    return error("No pudimos crear el negocio. Probá de nuevo.", 503);
  }
}

export async function businessDetail(request: Request, id: string, method: "GET" | "PATCH") {
  const actor = await requirePlatformAdmin();
  if (!actor) return error("Iniciá sesión.", 401);
  if (method === "GET") {
    const business = await db.business.findUnique({ where: { id }, select: {
      id: true, slug: true, status: true, createdAt: true,
      settings: { select: { businessName: true, publicPhone: true, timezone: true, currency: true, minAdvanceMinutes: true, maxAdvanceDays: true, slotStepMinutes: true } },
      audits: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, action: true, result: true, changesJson: true, createdAt: true, actor: { select: { username: true } } } },
    } });
    return business ? json({ business, publicUrl: `/${business.slug}/reservar`, adminUrl: `/${business.slug}/admin` }) : error("No encontramos ese negocio.", 404);
  }
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const body = z.object({ businessName: z.string().trim().min(2).max(100).optional(), publicPhone: z.string().trim().max(32).nullable().optional() }).strict().refine(value => Object.keys(value).length > 0).safeParse(await request.json().catch(() => null));
  if (!body.success) return error("Revisá el nombre y el teléfono público.");
  try {
    const updated = await db.$transaction(async tx => {
      const before = await tx.business.findUnique({ where: { id }, select: { id: true, settings: { select: { businessName: true, publicPhone: true } } } });
      if (!before?.settings) throw new Error("BUSINESS_NOT_FOUND");
      const data = body.data;
      const settings = await tx.settings.update({ where: { businessId: id }, data: { ...data, publicPhone: data.publicPhone === undefined ? undefined : data.publicPhone || null }, select: { businessName: true, publicPhone: true } });
      await tx.platformAudit.create({ data: { actorId: actor.id, businessId: id, action: "business.settings.updated", result: "success", changesJson: JSON.stringify({ ...(data.businessName !== undefined ? { businessName: { from: before.settings.businessName, to: settings.businessName } } : {}), ...(data.publicPhone !== undefined ? { publicPhoneConfigured: Boolean(settings.publicPhone) } : {}) }) } });
      return settings;
    });
    return json({ settings: updated });
  } catch {
    return error("No pudimos guardar los cambios.", 503);
  }
}

export async function changeBusinessStatus(request: Request, id: string) {
  const actor = await requirePlatformAdmin();
  if (!actor) return error("Iniciá sesión.", 401);
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const body = z.object({ status: z.enum(["active", "inactive"]) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return error("Revisá el estado del negocio.");
  try {
    const business = await db.$transaction(async tx => {
      await acquireLock(tx, `AlCorte:Occupancy:${id}`);
      const current = await tx.business.findUnique({ where: { id }, select: { status: true } });
      if (!current) throw new Error("BUSINESS_NOT_FOUND");
      if (current.status !== body.data.status) {
        await tx.business.update({ where: { id }, data: { status: body.data.status } });
        if (body.data.status === "inactive") {
          await tx.adminUser.updateMany({ where: { businessId: id }, data: { sessionVersion: { increment: 1 } } });
          await tx.adminActivation.updateMany({ where: { businessId: id, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
        }
        await tx.platformAudit.create({ data: { actorId: actor.id, businessId: id, action: body.data.status === "inactive" ? "business.disabled" : "business.reactivated", result: "success", changesJson: JSON.stringify({ from: current.status, to: body.data.status, pendingActivationsInvalidated: body.data.status === "inactive" }) } });
      }
      return tx.business.findUniqueOrThrow({ where: { id }, select: { id: true, slug: true, status: true, settings: { select: { businessName: true } } } });
    }, { isolationLevel: "ReadCommitted" });
    return json({ business });
  } catch (cause) {
    if (cause instanceof Error && cause.message === "BUSINESS_NOT_FOUND") return error("No encontramos ese negocio.", 404);
    return error("No pudimos cambiar el estado.", 503);
  }
}

export async function issueAdminActivation(request: Request, id: string) {
  const actor = await requirePlatformAdmin();
  if (!actor) return error("Iniciá sesión.", 401);
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const confirmation = z.object({ confirm: z.literal(true) }).safeParse(await request.json().catch(() => null));
  if (!confirmation.success) return error("Confirmá la emisión del nuevo acceso.");
  const activation = randomBytes(32).toString("base64url");
  const expiration = new Date(Date.now() + 24 * 60 * 60_000);
  try {
    const result = await db.$transaction(async tx => {
      await acquireLock(tx, `AlCorte:Occupancy:${id}`);
      const business = await tx.business.findUnique({ where: { id }, select: { id: true, slug: true, status: true, adminUsers: { where: { isInitialOwner: true }, select: { id: true } } } });
      const admin = business?.adminUsers[0];
      if (!business || !admin) throw new Error("BUSINESS_OR_ADMIN_NOT_FOUND");
      if (business.status !== "active") throw new Error("BUSINESS_INACTIVE");
      await tx.adminActivation.updateMany({ where: { businessId: id, adminUserId: admin.id, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
      await tx.adminUser.update({ where: { id: admin.id }, data: { active: false, sessionVersion: { increment: 1 } } });
      await tx.adminActivation.create({ data: { businessId: id, adminUserId: admin.id, purpose: "initial-owner", tokenHash: tokenHash(activation), expiresAt: expiration } });
      await tx.platformAudit.create({ data: { actorId: actor.id, businessId: id, action: "admin.activation.issued", result: "success", changesJson: JSON.stringify({ expiresAt: expiration.toISOString(), previousLinksInvalidated: true, accountRequiresActivation: true }) } });
      return { slug: business.slug };
    }, { isolationLevel: "ReadCommitted" });
    return json({ activationLink: activationLink(activation, request), expiresAt: expiration.toISOString(), slug: result.slug });
  } catch (cause) {
    if (cause instanceof Error && cause.message === "BUSINESS_OR_ADMIN_NOT_FOUND") return error("No encontramos al responsable inicial.", 404);
    if (cause instanceof Error && cause.message === "BUSINESS_INACTIVE") return error("Reactivá el negocio antes de emitir un acceso.", 409);
    return error("No pudimos emitir el acceso temporal.", 503);
  }
}

export async function activateAdmin(request: Request) {
  if (!hasSameOrigin(request)) return error("Solicitud no válida.", 403);
  const body = z.object({ token: z.string().min(32).max(128), password: z.string().min(14).max(200) }).strict().safeParse(await request.json().catch(() => null));
  if (!body.success) return error("El enlace no es válido o venció. Pedí uno nuevo.", 400);
  const ipLimit = await limited(request, "activation-ip", 12, 60 * 60_000);
  const tokenLimit = await limitedForIdentifier(request, "activation-token", body.data.token, 5, 60 * 60_000);
  if (ipLimit === null || tokenLimit === null) return error("No pudimos activar la cuenta ahora.", 503);
  if (ipLimit || tokenLimit) return error("Probá más tarde o pedí un nuevo enlace.", 429);
  const hashedToken = tokenHash(body.data.token);
  const passwordHash = await bcrypt.hash(body.data.password, 12);
  try {
    const candidate = await db.adminActivation.findUnique({ where: { tokenHash: hashedToken }, select: { businessId: true } });
    if (!candidate) return error("El enlace no es válido o venció. Pedí uno nuevo.", 400);
    const activated = await db.$transaction(async tx => {
      await acquireLock(tx, `AlCorte:Activation:${hashedToken}`);
      await acquireLock(tx, `AlCorte:Occupancy:${candidate.businessId}`);
      const activation = await tx.adminActivation.findUnique({ where: { tokenHash: hashedToken }, include: { business: { select: { slug: true, status: true } }, adminUser: { select: { id: true, businessId: true, sessionVersion: true } } } });
      if (!activation || activation.consumedAt || activation.invalidatedAt || activation.expiresAt <= new Date()
        || activation.purpose !== "initial-owner" || activation.business.status !== "active"
        || activation.adminUser.businessId !== activation.businessId) throw new Error("ACTIVATION_INVALID");
      const admin = await tx.adminUser.update({ where: { id: activation.adminUserId }, data: { passwordHash, active: true, sessionVersion: { increment: 1 } }, select: { id: true, businessId: true, sessionVersion: true } });
      await tx.adminActivation.update({ where: { id: activation.id }, data: { consumedAt: new Date() } });
      return { admin, slug: activation.business.slug };
    }, { isolationLevel: "ReadCommitted" });
    (await cookies()).set(adminCookieName, sessionFor(activated.admin), { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 60 * 60 });
    return json({ ok: true, slug: activated.slug });
  } catch (cause) {
    if (cause instanceof Error && cause.message === "ACTIVATION_INVALID") return error("El enlace no es válido o venció. Pedí uno nuevo.", 400);
    return error("No pudimos activar la cuenta ahora.", 503);
  }
}
