import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  out: "./packages/db/drizzle",
  schema: "./packages/db/src/schema.ts",
});
