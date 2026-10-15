# 05 · AI feature requirements

**Builds on:** `packages/institution/src/agents.ts` (four scoped roles), `course-agent-policy.ts`,
[`../FOUR-ROLE-INTELLIGENCE.md`](../FOUR-ROLE-INTELLIGENCE.md),
[`../operating-model/AI-LIFECYCLE-GATES.md`](../operating-model/AI-LIFECYCLE-GATES.md) (the five starting use cases),
[`../ai-toolkit/`](../ai-toolkit/README.md), [`../operating-model/AI-GRADING-AND-INTEGRITY.md`](../operating-model/AI-GRADING-AND-INTEGRITY.md),
[`../CRISIS-RESPONSE-RUNBOOK.md`](../CRISIS-RESPONSE-RUNBOOK.md).

Every feature below is held to the same frame, so a reviewer can compare them and a test can ask the same questions
of each. **Suites** name the evaluation suites of [chapter 06](06-evaluation-framework.md). **State** says plainly what
exists. Seven features, mapped onto the nine inventory systems of [chapter 01](01-inventory-and-risk-tiering.md):

| Feature | Inventory | Tier | Code today |
| --- | --- | --- | --- |
| Tutor | `AI-01.2`, role `tutor` of `AI-02.1` | 1 / 2 | Role, instruction and course-policy modes; `socratic.ts`; teach-back, solve |
| Advisor | role `advisor` of `AI-02.1` | 3 | Role and instruction; advisor-agenda drafting in `ProductivityPreparation.tsx` |
| Planner | `AI-01.1`, `AI-01.4`, `AI-03.3` | 3 / 1 / 2 | Assistant role with tools; planning narratives; change proposals |
| Writer | `AI-01.3` | 1 | Assignment breakdown, project file, `gate()` on essays, proofreading |
| Research assistant | `AI-01.5` and the toolkit research studio | 1 | `FindSources`; research studio with verification rules |
| Support assistant | none | 2 (proposed) | **Nothing.** Specified here |
| Institutional automation | `AI-02.1` and `packages/institution` workflows | 3 | The ladder, workflows and the two-phase action journal; no AI-driven execution |

## Rules that hold for every feature

1. **Never an unreviewed high-impact decision.** No feature admits, awards, grades, disciplines, accommodates,
   diagnoses, certifies, registers, ranks or scores a person. These are refused at intake
   (`PROHIBITED_STARTING_SCOPE`); a feature that can be argued into one is mis-scoped, not "careful".
2. **Policy first, always.** Course and institution policy outrank the user's request, the role and the prompt.
   **Unknown policy permits concepts, analogous practice and instructor questions only.** Changing role cannot bypass it.
3. **Source-aware.** Claims rest on retrieved, cited, dated sources, or are labelled **general knowledge** or
   **inference**. A feature that cannot say which a sentence is does not ship.
4. **Proposals, not acts.** Every write is a reviewed proposal ([chapter 04](04-tool-broker.md)).
5. **A person is one step away.** Every refusal on a sensitive class offers a human route; every feature has a
   non-AI path that is a real path.
6. **Visible.** Labelled as AI at the output; route disclosed; limits stated ([chapter 09](09-user-transparency.md)).
7. **Evaluated at its tier and killable on its own** ([chapters 06, 07, 10](10-red-team-and-launch-gates.md)).

## 1 · Tutor

**Job.** Help a student understand and practise material in a course. **Users:** students.
**Tier 1** on the student's own material; **tier 2** once bound to institution-approved course sources.

| | |
| --- | --- |
| May use | The selected course's approved sources (exactly one course); the student's own notes and attempts (T0–T2); the course AI policy |
| Tools | `open_screen`, `search_material`, `start_timer`, `add_note` (the role's list in `agents.ts`); nothing that reads grades |
| Must | Begin with the learning goal and what the student has tried; ask one guiding question, then one hint or a comparable worked example, then invite an attempt; give concept-focused feedback with a source anchor; state when a source is missing or stale; when policy is unknown, offer concept review, analogous practice and instructor questions |
| Must never | Complete active restricted graded work, choose live assessment answers, fabricate a citation, datum or result; **infer ability, effort, disengagement or risk**; report anything to staff; be used for grading or discipline |
| Oversight | H0. The student reads and decides; the course policy mode (`explain`, `hint`, `practice`, `review`, `draft`) is enforced server-side, and a mode the course does not allow is `course-mode-disabled` |
| Escalation | "Ask your instructor" with the instructor's published route; academic-integrity doubt goes to the policy text, not to an accusation; distress goes to the crisis route |
| Suites | `SU-GROUND`, `SU-POLICY`, `SU-REFUSE`, `SU-INJECT`, `SU-BIAS`, `SU-ACCESS`, `SU-NUM` |
| State | Role, instruction and server-side policy modes are built and tested. No evaluation run for the role; no live red-team on the institutional route |

## 2 · Advisor

**Job.** Help a student prepare an academic or career decision and a conversation with a human advisor.
**Users:** students. **Tier 3**: the role can reach consequential action classes, and the decision it supports is high-impact.

| | |
| --- | --- |
| May use | Student-selected planning details; approved catalog and requirement sources, dated; the student's own goal |
| Tools | `open_screen`, `find_deadlines`, `read_tasks`, `read_timetable`, `search_material`, `add_note`, `make_document`; **prepare only**: the gateway refuses any non-`prepare` action for a role other than `assistant` |
| Must | Offer **at most three options**; separate verified source facts, student-entered context, planning estimates and unknowns; prepare editable questions and an agenda; **name the official decision owner**; link the official path; label every estimate as one |
| Must never | **Certify degree progress**; guarantee eligibility, graduation, transfer credit or aid; replace a human advisor; recommend a course on the basis of an inferred ability or an outcome score; show anything to an advisor the student did not choose to share |
| Oversight | H0 for the draft; H3 where a human advisor uses it: the advisor reviews authoritative sources and records their own rationale. Not a decision system |
| Escalation | Every answer that touches a requirement ends at the human advisor and the official audit. A question that is really "decide this for me" is answered with the options and the owner |
| Suites | `SU-GROUND`, `SU-POLICY`, `SU-REFUSE`, `SU-HANDOFF`, `SU-BIAS`, `SU-INJECT`, `SU-ACTION` |
| State | Role and instruction built; advisor-agenda drafting exists on the preparation screen. Requirement sources are not retrievable server-side (`RP-04`); no degree-audit grounding; no evaluation |

## 3 · Planner (executive assistant)

**Job.** Organise a student's time: priorities, schedule, recovery after a bad week, reminders.
**Users:** students. **Tier 3** because the model chooses among tools that change the student's own plan.

| | |
| --- | --- |
| May use | The student's own tasks, deadlines, timetable, notes (T2); **grades and attendance only on consumer routes** and per `RP-08`; never on institution-directed routes |
| Tools | The assistant role's full list, scoped by mode (`toolscope.ts`): `add_task`, `move_task`, `start_timer`, `add_note`, `make_document`, `set_day_budget`, `set_next_step`, `add_application`, `move_application`, `tick_deadline`, plus reads. Each write carries its inverse |
| Must | Let the student choose the trade-off; say why an item is suggested; explain a deadline from the quote it came from; show every write as a card with its undo; count figures in code and have the model write only the sentences |
| Must never | Claim a request, message or record change is complete without verified confirmation; send, share, pay or change an official record; shame, rank or predict the student; infer health, ability or failure risk from the data it plans around |
| Oversight | H1 for proposals; the student presses; a view on the current screen applies on arrival and anything else waits |
| Escalation | Overload, distress or a basic-needs signal gets a human and a campus route, not a better schedule |
| Suites | `SU-TOOL`, `SU-ACTION`, `SU-GROUND`, `SU-NUM`, `SU-INJECT`, `SU-REFUSE`, `SU-BIAS` |
| State | The best-built of the seven. Tool scoping, inverses, round and lookup caps are tested. Not evaluated end to end; its kill path is advisory on three routes ([chapter 07](07-incident-response-and-shutdown.md)) |

## 4 · Writer

**Job.** Help a student write: break down an assignment, structure a project, proofread, draft non-coursework prose.
**Users:** students. **Tier 1**, with **integrity as a property of every output**.

| | |
| --- | --- |
| May use | The student's own draft and the assignment instructions (T2); the course policy on drafting |
| Tools | None that write beyond the student's own document |
| Must | For coursework: produce headings, the question each section must answer, a source table holding *the student's* sources, the rubric as a checklist and **blanks where the claims go**; critique a draft against the rubric; label any generated prose a generated draft; keep non-coursework drafting behind `gate()` in `lib/essay.ts` |
| Must never | Write the assignment; write a submission-ready answer for restricted graded work; invent a source; present AI text as the student's without the disclosure the course requires; evade a course that prohibits AI |
| Oversight | H0. The student owns the work; a declaration of AI use is offered where the course asks for one (`ai-toolkit/RUBRIC-AND-AI-USE-POLICY.md`) |
| Escalation | A request that would complete graded work becomes concept help and a question for the instructor |
| Suites | `SU-POLICY` (integrity boundary), `SU-GROUND`, `SU-REFUSE`, `SU-INJECT`, `SU-ACCESS`, `SU-BIAS` |
| State | Builders refuse to write the assignment and are fenced; the live red-team covered assignment breakdown and draft feedback (21-case run, route `shared-key`). No jailbreak suite for the integrity boundary |

## 5 · Research assistant

**Job.** Find, read, screen and cite sources; synthesise with the evidence visible. **Users:** students.
**Tier 1**, the surface **most exposed to fabrication**, because it is the one not grounded in the student's own material.

| | |
| --- | --- |
| May use | The student's own sources; public sources the student selects; the research studio's source records |
| Tools | `add_source` as a proposal; no connector that fetches on its own |
| Must | Mark each source **verified only when the original was opened** and a full citation and a matching quotation or page exist (the toolkit's `verify()`); label an AI summary as one and **never cite it as a source** (excluded from RIS and BibTeX); print missing citation fields as `[… missing]` instead of generating them; flag causal wording against non-experimental designs |
| Must never | Produce a citation it did not receive; present a suggestion as a verified source; browse or fetch without the student's action; send student work to a connector (`externalConnectors` is hard-wired off) |
| Oversight | H0, with the verification tick as the control: self-attested, and honestly labelled as such |
| Escalation | "Ask a librarian" and the library's route for anything the student cannot verify |
| Suites | `SU-GROUND` (**fabricated-citation rate is a critical fail**), `SU-INJECT` (web and PDF), `SU-LEAK`, `SU-ACCESS` |
| State | Verification rules built and tested in `lib/toolkit/research.ts`. `FindSources` is a model suggestion with no verification step on its own output |

## 6 · Support assistant (new)

**Job.** Answer "how do I…" and "what is the policy on…" from published help, and route a problem to a human with
the context already gathered. **Users:** students, staff, guardians, each with a different scope.
**Tier 2** as specified: published sources and a ticket *draft*, no account data. **Nothing exists**; no AI in the support path today.

| | |
| --- | --- | 
| May use | Published help, status and policy pages (institution and Semester); the user's own question; **no account records in phase 1** |
| Tools | `draft_ticket` (prepare only); `open_screen`; `find_help`. Ticket creation is a user confirmation; **no tool reads another person's data** |
| Must | Cite the help page; say when the answer is not in the help and route to a person; show who will answer and when; keep the user's text out of anything but the ticket they confirm; recognise crisis and basic-needs language and **route to the crisis and campus-escalation runbooks before anything else** |
| Must never | **Impersonate staff or a person**; claim to have fixed, refunded, reset or changed anything; read or act on an account without a consent-based, audited, time-limited grant given to a **human** agent; give legal, medical or financial advice; discourage reaching a human |
| Oversight | H0 for answers; H1 for the ticket draft. Support staff work is human work with its own audit |
| Escalation | A visible "talk to a person" on every answer; crisis language bypasses the assistant entirely |
| Suites | `SU-GROUND`, `SU-HANDOFF` (crisis, basic needs), `SU-REFUSE`, `SU-LEAK`, `SU-BIAS`, `SU-ACCESS`, `SU-INJECT` (pasted emails) |
| State | Not started. Phase 2 (account-aware answers) is tier 3 and needs the consent-based access model and the approvals path of [chapter 04](04-tool-broker.md) first |

## 7 · Institutional automation

**Job.** Help staff and faculty run institutional work: triage a queue, draft communications, prepare a bulk change,
summarise a case file, generate a report. **Users:** staff, faculty, administrators. **Tier 3**, and the feature
most likely to be mis-scoped into a decision.

| | |
| --- | --- |
| May use | The records the acting staff member is **entitled to**, through the policy decision point, as them; least privilege and field-level policy; nothing for scoring |
| Tools | Per registered workflow; rungs `inform` to `prepare` freely; `confirm` and above by **human approval**, not self-approval ([chapter 04](04-tool-broker.md)) |
| Must | Prepare, never commit; show the diff against the authoritative record; require **four-eyes** on a bulk change; keep a case summary traceable to its sources; record who approved what |
| Must never | **Auto-publish institutional policy**; make or recommend an eligibility, discipline, aid, accommodation, admission or hiring decision; run an unapproved production change; rank students for employers; score risk opaquely; act outside the tenant's configuration |
| Oversight | H2 for any record-affecting action; H3 where a human decision uses the output, with the decision-maker's own recorded basis. Reviewer capacity, authority and the freedom to reject are conditions of the feature, not a nicety |
| Escalation | An approval queue with an owner, an SLA and a stop rule; pausing the feature when reviewers cannot verify sources |
| Suites | `SU-TOOL` (permission simulation as every role), `SU-ACTION`, `SU-LEAK`, `SU-BIAS`, `SU-INJECT`, `SU-HANDOFF`, `SU-POLICY` |
| State | The ladder, workflow state machines and the two-phase journal are built. **No AI executes anything**: the runtime wires `execute` to refuse. No approval queue exists |

## What each feature needs before a pilot

By tier, from [chapter 10](10-red-team-and-launch-gates.md). None has met its tier's gate; the whole release gate
(`AI_RELEASE_GATE`) is open for every feature, so nothing here is in pilot and no claim in the product or the
contracts should say otherwise.

| Feature | Tier | Largest blocker |
| --- | --- | --- |
| Writer, Research assistant | 1 | An evaluation run; for the research assistant, a verification step on its own output |
| Tutor | 1 / 2 | Evaluation; course-source retrieval with authority and freshness (`RP-03`, `RP-04`) |
| Planner | 3 | Permission simulation, kill-switch containment on all routes, independent red-team |
| Advisor | 3 | Grounded requirement sources; independent red-team; named human decision owner |
| Support assistant | 2 | Everything: it is not built |
| Institutional automation | 3 | The approval path, server-rendered previews, an adapter with readback, a deployed gateway |
