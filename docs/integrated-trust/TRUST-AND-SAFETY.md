# Trust and safety policy framework

Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

**Status: a framework over one built-and-held-off subsystem.** Community moderation is built in the database and held off in production; the escalation sender, the image scanner, any abuse-material reporting route and any staffed coverage do not exist. There is no marketplace. AI has a kill switch and a policy but no report-an-answer flow that reaches an owner. The trust seat is vacant. This framework says what each surface must have before it is switched on, how each decision is made and reviewed, and what moderators may see. Policies that would bind users — community guidelines, terms of use, takedown and appeal terms — are **drafts that are not in force**, and publishing or enforcing them *requires qualified human counsel review*.

## 1. Principles

1. **Protect people before content.** Safety decisions are about harm to a person; a decision about content that does not protect someone is a moderation preference and is weighed as one.
2. **Automation protects; people decide.** Detectors and rules may reduce distribution, rate limit and preserve evidence. They may not remove, restrict an account or finalize a case. This is enforced in the database (`decide_community_case`).
3. **Every decision has a reason code, a reviewer who is not the one affected, and an appeal to someone who did not decide.**
4. **Least privilege, visible use.** A moderator sees what the case needs. Looking at more is a logged act. A student can see that staff looked.
5. **Crisis is routed to professionals.** Semester is not an emergency service. Self-harm language shows resources and routes to the campus professional; it never silences or holds the writer.
6. **Minors are a separate case, not a setting.** A different posture is decided with counsel, tested in SQL and reviewed on every change.
7. **No engagement mechanics that exploit stress.** The feed is finite; there are no leaderboards, streaks or scores shown to students; the private safety entry is never a ranking input. These are structural tests (`engagement.test.ts`), not a promise.
8. **Say what we did not do.** Transparency reporting states counts and limits, and nothing is published without a verified process.

## 2. Surfaces and what each needs before it is switched on

| Surface | Needs before it is on | Built | Not built |
| --- | --- | --- | --- |
| Community text | Report, triage, decide with reason, appeal, reviewer least-privilege, rate limits, detectors, age posture, crisis routing, a staffed reviewer, a written policy counsel has read | Everything in the database through appeals and volunteers | Age gating in SQL; staffed coverage; case assignee and clock; immutable case history; read logging; the policy in force |
| Community images | All of the above, plus a scanner, a known-abuse hash provider, a preserve-report-remove procedure, a takedown clock, and counsel's confirmation of the abuse-material section | Metadata stripping on the device; a private bucket; size and type limits; a hash blocklist; an exemption of matches from every deletion path | The scanner; the provider; the reporting code; the takedown mechanism; counsel's confirmation |
| Aliases (pseudonymity) | A program row per community; reveal only through a case | Reveal protocol; limits; no images under an alias | — |
| Volunteer moderation | Calibration; blind view; recusal; rate caps; two-agree removal | All, off by default in two places | Production approval |
| Institution escalation | A signed agreement with a professional contact; two different professionals; a signed webhook | The database half and the signing helper | The Edge Function; the agreement; the cron job (parked) |
| Marketplace | See section 6 | A moderated opportunities table | Everything else |
| AI output | A way to report an answer to an owner; a switch; a policy | The switch (fail-closed); the clamp; the prohibited-scope intake; the audit journal | The report flow; the staffed response |

## 3. Decisions

**Severity.** The community scale is P0 to P3 and decides *who may act*: P0 and P1 are professional-only (staff and the campus contact); P2 needs staff; only clear P3 and clear P2 spam reach volunteers. It is separate from the incident scale, which decides *how the company responds*. A P0 or P1 community case is an incident (SEV1 or SEV2) under [IR-09](INCIDENT-PLAYBOOKS.md#ir-09) the moment it is opened.

**Enforcement ladder.** Protect (reduce distribution, rate limit, preserve) → notify the author with the reason code → remove the item → restrict the account for a period → end the account. Each rung needs a reason code and a reviewer other than the author's; the restriction of an account at P0 needs a senior reviewer; ending an account is staff-only and appealable. Skipping a rung is allowed only for P0 and is recorded as a skipped rung.

**Appeals.** Authors may appeal removal, restriction and ending. Reporters may not appeal. The appeal is decided by someone who did not decide the original. A granted appeal reverses the restriction and the private safety entry. The student sees the outcome and the reason code, never a score and never the reporter.

**Reports.** Anyone may report. A reporter cannot read their own report back, by design. A report about a person rather than a post (a club, an event, an opportunity, a person) is not yet possible because a case requires a post (register SAF-003); four blueprint reasons are missing (commercial solicitation, club or event policy, accessibility barrier, outdated information). These are gaps, listed so they are not lost.

**Transparency.** Counts of reports, cases by severity, removals, restrictions, appeals and their outcomes, escalations and median time to decision are published quarterly once Community is on, from the case tables, verified by hand against a sample first (TR-44). No figure is published from a process that has not been checked.

## 4. Moderator access

| Principle | Rule | Today |
| --- | --- | --- |
| Least privilege | Reviewers do not see the reporter; volunteers see a blind view with no name, email, id, reporter or social graph | In place |
| Time-bound reveal | An alias reveal needs a case, lasts four hours, is decided by a different reviewer, and every look is a case event | In place |
| Read logging | Opening the queue and opening a case are logged | **Not logged** (TC-TSF-02; TR-34) |
| Immutable history | Case events cannot be edited and are kept on the retention schedule | **Mutable; deleted with the case** (MOD-004; TR-34) |
| No self-review | A decider never decides their own appeal; a volunteer recuses on knowing the author | In place |
| Standing identity access | None. Liaisons and administrators have none; a platform support role needs a case | In place for liaisons; a periodic review of who holds the capabilities does not exist |
| Training | A new reviewer completes calibration (20 items, 85 % to pass) before real work; staff complete a briefing covering minors, crisis language, and abuse material | Calibration is built; the briefing is not |
| Wellbeing | Exposure limits, rotation, a way to step away, and support, for anyone who reviews severe material | Volunteers are rate-capped at 20 an hour; nothing exists for staff |
| Audit | A quarterly review of every reveal and every safety read, by someone who made none | Not scheduled |
| Offboarding | Capabilities end the day a reviewer leaves | The SCIM trigger covers school-scope grants only (audit L61) |

## 5. Minors

The minimum age is thirteen, enforced in SQL; the birth date is never stored. Minors are kept out of discovery, matching, mentoring and employer visibility. **The Community migration does not reference minor status**, so a minor may join and post (TC-PRV-06; TR-35). The posture for minors in Community — whether they may join at all, whether posts are visible beyond the cohort, and who is told — is an open decision for counsel and the institution (requires qualified human counsel review). Until it is made, Community is not switched on at any tenant that has minors.

## 6. Marketplace entry criteria

There is no marketplace and none is to be built before every item below exists, in this order. The register already defers it; this is the list that lets the deferral end.

1. **A threat model** reviewed by the security and trust seats ([T3](THREAT-MODELS.md#t3-marketplace-and-partner-listings)).
2. **Provider verification**: identity and business verification, sanctions and tax screening where payments exist, a visible verified state, and re-verification on change.
3. **Listing review**: moderator approval, re-review on edit, https-only links, and a ban on categories the institution has not approved (housing, financial products, ticket resale, anything involving minors).
4. **Disclosure**: a student-visible statement of what a provider receives, a snapshot of it at acceptance, and a delivery receipt.
5. **Money**: payment through the processor only, no card data in Semester, an order record, refund and dispute paths with a clock, payouts with holds, a reconciliation to the processor, and chargebacks handled as incidents ([IR-10](INCIDENT-PLAYBOOKS.md#ir-10)).
6. **Reports on a listing and a provider**, the same case path as Community, with removal and sanction.
7. **Fraud and scam playbook** exercised ([IR-13](INCIDENT-PLAYBOOKS.md#ir-13), TT-13).
8. **Consumer, tax, payment and terms review by counsel** (requires qualified human counsel review).
9. **A staffed owner** with hours and a backup.

## 7. AI trust and safety

- **Prohibited** at intake (refused by `ai-lifecycle.ts`): autonomous registration, certifying an official degree, financial-aid decisions, disciplinary judgments, health decisions, opaque risk scoring, automated hiring decisions, ranking students for employers, auto-publishing institutional policy, unapproved production changes.
- **Report an answer.** Every AI answer carries a way to say it was wrong, unsafe or showed something it should not, which opens a case with the prompt, context-assembly log, sources and output attached by reference (item to be created; today feedback controls are local).
- **Red lines for the model route**: no training on student content by default (a policy; no control enforces it, and no provider terms are signed), no provider change without the adversarial run, no model without a pinned identifier.
- **Human review** by tier: assistive and contextual outputs are disclosed and controllable; advisory outputs show sources and uncertainty; action-proposing outputs require a preview and confirmation; high-impact outputs require a designated person and are never final.
- **Incidents** follow [IR-04](INCIDENT-PLAYBOOKS.md#ir-04), with the switch and a two-person release (the second person is unassigned).

## 8. Government and law-enforcement requests

A procedure exists only as a draft with every field to be decided (`docs/legal-drafts/LAW-ENFORCEMENT-REQUEST-PROCEDURE-DRAFT.md`). Nothing is in code. The framework requires: one intake address; authentication of the requester; counsel reviews every request before any data moves; scope narrowed to what the request names; legal holds placed on the affected scope; a log of every request and response; and no statistic published without a verified reporting process. Emergency disclosure is for counsel to define (requires qualified human counsel review).

## 9. Gates

Community and image posts stay off until: TR-34, TR-35, TR-36 are done; the community-safety tabletop (TT-11) has produced a go decision; counsel has confirmed the abuse-material, takedown and minors sections; and a named trust owner with a backup exists. The register line and a release-profile gate that refuses it are item TR-11.
