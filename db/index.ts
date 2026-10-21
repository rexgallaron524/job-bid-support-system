import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const globalDb = globalThis as unknown as { jobSupportPool?: pg.Pool };
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Follow README.md to configure PostgreSQL.");
  if (!globalDb.jobSupportPool) {
    globalDb.jobSupportPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
    globalDb.jobSupportPool.on("error", () => console.error("An idle PostgreSQL connection closed."));
  }
  return globalDb.jobSupportPool;
}
export function getDb() { return drizzle(getPool(), { schema }); }
