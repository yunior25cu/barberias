import type { Prisma } from "@prisma/client";

/** Serializes occupancy mutations across all app instances using Azure SQL's
 * transaction-scoped application lock. Call only from inside a transaction. */
export async function lockOccupancy(tx: Prisma.TransactionClient): Promise<void> {
  const rows = await tx.$queryRaw<{ result: number }[]>`
    DECLARE @result int;
    EXEC @result = sys.sp_getapplock
      @Resource = N'AlCorte:Occupancy',
      @LockMode = 'Exclusive',
      @LockOwner = 'Transaction',
      @LockTimeout = 15000;
    SELECT @result AS result;
  `;
  if (!rows.length || rows[0].result < 0) throw new Error("OCCUPANCY_LOCK_FAILED");
}
