const baseUrl = (process.env.PRODUCTION_BASE_URL ?? "https://gentle-sky-060525010.4.azurestaticapps.net").replace(/\/$/, "");
const checks = [
  {
    path: "/api/health",
    validate: body => body?.status === "ok" && body?.database === "ok",
    label: "health/database",
  },
  {
    path: "/api/services",
    validate: body => Array.isArray(body?.services),
    label: "public service catalog",
  },
  {
    path: "/alcorte/reservar",
    accept: "text/html",
    validate: body => typeof body === "string" && body.includes("<html") && !body.includes("__next_error__"),
    label: "business booking SSR",
  },
  {
    path: "/alcorte/admin",
    accept: "text/html",
    validate: body => typeof body === "string" && body.includes("<html") && !body.includes("__next_error__"),
    label: "business admin SSR",
  },
];

async function check(checkSpec) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${baseUrl}${checkSpec.path}`, {
      headers: { accept: checkSpec.accept ?? "application/json" },
      signal: controller.signal,
    });
    const body = checkSpec.accept === "text/html"
      ? await response.text().catch(() => "")
      : await response.json().catch(() => null);
    if (!response.ok || !checkSpec.validate(body)) {
      throw new Error(`${checkSpec.label}: HTTP ${response.status}; response did not meet the health contract`);
    }
    console.log(`${checkSpec.label}: PASS (HTTP ${response.status})`);
  } finally {
    clearTimeout(timeout);
  }
}

let lastError;
for (let attempt = 1; attempt <= 6; attempt += 1) {
  try {
    for (const item of checks) await check(item);
    console.log("POST_DEPLOY_SMOKE=PASS");
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(`Smoke attempt ${attempt}/6 failed: ${error instanceof Error ? error.message : String(error)}`);
    if (attempt < 6) await new Promise(resolve => setTimeout(resolve, 10_000));
  }
}

console.error("POST_DEPLOY_SMOKE=NOT PASS");
console.error(lastError instanceof Error ? lastError.message : String(lastError));
process.exit(1);
