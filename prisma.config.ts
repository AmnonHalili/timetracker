// Prisma configuration for Neon database
// Note: For Neon with connection pooling, use DIRECT_URL for migrations
// and pass DATABASE_URL to PrismaClient at runtime
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use DIRECT_URL for migrations (non-pooled connection)
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
