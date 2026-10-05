# Native gap register

**As of** 2026-10-05 · **Base** `origin/main` `3bd382dc`

P0 means "do not tell an institution this is on." It does not mean "build it this week ahead of isolation." The design-catalog gap list (203 of 319 workflow steps) remains in [`docs/master/SEMESTER_GAP_REGISTER.md`](../master/SEMESTER_GAP_REGISTER.md).

## P0 launch blockers

| ID | Blocker | Evidence | If ignored |
| --- | --- | --- | --- |
| B-01 | No domain is ready for a named pilot, production, or authority | Capability matrix | A screen is described as a SIS, LMS, or bursar |
| B-02 | School tenant isolation is off (F-01) | Trust model; not re-tested this pass | Any institutional row is under-protected |
| B-03 | Two Supabase projects | `semester` `lzrqvlugnawcgywkhqlz` measured; `Semester2` `kpuulmnicidgdmwgfngv` is the live-domain database per the source-of-truth doc, not queried here | A fix lands on the project the domain does not use |
| B-04 | Anon can see 32 tables in GraphQL and holds SELECT | Security advisor WARN; policies exist; predicates not run | Possible disclosure if a policy is permissive |
| B-05 | 207 signed-in SECURITY DEFINER functions | Advisor WARN | A command without an internal capability check |
| B-06 | Registration, gradebook, records, finance, family, community are unsafe to activate | Domain catalog | A flag is turned on for a tenant |
| B-07 | No qualified accessibility evaluation | EXT-008, domain universal field | A WCAG conformance claim |
| B-08 | No alert path to a person; incident roles are data, not a workflow | F-08; gap register incident steps | A severity is "declared" in a document only |
| B-09 | Seeded or device data can be read as the institution | D01 risks | A student acts on a sample grade |
| B-10 | AI output has no single permission engine | Workflow catalog §5 | A tool call is treated as an official act |
| B-11 | Outbox has no projection worker | `private.domain_outbox_events`; consumer not found | Operators think writes refresh every read model |
| B-12 | One unsigned operator covers the launch seats | Company operating system doc | Support, security, and finance are implied to be staffed |
| B-13 | Commercial checkout is a flag-gated test, not institutional billing | D32 card | Revenue or a customer logo is invented |
| B-14 | Restore drill project exists; a target-environment drill is not evidenced here | Project `semester-restore-drill-2026-10-01` listed; SLO doc says unmeasured | An RPO is quoted |

## Security and RLS exposure classification

| Class | Objects | Treatment |
| --- | --- | --- |
| RLS on, policies present | 321 public minus the 33 public no-policy tables; private tables that have policies | Keep. Review policy predicates before a tenant. |
| RLS on, zero policies (default deny) | 63 (30 private, 33 public), INFO | Prefer this to an open policy. Confirm the client was not supposed to read `registration_holds`, `support_tickets`, `scim_credential`, `payment_events`, `lti_*`, `gtm_*`. |
| Anon schema exposure | 32 public tables | Requires security review. Do not grant more. |
| Authenticated schema exposure | 289 public tables | Expected for a logged-in app if RLS is correct. Still review. |
| Intentional command surface | 207 definer functions | Classify each as student, staff, or operator. Revoke EXECUTE where the caller should use a narrower RPC. |
| Service-role only | Private tables, edge functions | Keys stay off the client. This pass did not print any key. |
| Client authority | Browser state for official acts | Forbidden. Registration and grades already go through RPCs. Keep it that way. |

## P0 pilot — registration readiness

The PDF's entry wedge is a **Registration Readiness Pilot**. It is a workflow definition, not a pilot in progress. No institution is named. No agreement is signed. No data scope is approved.

### What the pilot is allowed to be

A single invited student, on the canonical project, seeing:

1. Today, with each fact labelled student-entered, imported, or unavailable.
2. The degree plan labelled as the student's arithmetic, not a registrar audit.
3. A registration readiness screen that says whether Semester can see a window, a hold, or a section, and that says "unavailable" when it cannot.
4. A handoff to the institution's real registration system.
5. Ask, answering only from approved sources, with a citation and a sentence that the answer is not an enrolment.
6. A support request if the handoff fails.
7. A privacy page that can export and request deletion of Semester-held data.

### What the pilot is not

Enrolment, a grade, a balance, a family share, a community, an employer introduction, or a transcript.

### Exit criteria before anyone calls it a pilot

| Gate | State |
| --- | --- |
| Named institution and a signed scope | Absent |
| F-01 fixed or the pilot holds no school rows | Open |
| Anon exposure review written down | Open |
| Source label on every readiness fact | Partial |
| SIS remains authoritative | Required and true today |
| Support owner named | Unsigned seats |
| Accessibility review of these six screens | No qualified evaluation |
| Rollback: turn the module flag off | Kill switch exists as schema; not rehearsed for this wedge |
| No public claim | Required |

## Human review queue

Qualified people, not this repository, must review before a claim:

| Topic | Why |
| --- | --- |
| Security | F-01, anon policies, 207 definer functions, secret storage |
| Privacy | Family grants, advisor shares, retention classes, DSR |
| Accessibility | WCAG 2.2 AA conformance |
| Registrar / academic records | Any enrolment or grade |
| Finance | Ledger, tax, payments, no PAN storage |
| Aid | Regulatory |
| AI governance | Tool permissions, subprocessors |
| Legal | Terms, student records, guardian consent, insurance, corporate |
| Accessibility of emergency copy | Safety handoff wording |

## Stale or duplicate work to avoid

| Temptation | Why it is a gap, not a task |
| --- | --- |
| New frontend called Education OS | `app/` is the product |
| New token CSS files from the design PDF | Splits `look.ts` |
| New `ops_*` tables beside console reads | Name the read model after the existing command |
| Second goals or schedule store | Pathway and calendar exist |
| Marketplace schema | D-1236 gates are not met |
| Applying migrations to production to "catch up" | Remote and local migration counts both 184. Do not push |
