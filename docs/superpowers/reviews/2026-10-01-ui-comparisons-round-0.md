# Task 3 independent specification and code-quality review

Reviewed 2026-10-01 in the isolated `ui-standards` worktree. Exact range: `e9d8aa8595d2dc251c78e28b8881a9f24bc3cd60` → `b19fc857b143491dd8482301f53fb145021b0a87`; the latter is the checked-out HEAD. Read `task-3-brief.md`, including its binding Global Constraints, before the report and implementation. Reviewed the supplied `review-e9d8aa85..b19fc857.diff`, the corresponding source changes, the new integration tests, and necessary storage, host, advisor, calculation and backup context.

**Specification verdict: changes required. Code-quality verdict: changes required.** Findings: **0 Critical, 2 Important, 2 Minor**. The nine reported domain surfaces are wired to the shared contract, and the core explicit-choice and editable advisor flow is implemented. Persistence lifecycle integration is incomplete. The legacy registration-source ownership guarantee remains unverified; it is discussed separately below, rather than silently accepted as an exception to the brief.

No source changes, helpers, publication, or test/build/lint/budget reruns were performed. This review does not independently reproduce the reported 177 passing tests or other command outcomes.

## Findings

### Important 1 — Exported comparison history is silently omitted by the existing restore control

**Locations:** `app/src/lib/productivity.ts:86–89` (new stored field); `app/src/components/ProductivityWorkspace.tsx:1156–1198` (export and restore integration, particularly the merge at 1191–1198).

The backup exporter serializes the complete workspace, including the new `comparisons` field, and `readProductivity` accepts it. Restore explicitly merges only `decisions`, `captures`, `drafts`, `journal`, and `preferences`. It never merges `incoming.comparisons`.

**Concrete sequence:** save a course comparison, export the private backup, then restore that backup into an empty account/device workspace. Validation and the save succeed, but the comparison choices and their original candidate contexts are absent. Restoring into an existing workspace similarly ignores all incoming comparison history. This is a new data-type integration failure in an existing user control, not a malformed-file edge case. Local same-device reload tests do not cover it.

**Impact:** the feature's exported personal choices cannot be recovered through the advertised restore workflow. This conflicts with keeping existing controls functional and retaining saved personal work.

**Required correction:** merge optional comparison arrays by snapshot ID, preserving existing snapshots and compatibility with backups predating this field. Add an actual export/restore integration case covering an empty destination and an existing destination.

### Important 2 — Comparison snapshots are append-only with no supported deletion or archive operation

**Locations:** `app/src/components/ComparisonActionsPanel.tsx:21–27,66`; `app/src/components/ComparisonHistory.tsx:3–8`; `app/src/components/ProductivityWorkspace.tsx:723,1220–1223`; `app/src/lib/device-library.ts:128–131` (unchanged storage cap).

Every Choose and Save all appends a complete copy of every candidate to the same 3,000,000-character Productivity workspace. `ComparisonHistory` only renders snapshots. Neither the per-surface history nor the central Productivity history offers deletion; deleting original courses, opportunities, decisions or legacy journal snapshots deliberately leaves comparisons intact. The Backup guidance still tells the user to use each item's Delete control, which these items do not have.

**Concrete sequence:** repeatedly save a large career/programme comparison, or save comparisons over sustained normal use. Once the accumulated history dominates the workspace limit, subsequent choices and unrelated Productivity edits fail. Exporting a backup does not reclaim space, and no supplied control can archive/remove the comparison records. Cloud replacement or manually modifying storage/backup files is not a reasonable local archive control.

**Impact:** users cannot remove retained personal planning context, and the new shared history can consume the capacity of existing decisions, drafts and captures with no supported recovery for the responsible records.

**Required correction:** provide an explicit owner-scoped delete/archive action for comparison history, accessible centrally even after source deletion. Preserve snapshot immutability while retained; do not silently evict personal work. Verify that deleting a snapshot preserves other snapshots and unrelated workspace data and restores capacity.

### Minor 1 — A removed career candidate is treated as a successful canonical update

**Locations:** `app/src/screens/Career.tsx:338`; `app/src/components/ComparisonActionsPanel.tsx:29–30`.

The career `onChoose` callback maps the latest stored opportunities by ID and returns the generic storage-write result. If the selected record was removed after render but before the click is processed, the map changes nothing and `lib.update` returns true. If the same ID was edited, it marks the newer version saved using the old displayed candidate context without a version check. A queued cross-tab storage event is enough to create this window; the existing stale-Productivity test deliberately exercises the equivalent disk-before-render sequence.

**Impact:** the personal historical snapshot remains legitimate, but the promised additional canonical shortlist operation can be a silent no-op or apply to changed facts. The partial-save notice only covers writes that return false, so this case is not reported. This is not a request for an unavailable cross-store transaction.

**Correction:** check candidate presence and the relevant source version inside the latest-source updater, and return/refuse as a source-update failure when it no longer matches. Retain the already-saved historical choice and show the partial-result notice. Test valid-but-deleted and edited source records, not only corrupted storage and quota failure.

### Minor 2 — The new canonical chosen ID survives removal of its option

**Locations:** `app/src/lib/productivity.ts:54–57,215–228`; `app/src/components/ComparisonActionsPanel.tsx:26`; `app/src/components/ProductivityWorkspace.tsx:487–495`.

Choose now writes `Decision.chosen`, but the existing Remove option operation only updates `options`. After choosing A and removing A, the live canonical decision still contains `chosen: A`, and the validator accepts any string without checking membership. Its decided flag also remains set. Historical comparison snapshots correctly retain A; the live decision should not carry a dangling choice reference. Assumption-reset/revisit paths also preserve the new chosen field while clearing `decided`, so the field's lifecycle needs an explicit rule.

**Impact:** the new canonical field becomes internally inconsistent under normal supported editing, including export/reload. Current history display is insulated because it uses the immutable snapshot; this bounds the present severity.

**Correction:** clear/invalidate the live choice when its option is removed and define how reconsideration handles it; validate chosen membership for live decisions without discarding legitimate historical snapshots. Cover Choose → remove selected option → reload.

## Applicable-surface and specification assessment

| Surface | Reviewed implementation and assessment |
|---|---|
| Course shortlist | Real two/three checked sections, section/term labels, actual import timestamp, source unknowns and canonical requirement/schedule/requisite readings. Explicit personal history does not alter the cart. Full decision renderer remains. Source facts are a selected summary, not a full catalogue backup; the helper omits available URL/CRN and the host does not pass institution identity. |
| Potential schedules | Uses each stored schedule's historical courses, not replacement current catalogue records. Preserves conflict/credit totals and warns about sections absent from the current catalogue. Original import date is honestly unknown. Load into cart remains separate. Ownership limitation below applies. |
| Primary/backups | Uses primary and actual recorded backup IDs in priority order; no fabricated suggested replacement or rank mutation. Catalogue facts and unknowns are retained. Ownership limitation below applies. |
| Degree/time/cost | Current plan plus all real saved scenarios, including when the enhanced detail flag is off. Uses `graduationOutcomes`, `compareRows`, `limits` and applied adapter values; itemized cost lines retained. No degree/audit rewrite or invalid conversion of abroad scenarios into base plans. |
| Programme shortlist/costs | Visible shortlist or explicitly selected cost rows. Preserves original currency/period, canonical net cost, source, deadlines, requirements and material statuses. Does not set application status or imply official receipt. Empty cost selection adds no candidates. |
| Study abroad | Real programmes, canonical credit picture/approval text, recorded cost or Unknown, applied programme assumptions. Student-recorded approvals remain qualified. Private programme notes are omitted. |
| Career | Actual displayed/filtered order, selected Skills & fit listing, or abroad listings. Preserves listing facts, `explainFit` context and applied target assumptions. Owner+term source scope retained. Personal choice plus canonical saved flag; stale-source limitation is Minor 1. |
| Productivity | Actual options, per-option `advisorPacket`, applied assumptions/evidence and no private reflection in new comparison payloads. Choice/snapshot are one same-store update with a latest-decision version check. Backup/history lifecycle findings and chosen-reference finding apply. |
| Operating rhythm | Current/grouped results from canonical `simulate`, actual entered nonblank tasks, available minutes and switch buffer. Choose invokes existing dated daily/weekly owner+term plan save, with explicit simulation milestones/assumptions. Calendar proposals are excluded and no download runs. |

The report's nine-surface inventory is supported by host inspection and source search for comparison/compare/alternative/shortlist/scenario uses. No additional applicable student planning candidate comparison was found. The named fact-renderer, statistical/historical/institutional, commercial membership and single-plan parameter-editor exceptions are reasonable within this task. This is a source-inventory judgment, not a runtime tour of every route.

The prior native-assumption ruling was applied: pending same-adapter edits remain pending; snapshots use applied values. The rhythm simulation inputs are the displayed native simulation inputs, not a deferred `AssumptionEditor` proposal. Existing unrelated CRUD was not treated as requiring a new assumption approval flow.

## Advisor workflow, ownership and failure ordering

The shared Ask advisor flow starts with no options selected and no meeting creation. Selection builds a visible editable draft; fuller applied/personal context requires its own opt-in. Changing selection/context explicitly rebuilds the text. Source/context/owner/scope changes represented in the component key remount the panel and discard its pending draft. Prepared agendas enter the actual owner-scoped `AdvisorMeeting` with empty attachment selections and no private notes. Existing provider sharing and download/print confirmation remain in that component. No new automatic registration, application, payment, publication, clipboard/export or advisor send was found.

The integration tests exercise real hosts, selected-only default drafts, edits, cancellation, preparation and actual share-confirmation cancellation; they are not merely mirrors of the helper's string output. Tests also inspect owner/term resets, applied-versus-pending assumptions, local reload, corrupt stores, stale Productivity writes and source-only quota failure. The uncovered lifecycle sequences above remain necessary.

**Nontransactional stores:** snapshot-first ordering is real. A failed snapshot write prevents the career/rhythm source callback. A failed later source write preserves the original personal choice and source bytes; the code has a partial-result notice. This is an acceptable explicit partial-success model for a personal choice plus optional canonical update, rather than an atomicity claim. A source becoming unreadable can remove the whole action panel, so its local notice is not guaranteed to remain visible; the source error and central saved history remain available. Valid source changes require the narrower correction in Minor 1.

**Legacy registration source ownership is not established.** Registration, shortlist and backup source keys are shared-device keys with no owner metadata. The new destination stores and meetings are owner-scoped, and the implementation does not expose another account's *new comparison store*. However, account A's pre-existing personal schedule/shortlist/backups remain visible after switching to B, and the new Save/Ask actions can copy that source content into B's durable comparison history/agenda. A read from a shared key does not establish that the source is B's work. The report honestly acknowledges the legacy stores, but its broad claim that other-user data are excluded is not proven for these integrations. This is inherited source exposure plus a new durable-copy path, not evidence of a new cross-account destination-store read. I cannot certify the binding “Persist only user-owned preferences/work” guarantee for these surfaces without an owner-aware source policy or an explicit scope disposition from the controller; report disclosure alone is not approval. No blind reassignment/migration of legacy records should be inferred as the fix.

## Cannot independently verify / evidence limits

- Reported 20-file/177-test pass, build, lint and bundle-budget numbers were read, not rerun. No evidence of lowered limits or new dependencies was found in this range.
- Real-provider authorization, delivered advisor shares, production isolation, server/RLS acceptance and real browser assistive-technology behavior were not exercised. None is claimed as observed approval or provider success.
- Full other-user exclusion for legacy shared-device registration sources cannot be established from their schema, as explained above.
- The source search and host inspection support the stated applicable inventory; exhaustive runtime operation of every feature-flag/navigation combination was not performed.

The Important findings should be corrected before accepting task completion. The Minor findings should be addressed or explicitly recorded with their limited impact. Retain the report's honest nontransactional-store and legacy-source caveats, and narrow any stronger ownership/backup-completeness claims until verified.
