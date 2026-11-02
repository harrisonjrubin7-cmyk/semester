# How to use this context

Semester is one native education platform and SaaS company, not a student dashboard with unrelated tools attached.
The founder (Harrison Rubin) supplied these documents on 22 Oct 2026; the originals are attached in the **Source Register** table.

## Files
- `01-semester-complete-context.md`: the governing brief. Read it first for any product, company or design decision.
- `02-logical-schema.md`, `03-api-contracts.md`: proposed contracts. They describe the target, not what exists.
- `04-student-app-prompts.md`, `05-implementation-blueprint.md`: build order and prompts.
- `06-system-design.md`: tenancy, authorization decision, billing, API middleware, data flows and deployment gates.
- `semester.md`: the founder's own summary of scope (written in the editor).
- `/docs/execution/*` (repo root): the living state: what exists, what was verified, conflicts, launch gates.

## Precedence
1. The founder's current instructions in the conversation.
2. Safety and claim rules (below), which win over any convenience.
3. `docs/execution/conflicts-and-decisions.md` for resolved conflicts.
4. The brief (01), then the proposals (02–05).
5. Semester Books 1–3 (summarised in the Semester Book reader artifact) for background.

## Rules that always apply
- **AI:** student records never go to an external model provider. Only public catalog text may be sent (enforced in `apps/semester/src/lib/aiGate.ts`, tested).
- **Claims:** publish no price, customer name, outcome, certification or compliance claim without an approved source. Planning prices in the books are assumptions, not quotes.
- **Status words:** not_started, specified, implemented_unverified, verified_in_test, pilot_enabled, production_operated. A page existing is not "done".
- **Authority:** the institution's SIS stays authoritative during the pilot. A request sent from Semester is a request, not a registration.
- **Tenancy:** every list and decision is scoped to the caller's institution (`tenantScope()` in `apps/semester/src/lib/server.ts`). Company staff get no blanket student-record access.
- **Approvals:** no production publish, outbound communication, live data change, money movement or permission change without the founder's explicit approval.
