/**
 * Regenerates supabase/seed.sql from lib/benchmark/benchmark.config.ts.
 *   npm run seed:generate
 * tests/seed.test.ts fails when the committed file differs from this output.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderSeedSql } from "../lib/benchmark/seed";

const out = fileURLToPath(new URL("../supabase/seed.sql", import.meta.url));
writeFileSync(out, renderSeedSql());
console.log(`wrote ${out}`);
