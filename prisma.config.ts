import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema",
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
});
