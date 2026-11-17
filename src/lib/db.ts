import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  if (env.AZURE_SQL_AUTH_MODE === "sql") return new PrismaClient();
  const authentication = env.AZURE_SQL_AUTH_MODE === "managed-identity"
    ? { type: "azure-active-directory-msi-app-service" as const, options: env.AZURE_SQL_CLIENT_ID ? { clientId: env.AZURE_SQL_CLIENT_ID } : {} }
    : {
        type: "azure-active-directory-service-principal-secret" as const,
        options: { clientId: env.AZURE_SQL_CLIENT_ID!, clientSecret: env.AZURE_SQL_CLIENT_SECRET!, tenantId: env.AZURE_SQL_TENANT_ID! },
      };
  const adapter = new PrismaMssql({
    server: env.AZURE_SQL_SERVER!,
    port: 1433,
    database: env.AZURE_SQL_DATABASE!,
    authentication,
    options: { encrypt: true, trustServerCertificate: false },
    connectionTimeout: 60000,
    requestTimeout: 60000,
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
