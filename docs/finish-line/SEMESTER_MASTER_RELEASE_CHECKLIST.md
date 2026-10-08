# Semester master release checklist

| | |
| --- | --- |
| **Version** | 0.1 |
| **As of** | 2026-10-05 |
| **Owner** | Harrison Rubin |

Use one copy per release or claim, in the pull request description or in
`docs/evidence/releases/<date>-<name>.md`. A box is ticked only with a link or a
path beside it. An unticked box is a stated gap, not a failure to report.

**A release may be marked `pilot-ready`, `production-ready` or `authoritative`
in [the register](SEMESTER_RELEASE_READINESS_REGISTER.md) only when every box in
Sections 1–10 that applies is ticked with evidence.** `not applicable` is
written out with its reason.

Replace **Release record** values below with the release's own.

## Release record

- Register row id(s):
- Target state: `preview` / `pilot-ready` / `production-ready` / `authoritative`
- Candidate commit (full hash):
- Owner and backup:
- Review date:

## 1. Definition of done

- [ ] Code merged to `main` at the candidate commit.
- [ ] A test exists and has been **seen to fail** without the change (revert, red, restore).
- [ ] A control case proves the probe can fail (a broken probe also reads clean).
- [ ] Owner and backup named; neither `UNASSIGNED`.
- [ ] Operational support route named (Section 7).

## 2. Gates, run from `app/`

- [ ] `npx tsc -b`
- [ ] `npm run lint`
- [ ] `npm run check:university`
- [ ] `npm test`
- [ ] `npm run test:shuffle` (a green shuffle is weak evidence about teardown races; `src/rootunmount.test.ts` is the guard)
- [ ] `npm run build`
- [ ] SQL check suites (`supabase/check.sh`) for any migration change
- [ ] Hosted CI green on the **exact** candidate commit
- [ ] Screenshot of the changed screen, driven in a browser (`.claude/skills/run`); a dark rectangle is a launch failure

## 3. Security and tenancy

- [ ] Tenant scope stated; cross-tenant denial test covers every new table
- [ ] Every new `SECURITY DEFINER` function has `search_path` set, a scope check in its body, grants revoked from `anon`/`public`, and a row in `docs/DEFINER-RLS-REGISTER.md`
- [ ] No new table is exposed through PostgREST or GraphQL without an intentional classification
- [ ] Secrets scan clean; no browser-held credential added
- [ ] Sensitive actions write to the audit trail; high-risk actions require approval
- [ ] Permission is enforced on the server; browser state is not the authority
- [ ] Threat note or finding ids recorded; no known open critical
- [ ] No control was removed or weakened to pass a test

## 4. Data, privacy and retention

- [ ] Data classification (T0–T3) per table and field; `database/schema/table-classification.json` updated
- [ ] Retention rule, hold behaviour, export and erasure covered; `RETENTION.md` updated
- [ ] Consent and purpose recorded where personal data is processed
- [ ] Source authority label chosen: official, derived, AI-generated, student-owned, external, community
- [ ] Freshness and "unavailable" states defined for any institutional data

## 5. Accessibility and product coherence

- [ ] Uses accessible primitives; axe and keyboard checks pass on the new screens
- [ ] Target size, contrast and reflow at 320 px checked
- [ ] Error, empty and loading states present; mobile and desktop behaviour defined
- [ ] Manual assistive-technology pass recorded for any new pilot-path screen
- [ ] Connects to Today / Action Center, search, support and policy; no new duplicate profile, task, notification or AI history
- [ ] Source label and "report incorrect information" present on institution data

## 6. AI (if applicable)

- [ ] Use case and data class recorded; ceiling test (`aiclass`/`claudeclass`) green
- [ ] Tool permission matrix updated and tested both ways
- [ ] Prompt registered; deterministic harness green; live run filed if a model or prompt builder changed
- [ ] Route reached by the kill switch and the school AI-off policy
- [ ] Transparency text reviewed; human escalation defined; correction route defined
- [ ] Cost impact stated; rollback or deprecation named

## 7. Operations and support

- [ ] Monitor and SLO named for the critical path; an induced failure reaches a person
- [ ] Runbook exists; backup responder can use it
- [ ] Support path and macros updated; severity defined
- [ ] Feature flag default off; tenant rollout state set; kill switch exercised
- [ ] Rollback written and, for a risky change, exercised; migration is additive or has a reverse
- [ ] Status and customer notice templates ready

## 8. Evidence and claims

- [ ] Release evidence filed under `docs/evidence/` with its own date, scope, limit and author type (self, author-run, independent)
- [ ] Added to `app/src/lib/ops/evidence.ts` so the rendered register and its test pick it up
- [ ] Every customer-facing statement cites an **available** row in the claims register resting on an unexpired record
- [ ] Documentation updated: architecture, runbook, changelog, known limits
- [ ] Register row updated by the same pull request

## 9. Pilot launch (adds to 1–8 for a customer release)

- [ ] Executed agreement and approved security path filed
- [ ] Data map signed; official context synced **or** every affected screen marked unavailable
- [ ] Tenant, roles and policy configured and reviewed by a second person
- [ ] Cohort imported with reject report; invitations sent
- [ ] Champion named; dashboard shows only cohort data above the suppression floor
- [ ] Support live in the agreed hours; escalation tested
- [ ] Baseline recorded; metrics agreed in writing
- [ ] Rollout approval and contingency recorded

## 10. Domain authority (adds to 1–9 for a replacement claim)

- [ ] All 21 gates in [the domain gates](SEMESTER_DOMAIN_AUTHORITY_GATES.md) pass or are `n/a` with a written reason
- [ ] Institution's named approvers have signed
- [ ] Reconciliation and dual run complete with agreed tolerance
- [ ] Rollback to the incumbent exercised
- [ ] Export verified by a second person

## 11. After release

- [ ] Verify in the deployed environment, not only in CI
- [ ] Watch the first window; record anything unexpected
- [ ] Re-read the register row at the review date
- [ ] Close or carry the risks it named

## The thirteen questions (answer in one line each)

What is it? Who owns it? Who can use it? What data does it use? What source is
authoritative? What policy governs it? How is it tested? How is it monitored?
How is it supported? How is it secured? How is it made accessible? How is it
rolled back? How is success measured? What evidence proves it is ready?
