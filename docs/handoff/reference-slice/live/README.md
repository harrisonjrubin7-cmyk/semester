# Uploaded "live" stack (6 Oct 2026)

These files are kept exactly as uploaded, with `.txt` suffixes, as a third reference alongside `../` (v1) and `../v2/`.
- **`001_persistence.sql`** creates its own schemas (`semester_live`, `semester_live_private`).
- **The server code** is Express + pg (`server.ts`, `db.ts`, `documentService.ts`, `webhooks.ts`).
- **The state machine** is a pure function in `transition.js`, with node:test coverage in `transition.test.js`.

**Do not run this stack next to `semester-platform` (migrations 010–240).** It is a third model of the same document workflow. If you build from `semester-platform`:
- **Keep `transition.js` and its tests.** They are the clearest statement of the transition rules. Port them as a unit test of the same rules that `api.transition_document` (180) enforces in SQL, and treat any disagreement as a bug.
- **Its webhook retry logic** matches `workers/webhook-delivery.ts`. Its storage should be `opsx.webhook_deliveries` (220), not `semester_live`.
- **Its pg pool is privileged.** As its own header says, every public operation must authorize the actor itself. The Supabase path in this design system instead uses the user's JWT plus `api.*` security-definer functions.

**`module_registry.json`** lists 32 modules. Checking them against `handoff/registry/capabilities.json` turned up three gaps, now added:
- Family/guardian access (`edu.family`)
- Campus housing (`edu.housing`, `inst.housing`, migration 240)
- Webhook dead letters (`ops.dead_letters`)

Every other module maps to existing capabilities.
