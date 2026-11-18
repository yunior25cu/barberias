import { expect, request, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const ownerUser = "e2e-platform-owner";
const ownerPassword = "E2E-platform-password-123!";
const firstPassword = "E2E-tenant-a-password-123!";
const nextPassword = "E2E-tenant-a-recovered-123!";

async function tokenFrom(link: string) {
  const token = new URLSearchParams(new URL(link).hash.slice(1)).get("token");
  expect(token).toBeTruthy();
  return token!;
}

async function assertPlatformSession(page: import("@playwright/test").Page, origin: string) {
  const response = await page.request.get("/api/plataforma/session");
  const body = await response.text();
  const cookieMetadata = (await page.context().cookies(origin))
    .filter(cookie => cookie.name === "alcorte_platform")
    .map(({ name, domain, path, secure, httpOnly, sameSite, expires }) => ({ name, domain, path, secure, httpOnly, sameSite, expires }));
  expect(response.status(), `Platform session check failed: status=${response.status()}, body=${body.slice(0, 300)}, cookieMetadata=${JSON.stringify(cookieMetadata)}`).toBe(200);
  expect(JSON.parse(body).authenticated, `Platform session is not authenticated; cookieMetadata=${JSON.stringify(cookieMetadata)}`).toBe(true);
}

test("plataforma provisiona, activa y aísla tres negocios con auditoría y revocación", async ({ page, baseURL }) => {
  const origin = baseURL!;
  await page.goto("/plataforma");
  await expect(page).toHaveTitle(/Administración de negocios/);
  await page.getByLabel("Usuario").fill(ownerUser);
  await page.getByLabel("Contraseña").fill(ownerPassword);
  const platformLogin = page.waitForResponse(response => new URL(response.url()).pathname === "/api/plataforma/login" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Entrar" }).click();
  const loginResponse = await platformLogin;
  const loginBody = await loginResponse.json();
  expect(loginResponse.status(), `Platform login failed: status=${loginResponse.status()}, body=${JSON.stringify(loginBody)}`).toBe(200);
  await expect(page.getByRole("heading", { name: "Negocios" })).toBeVisible();

  await assertPlatformSession(page, origin);

  const unauthorizedContext = await request.newContext({ baseURL: origin });
  expect((await unauthorizedContext.get("/api/plataforma/businesses")).status()).toBe(401);
  await unauthorizedContext.dispose();

  const tenantOnly = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  const tenantLogin = await tenantOnly.post("/api/al-corte/auth/login", { data: { username: "e2e-owner", password: "E2E-only-password-123!" } });
  expect(tenantLogin.status()).toBe(200);
  expect((await tenantOnly.get("/api/plataforma/businesses")).status()).toBe(401);
  await tenantOnly.dispose();
  await assertPlatformSession(page, origin);
  const businessesResponse = await page.request.get("/api/plataforma/businesses");
  expect(businessesResponse.status(), `Platform businesses request failed after authenticated session check: status=${businessesResponse.status()}, body=${(await businessesResponse.text()).slice(0, 300)}`).toBe(200);
  await page.context().clearCookies();
  const platformOnly = await page.request.post("/api/plataforma/login", { headers: { Origin: origin }, data: { username: ownerUser, password: ownerPassword } });
  expect(platformOnly.status()).toBe(200);
  expect((await page.request.get("/api/al-corte/admin/services")).status()).toBe(401);
  const badOrigin = await page.request.post("/api/plataforma/businesses", { headers: { Origin: "https://example.invalid", "Idempotency-Key": crypto.randomUUID() }, data: { businessName: "No válido", slug: "no-valido", username: "no-valido", currency: "UYU" } });
  expect(badOrigin.status()).toBe(403);

  const marker = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const tenants = [
    { businessName: "Peluquería A", slug: `e2e-platform-a-${marker}`, username: `responsable-a-${marker}` },
    { businessName: "Barbería B", slug: `e2e-platform-b-${marker}`, username: `responsable-b-${marker}` },
    { businessName: "Salón C", slug: `e2e-platform-c-${marker}`, username: `responsable-c-${marker}` },
  ];
  const provisioned: { id: string; slug: string; link: string; key: string; username: string }[] = [];
  for (const item of tenants) {
    const payload = { ...item, publicPhone: "", currency: "UYU" };
    const key = crypto.randomUUID();
    const response = item === tenants[0]
      ? (await Promise.all([1, 2].map(() => page.request.post("/api/plataforma/businesses", { headers: { Origin: origin, "Idempotency-Key": key }, data: payload })))).find(candidate => candidate.status() === 201)!
      : await page.request.post("/api/plataforma/businesses", { headers: { Origin: origin, "Idempotency-Key": key }, data: payload });
    expect(response.status()).toBe(201);
    const result = await response.json();
    expect(result.created).toBe(true);
    expect(result.business.settings.businessName).toBe(item.businessName);
    expect(result.business.slug).toBe(item.slug);
    expect(result.business.status).toBe("active");
    expect(result.business).not.toHaveProperty("adminUsers");
    expect(result.activationLink).toContain("/activar#token=");
    provisioned.push({ id: result.business.id, slug: item.slug, link: result.activationLink, key, username: item.username });
    const retry = await page.request.post("/api/plataforma/businesses", { headers: { Origin: origin, "Idempotency-Key": key }, data: payload });
    expect(retry.status()).toBe(200);
    expect((await retry.json()).activationLink).toBeNull();
  }

  const duplicate = await page.request.post("/api/plataforma/businesses", {
    headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
    data: { ...tenants[0], publicPhone: "", currency: "UYU" },
  });
  expect(duplicate.status()).toBe(409);
  const collisionSlug = `e2e-platform-race-${marker}`;
  const collisionPayload = { businessName: "Un solo alta concurrente", slug: collisionSlug, username: `responsable-race-${marker}`, publicPhone: "", currency: "UYU" };
  const collisionResults = await Promise.all([1, 2].map(() => page.request.post("/api/plataforma/businesses", { headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() }, data: collisionPayload })));
  expect(collisionResults.filter(response => response.status() === 201)).toHaveLength(1);
  expect(collisionResults.filter(response => response.status() === 409), `Concurrent slug creation returned ${collisionResults.map(response => response.status()).join(",")}`).toHaveLength(1);
  const reserved = await page.request.post("/api/plataforma/businesses", {
    headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
    data: { businessName: "No crear", slug: "api", username: "no-crear", publicPhone: "", currency: "UYU" },
  });
  expect(reserved.status()).toBe(409);

  const firstToken = await tokenFrom(provisioned[0].link);
  const alteredToken = `${firstToken.slice(0, -1)}${firstToken.endsWith("A") ? "B" : "A"}`;
  const alteredAttempt = await page.request.post("/api/activar", { headers: { Origin: origin }, data: { token: alteredToken, password: firstPassword } });
  expect(alteredAttempt.status()).toBe(400);
  await page.goto(provisioned[0].link);
  await expect.poll(() => new URL(page.url()).hash).toBe("");
  await page.getByLabel("Nueva contraseña").fill(firstPassword);
  await page.getByLabel("Repetí la contraseña").fill(firstPassword);
  await page.getByRole("button", { name: "Activar y entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`/${provisioned[0].slug}/admin$`));
  const sessionA = await page.request.get(`/api/${provisioned[0].slug}/auth/session`);
  expect(sessionA.status()).toBe(200);
  expect((await sessionA.json()).authenticated).toBe(true);
  const serviceA = await page.request.post(`/api/${provisioned[0].slug}/admin/services`, { headers: { Origin: origin }, data: { name: "Servicio de Peluquería A", durationMinutes: 30, active: true } });
  expect(serviceA.status()).toBe(201);
  expect((await page.request.get(`/api/${provisioned[1].slug}/admin/services`)).status()).toBe(401);
  expect((await page.request.get("/api/plataforma/businesses")).status()).toBe(200);

  const tokenReplay = await page.request.post("/api/activar", { headers: { Origin: origin }, data: { token: firstToken, password: firstPassword } });
  expect(tokenReplay.status()).toBe(400);

  const tenantContexts = await Promise.all([request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } }), request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } })]);
  try {
    const oldSecondToken = await tokenFrom(provisioned[1].link);
    const replacement = await page.request.post(`/api/plataforma/businesses/${provisioned[1].id}/activation`, { headers: { Origin: origin }, data: { confirm: true } });
    expect(replacement.status()).toBe(200);
    const replacedAttempt = await page.request.post("/api/activar", { headers: { Origin: origin }, data: { token: oldSecondToken, password: "E2E-tenant-b-password-123!" } });
    expect(replacedAttempt.status()).toBe(400);
    const secondToken = await tokenFrom((await replacement.json()).activationLink);
    const [activateB1, activateB2] = await Promise.all(tenantContexts.map(context => context.post("/api/activar", { data: { token: secondToken, password: "E2E-tenant-b-password-123!" } })));
    expect([activateB1.status(), activateB2.status()].filter(status => status === 200)).toHaveLength(1);
    expect([activateB1.status(), activateB2.status()].filter(status => status === 400), `Activation race returned ${activateB1.status()} (${await activateB1.text()}) and ${activateB2.status()} (${await activateB2.text()})`).toHaveLength(1);
    const adminB = activateB1.status() === 200 ? tenantContexts[0] : tenantContexts[1];
    expect((await adminB.get(`/api/${provisioned[1].slug}/admin/services`)).status()).toBe(200);
    const serviceB = await adminB.post(`/api/${provisioned[1].slug}/admin/services`, { data: { name: "Servicio de Barbería B", durationMinutes: 30, active: true } });
    expect(serviceB.status()).toBe(201);
    expect((await adminB.get(`/api/${provisioned[0].slug}/admin/services`)).status()).toBe(401);
  } finally { await Promise.all(tenantContexts.map(context => context.dispose())); }

  const tenantC = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  try {
    const firstCToken = await tokenFrom(provisioned[2].link);
    const db = new PrismaClient();
    try {
      await db.adminActivation.updateMany({ where: { tokenHash: createHash("sha256").update(firstCToken).digest("hex") }, data: { expiresAt: new Date(Date.now() - 1000) } });
    } finally { await db.$disconnect(); }
    const expiredAttempt = await tenantC.post("/api/activar", { data: { token: firstCToken, password: "E2E-tenant-c-password-123!" } });
    expect(expiredAttempt.status()).toBe(400);
    const replacement = await page.request.post(`/api/plataforma/businesses/${provisioned[2].id}/activation`, { headers: { Origin: origin }, data: { confirm: true } });
    expect(replacement.status()).toBe(200);
    const activateC = await tenantC.post("/api/activar", { data: { token: await tokenFrom((await replacement.json()).activationLink), password: "E2E-tenant-c-password-123!" } });
    expect(activateC.status()).toBe(200);
    const serviceC = await tenantC.post(`/api/${provisioned[2].slug}/admin/services`, { data: { name: "Servicio de Salón C", durationMinutes: 45, active: true } });
    expect(serviceC.status()).toBe(201);
    expect((await tenantC.get(`/api/${provisioned[1].slug}/admin/services`)).status()).toBe(401);
    const pendingC = await page.request.post(`/api/plataforma/businesses/${provisioned[2].id}/activation`, { headers: { Origin: origin }, data: { confirm: true } });
    const pendingCToken = await tokenFrom((await pendingC.json()).activationLink);
    expect(pendingC.status()).toBe(200);
    expect((await page.request.patch(`/api/plataforma/businesses/${provisioned[2].id}/status`, { headers: { Origin: origin }, data: { status: "inactive" } })).status()).toBe(200);
    const inactiveActivation = await tenantC.post("/api/activar", { data: { token: pendingCToken, password: "E2E-tenant-c-password-123!" } });
    expect(inactiveActivation.status()).toBe(400);
    expect((await page.request.patch(`/api/plataforma/businesses/${provisioned[2].id}/status`, { headers: { Origin: origin }, data: { status: "active" } })).status()).toBe(200);
    const recoveredC = await page.request.post(`/api/plataforma/businesses/${provisioned[2].id}/activation`, { headers: { Origin: origin }, data: { confirm: true } });
    expect(recoveredC.status()).toBe(200);
    expect((await tenantC.post("/api/activar", { data: { token: await tokenFrom((await recoveredC.json()).activationLink), password: "E2E-tenant-c-password-123!" } })).status()).toBe(200);
    const retainedServices = await tenantC.get(`/api/${provisioned[2].slug}/admin/services`);
    expect((await retainedServices.json()).services.map((service: { name: string }) => service.name)).toContain("Servicio de Salón C");
  } finally { await tenantC.dispose(); }

  const nameByAdmin = await page.request.patch(`/api/${provisioned[0].slug}/admin/settings`, {
    headers: { Origin: origin }, data: { businessName: "Nombre editado por el local A" },
  });
  expect(nameByAdmin.status()).toBe(200);
  const publicPage = await page.request.get(`/${provisioned[0].slug}/reservar`);
  expect(await publicPage.text()).toContain("Nombre editado por el local A");
  const ownerEdit = await page.request.patch(`/api/plataforma/businesses/${provisioned[0].id}`, {
    headers: { Origin: origin }, data: { businessName: "Nombre actualizado desde plataforma A", publicPhone: null },
  });
  expect(ownerEdit.status()).toBe(200);
  const currentPublicPage = await page.request.get(`/${provisioned[0].slug}/reservar`);
  expect(await currentPublicPage.text()).toContain("Nombre actualizado desde plataforma A");
  await page.goto(`/${provisioned[0].slug}/reservar`);
  await expect(page).toHaveTitle("Nombre actualizado desde plataforma A – Reservá tu hora");

  const listing = await page.request.get("/api/plataforma/businesses?q=Nombre%20actualizado");
  const listingBody = await listing.text();
  expect(listing.status()).toBe(200);
  expect(listingBody).toContain("Nombre actualizado desde plataforma A");
  expect(listingBody).not.toContain("Ana Prueba");
  const detail = await page.request.get(`/api/plataforma/businesses/${provisioned[0].id}`);
  expect(detail.status()).toBe(200);
  expect((await detail.json()).business.audits.length).toBeGreaterThan(0);

  const newAccess = await page.request.post(`/api/plataforma/businesses/${provisioned[0].id}/activation`, { headers: { Origin: origin }, data: { confirm: true } });
  expect(newAccess.status()).toBe(200);
  const newActivationLink = (await newAccess.json()).activationLink as string;
  expect((await (await page.request.get(`/api/${provisioned[0].slug}/auth/session`)).json()).authenticated).toBe(false);
  await page.goto(newActivationLink);
  await page.getByLabel("Nueva contraseña").fill(nextPassword);
  await page.getByLabel("Repetí la contraseña").fill(nextPassword);
  await page.getByRole("button", { name: "Activar y entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`/${provisioned[0].slug}/admin$`));
  await page.getByRole("button", { name: "Ajustes" }).click();
  const greeting = page.getByLabel("Texto sugerido para el saludo");
  await expect(greeting).toHaveValue(/Nombre actualizado desde plataforma A/);
  await page.getByLabel("Nombre del local").fill("Nombre editado desde ajustes A");
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(page.getByRole("link", { name: "Nombre editado desde ajustes A" })).toBeVisible();
  await expect(page).toHaveTitle("Panel del responsable | Nombre editado desde ajustes A");

  const disable = await page.request.patch(`/api/plataforma/businesses/${provisioned[0].id}/status`, { headers: { Origin: origin }, data: { status: "inactive" } });
  expect(disable.status()).toBe(200);
  expect((await page.request.get(`/api/${provisioned[0].slug}/services`)).status()).toBe(404);
  expect((await page.request.get(`/api/${provisioned[1].slug}/services`)).status()).toBe(200);
  const reactivate = await page.request.patch(`/api/plataforma/businesses/${provisioned[0].id}/status`, { headers: { Origin: origin }, data: { status: "active" } });
  expect(reactivate.status()).toBe(200);
  const revokedSession = await page.request.get(`/api/${provisioned[0].slug}/auth/session`);
  expect((await revokedSession.json()).authenticated).toBe(false);
  const newLogin = await page.request.post(`/api/${provisioned[0].slug}/auth/login`, {
    headers: { Origin: origin }, data: { username: provisioned[0].username, password: nextPassword },
  });
  expect(newLogin.status()).toBe(200);
  expect((await (await page.request.get(`/api/${provisioned[0].slug}/auth/session`)).json()).authenticated).toBe(true);
});
