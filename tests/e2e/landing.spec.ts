import { expect, test } from "@playwright/test";

test("la landing se sirve desde la raíz sin API ni conexión a SQL", { tag: "@static" }, async ({ page }, testInfo) => {
  const apiRequests: string[] = [];
  await page.route("**/api/**", async route => {
    apiRequests.push(route.request().url());
    await route.abort();
  });

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle("Reserva | Reservas online para peluquerías y barberías");
  await expect(page.getByRole("heading", { level: 1, name: "Tu agenda ordenada. Tus clientes reservan online." })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://reservas.balaxys.com");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Reserva | Reservas online para peluquerías y barberías");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://reservas.balaxys.com/marketing/og.svg");
  await expect(page.getByRole("link", { name: /Solicitar una demo/ }).first()).toHaveAttribute("href", "#contacto");
  await expect(page.locator("#contacto").getByRole("link", { name: "Solicitar una demo" })).toHaveAttribute("href", /^https:\/\/wa\.me\/59894448249\?text=/);
  await expect(page.locator("#contacto").getByRole("link", { name: "Solicitar una demo" })).toHaveAttribute("target", "_blank");
  expect(decodeURIComponent(new URL(await page.locator("#contacto a").getAttribute("href") ?? "").searchParams.get("text") ?? "")).toContain("Hola, quiero conocer Reserva para mi peluquería o barbería.");
  await expect(page.getByText("Ilustración · datos de ejemplo")).toBeVisible();
  expect(apiRequests).toEqual([]);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  await page.screenshot({ path: testInfo.outputPath("landing-desktop.png"), fullPage: true });
  expect(apiRequests).toEqual([]);
});

test("navegación móvil, FAQ accesible y layout sin overflow a 320px", { tag: "@static" }, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: testInfo.outputPath("landing-mobile-320.png"), fullPage: true });

  const menu = page.getByRole("button", { name: "Abrir menú" });
  await menu.click();
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar menú" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("navigation").getByRole("link", { name: "Funciones" }).click();
  await expect(page).toHaveURL(/#funciones$/);
  await expect(page.getByRole("button", { name: "Abrir menú" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { name: "La agenda de tu local, en un solo lugar." })).toBeInViewport();

  const faq = page.locator("#preguntas details").first();
  const summary = faq.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(faq).toHaveAttribute("open", "");
  await expect(faq.getByText("Pueden reservar directamente desde el navegador de su celular, sin instalar nada ni crear una cuenta.")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("landing-mobile-390.png"), fullPage: true });
});

test("el acceso acepta un slug de negocio y no admite una URL externa", async ({ page }) => {
  await page.goto("/#acceso");
  const identifier = page.getByLabel("Identificador del negocio");
  await identifier.fill("https://evil.example/path");
  await page.getByRole("button", { name: "Ir a mi panel" }).click();
  await expect(page).toHaveURL(/#acceso$/);

  await identifier.fill("E2E-B");
  await page.getByRole("button", { name: "Ir a mi panel" }).click();
  await expect(page).toHaveURL(/\/e2e-b\/admin$/);
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
});

test("el catálogo público por slug y el panel legacy conservan su destino", async ({ page }) => {
  const booking = await page.request.get("/al-corte/reservar");
  expect(booking.status()).toBe(200);
  const adminAlias = await page.request.get("/admin", { maxRedirects: 0 });
  expect(adminAlias.status()).toBe(307);
  expect(adminAlias.headers().location).toBe("/al-corte/admin");
});
