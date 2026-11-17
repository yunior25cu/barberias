import { createHash } from "node:crypto";
import { db } from "@/lib/db";

export async function limited(request: Request, bucket: string, max: number, windowMs: number): Promise<boolean | null> {
  const forwarded = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown";
  const key = `${bucket}:${createHash("sha256").update(forwarded).digest("hex")}`;
  const now = new Date();
  const reset = new Date(now.getTime() + windowMs);
  try {
    const hits = await db.$transaction(async tx => {
      const lock = await tx.$queryRaw<{ result: number }[]> `
        DECLARE @result int;
        EXEC @result = sys.sp_getapplock @Resource = ${`AlCorte:Rate:${key}`},
          @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 5000;
        SELECT @result AS result;
      `;
      if (!lock.length || lock[0].result < 0) throw new Error("RATE_LIMIT_LOCK_FAILED");
      const existing = await tx.rateLimit.findUnique({ where: { key } });
      if (!existing) {
        await tx.rateLimit.create({ data: { key, hits: 1, resetAt: reset } });
        return 1;
      }
      const expired = existing.resetAt < now;
      const nextHits = expired ? 1 : existing.hits + 1;
      await tx.rateLimit.update({ where: { key }, data: { hits: nextHits, resetAt: expired ? reset : existing.resetAt } });
      return nextHits;
    });
    if (Math.random() < 0.01) await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - 86400_000) } } });
    return hits > max;
  } catch {
    return null;
  }
}

export async function limitedForBusiness(
  request: Request, businessId: string, bucket: string, max: number, windowMs: number, globalMax = Math.max(max * 4, 32),
): Promise<boolean | null> {
  const global = await limited(request, `global:${bucket}`, globalMax, windowMs);
  if (global !== false) return global;
  return limited(request, `tenant:${businessId}:${bucket}`, max, windowMs);
}
