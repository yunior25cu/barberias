import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
test("reserva completa desde viewport móvil sin crear una cuenta",async({page})=>{
  await page.goto("/al-corte/reservar");await expect(page.getByRole("heading",{name:"¿Qué te gustaría hacerte?"})).toBeVisible();
  await page.getByRole("button",{name:/Corte de prueba E2E/}).click();await expect(page.getByRole("button",{name:"Cualquier profesional disponible"})).toBeVisible();await page.getByRole("button",{name:"Profesional E2E B"}).click();await page.getByRole("button",{name:/Elegir día y hora/}).click();
  const date=new Date(Date.now()+7*86400_000);const day=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Montevideo",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
  await page.getByLabel("Elegí un día").fill(day);await page.getByRole("button",{name:"09:00"}).click();await page.getByRole("button",{name:/Continuar/}).click();
  await page.getByLabel("Tu nombre").fill("Ana Prueba");await page.getByLabel("Teléfono").fill("099 123 456");await page.getByRole("button",{name:"Confirmar reserva"}).click();
  await expect(page.getByRole("heading",{name:"¡Pronto nos vemos, Ana Prueba!"})).toBeVisible();await expect(page.getByText(/Código:/)).toBeVisible();
  await page.getByRole("button",{name:"Cambiar horario"}).click();const later=new Date(Date.now()+8*86400_000);const laterDay=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Montevideo",year:"numeric",month:"2-digit",day:"2-digit"}).format(later);await page.getByLabel("Elegí un día").fill(laterDay);await page.getByRole("button",{name:"09:00"}).click();await page.getByRole("button",{name:/Continuar/}).click();await page.getByRole("button",{name:"Cambiar horario"}).click();await expect(page.getByRole("heading",{name:"¡Pronto nos vemos, Ana Prueba!"})).toBeVisible();
  page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Cancelar reserva"}).click();await expect(page.getByText("La reserva quedó cancelada.")).toBeVisible();
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
  expect(namesB).toEqual(["Servicio solo B"]);

  await page.goto("/al-corte/admin");
  await page.getByLabel("Usuario").fill("e2e-owner");
  await page.getByLabel("Contraseña").fill("E2E-only-password-123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Agenda del día" })).toBeVisible();
  expect((await page.request.get("/api/al-corte/admin/services")).status()).toBe(200);
  expect((await page.request.get("/api/e2e-b/admin/services")).status()).toBe(401);

  const invalidRelation = await page.request.post("/api/al-corte/admin/staff", {
    headers: { Origin: new URL(page.url()).origin },
    data: { name: "No debe crearse", serviceIds: ["e2e-service-b"] },
  });
  expect(invalidRelation.status()).toBe(422);

  const crossTenantToken = await page.request.post("/api/e2e-b/manage", {
    data: { code: "222222", manageToken: "e2e-manage-token-for-business-a", action: "cancel" },
  });
  expect(crossTenantToken.status()).toBe(404);

  await page.goto("/e2e-b/admin");
  await page.getByLabel("Usuario").fill("e2e-owner");
  await page.getByLabel("Contraseña").fill("E2E-only-password-123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Agenda del día" })).toBeVisible();
  expect((await page.request.get("/api/e2e-b/admin/services")).status()).toBe(200);
  expect((await page.request.get("/api/al-corte/admin/services")).status()).toBe(401);
  const adminB = await page.request.get("/api/e2e-b/admin/services");
  expect((await adminB.json()).services.map((service: { name: string }) => service.name)).toContain("Servicio solo B");
});
test("el panel protege el acceso y permite mantener servicios y equipo",async({page})=>{
  const unauthorized=await page.request.get("/api/al-corte/admin/services");expect(unauthorized.status()).toBe(401);
  await page.goto("/al-corte/admin");await page.getByLabel("Usuario").fill("e2e-owner");await page.getByLabel("Contraseña").fill("E2E-only-password-123!");await page.getByRole("button",{name:"Entrar"}).click();
  await expect(page.getByRole("heading",{name:"Agenda del día"})).toBeVisible();await page.getByRole("button",{name:"Servicios y equipo"}).click();
  const serviceForm=page.locator("form").filter({has:page.getByRole("heading",{name:"Agregar servicio"})});await serviceForm.getByLabel("Nombre").fill("Servicio prueba admin");await serviceForm.getByLabel("Duración (minutos)").fill("45");await serviceForm.getByRole("button",{name:"Guardar servicio"}).click();await expect(page.getByText("Servicio prueba admin").first()).toBeVisible();
  const staffForm=page.locator("form").filter({has:page.getByRole("heading",{name:"Agregar profesional"})});await staffForm.getByLabel("Nombre").fill("Profesional prueba admin");await staffForm.getByLabel("Servicio prueba admin").check();await staffForm.getByRole("button",{name:"Agregar al equipo"}).click();await expect(page.getByText("Profesional prueba admin").first()).toBeVisible();
  const future=new Date(Date.now()+8*86400_000);let day=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Montevideo",year:"numeric",month:"2-digit",day:"2-digit"}).format(future);while(new Date(`${day}T12:00:00Z`).getUTCDay()!==1)day=new Date(new Date(`${day}T12:00:00Z`).getTime()+86400_000).toISOString().slice(0,10);
  await page.getByRole("button",{name:"Horarios"}).click();await page.getByLabel("Profesional").selectOption({label:"Profesional prueba admin"});await page.getByLabel("Cerrado").nth(1).uncheck();await page.getByLabel("Abre Lunes").fill("09:00");await page.getByLabel("Cierra Lunes").fill("18:00");await page.getByRole("button",{name:"Guardar horarios"}).click();await expect(page.getByText("Horarios guardados.")).toBeVisible();const settingsResponse=await page.request.get("/api/al-corte/admin/hours");const savedStaff=(await settingsResponse.json()).staff.find((p:{name:string})=>p.name==="Profesional prueba admin");expect(savedStaff.services.map((x:{service:{name:string}})=>x.service.name)).toContain("Servicio prueba admin");expect(savedStaff.hours).toContainEqual(expect.objectContaining({weekday:1,startMinute:540,endMinute:1080}));
  await page.getByRole("button",{name:"Bloqueos"}).click();await page.getByLabel("Profesional").selectOption({label:"Profesional prueba admin"});await page.getByLabel("Día").fill(day);await page.getByLabel("Desde").fill("12:00");await page.getByLabel("Hasta").fill("13:00");await page.getByRole("button",{name:"Bloquear horario"}).click();await expect(page.getByText(/Bloqueos activos/)).toBeVisible();
  await page.getByRole("button",{name:"Agenda"}).click();await page.getByLabel("Fecha de agenda").fill(day);await page.getByRole("button",{name:/Reserva manual/}).click();const manualForm=page.locator("form").filter({has:page.getByRole("heading",{name:"Nueva reserva"})});await manualForm.getByLabel("Servicio").selectOption({label:"Servicio prueba admin"});await manualForm.getByLabel("Profesional").selectOption({label:"Profesional prueba admin"});await manualForm.getByLabel("Día").fill(day);await manualForm.getByLabel("Hora").fill("10:00");await manualForm.getByLabel("Nombre").fill("Cliente manual");await manualForm.getByLabel("Teléfono").fill("099 222 333");
  const invalidFields=await manualForm.evaluate((form:HTMLFormElement)=>Array.from(form.querySelectorAll(":invalid")).map((element)=>{const input=element as HTMLInputElement;return {type:input.type,value:input.value,message:input.validationMessage};}));expect(invalidFields,`Manual booking form is invalid for day ${day}`).toEqual([]);
  const createResponse=page.waitForResponse((response)=>new URL(response.url()).pathname==="/api/al-corte/admin/bookings"&&response.request().method()==="POST",{timeout:10000});await manualForm.getByRole("button",{name:"Guardar reserva"}).click();const manualResponse=await createResponse;const manualResult=await manualResponse.json();expect(manualResponse.status(),`Manual booking API failed for ${day}: ${manualResult.error??"unknown"}`).toBe(201);await expect(page.getByText("Cliente manual")).toBeVisible();
  await page.getByRole("button",{name:"Mover / reasignar"}).click();await page.getByLabel("Hora",{exact:true}).fill("11:00");await page.getByRole("button",{name:"Guardar cambio"}).click();await expect(page.getByText("11:00")).toBeVisible();
});

test("las reservas HTTP concurrentes no permiten colisiones entre cliente y administración ni entre reprogramaciones", async ({ page }) => {
  await page.goto("/al-corte/admin");
  await page.getByLabel("Usuario").fill("e2e-owner");
  await page.getByLabel("Contraseña").fill("E2E-only-password-123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Agenda del día" })).toBeVisible();

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
    await page.goto("/al-corte/admin");
    await page.locator("#user").fill("e2e-owner");
    await page.locator("#password").fill("E2E-only-password-123!");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect.poll(async () => (await page.request.get("/api/al-corte/admin/services")).status()).toBe(200);

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
