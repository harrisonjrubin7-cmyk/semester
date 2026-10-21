import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_NOT_CONFIGURED");
    pool = new Pool({ connectionString, max: 10 });
  }
  return pool;
}
