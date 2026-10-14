# Production diff: registrar design vs what the repo already has

Read 13 Oct 2026 from `harrisonjrubin7-cmyk/semester@0e8e789` — `supabase/migrations/20260929300000_registration_transaction.sql` (header says **NOT APPLIED to production**), plus table names from `20260926150000_expansion_roles_and_features.sql`, `20260929210000_academic_record_ledger.sql`, `20260929310000_gradebook.sql`. Only the registration file was read in full; ledger and gradebook still need the same pass.

**Conclusion:** the repo already has a real registration transaction. `proposed-schema/100–120` and `reference-package/registrar_ref` must **not** be applied beside it. Treat them as a checklist; the work is small additive migrations on the existing `public.registration_*` tables.

## Already in the repo (keep)
| Concern | How the repo does it |
|---|---|
| Who | Every writer is `security definer`, reads `auth.uid()`, takes the school from `profiles.school_id` — never a parameter |
| Gate | `private.registration_gate`: `kill.writeback` / `kill.integration_sync`, then flag `writeback.registration_submit` must be `production`. Stopped outranks off |
| Last seat | Advisory lock per school + term, then `select … for update` on the section. Second student waits, then reads it full |
| Idempotency | `registration_requests` unique `(actor, idem_key)`, key 8–128 chars, md5 fingerprint; replay returns stored result with `replayed: true`; different args → `idempotency_conflict`; refusals not stored |
| Stale review | `want_expect` ('seat'/'waitlist') → `stale_seat_count`, nothing written |
| Holds | Block enrolling, never leaving. Reason has no client grant; `my_registration_hold` returns office + link only |
| History | Nothing deleted; drop / withdraw (W) / deny / leave waitlist are states; every change writes `registration_audit_event` |
| Waitlist | Promotion re-checks the blocker; a blocked head is skipped, keeps place, audited |
| Reads | RLS policies: school members read terms/sections; student reads own enrollments; registrar reads school's |

## Gaps (additive migrations to write, in order)
| # | Gap | Proposed change | From |
|---|---|---|---|
| 1 | RLS **enabled** but not **forced** on the 8 tables | `alter table … force row level security` (security-definer writers unaffected; verify owner isn't the PostgREST role) | 100/120, reference |
| 2 | `registration_enrollments.tenant_id` and `section_id` are independent FKs — an enrollment could point at another school's section | Add `unique (tenant_id, id)` on sections; composite FK `(tenant_id, section_id)`; same for overrides | invariants |
| 3 | No swap | `registration_swap(from, to, key, expect)` under the same term lock: drop + enroll in one transaction; enroll refusal raises so the drop rolls back | enrollment-engine.yaml |
| 4 | Overrides: registrar grants directly; no requester ≠ approver, expiry or use limit | Add `requested_by`, `valid_until`, `uses_allowed/uses`, check `requested_by <> granted_by` for waivers the school marks consequential; `registration_waived` respects expiry/uses | access.yaml SoD |
| 5 | Idempotency key 8–128; design said 16–200 | Keep repo's 8–128 (already enforced in two places); update the OpenAPI contracts to match instead | contract consistency |
| 6 | No effective vs recorded time | Add `effective_at` to `registration_enrollments` (default `created_at`) for late corrections | data-model.yaml |
| 7 | Single capacity per section | Defer capacity pools (110) until a school needs reserved or cross-listed seats | 110 |
| 8 | SIS write adapter "not built" (stated in the file) | Stays external-authority mode: `connect_delegated` → timeout after dispatch = `reconcile_required` | integration-modes.yaml |
| 9 | Grade chain | Read `academic_record_entries` + `grade_entries` next; check append-only + same-attempt supersession before adding anything from 120 | 120 |

## Academic-record ledger (`20260929210000_academic_record_ledger.sql`, read in full)
Already stronger than 120's grade chain — **keep it, don't add official_grade_decisions**:
- Nobody writes the ledger directly. A change is proposed in `academic_record_changes` (reason ≥10 chars, effective date, source); approval by **someone other than the proposer** makes a trigger write one `academic_record_entries` row.
- Append-only for everyone including the owner; corrections are new entries, reversals are `void` entries; each entry names `previous_entry_id` + `previous_value`.
- Effective date (`effective_on`) and recorded time (`recorded_at`) are separate.
- Correcting a grade, standing or conferral already in effect needs `record:override` — decided from the ledger, not a client flag.
- Per-line advisory lock so two approvals can't both replace the same entry.
- Records are keyed by the school's student ref; deleting an account removes only the link.

Gaps (add to the hardening migration):
| # | Gap | Change |
|---|---|---|
| L1 | RLS enabled, not forced | `force row level security` on the 3 tables |
| L2 | No policy/scale version on an entry | Add `policy_version text` (+ for `kind='grade'`, validate `value` against the school's approved scale version) |
| L3 | `subject_key` is free text — no tie to an enrollment | Optional `registration_enrollment_id` FK (tenant-composite) for `kind in ('enrollment','grade')` |
| L4 | `previous_entry_id` FK isn't tenant-scoped | Composite `(tenant_id, previous_entry_id)` after adding `unique (tenant_id, id)` (trigger already sets it correctly; this is defence in depth) |
| L5 | Transcript issuance explicitly out of scope | Snapshots referencing entry ids — new, later |

## Gradebook (`20260929310000_gradebook.sql`, 7 tables)
Keep it. It already has: grading authority **per course and term** (a TA this spring can't read last year's drafts), append-only `grade_entries` versions (entered → changed → moderated → released → regraded), moderation by a second person (grader can't moderate own grade), students see only their own `released` rows, idempotent operations ledger, regrade requests/resolutions, registrar export of released rows only, and an LMS passback queue.

Gaps:
| # | Gap | Change |
|---|---|---|
| G1 | RLS enabled, not forced (7 tables) | `force row level security` |
| G2 | A released **final** course grade never reaches the academic-record ledger — the two systems aren't connected | On release of a final-grade item, insert a `proposed` row in `academic_record_changes` (kind `grade`, source `faculty`, effective_on = release date). The registrar approves it into the ledger — the gradebook never writes entries |
| G3 | `grade_entries.item_id` FK isn't tenant-scoped | `unique (tenant_id, id)` on items + composite FK |


## Not to copy
- `registrar.enroll()` in 100 — the repo's `registration_enroll` is stronger (holds, prereqs, clash, credit load, waitlist, stale review).
- `registrar_ref.*` tables — duplicate family.
- The 16–200 key rule — conflicts with the repo's existing keys.

## Next
1. **Drafted, both hand edits included:** `repo-patch/20261014000000_registration_hardening.sql`
   - Override uses counted by an AFTER trigger on `registration_enrollments` whenever a row becomes `enrolled` (new seat, approval, promotion). Replays write nothing, so they don't count twice. `registration_enroll` / `registration_promote` untouched.
   - Ledger entries get `policy_version` from their change via a BEFORE INSERT trigger; `academic_record_change_guard` untouched. A missing policy version on grade/standing/conferral changes is stamped `unversioned` (visible on the entry); it’s refused only once the school turns on `records.require_policy_version` in `tenant_feature_policy`. A hard check would have broken four existing check files (academic-record, human-overrides, ledger-chains, ledger-seals) and any current writer.
   - Precondition block refuses to force RLS if a table owner can't bypass RLS — otherwise every security-definer writer would stop.
2. **Checks:** `repo-patch/registration_hardening.check.sql` is now self-contained in the existing harness style (own schools, users, sections): forced RLS, cross-school refs, self-approval, expiry, use counting incl. replay, swap rollback + success + replay + key conflict, policy version on approved entries. The repo harness helpers are inlined (copied from `registration_transaction.check.sql` @27103d1), so it runs on its own.
3. **Run on a branch (you — not run here):**
```bash
git checkout -b registration-hardening
cp repo-patch/20261014000000_registration_hardening.sql supabase/migrations/
cp repo-patch/registration_hardening.check.sql supabase/
supabase branches create registration-hardening   # or: supabase start (local)
supabase db reset                                   # applies all migrations incl. the patch
supabase/check.sh registration_transaction          # existing suite must still pass
supabase/check.sh registration_hardening            # new suite
```
   Expect every line `ok …`; any `FAILED:` aborts and rolls back.
3. Same diff pass for the ledger and gradebook migrations.


## Outbox publisher store (closes the `outbox.publish` gap)

The repo had the producer helper (`private.emit_domain_event`), the tables and the publisher loop (`drainOutbox` in `packages/institution/src/events.ts`), but no Postgres store for that loop — and reading pending rows straight from the table would let two publishers send the same row.

- `repo-patch/20261014010000_outbox_publisher_store.sql`: `claim_id` + `claimed_until` columns; `private.outbox_claim` (oldest first, `for update skip locked`, 10 s–30 min lease); `outbox_mark_published/failed/dead_lettered` that only land with the claim holding the row; `public.outbox_claim` / `public.outbox_mark` wrappers for supabase-js. All service-role only. No new event types.
- `repo-patch/outbox_publisher_store.check.sql`: batch order, envelope shape, lease exclusion, expired lease re-claim, stale-claim mark refused, failed releases + counts, dead-letter parks, error bounded at 500, bad arguments refused, anon/authenticated refused.
- `repo-patch/postgres-outbox.ts.txt` + `.test.ts.txt` → `packages/institution/src/`: `PostgresOutbox implements OutboxStore`; drops Postgres nulls so envelopes validate; parks an invalid envelope at once; reports a lost-claim mark without aborting the batch; 8 vitest cases incl. two publishers draining at once.

```bash
cp repo-patch/20261014010000_outbox_publisher_store.sql supabase/migrations/
cp repo-patch/outbox_publisher_store.check.sql supabase/
for f in postgres-outbox postgres-outbox.test; do cp repo-patch/$f.ts.txt packages/institution/src/$f.ts; done
supabase db reset && supabase/check.sh outbox_publisher_store
npm test --workspace packages/institution
```
### Scheduled publisher + first consumer

- `repo-patch/20261014020000_event_consumers.sql`: `event_receipt_seen` / `event_receipt_record` (processed and skipped are final; a late failure can't downgrade a success) and the first consumer's projection `private.event_volume_daily` + `event_volume_count`. Service role only. `event_consumers.check.sql` covers all of it.
- `repo-patch/publisher.ts.txt` → `server/events/publisher.ts`: `runOnce` claims a batch, runs every registered consumer through `processOnce` with `PostgresReceiptLedger`, publishes only when no consumer failed, and leaves the row for retry otherwise (consumers that already succeeded are skipped by their receipts). CLI mode for cron, or a loop with `SEMESTER_PUBLISHER_INTERVAL_MS`.
- `publisher.test.ts.txt`: 4 cases — happy path, partial failure + retry without repeating the good consumer, dead-letter at maxAttempts, non-accepting consumer untouched.
- First consumer is `event-volume` (counts per day/tenant/type, reads no payload) so the path is proven before notifications or passback are attached. If its receipt write fails after counting, a retry can count once more — fine for a volume metric, not for a consumer with real side effects.

```bash
cp repo-patch/20261014020000_event_consumers.sql supabase/migrations/ && cp repo-patch/event_consumers.check.sql supabase/
mkdir -p server/events && cp repo-patch/publisher.ts.txt server/events/publisher.ts && cp repo-patch/publisher.test.ts.txt server/events/publisher.test.ts
supabase db reset && supabase/check.sh event_consumers && npx vitest run server/events
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node --import tsx server/events/publisher.ts   # staging only, once
```
Still needed: schedule it (cron or worker host), add an alert on `semester_outbox_pending` age, and attach the next consumer with real side effects.
