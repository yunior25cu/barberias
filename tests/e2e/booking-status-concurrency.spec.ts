import { expect, test } from "@playwright/test";

test("la primera acción HTTP que cierra una reserva prevalece ante una carrera completar/no asistió", async ({ page }) => {
  await page.goto("/al-corte/admin");
  const origin = new URL(page.url()).origin;
  await page.getByLabel("Usuario").fill("e2e-owner");
  await page.getByLabel("Contraseña").fill("E2E-only-password-123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible();

  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(Date.now() + 18 * 86_400_000));
  const start = new Date(`${day}T13:00:00.000Z`).toISOString();
  const create = await page.request.post("/api/al-corte/admin/bookings", {
    headers: { Origin: origin },
    data: { serviceId: "e2e-service", staffId: "e2e-staff", startsAt: start, name: "Status race", phone: "099123456" },
  });
  expect(create.status()).toBe(201);
  const booking = (await create.json()).booking as { id: string; startsAt: string };

  const actions = await Promise.all([
    page.request.patch("/api/al-corte/admin/bookings", {
      headers: { Origin: origin }, data: { id: booking.id, status: "completed" },
    }),
    page.request.patch("/api/al-corte/admin/bookings", {
      headers: { Origin: origin }, data: { id: booking.id, status: "no_show" },
    }),
  ]);
  expect(actions.map(response => response.status()).sort()).toEqual([200, 409]);

  const winningResponse = actions.find(response => response.status() === 200)!;
  const winner = await winningResponse.json() as { status: string };
  expect(["completed", "no_show"]).toContain(winner.status);
  const dayStart = new Date(`${day}T03:00:00.000Z`).toISOString();
  const dayEnd = new Date(Date.parse(dayStart) + 86_400_000).toISOString();
  const agenda = await page.request.get(`/api/al-corte/admin/bookings?from=${encodeURIComponent(dayStart)}&to=${encodeURIComponent(dayEnd)}`);
  expect(agenda.status()).toBe(200);
  const persisted = (await agenda.json()).bookings.find((item: { id: string }) => item.id === booking.id);
  expect(persisted?.status).toBe(winner.status);
});
