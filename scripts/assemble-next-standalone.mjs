import { cp, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");
await stat(standalone);
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
