import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { lockOccupancy } from "@/lib/sql-lock";
import { requireBusinessId, type BusinessContext } from "@/lib/business";

const modelNames = [
  "adminUser", "settings", "service", "staff", "staffService", "businessHours", "booking", "timeBlock", "occupancy",
] as const;
type ModelName = typeof modelNames[number];
type ScopedDelegates = { [Model in ModelName]: PrismaClient[Model] };
export type TenantTransactionRepository = ScopedDelegates & { lockOccupancy(): Promise<void> };
type TransactionOptions = { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel };
export type TenantRepository = ScopedDelegates & {
  $transaction<T>(work: (tx: TenantTransactionRepository) => Promise<T>, options?: TransactionOptions): Promise<T>;
};

const whereOperations = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy",
  "update", "updateMany", "delete", "deleteMany",
]);
function scopedWhere(where: Record<string, unknown> | undefined, businessId: string) {
  if (where?.businessId && where.businessId !== businessId) throw new Error("TENANT_SCOPE_MISMATCH");
  return { ...where, businessId };
}
function scopedData(data: unknown, businessId: string): unknown {
  if (Array.isArray(data)) return data.map(item => scopedData(item, businessId));
  if (!data || typeof data !== "object") return data;
  const row = data as Record<string, unknown>;
  if (row.businessId && row.businessId !== businessId) throw new Error("TENANT_SCOPE_MISMATCH");
  return { ...row, businessId };
}
function scopedArgs(operation: string, args: Record<string, unknown> | undefined, businessId: string) {
  const next = { ...(args ?? {}) };
  if (whereOperations.has(operation)) next.where = scopedWhere(next.where as Record<string, unknown> | undefined, businessId);
  if (operation === "create" || operation === "createMany" || operation === "createManyAndReturn") next.data = scopedData(next.data, businessId);
  if (operation === "upsert") {
    next.where = scopedWhere(next.where as Record<string, unknown> | undefined, businessId);
    next.create = scopedData(next.create, businessId);
    if ((next.update as Record<string, unknown> | undefined)?.businessId) throw new Error("TENANT_SCOPE_IMMUTABLE");
  }
  if ((operation === "update" || operation === "updateMany") && (next.data as Record<string, unknown> | undefined)?.businessId) {
    throw new Error("TENANT_SCOPE_IMMUTABLE");
  }
  return next;
}

function repositoryFor(source: PrismaClient | Prisma.TransactionClient, businessId: string, transactional: boolean): TenantTransactionRepository | TenantRepository {
  const raw = source as unknown as Record<string, unknown>;
  const proxy = new Proxy({}, {
    get(_target, property) {
      if (property === "businessId") return businessId;
      if (property === "lockOccupancy") {
        if (!transactional) throw new Error("OCCUPANCY_LOCK_REQUIRES_TRANSACTION");
        return () => lockOccupancy(source as Prisma.TransactionClient, businessId);
      }
      if (property === "$transaction") {
        if (transactional) throw new Error("NESTED_TENANT_TRANSACTION_NOT_ALLOWED");
        return <T>(work: (tx: TenantTransactionRepository) => Promise<T>, options?: TransactionOptions) => {
          const root = source as PrismaClient;
          return root.$transaction(
            tx => work(repositoryFor(tx, businessId, true) as TenantTransactionRepository),
            options,
          );
        };
      }
      if (typeof property !== "string" || !modelNames.includes(property as ModelName)) return undefined;
      const delegate = raw[property] as Record<string, unknown>;
      return new Proxy(delegate, {
        get(target, operation) {
          if (typeof operation !== "string") return undefined;
          const method = target[operation];
          if (typeof method !== "function") return method;
          return (args?: Record<string, unknown>) => {
            const next = scopedArgs(operation, args, businessId);
            return (method as (value: Record<string, unknown>) => unknown).call(target, next);
          };
        },
      });
    },
  });
  return proxy as TenantTransactionRepository | TenantRepository;
}

export function tenantRepository(business: Pick<BusinessContext, "id" | "status">): TenantRepository {
  return repositoryFor(db, requireBusinessId(business), false) as TenantRepository;
}

