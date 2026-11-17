import type { Prisma } from "@prisma/client";

/** Serializes occupancy writes for one business; call inside its SQL transaction. */
export async function lockOccupancy(tx: Prisma.TransactionClient, businessId: string): Promise<void> {
  if (!businessId) throw new Error("ACTIVE_BUSINESS_CONTEXT_REQUIRED");
  const resource = `AlCorte:Occupancy:${businessId}`;
  const rows = await tx.$queryRaw<{ result: number }[]> `
    DECLARE @result int;
    EXEC @result = sys.sp_getapplock
      @Resource = ${resource},
      @LockMode = 'Exclusive',
      @LockOwner = 'Transaction',
      @LockTimeout = 15000;
    SELECT @result AS result;
  `;
  if (!rows.length || rows[0].result < 0) throw new Error("OCCUPANCY_LOCK_FAILED");
}
