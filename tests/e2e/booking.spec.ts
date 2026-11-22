import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { deflateSync } from "node:zlib";
import { imageSize } from "image-size";

function imageFixture(red: number, green: number, blue: number) {
  const crc32 = (buffer: Buffer) => {
    let crc = 0xffffffff;
    for (const byte of buffer) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const typeBuffer = Buffer.from(type);
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length, 0);
    typeBuffer.copy(result, 4);
    data.copy(result, 8);
    result.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), result.length - 4);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0); header.writeUInt32BE(2, 4); header[8] = 8; header[9] = 6;
  const row = Buffer.from([0, red, green, blue, 255, red, green, blue, 255]);
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.concat([row, row]))), chunk("IEND", Buffer.alloc(0))]);
}
async function loginAs(page: import("@playwright/test").Page, slug: string) {
  await page.goto(`/${slug}/admin`);
  await expect(page).toHaveTitle(new RegExp(`Panel del responsable \\|`));
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex.*nofollow/);
  const username = page.getByLabel("Usuario");
  const agenda = page.getByRole("heading", { name: "Agenda", exact: true });
  const loginFormVisible = await Promise.race([
    username.waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false),
    agenda.waitFor({ state: "visible", timeout: 10_000 }).then(() => false).catch(() => null),
  ]);
  if (loginFormVisible === null) throw new Error(`Admin panel for ${slug} did not load its login form or authenticated agenda.`);
  if (!loginFormVisible) {
    // Tests may revisit the admin panel in the same browser context. Reuse its
    // still-valid session instead of expecting the login form a second time.
    return;
  }
  await username.fill("e2e-owner");
  await page.getByLabel("Contraseña").fill("E2E-only-password-123!");
  const loginResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname === `/api/${slug}/auth/login` && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Entrar" }).click();
  const response = await loginResponse;
  const result = await response.json();
  expect(response.status(), `Admin login for ${slug} failed: ${result.error ?? "unknown error"}`).toBe(200);
  await expect(page.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible();
}
test("reserva completa desde viewport móvil sin crear una cuenta",async({page})=>{
  await page.goto("/al-corte/reservar");await page.context().grantPermissions(["clipboard-read","clipboard-write"]);await expect(page).toHaveTitle("Al Corte – Reservá tu hora");await expect(page.locator('meta[name="description"]')).toHaveAttribute("content","Elegí tu servicio y reservá tu hora en pocos pasos.");await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content","Elegí tu servicio y reservá tu hora en pocos pasos.");await expect(page.getByRole("heading",{name:"¿Qué te gustaría hacerte?"})).toBeVisible();
  await page.route("**/api/al-corte/availability?*",async route=>{await new Promise(resolve=>setTimeout(resolve,300));await route.continue();});await page.getByRole("button",{name:/Corte de prueba E2E/}).click();await expect(page.getByRole("button",{name:/Corte de prueba E2E/})).toHaveCSS("background-color","rgb(37, 90, 70)");await expect(page.getByRole("button",{name:"Cualquier profesional disponible"})).toBeVisible();await page.getByRole("button",{name:"Profesional E2E B"}).click();await page.getByRole("button",{name:/Elegir día y hora/}).click();
  const date=new Date(Date.now()+7*86400_000);const day=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Montevideo",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
  await page.getByLabel("Elegí un día").fill(day);await expect(page.getByRole("status").filter({hasText:"Buscando horarios disponibles"})).toBeVisible();await page.getByRole("button",{name:"09:00"}).click();await page.getByRole("button",{name:/Continuar/}).click();
  await page.getByLabel("Tu nombre").fill("Ana Prueba");await page.getByLabel("Teléfono").fill("099 123 456");await page.getByRole("button",{name:"Confirmar reserva"}).click();
  await expect(page.getByRole("heading",{name:"¡Pronto nos vemos, Ana Prueba!"})).toBeVisible();await expect(page.getByText(/Código:/)).toBeVisible();await page.getByRole("button",{name:"Copiar código"}).click();await expect(page.getByRole("status").filter({hasText:"Copiado"})).toBeVisible();
  await page.getByRole("button",{name:"Cambiar horario"}).click();await expect(page.getByLabel("Elegí un día")).toHaveValue(day);const later=new Date(Date.now()+8*86400_000);const laterDay=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Montevideo",year:"numeric",month:"2-digit",day:"2-digit"}).format(later);await page.getByLabel("Elegí un día").fill(laterDay);await page.getByRole("button",{name:"09:00"}).click();await page.getByRole("button",{name:/Continuar/}).click();const manageResponse=page.waitForResponse(response=>new URL(response.url()).pathname==="/api/al-corte/manage"&&response.request().method()==="POST");await page.getByRole("button",{name:"Cambiar horario"}).click();const manageResult=await manageResponse;const manageBody=await manageResult.json();expect(manageResult.status(),`Public reschedule failed: ${manageBody.error??"unknown error"}`).toBe(200);await expect(page.getByRole("heading",{name:"¡Pronto nos vemos, Ana Prueba!"})).toBeVisible();
  await page.getByRole("button",{name:"Cancelar reserva"}).click();const cancelDialog=page.getByRole("dialog",{name:"Cancelar reserva"});await expect(cancelDialog).toBeVisible();await cancelDialog.getByRole("button",{name:"Cancelar reserva"}).click();await expect(page.getByText("La reserva quedó cancelada.")).toBeVisible();
});
test("separa catálogo, sesiones y relaciones entre negocios", async ({ page }) => {
  const publicA = await page.request.get("/api/al-corte/services");
  const publicB = await page.request.get("/api/e2e-b/services");
  expect(publicA.status()).toBe(200);
  expect(publicB.status()).toBe(200);
  const namesA = (await publicA.json()).services.map((service: { name: string }) => service.name);
  const namesB = (await publicB.json()).services.map((service: { name: string }) => service.name);
  expect(namesA).toContain("Corte de prueba E2E");
  expect(namesA).not.toContain("Servicio solo B");
  expect(namesB).toContain("Servicio solo B");
  expect(namesB).not.toContain("Corte de prueba E2E");

  await loginAs(page, "al-corte");
  expect((await page.request.get("/api/al-corte/admin/services")).status()).toBe(200);
  expect((await page.request.get("/api/e2e-b/admin/services")).status()).toBe(401);

  const staffBefore = (await (await page.request.get("/api/al-corte/admin/staff")).json()).staff.length;
  const invalidRelation = await page.request.post("/api/al-corte/admin/staff", {
    headers: { Origin: new URL(page.url()).origin },
    data: { name: "No debe crearse", serviceIds: ["e2e-service-b"] },
  });
  expect(invalidRelation.status()).toBe(422);
  expect((await (await page.request.get("/api/al-corte/admin/staff")).json()).staff).toHaveLength(staffBefore);

  const crossTenantToken = await page.request.post("/api/e2e-b/manage", {
    data: { code: "222222", manageToken: "e2e-manage-token-for-business-a", action: "cancel" },
  });
  expect(crossTenantToken.status()).toBe(404);

  await loginAs(page, "e2e-b");
  expect((await page.request.get("/api/e2e-b/admin/services")).status()).toBe(200);
  expect((await page.request.get("/api/al-corte/admin/services")).status()).toBe(401);
  const adminB = await page.request.get("/api/e2e-b/admin/services");
  expect((await adminB.json()).services.map((service: { name: string }) => service.name)).toContain("Servicio solo B");
});
test("el panel protege el acceso y permite mantener servicios y equipo",async({page})=>{
  const unauthorized=await page.request.get("/api/al-corte/admin/services");expect(unauthorized.status()).toBe(401);
  await loginAs(page, "al-corte");await page.getByRole("button",{name:"Servicios y equipo"}).click();
  const serviceForm=page.locator("form").filter({has:page.getByRole("heading",{name:"Agregar servicio"})});await serviceForm.getByLabel("Nombre").fill("Servicio prueba admin");await serviceForm.getByLabel("Duración (minutos)").fill("45");await serviceForm.getByRole("button",{name:"Guardar servicio"}).click();await expect(page.getByText("Servicio prueba admin").first()).toBeVisible();
  const staffForm=page.locator("form").filter({has:page.getByRole("heading",{name:"Agregar profesional"})});await staffForm.getByLabel("Nombre").fill("Profesional prueba admin");await staffForm.getByLabel("Servicio prueba admin").check();await staffForm.getByRole("button",{name:"Agregar al equipo"}).click();await expect(page.getByText("Profesional prueba admin").first()).toBeVisible();
  const future=new Date(Date.now()+8*86400_000);let day=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Montevideo",year:"numeric",month:"2-digit",day:"2-digit"}).format(future);while(new Date(`${day}T12:00:00Z`).getUTCDay()!==1)day=new Date(new Date(`${day}T12:00:00Z`).getTime()+86400_000).toISOString().slice(0,10);
  await page.getByRole("button",{name:"Horarios"}).click();await page.getByLabel("Profesional").selectOption({label:"Profesional prueba admin"});const mondayHours=page.locator(".hour-row").filter({hasText:"Lunes"});await mondayHours.getByLabel("Cerrado").uncheck();await expect(mondayHours.getByLabel("Cerrado")).not.toBeChecked();await mondayHours.getByLabel("Abre Lunes").fill("09:00");await mondayHours.getByLabel("Cierra Lunes").fill("18:00");await page.getByRole("button",{name:"Guardar horarios"}).click();await expect(page.getByText("Horarios guardados.")).toBeVisible();const settingsResponse=await page.request.get("/api/al-corte/admin/hours");const savedStaff=(await settingsResponse.json()).staff.find((p:{name:string})=>p.name==="Profesional prueba admin");expect(savedStaff.services.map((x:{service:{name:string}})=>x.service.name)).toContain("Servicio prueba admin");expect(savedStaff.hours).toContainEqual(expect.objectContaining({weekday:1,startMinute:540,endMinute:1080}));
  await page.getByRole("button",{name:"Bloqueos"}).click();await page.getByLabel("Profesional").selectOption({label:"Profesional prueba admin"});await page.getByLabel("Día").fill(day);await page.getByLabel("Desde").fill("12:00");await page.getByLabel("Hasta").fill("13:00");await page.getByRole("button",{name:"Bloquear horario"}).click();await expect(page.getByText(/Bloqueos activos/)).toBeVisible();
  await page.getByRole("button",{name:"Agenda"}).click();const controls=page.locator(".agenda-controls");const previousBox=await controls.getByRole("button",{name:"Anterior"}).boundingBox();const dateBox=await controls.getByLabel("Fecha de agenda").boundingBox();const nextBox=await controls.getByRole("button",{name:"Siguiente"}).boundingBox();const weekBox=await controls.getByRole("button",{name:"Ver semana"}).boundingBox();expect(previousBox&&dateBox&&nextBox&&weekBox).toBeTruthy();expect(Math.abs(previousBox!.y-dateBox!.y)).toBeLessThan(2);expect(Math.abs(nextBox!.y-dateBox!.y)).toBeLessThan(2);expect(weekBox!.y).toBeGreaterThan(nextBox!.y);expect(Math.abs((weekBox!.x+weekBox!.width/2)-(dateBox!.x+dateBox!.width/2))).toBeLessThan(2);await page.getByLabel("Fecha de agenda").fill(day);await page.getByRole("button",{name:/Reserva manual/}).click();const manualForm=page.locator("form").filter({has:page.getByRole("heading",{name:"Nueva reserva"})});await manualForm.getByLabel("Servicio").selectOption({label:"Servicio prueba admin"});await manualForm.getByLabel("Profesional").selectOption({label:"Profesional prueba admin"});await manualForm.getByLabel("Día").fill(day);await manualForm.getByLabel("Hora").fill("10:00");await manualForm.getByLabel("Nombre").fill("Cliente manual");await manualForm.getByLabel("Teléfono").fill("099 222 333");
  const invalidFields=await manualForm.evaluate((form:HTMLFormElement)=>Array.from(form.querySelectorAll(":invalid")).map((element)=>{const input=element as HTMLInputElement;return {type:input.type,value:input.value,message:input.validationMessage};}));expect(invalidFields,`Manual booking form is invalid for day ${day}`).toEqual([]);
  const createResponse=page.waitForResponse((response)=>new URL(response.url()).pathname==="/api/al-corte/admin/bookings"&&response.request().method()==="POST",{timeout:10000});await manualForm.getByRole("button",{name:"Guardar reserva"}).click();const manualResponse=await createResponse;const manualResult=await manualResponse.json();expect(manualResponse.status(),`Manual booking API failed for ${day}: ${manualResult.error??"unknown"}`).toBe(201);await expect(page.getByText("Cliente manual",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Mover",exact:true}).click();await page.getByLabel("Hora",{exact:true}).fill("11:00");await page.getByRole("button",{name:"Guardar cambio"}).click();await expect(page.getByRole("button",{name:"11:00 Servicio prueba admin"})).toBeVisible();await page.getByRole("button",{name:"Cancelar",exact:true}).click();const bookingCancel=page.getByRole("dialog",{name:"Cancelar reserva"});await expect(bookingCancel).toBeVisible();await bookingCancel.getByRole("button",{name:"Cancelar turno"}).click();await expect(page.getByText("Cancelada",{exact:true})).toBeVisible();
});

test("las reservas HTTP concurrentes no permiten colisiones entre cliente y administración ni entre reprogramaciones", async ({ page }) => {
  await loginAs(page, "al-corte");

  const dayFor = (daysAhead: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + daysAhead * 86400_000));
  const instant = (day: string, hour: number) => new Date(`${day}T${String(hour + 3).padStart(2, "0")}:00:00.000Z`).toISOString();
  const serviceId = "e2e-service";
  const staffId = "e2e-staff";
  const sameSlotDay = dayFor(12);
  const slot = instant(sameSlotDay, 12);
  const publicBooking = page.request.post("/api/al-corte/bookings", {
    headers: { "Idempotency-Key": `e2e-${crypto.randomUUID()}` },
    data: { serviceId, staffId, startsAt: slot, name: "Concurrent public", phone: "099123456", manageToken: crypto.randomUUID() + crypto.randomUUID() },
  });
  const manualBooking = page.request.post("/api/al-corte/admin/bookings", {
    headers: { Origin: new URL(page.url()).origin },
    data: { serviceId, staffId, startsAt: slot, name: "Concurrent admin", phone: "099123457" },
  });
  const mixedResults = await Promise.all([publicBooking, manualBooking]);
  expect(mixedResults.filter(result => [200, 201].includes(result.status()))).toHaveLength(1);
  expect(mixedResults.filter(result => result.status() === 409)).toHaveLength(1);

  const moveDay = dayFor(14);
  const sourceOne = await page.request.post("/api/al-corte/admin/bookings", { headers: { Origin: new URL(page.url()).origin }, data: { serviceId, staffId, startsAt: instant(moveDay, 9), name: "Move source A", phone: "099123458" } });
  const sourceTwo = await page.request.post("/api/al-corte/admin/bookings", { headers: { Origin: new URL(page.url()).origin }, data: { serviceId, staffId, startsAt: instant(moveDay, 10), name: "Move source B", phone: "099123459" } });
  expect(sourceOne.status()).toBe(201);
  expect(sourceTwo.status()).toBe(201);
  const first = (await sourceOne.json()).booking;
  const second = (await sourceTwo.json()).booking;
  const destination = instant(moveDay, 12);
  const moves = await Promise.all([
    page.request.patch("/api/al-corte/admin/bookings", { headers: { Origin: new URL(page.url()).origin }, data: { id: first.id, startsAt: destination } }),
    page.request.patch("/api/al-corte/admin/bookings", { headers: { Origin: new URL(page.url()).origin }, data: { id: second.id, startsAt: destination } }),
  ]);
  expect(moves.map(result => result.status()).sort()).toEqual([200, 409]);
});

test("active slugs reject renamed businesses and admin sessions are revoked", async ({ page }) => {
  const db = new PrismaClient();
  let originalSlug: string | undefined;
  try {
    expect((await page.request.get("/api/unknown-business/services")).status()).toBe(404);
    await loginAs(page, "al-corte");

    const owner = await db.adminUser.findFirst({ where: { businessId: "al-corte", username: "e2e-owner" }, select: { id: true } });
    expect(owner).not.toBeNull();
    await db.adminUser.update({ where: { id: owner!.id }, data: { sessionVersion: { increment: 1 } } });
    expect((await page.request.get("/api/al-corte/admin/services")).status()).toBe(401);

    const business = await db.business.findUnique({ where: { id: "e2e-business" }, select: { slug: true } });
    expect(business).not.toBeNull();
    originalSlug = business!.slug;
    await db.business.update({ where: { id: "e2e-business" }, data: { slug: "e2e-b-renamed" } });
    expect((await page.request.get("/api/e2e-b/services")).status()).toBe(404);
    expect((await page.request.get("/api/e2e-b-renamed/services")).status()).toBe(200);
  } finally {
    if (originalSlug) await db.business.update({ where: { id: "e2e-business" }, data: { slug: originalSlug } });
    await db.$disconnect();
  }
});

test("el administrador crea, reemplaza y elimina imagenes optimizadas de servicios; la reserva permite ampliarlas en movil", async ({ page }) => {
  await loginAs(page, "e2e-b");
  await page.getByRole("button", { name: "Servicios y equipo" }).click();
  const creation = page.locator("form").filter({ has: page.getByRole("heading", { name: "Agregar servicio" }) });
  await creation.getByLabel("Nombre").fill("Imagen E2E");
  await creation.getByLabel("Duración (minutos)").fill("30");
  await creation.getByLabel("Imagen del servicio (opcional)").setInputFiles({ name: "image.png", mimeType: "image/png", buffer: imageFixture(190, 60, 40) });
  const uploadIntentResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/e2e-b/admin/service-images" && response.request().method() === "POST");
  await creation.getByRole("button", { name: "Guardar servicio" }).click();
  const uploadIntent = await (await uploadIntentResponse).json();

  const serviceCard = page.locator(".service-admin-card").filter({ hasText: "Imagen E2E" });
  await expect(serviceCard.getByRole("img", { name: "Imagen de Imagen E2E" })).toBeVisible();
  const getImageUrl = async (): Promise<string | null> => {
    const response = await page.request.get("/api/e2e-b/services");
    expect(response.status()).toBe(200);
    const item = (await response.json()).services.find((service: { name: string }) => service.name === "Imagen E2E");
    expect(item).toBeDefined();
    return item.imageUrl as string | null;
  };
  const firstUrl = await getImageUrl();
  expect(firstUrl).toMatch(/^http/);
  expect((await (await page.request.get("/api/al-corte/services")).json()).services.every((service: { imageUrl: string | null; imageBlobName?: string }) => service.imageUrl === null && service.imageBlobName === undefined)).toBe(true);
  const firstImage = await page.request.get(firstUrl!);
  expect(firstImage.status()).toBe(200);
  expect(firstImage.headers()["content-type"]).toContain("image/webp");
  const originalImageBytes = await firstImage.body();
  expect(originalImageBytes.byteLength).toBeLessThanOrEqual(500 * 1024);
  expect(imageSize(originalImageBytes).type).toBe("webp");
  expect(imageSize(originalImageBytes).width).toBeLessThanOrEqual(1440);
  const overwrite = await page.request.put(uploadIntent.uploadUrl, {
    headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": "image/webp" }, data: originalImageBytes,
  });
  expect(overwrite.status()).toBeGreaterThanOrEqual(400);
  expect(await (await page.request.get(firstUrl!)).body()).toEqual(originalImageBytes);

  await serviceCard.getByRole("button", { name: "Editar" }).click();
  const edit = serviceCard.locator("form").filter({ has: page.getByRole("heading", { name: "Editar servicio" }) });
  await edit.getByLabel("Reemplazar imagen (opcional)").setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: imageFixture(30, 120, 210) });
  const replacementIntentResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/e2e-b/admin/service-images" && response.request().method() === "POST");
  const replacementSaveResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/e2e-b/admin/service-images" && response.request().method() === "PATCH");
  await edit.getByRole("button", { name: "Guardar cambios" }).click();
  expect((await replacementIntentResponse).status()).toBe(200);
  expect((await replacementSaveResponse).status()).toBe(200);
  await expect(serviceCard.getByRole("img", { name: "Imagen de Imagen E2E" })).toBeVisible();
  const secondUrl = await getImageUrl();
  expect(secondUrl).toMatch(/^http/);
  expect(new URL(secondUrl!).pathname).not.toBe(new URL(firstUrl!).pathname);
  expect((await page.request.get(firstUrl!)).status()).toBe(404);

  await page.goto("/e2e-b/reservar");
  const publicCard = page.locator(".service-choice-wrap").filter({ has: page.getByRole("button", { name: /Imagen E2E/ }) });
  const before = await publicCard.boundingBox();
  await publicCard.getByRole("button", { name: "Ampliar imagen de Imagen E2E" }).click();
  const viewer = page.getByRole("dialog", { name: "Imagen ampliada" });
  await expect(viewer.getByRole("img", { name: "Imagen E2E" })).toBeVisible();
  await viewer.getByRole("button", { name: "Cerrar imagen" }).click();
  const after = await publicCard.boundingBox();
  expect(before && after).toBeTruthy();
  expect(after!.width).toBe(before!.width);
  expect(after!.height).toBe(before!.height);

  await loginAs(page, "e2e-b");
  await page.getByRole("button", { name: "Servicios y equipo" }).click();
  const removable = page.locator(".service-admin-card").filter({ hasText: "Imagen E2E" });
  await removable.getByRole("button", { name: "Quitar imagen" }).click();
  const confirmation = page.getByRole("dialog", { name: "Quitar imagen del servicio" });
  await confirmation.getByRole("button", { name: "Quitar imagen" }).click();
  await expect(removable.getByRole("img", { name: "Imagen de Imagen E2E" })).toHaveCount(0);
  expect(await getImageUrl()).toBeNull();
  expect((await page.request.get(secondUrl!)).status()).toBe(404);
});

test("public booking can be managed without a phone number", async ({ page }) => {
  const db = new PrismaClient();
  try {
    await loginAs(page, "e2e-b");
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await expect(page.getByLabel("Dirección del local")).toHaveValue("Av. 18 de Julio 1000, Montevideo, Uruguay");
    await page.getByLabel("Dirección del local").fill("Bulevar Artigas 1234, Montevideo, Uruguay");
    await page.getByRole("button", { name: "Guardar ajustes" }).click();
    await expect(page.getByText("Ajustes guardados.")).toBeVisible();
    const savedSettings = await page.request.get("/api/e2e-b/admin/settings");
    expect((await savedSettings.json()).settings.businessAddress).toBe("Bulevar Artigas 1234, Montevideo, Uruguay");
    expect((await (await page.request.get("/api/al-corte/services")).json()).businessAddress).toBeNull();
    await page.goto("/e2e-b/reservar");
    await page.getByRole("button", { name: /Servicio solo B/ }).click();
    await page.getByRole("button", { name: /Elegir d/ }).click();
    const dayFor = (daysAhead: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + daysAhead * 86400_000));
    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill(dayFor(15));
    await page.getByRole("button", { name: "09:00" }).click();
    await page.getByRole("button", { name: /Continuar/ }).click();
    await expect(page.getByRole("region", { name: "Ubicación del local" })).toBeVisible();
    await expect(page.getByTitle("Mapa de Negocio E2E B")).toHaveAttribute("src", /maps\/embed\/v1\/place/);
    await expect(page.getByRole("link", { name: "Cómo llegar en Google Maps" })).toHaveAttribute("href", /destination=Bulevar%20Artigas%201234%2C%20Montevideo%2C%20Uruguay/);
    await page.getByLabel("Tu nombre").fill("Reserva sin telefono");
    await expect(page.getByLabel("Teléfono (opcional)")).not.toHaveAttribute("required", "");
    await page.getByRole("button", { name: "Confirmar reserva" }).click();
    await expect(page.getByRole("heading", { name: /Reserva sin telefono/ })).toBeVisible();
    const saved = await db.booking.findFirst({ where: { businessId: "e2e-business", customerName: "Reserva sin telefono" }, select: { id: true, phoneNormalized: true } });
    expect(saved?.phoneNormalized).toBe("");

    await page.getByRole("button", { name: "Cambiar horario" }).click();
    await dateInput.fill(dayFor(16));
    await page.getByRole("button", { name: "09:00" }).click();
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.getByRole("button", { name: "Cambiar horario" }).click();
    await expect(page.getByRole("heading", { name: /Reserva sin telefono/ })).toBeVisible();

    await page.getByRole("button", { name: "Cancelar reserva" }).click();
    await page.getByRole("dialog", { name: "Cancelar reserva" }).getByRole("button", { name: "Cancelar reserva" }).click();
    await expect(page.getByText("La reserva quedó cancelada.")).toBeVisible();
  } finally {
    await db.$disconnect();
  }
});

test("el modo dinamico ofrece el final real del turno y recalcula al cancelar", async ({ page }) => {
  await loginAs(page, "e2e-b");
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await expect(page.getByLabel(/Tipo de calendario de reservas/)).toHaveValue("fixed");
  await page.getByLabel(/Tipo de calendario de reservas/).selectOption("dynamic");
  await page.getByLabel("Intervalo entre horas (minutos)").fill("30");
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(page.getByText("Ajustes guardados.")).toBeVisible();

  const future = new Date(Date.now() + 12 * 86_400_000);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).format(future);
  const startsAt = (time: string) => new Date(`${day}T${time}:00-03:00`).toISOString();
  const reserve = (serviceId: string, time: string, key: string, manageToken: string) => page.request.post("/api/e2e-b/bookings", {
    headers: { "Idempotency-Key": key },
    data: { serviceId, staffId: "e2e-staff-b", startsAt: startsAt(time), name: "Cliente agenda dinámica", phone: "099123456", manageToken },
  });

  const firstToken = crypto.randomUUID() + crypto.randomUUID();
  const first = await reserve("e2e-service-b", "10:30", `dynamic-first-${crypto.randomUUID()}`, firstToken);
  const firstBody = await first.json();
  expect(first.status(), JSON.stringify(firstBody)).toBe(200);
  const secondToken = crypto.randomUUID() + crypto.randomUUID();
  const second = await reserve("e2e-service-dynamic", "11:00", `dynamic-second-${crypto.randomUUID()}`, secondToken);
  const secondBody = await second.json();
  expect(second.status(), JSON.stringify(secondBody)).toBe(200);

  const availabilityPath = "/api/e2e-b/availability?serviceId=e2e-service-dynamic&staffId=e2e-staff-b&date=";
  const dynamicSlotsResponse = await page.request.get(availabilityPath + day);
  expect(dynamicSlotsResponse.status()).toBe(200);
  const dynamicTimes = (await dynamicSlotsResponse.json()).slots.map((slot: { time: string }) => slot.time);
  expect(dynamicTimes).toContain("11:45");

  const thirdToken = crypto.randomUUID() + crypto.randomUUID();
  const third = await reserve("e2e-service-dynamic", "12:30", `dynamic-third-${crypto.randomUUID()}`, thirdToken);
  const thirdBody = await third.json();
  expect(third.status(), JSON.stringify(thirdBody)).toBe(200);
  const rescheduled = await page.request.post("/api/e2e-b/manage", {
    data: { code: thirdBody.code, manageToken: thirdBody.manageToken, action: "reschedule", startsAt: startsAt("11:45") },
  });
  expect(rescheduled.status(), await rescheduled.text()).toBe(200);

  const cancelledSecond = await page.request.post("/api/e2e-b/manage", {
    data: { code: secondBody.code, manageToken: secondBody.manageToken, action: "cancel" },
  });
  expect(cancelledSecond.status()).toBe(200);
  const refreshedDynamic = await (await page.request.get(availabilityPath + day)).json();
  const refreshedTimes = refreshedDynamic.slots.map((slot: { time: string }) => slot.time);
  expect(refreshedTimes).toContain("11:00");
  expect(refreshedTimes).not.toContain("11:45");

  for (const booking of [firstBody, thirdBody]) {
    const cancelled = await page.request.post("/api/e2e-b/manage", {
      data: { code: booking.code, manageToken: booking.manageToken, action: "cancel" },
    });
    expect(cancelled.status()).toBe(200);
  }
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await page.getByLabel(/Tipo de calendario de reservas/).selectOption("fixed");
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(page.getByText("Ajustes guardados.")).toBeVisible();
  const fixedSlotsResponse = await page.request.get(availabilityPath + day);
  const fixedTimes = (await fixedSlotsResponse.json()).slots.map((slot: { time: string }) => slot.time);
  expect(fixedTimes).toContain("11:00");
  expect(fixedTimes).not.toContain("11:45");
});
