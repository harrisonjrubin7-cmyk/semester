# Student Credential Wallet

A student-controlled, portable record of verified learning and experience:
the student's own evidence, plus achievements an authorised issuer has
verified, plus sharing and export the student controls. **It is not** a
transcript replacement, a social profile, or an employer search engine.

**Where it sits in the roadmap: Tier 2, Phase 3.** Its device-local foundation
now exists; institution issuance and recipient sharing still come after identity,
sharing, verification, privacy, issuer governance, retention and portability
controls are mature, not before. [`STRATEGIC-EXPANSION-REGISTER.md`](STRATEGIC-EXPANSION-REGISTER.md)
(areas `CRD`, `PRF`, `EVG`) tracks each piece.

## Most of the foundation is already here

The wallet is mostly a surface over things main already has. Building it
should reuse them rather than start a parallel model — the same decision
[`CAREER-PORTABILITY-AND-LIFELONG-ACCESS.md`](CAREER-PORTABILITY-AND-LIFELONG-ACCESS.md)
made for the career hub.

| Wallet piece | What exists | Where |
| --- | --- | --- |
| Student-entered skills | Self-reported skill records, editable and deletable by the student | `skill_records` in `supabase/migrations/20260926150000_expansion_roles_and_features.sql` |
| Verification request | Student asks a **course or office** to verify; the request names its scope | same table: `verification_requested`, `verifier_scope_kind/id` |
| Verified skill | Only a holder of `skill:verify` **for that scope**, who is not the student, can verify; `verified_by`/`verified_at` are required together; the student cannot edit a verified row | the `a verifier decides` and `a student edits unverified skills` policies; `supabase/expansion.check.sql` |
| Evidence and portfolio artifacts | Artifacts tied to the course or entry they were made in; confirmed skills only; nothing invented (D-046) | `app/src/lib/career-evidence.ts`, [`CAREER-EVIDENCE.md`](CAREER-EVIDENCE.md) |
| Course → skill → artifact → opportunity | The skills graph, with "because of" reasons | `app/src/lib/skills-graph.ts` |
| Employer visibility | Opt-in, **expires after 180 days** (at most 366), must be renewed; employers need `talent:search` | `talent_profiles` |
| Viewing history | A receipt per employer view | `talent_profile_views` |
| Learner-controlled wallet surface | Student-confirmed skills and selected artifacts, each with an authority label; selected JSON export says it is not official | `app/src/components/CredentialWallet.tsx`, `app/src/lib/credential-wallet.ts` |

## What a student sees

```text
My Credentials
  Verified achievements   institution-issued credentials, verified skills,
                          badges, internship/experiential records,
                          research or project verification
  In progress             skills I'm building, verification requests,
                          evidence awaiting review
  My evidence             projects I chose, portfolio links, course work
                          I chose to include, context notes
  Sharing                 private by default · share with a named recipient ·
                          time-limited link · revoke · see who viewed
  Export                  download a portable record · export selected
                          evidence · request an institution credential
```

## Authority: who may say what

| Item | Authority | What the student can do | Exists? |
| --- | --- | --- | --- |
| Student-entered skill | Student | Edit, delete, place in a selected export | Yes |
| Evidence artifact | Student-selected | Add, remove, place in a selected export | Yes (device-local) |
| Verification request | Student initiates | Withdraw | Yes: edit back to `self_reported` |
| Verified skill | Scoped verifier (faculty, career office) | Display and share; **cannot alter the issuer's claim** | Yes |
| Institution credential (badge, certificate) | Authorised institutional issuer | Hold and share; **issuer corrects or revokes** | **No** |
| Official academic record | The institution | Shown only if authorised; never replaced | Out of scope |
| Employer view | Employer action | See the view history | Yes |

## Safeguards

Each safeguard is either held today or a gap the build must close first.

| Safeguard | State |
| --- | --- |
| Private by default | Held: the wallet is device-local and exports only checked items; `talent_profiles.opted_in` defaults false. A portfolio item's server visibility column is planned, not built |
| No employer search without active, renewable opt-in | Held: the employer policy requires `opted_in and expires_at > now()` |
| Student sees employer views | Held: `talent_profile_views` |
| No claim of institution verification unless an authorised role issued it | Held for skills (scoped `skill:verify`); **no** issuer model for credentials yet |
| **Issuer controls correction and revocation, audited** | **Gap.** Once a skill is `verified`, no policy lets the verifier revise or revoke it, and there is no revocation state. Needs a `revoked` status, a reason, a revoking-issuer check, and an audit row, before any credential is issued |
| No grade, disability, financial, health, conduct, immigration or private-study data in the wallet by default | Gap: no share-scope filter exists, because no share exists. The share model must deny these classes unless the student adds one explicitly, one item at a time |
| Every share has a recipient, scope, duration, preview, revoke and audit | Gap: only the employer opt-in exists. Named-recipient and time-limited links are new |
| Student can remove artifacts and revoke shares | Artifacts: held. Shares: with the share model |
| Minor/guardian rules | Gap: to follow `SUPPORTER-FAMILY-PRIVACY-MODEL.md` |
| No public searchable profile by default | Held: nothing is public; employer search is capability-gated |

## Flows

**Add evidence.** Choose "Add evidence" → pick a Semester artifact or an allowed
link → label the skill, course or project → private by default → optionally
request verification → see who owns it and how long it is kept.

**Request verification.** Pick the skill and its evidence → pick an authorised
course or office verifier → preview exactly what is sent (only what is needed)
→ the verifier approves, declines, or asks for clarification → the student is
told → a verified item shows issuer, date, scope, and correction/revocation
status.

**Share.** Select items → a named recipient or a time-limited link → preview
the exact content, scope, duration and identity shown → confirm → the recipient
sees a restricted view → every view is logged for the student → revoke at any
time, immediately.

**Export.** Select items → see the authority distinction on every item →
download a JSON package containing only those items → request an
institution-issued credential separately. Every export carries “Not an official
transcript or institution-issued credential.”

## Standards, in order

1. **Foundation:** the internal skills/evidence/verification model above, with
   scoped issuers, revocation and an audit trail.
2. **Interoperability:** CASE identifiers for competencies; Open Badges for the
   badges an institution chooses to issue; a CLR-compatible export mapping.
3. **Enterprise:** institution issuer governance, a credential registry, a
   verification API, and a conformance or certification path where a customer
   requires one.

Framework and standards alignment here is planning, not a conformance claim.
Nothing may say Semester supports Open Badges or CLR until an export validates
against the standard, and certification is a separate claim again.

## Before it enters active delivery

It passes the roadmap admission gate in `app/src/lib/expansionregister.ts`
(`admit`), with a governance scorecard route and a product charter like every
other capability. At minimum the issuer revocation model, the share model with
its sensitive-class denial, and the export's "not official" labelling are
built and tested first.
