# Architecture dashboard + code review — how it fits (13 Oct)

Filed from the upload. The dashboard (dashboard/index.html) is static metadata: 44 public/entry patterns, route contracts for 122 capabilities, component trees and per-page wireframes. No network calls, records or secrets.

## Verified here
The code review's five blob SHAs **match harrisonjrubin7-cmyk/semester main @ fb51d66** (checked 13 Oct):
capabilities.ts 7e27dd8 · permissions.ts 159465b · membership.ts 3125f2e · readiness.ts 9adb03c · registration-actions.ts 93c22ea. So the review describes the current code, not a stale copy. Its findings are source-level only — no repo tests were run.

## Findings to carry into other work
- **membership.ts is billing, not institution membership.** Don't map it to org memberships by filename (the capability register and platform shell both use "membership" for school membership — keep them pointed at `my_capabilities` / grants).
- **readiness.ts is institution-claim readiness, not the student registration checklist.** The registrar replacement and Wave 1 readiness specs should reference `registration-actions.ts` for the student side.
- **Capability discovery authorizes nothing;** server/RLS decides. Matches the platform shell's rule that nav visibility ≠ authorization.
- **Still unreviewed:** the SQL behind `my_capabilities` / `private.has_capability`, object policies, negative tenant tests, revocation at execution. The Security Assurance Manual's catalog SQL (handoff/security-assurance) is the way to fill that in.

## Deployment request — not sent
`deployment/EXACT-DEPLOYMENT-REQUEST.json` is a Vercel API body for a **new, separate** project `semester-architecture-dashboard` (noindex, CSP with `connect-src 'none'`, no build). It names team `team_v0ugbIoxEJmsnWkUWRQqt4Ys`. I haven't sent it and can't from here. If you want it live, deploy it to that separate project — never to the product project or its domain. The `reviews/*.ts` excerpts are stored as `.ts.txt` so the design bundler skips them; they're not part of the deploy.
