import { z } from "zod";
const sqlConnection = /^sqlserver:\/\/[a-z0-9.-]+(?::\d+)?;database=[^;]+;(?:user=[^;]+;password=.+|integratedSecurity=true|encrypt=true)(?:;.*)?$/i;
const envSchema = z.object({
  DATABASE_URL: z.string().regex(sqlConnection, "DATABASE_URL must be a SQL Server connection string.").optional(),
  AZURE_SQL_AUTH_MODE: z.enum(["sql", "managed-identity", "service-principal"]).default("sql"),
  AZURE_SQL_SERVER: z.string().optional(),
  AZURE_SQL_DATABASE: z.string().optional(),
  AZURE_SQL_CLIENT_ID: z.string().optional(),
  AZURE_SQL_CLIENT_SECRET: z.string().optional(),
  AZURE_SQL_TENANT_ID: z.string().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
}).superRefine((value, context) => {
  if (value.AZURE_SQL_AUTH_MODE !== "sql" && (!value.AZURE_SQL_SERVER || !value.AZURE_SQL_DATABASE)) {
    context.addIssue({ code: "custom", path: ["AZURE_SQL_SERVER"], message: "Azure SQL authentication requires AZURE_SQL_SERVER and AZURE_SQL_DATABASE." });
  }
  if (value.AZURE_SQL_AUTH_MODE === "service-principal" && (!value.AZURE_SQL_CLIENT_ID || !value.AZURE_SQL_CLIENT_SECRET || !value.AZURE_SQL_TENANT_ID)) {
    context.addIssue({ code: "custom", path: ["AZURE_SQL_CLIENT_ID"], message: "Service-principal authentication requires its client ID, secret, and tenant ID." });
  }
});
export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AZURE_SQL_AUTH_MODE: process.env.AZURE_SQL_AUTH_MODE,
  AZURE_SQL_SERVER: process.env.AZURE_SQL_SERVER,
  AZURE_SQL_DATABASE: process.env.AZURE_SQL_DATABASE,
  AZURE_SQL_CLIENT_ID: process.env.AZURE_SQL_CLIENT_ID,
  AZURE_SQL_CLIENT_SECRET: process.env.AZURE_SQL_CLIENT_SECRET,
  AZURE_SQL_TENANT_ID: process.env.AZURE_SQL_TENANT_ID,
  SESSION_SECRET: process.env.SESSION_SECRET,
  APP_URL: process.env.APP_URL,
  NODE_ENV: process.env.NODE_ENV,
});
