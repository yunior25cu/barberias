import { cp, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");
await stat(standalone);

const prismaEngineName = "libquery_engine-debian-openssl-3.0.x.so.node";
const generatedPrismaEngine = join(root, "node_modules", ".prisma", "client", prismaEngineName);
const standalonePrismaClient = join(standalone, "node_modules", ".prisma", "client");
await stat(generatedPrismaEngine).catch(() => {
  throw new Error(`Prisma engine ${prismaEngineName} is missing. Regenerate Prisma Client with its Azure Static Web Apps runtime target.`);
});
await mkdir(standalonePrismaClient, { recursive: true });
await cp(generatedPrismaEngine, join(standalonePrismaClient, prismaEngineName), { force: true });

const staticSource = join(root, ".next", "static");
const staticTarget = join(standalone, ".next", "static");
await mkdir(staticTarget, { recursive: true });
await cp(staticSource, staticTarget, { recursive: true, force: true });

const publicSource = join(root, "public");
try {
  await stat(publicSource);
  await cp(publicSource, join(standalone, "public"), { recursive: true, force: true });
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

console.log("Standalone Next.js runtime assets assembled.");
