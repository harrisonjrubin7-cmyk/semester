# Domain authority matrix

Status: Phase 0 baseline, assessed 2026-10-05 at `790ebbf`. This matrix says, per domain, **which system is the source of truth today**, what Semester's role is, and what must be true before that changes. It is the document to read before touching any record domain. Status codes: [product map](EDUCATION_OS_PRODUCT_MAP.md). Replacement gates: [DOMAIN_REPLACEMENT_MATRIX.md](DOMAIN_REPLACEMENT_MATRIX.md).

## Authority rules

1. **The authoritative source today is the institution's system, unless a row says otherwise.** Existing official records stay authoritative until a formal domain migration is approved (the brief's principle 1).
2. **Semester roles, in order of strength:** *engagement* (shows and routes), *action* (prepares drafts, hands off), *assistant* (explains, never decides), *mirror* (read-only copy with freshness), *ledger* (native append-only record), *record* (authoritative). A domain is `record` only after passing every applicable gate, with institution approval.
3. **Every displayed fact carries its source label** (`app/src/lib/source.ts`): official, student-entered, estimate, or AI-assisted ("not an official answer — check anything you act on"), and a freshness time where one exists.
4. **Conflict rule:** when a mirror and a native ledger disagree, the authoritative source wins, the disagreement is queued for reconciliation (`app/src/lib/integration/reconcile.ts`), and the student sees the official value with the label.
5. **Student-owned content is private by default.** Sharing is explicit, scoped, time-bound, revocable and logged.
6. **No AI output is an authority.** See [AI governance](AI_GOVERNANCE_AND_MODEL_ROUTING.md).

## Matrix 1: record domains

"Semester today" is what the code does; "Needs" is the minimum before the role moves up one step.

| Domain | Authoritative source today | Semester today | Native build | Tenant boundary | Permission model | Class | Needs for next step |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Identity and affiliation | Institution IdP and directory | Mirror via SAML binding and SCIM (no live IdP) | Membership, role grants | `schools` row, composite FKs | `institution_membership`; `has_capability` | T3 | Live IdP acceptance run; OIDC; offboarding notice |
| Terms and calendars | Registrar / SIS | Mirror: `registration_terms` | NV in DB | Tenant | Registrar sync | T1 | SIS feed |
| Course catalog | Registrar / SIS | Mirror: `catalog_sections`; student imports a file | Authoring NS | Tenant | `catalog:sync` | T1 | Live feed; catalog-year versioning |
| Sections, schedules | SIS | Mirror | `registration_sections` NV in DB | Tenant | Registrar | T2 | SIS feed |
| Registration, waitlist, add and drop | SIS | Planning and official handoff; native transaction in DB, off | NV in DB | Tenant, per school-term advisory lock | `writeback.registration_submit` + registrar | T3 | Reconciliation, dual run, cutover, rollback evidence; SIS adapter |
| Holds (registration) | SIS | Mirror: office and link only, never the reason | n/a | Tenant | Service-role writes | T3 | Hold category field |
| Prerequisites, overrides | SIS rules; registrar | Enforced in the native transaction (off); overrides lift exactly the named refusal | NV in DB | Tenant | Registrar | T3 | Rule import and parity test against the SIS |
| Academic record, transcript | Registrar / SIS | Native ledger in DB (off); no importer; CSV marked "Not an official transcript" | NV in DB | Tenant | `record:*`; propose and approve by different people | T3 | Importer; reconciliation; student read screen; legal review |
| Grades (instructor) | LMS and SIS | Native gradebook in DB (off); passback gated | NV in DB | Tenant / course | `grades:*`, course or school scope | T3 | `LmsAdapter`; policy mapping; passback idempotency |
| Grades (student's own) | Student | Estimate, labelled | NV | Person | Owner | T2 | none (by design not an authority) |
| Degree audit, requirements | Registrar degree-audit system | Student-entered estimate | Audit engine NS | Person | Owner | T2 | Requirement source; registrar certification |
| Transfer credit, articulation | Registrar | `articulation_rules` in DB; student estimates | NI | Tenant | `articulation:approve` | T2 | Screen; registrar workflow |
| Graduation and conferral | Registrar | Student projection; ledger supports conferral corrections | NS (audit link) | Person / Tenant | `record:override` | T3 | Degree-audit check |
| Student account, charges, payment plans | Bursar / SIS finance | Native ledger in DB, **UA**; payments recorded by hand | NV in DB | Tenant | `finance:*`; two-approver | T4 | Nine preconditions in `docs/MONEY-MODULES-SWITCH-ON.md`, payment provider, finance owner |
| Financial aid | Aid office | Not started; handoff | NS | | | T4 | `+REV` |
| Housing | Housing office | Student-entered facts | PL | | | T3 | Table, adapter |
| Dining, card | Card office / vendor | Native store in DB, **UA** | NV in DB | Tenant | `dining:operate` | T3 | Vendor connection; staff screen |
| Advising records and notes | Advising CRM | Student-controlled share only | Case model PL | Tenant / relationship | 120-day share | T3 | Case model, privacy review |
| Support tickets (Semester's own) | Semester | Native | NI | Person / Semester | Operators | T2 | Staffed SLA |
| Support tickets (institution's) | Institution helpdesk | Pointers via `help_destinations` | NI | Tenant | | T2 | Helpdesk connector |
| Accessibility accommodations | Accessibility office | `accommodation_passports` in DB; no screen | NI (DB) | Tenant | `accommodation:verify` | T4 | Screen; `+REV`; counsel |
| Conduct, health, counseling | Respective offices | **Not centralized, by design** | Purpose-limited handoff | | | T4+ | Never auto-centralize |
| Family and guardian grants | Student; school for K-12 guardians | Native | NV (suites) | Free-text tenant (gap) | Share code; `guardians:manage` | T3 | FK fix; counsel P-04, P-06 |
| Legal holds, retention | Counsel | Native | NV in repo | Account, tenant, platform | `hold:*` | T3 | Apply pending migrations to production |

## Matrix 2: learning, productivity and AI domains

| Domain | Authoritative source today | Semester today | Native build | Notes |
| --- | --- | --- | --- | --- |
| Course content, assignments, submissions | LMS (Canvas, Brightspace, Blackboard) | LTI launch (synthetic), student's own Canvas token pull | Course Studio publishes rules, guidance and packs only | No native submission or receipt; `LmsAdapter` not implemented |
| Course AI rules and guidance | Faculty, in Semester | Native, authoritative for AI behaviour | NV in slice, off | The one faculty publication that is the source in Semester |
| Roster and enrollment context | SIS / LMS | OneRoster staging (4 entities); LTI claims; no NRPS | NI | No connector |
| Student calendar, tasks, notes, files | The student; Google or Microsoft for imports | Native; device and blob | NV / NI | Files device-only; Apple via ICS link only |
| Study materials, flashcards | The student; instructor packs | Native | NI | FSRS tests |
| Search index | none (client-side) | Native, client-side | NI | Server-authorized index needed |
| AI provider and model | Provider; tenant `ai_policy` | Consumer BYO, shared key gated, gateway undeployed | NI | No single registry |
| Institutional knowledge sources | Tenant admin | `approved_source` with per-course scope | NV in DB | Source class not stored; declared T1 |
| Community content | Semester community (moderated) | Native, off | NV, off | Labelled distinct from official guidance |
| Career opportunities, employers | External boards; employer | Imported listings; listing desk | NI | Employer search UI absent |
| Credentials and badges | Issuing institution | Student wallet export, not official | NI | No issuer model |

## Matrix 3: Semester's own domains

| Domain | Authority | Today | Notes |
| --- | --- | --- | --- |
| Tenant configuration | Tenant admin via Configuration Studio | Stored, second-person published; **read by nothing in the app** | Wire consumers before claiming control |
| Tenant policy and flags | `tenant_feature_policy`, kill switches | NV; enforced in DB for gradebook, ledger, accounts, dining, registration, migration, community, integration | `tenant_rollout` is a status record, not a gate |
| Audit | Append-only chained streams | NV for console and ledgers; others fragmented | No shared correlation id |
| Commercial terms | Semester operators; counsel | No approved price book in the repo | Numbers in the founding brief are hypotheses |
| Customer data for GTM | Semester CRM (none) | `gtm_accounts` | Consent and suppression enforced (`supabase/gtm.check.sql`) |

## Source states

Every integration field and every mirrored value is in exactly one state, shown to the user and used by reconciliation:

| State | Meaning |
| --- | --- |
| `official-live` | Read from the system of record within its freshness target |
| `official-stale` | Last official value; freshness target missed; shown with its age |
| `official-imported` | Loaded from a file; no live feed |
| `student-entered` | The student typed it; no institutional verification |
| `instructor-published` | Published by faculty in Semester with `course:publish` |
| `semester-derived` | Computed by Semester from other states; shown as estimate |
| `ai-assisted` | Produced or summarized by a model; non-authoritative |
| `conflicted` | Two sources disagree; official wins, reconciliation open |

`app/src/lib/integration/freshness.ts` and `source.ts` carry parts of this today; unifying them into one enumerated type used by the education graph is [backlog item EOS-102](EDUCATION_OS_BACKLOG.md).
