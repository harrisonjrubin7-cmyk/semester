# Stream 12 · One place: nobody leaves Semester

Make every job in `ui_kits/one-place/one-place-data.js` doable inside Semester. Paste into Claude Code (or Codex) at the repo root after streams 00–08.

## Inputs from the design project
- `ui_kits/one-place/` (job map: designed / to build / embedded)
- `ui_kits/ops/` (company consoles)
- `ui_kits/student/` (Write, Sheets, Decks, Mail, Calendar)

## Tasks
1. For each "to build" row, build the module (Meet, team spaces, contracts with in-app signing, career portfolio) using existing shells and components.
2. For each "embedded" row, build the in-app hand-off: provider screen inside Semester (processor checkout, payroll status, e-sign, IdP sign-in), status written back to Semester, audit event on each step. No regulated step is re-implemented.
3. Run the company inside /ops: CRM, support, incidents, social, finance, people, compliance, product ops, board reports. Semester staff use Semester for docs, sheets, decks, mail and calendar.
4. Add an "open in Semester" check to the release checklist: any new feature that sends users to another app needs an embedded path or a written exception.

## Exit gates
- [ ] Every row in one-place-data.js is designed, built, or embedded with a working in-app path
- [ ] Company operating cadence (weekly metrics, monthly close, QBRs) runs from /ops
- [ ] No student data in company modules (isolation test passes)

Follow the shared rules in any other stream file (branch `semester/one-place`, PR + report, stop for review).
