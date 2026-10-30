import { z } from "zod";

// PostgreSQL accepts UUIDs regardless of RFC version/variant bits. Zod 3's
// uuid() matched that behavior; Zod 4 intentionally validates RFC variants.
// Keep the API contract aligned with the database while still rejecting any
// value that is not the canonical 8-4-4-4-12 hexadecimal UUID shape.
export const databaseUuid = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  "Invalid UUID",
);
