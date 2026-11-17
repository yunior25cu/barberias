import { PrismaClient } from "@prisma/client";

const configured = process.env.DATABASE_URL ?? "";
if (!/^sqlserver:\/\/(localhost|127\.0\.0\.1)(:\d+)?;database=barber_local;/i.test(configured)) {
  throw new Error("Refusing to create a database: DATABASE_URL must target local SQL Server barber_local.");
}
const masterUrl = configured.replace("database=barber_local", "database=master");
const db = new PrismaClient({ datasources: { db: { url: masterUrl } } });
try {
  const rows = await db.$queryRaw`SELECT DB_ID(N'barber_local') AS [databaseId]`;
  if (rows[0].databaseId == null) {
    await db.$executeRawUnsafe("CREATE DATABASE [barber_local]");
    console.log("Created local SQL Server database barber_local.");
  } else {
    console.log("Local SQL Server database barber_local already exists; leaving its contents intact.");
  }
} finally {
  await db.$disconnect();
}
