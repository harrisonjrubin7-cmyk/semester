# 06 Acceptance, sign-off, evidence and archival

Code: `signoff.ts`, `evidence.ts`. Stages: **archive**, **monitoring**, and the
approvals the Center's cutover stage requires.

## 1. Acceptance criteria

An institution accepts the migration of a domain when **all** of these hold.
They are the institution's criteria; Semester proposes them and the
institution's approver may add to them, not remove.

**Data**
- [ ] The domain's workbook checks all pass the gate: every evidence class
      examined, no open critical, rates within threshold, every remaining
      exception dispositioned by name.
- [ ] Every business outcome in the workbook recomputes to the institution's
      figure (GPA, balance, standing, eligibility, seats, visibility…) for the
      full population or the agreed stratified sample.
- [ ] History: original timestamps and actors preserved; none restamped.
- [ ] Permissions: no access widened; none narrowed without an approved,
      communicated change.

**Operation**
- [ ] Two consecutive full-scale rehearsals passed in the window, rollback
      exercised ([05 §1](05-REHEARSAL-PARALLEL-RUN-CUTOVER-ROLLBACK.md)).
- [ ] Parallel run met its exit, including the named calendar events (05 §2).
- [ ] Staff in each role completed their real tasks on the target, with no
      workaround on the legacy system, in a structured acceptance session.
- [ ] Support is staffed and the hypercare period and exit are agreed.

**Governance**
- [ ] Sign-offs current for every required role ([§2](#2-sign-off)).
- [ ] Evidence ledger verifies; retention dates set by the institution.
- [ ] Counsel has answered every flagged question, recorded outside this
      repository and referenced by digest.
- [ ] Archive and exit path in place ([§5](#5-archive-and-exit)).

## 2. Sign-off

`evaluateSignoffs(gate, domain, signoffs, currentHead, preparers, now)`.

| Rule | Why |
| --- | --- |
| Each required role has an **approve** as its latest decision | A later rejection overrides an earlier approval |
| The signature's `evidenceHead` equals the ledger's current head | A signature is about specific evidence; new evidence (a re-run, an exception) makes it stale. Signing itself does not stale the others (`evidenceHead` skips sign-offs) |
| Signed within 14 days (`SIGNOFF_VALID_HOURS`) | Approval of a rehearsal from March does not cover August |
| The signer is not a **preparer** | Separation of duties; an independent `semester_reviewer` signs the Semester side |
| One person fills one role | No self-approval by wearing two hats |

Required roles per gate: `requiredRoles(gate, domain)` — the institution's
domain approver (`it`, `registrar`, `finance`, `faculty`, `data_owner`), the
independent reviewer, `semester_security` at rehearsal and cutover, the
`executive_sponsor` at go/no-go and acceptance, `data_owner` at archive, and
**`counsel`** at mapping, cutover and archive for family, documents and
academic records.

The Center records its own approvals per `ApprovalArea`; those and these use
the same area names, so an approval given in the Center screen and a sign-off
here refer to the same role.

## 3. Post-cutover acceptance and hypercare exit

Exit hypercare when, for the agreed period: no open critical; outcome and
permission checks daily-clean on the live target; mismatch and login-failure
rates inside the triggers; support tickets tagged migration trending to zero;
and every conditional approval's conditions closed. Then
`post_cutover_acceptance` is signed by the executive sponsor and each approver.

## 4. Evidence retention and auditability

`evidence.ts`: an append-only, hash-chained ledger.

- Each entry commits to the previous entry's hash and to a **SHA-256 digest**
  of its artifact (the check results, the manifest, the signed approval). Edit,
  reorder or remove an entry and `verifyChain` names the first one that breaks.
- The ledger holds **digests, opaque references and short sanitised text**
  (`sanitizeMessage` strips tokens, emails, long digit runs). It holds no
  student data, so reviewers and auditors can read it without being able to read
  a student, and it can outlive the data it describes.
- The artifacts themselves are kept by the institution and Semester in
  controlled storage; the digest proves they are unchanged.
- **Every entry needs `retainUntil` from the institution's records schedule.**
  The ledger refuses an entry without one rather than guess a number that
  sounds legal. Retention of migration evidence and of rehearsal extracts is the
  institution's records manager's decision, with counsel.
- Kinds: `inventory`, `extract_manifest`, `mapping_approved`, `check_run`,
  `gate_result`, `exception_event`, `rehearsal`, `parallel_run_day`, `signoff`,
  `cutover_event`, `rollback_event`, `archive_manifest`.

**What the ledger does not do:** it is a record, not a notary. It proves
internal consistency after it was written, not that the first entry was honest,
nor who held the key. For external assurance, the head hash is
periodically sent to a party outside the migration team (the institution's
internal audit, or counsel); that practice is recommended here and not built.
It also lives wherever its operator stores it, so storage with write-once
semantics and access logging is an operational requirement for the first
institution.

### Audit questions the evidence must answer

1. What exactly was migrated, from which snapshot, by which mapping version?
2. What was found wrong, who owned it, how was it fixed, and who re-ran it?
3. Who approved each gate, on what evidence, and was that evidence still the
   current evidence when they signed?
4. What was waived, by whom, why, and when did it expire?
5. Was rollback exercised, and what were the triggers on the day?
6. Can any student's migrated record be traced to its source record without
   storing student data in the evidence? (`crosswalk` + `redactReference`.)

## 5. Archive and exit

**Legacy archive.** The Center's archive stage records where the legacy data
was archived. The archive must be:

- complete for the history in scope, in a **documented, open format** with the
  extraction manifest, not a database dump only the retired vendor can read;
- retention- and hold-aware: legal holds and retention clocks carried or
  recorded, not reset (the documents workbook's `retention_clock` check);
- access-controlled with the same permission model as the source, and readable
  by named roles for the retention period;
- decommission-gated: the legacy system is not switched off until the archive
  is verified by digest, restored in a test, and `archive_complete` is signed.

**A tension to settle with counsel.** Semester's own student-facing promise is
that deleting an account leaves no archive (`app/src/lib/privacy.ts`,
[`RETENTION.md`](../../RETENTION.md)), while an institution has records-retention
obligations for the same people. How an institutional record in Semester is
retained or deleted when a *student* requests deletion is a legal and policy
question this pack does not resolve; the migration must not start until it is
answered for the first institution.

**Exit.** An institution must be able to leave, with its data, in the same
open formats it came in: see
[`DATA-PORTABILITY-AND-OFFBOARDING.md`](../DATA-PORTABILITY-AND-OFFBOARDING.md).
The workbooks are symmetrical on purpose: the checks that prove a safe move in
prove a safe move out.

`archiveReadiness` is the check: the rollback window has closed, the evidence is
sealed under a digest, counsel has reviewed the retention periods the entries
carry, and legal holds were *checked* (an unchecked hold is not zero). The
programme never deletes from the incumbent; decommissioning is the institution's
act, after this, under its own records schedule.

## 6. Open items for the first institution

- Records-schedule dates for the evidence ledger and for extracts.
- Counsel's answers on the flagged items (consent and custody, accommodation
  and conduct records, holds, third-party content, student-deletion vs
  retention).
- The agreed cutover window and the staffing for hypercare.
- Whether `rehearsal` becomes a Center stage (a production schema change that
  needs the owner's approval).
- Whether the Center's `date_iso` gets the explicit slash-date setting.
