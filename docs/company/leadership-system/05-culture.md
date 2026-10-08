# 6 · Culture principles

> **PROPOSED — NOT ADOPTED.** A culture statement is worth only the mechanisms behind it. For each principle: what it means, how it shows up, **the mechanism that makes it real**, and how to tell it is slipping. Mechanisms that already exist in the repository are linked; they are the proof that the principle is practiced and not posted.

Five principles. Each is something Semester will sometimes pay for. The cost is stated, because a principle with no price is a slogan.

## Trust

**We are trusted with students' records, time and choices. We act as if every one of them can see what we did.**

| | |
| --- | --- |
| **Means** | Minimal data, honest claims, visible reasoning, no hidden profiling, no dark patterns; the same standard for a student, an institution and a colleague |
| **Looks like** | Saying "we don't know yet" in a customer call · writing the limitation next to the claim · telling advisors about an incident inside 24 hours, before they ask · handling a mistake as a record, not an anecdote |
| **Does not look like** | Rounding a number up · describing a repository capability as a live service · letting a colleague learn about a problem from a customer |
| **Mechanisms** | [Public claims register](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) (prohibited claims are structurally unavailable) · fail-closed defaults ([`COMPANY-OPERATING-MODEL.md`](../COMPANY-OPERATING-MODEL.md#operating-principles)) · blameless incident reviews that end in a structural fix, not a name · the no-surprises notice ([01](01-board.md#reporting-cadence)) |
| **We pay** | Slower sales language, lost deals that wanted a claim we cannot support |
| **Slipping when** | Claims are found live outside the register · incidents are described by who, not why · the trust ledger shows items past their expiry |

## Ownership

**Every outcome has one named owner. Owning means the outcome, not the task.**

| | |
| --- | --- |
| **Means** | A single accountable person for each decision, key result, initiative, risk and runbook; the owner finds the gap, closes it or says clearly that it is not closing |
| **Looks like** | "My name is on it" · surfacing a miss early with a proposal · asking for help with the specific thing in the way |
| **Does not look like** | "We" as an owner · waiting to be assigned · escalating a problem without a recommendation · holding knowledge only in one head |
| **Mechanisms** | [Owner matrix](../../../OWNER-AND-ACCOUNTABILITY-MATRIX.md) with a backup per seat · one DRI per decision and initiative ([02](02-decision-rights.md), [07](07-communications-and-tracking.md#initiative-tracking)) · runbooks written by the person who performs the work · the rule that no seat is single-held by Series A ([08](08-continuity.md)) |
| **We pay** | Owners must be given real authority and the risk of being wrong |
| **Slipping when** | Items have a team name instead of a person · decisions age past their clock · the same incident repeats |

## Student-centered design

**The student is the person the product is for, and the person with the least power in the room. We design so that their agency increases.**

| | |
| --- | --- |
| **Means** | Students control sharing, notifications, AI context and portability; the product explains why it shows what it shows; the institution's and guardian's views never silently exceed what the student and policy allow |
| **Looks like** | Every product requirement states the student's first-win measure and what the student can change · talking to students every month · bringing a hard consent question to a student before shipping |
| **Does not look like** | Engagement for its own sake · defaults that benefit the buyer at the student's expense · designing from what a dashboard can show |
| **Mechanisms** | A seat for a current student on the Advisory Council and on every AI and consent decision ([01](01-board.md#advisory-council), [06](06-domain-governance.md#ai)) · [`ACTION-EXPLAINABILITY-AND-STUDENT-CONTROL.md`](../../ACTION-EXPLAINABILITY-AND-STUDENT-CONTROL.md) and [`CONSENT-SHARING-DESIGN.md`](../../CONSENT-SHARING-DESIGN.md) · student contact quota: every product and design owner has at least a stated number of student conversations per month `[DECIDE]` · accessibility task success as a guardrail on every growth key result ([03](03-okrs-planning-metrics.md#okr-system)) |
| **We pay** | Slower growth levers; features declined because they weaken student control |
| **Slipping when** | A consent or data-use change ships without a student reading it first · no student conversation logged in a month · accessibility task success drops |

## Execution quality

**"Done" means done for the person who depends on it, and finished means shown, not said.**

| | |
| --- | --- |
| **Means** | Small, testable, reversible steps; quality is not a phase; a screen, mock action, state reducer or passing unit test is not a live capability |
| **Looks like** | Reverting a fix to watch its guard fail and then restoring it · including a control in every measurement · screenshots for anything visual · merging only behind green gates |
| **Does not look like** | "Works on my machine" · shipping around a failing check · a green dashboard nobody has tried to break |
| **Mechanisms** | [`DEFINITION-OF-DONE.md`](../../DEFINITION-OF-DONE.md) · the gates in [`CLAUDE.md`](../../../CLAUDE.md#the-gates-and-what-each-is-for) · proving a change by measurement, including negative controls · [`REGRESSION-CHECKLIST.md`](../../../REGRESSION-CHECKLIST.md) · release councils and error budgets ([`SLOS-AND-ERROR-BUDGETS.md`](../../operating-model/SLOS-AND-ERROR-BUDGETS.md)) |
| **We pay** | Fewer things shipped per month than the backlog wants |
| **Slipping when** | A gate is skipped "just this once" · regression after a "fix" · evidence artifacts filed late |

## Healthy disagreement

**We want the strongest objection early, in writing, aimed at the idea. Then one person decides and we move.**

| | |
| --- | --- |
| **Means** | Candor is safe; hierarchy does not decide what is true; once decided, we commit, and the dissent stays in the record |
| **Looks like** | "Here is the strongest argument against my own proposal" · changing your mind in public · a recorded dissent that turns out to be right, and that being treated as a win |
| **Does not look like** | Silence in the meeting, argument in the corridor · relitigating a decision without new evidence · consensus as a goal |
| **Mechanisms** | **Dissent recorded by name and reason** in every Class A decision and board minute ([01](01-board.md#meeting-mechanics), [02](02-decision-rights.md#escalation-rules)), as the AI board already does ([`AI-GOVERNANCE-BOARD.md`](../../operating-model/AI-GOVERNANCE-BOARD.md#decision-rules)) · written pre-reads before every decision meeting · **pre-mortem** for every plan and Class A decision: assume it failed, list why, and attach a tripwire to each reason · **red-team rotation** on the quarterly plan: someone outside the owner argues the opposite for 15 minutes · "disagree and commit" requires a review date · the pause-review right for an outside advisor |
| **We pay** | Some meetings run long; some ideas get slower |
| **Slipping when** | No dissent appears in any record for a quarter · the same decision is reopened three times · people agree in the meeting and object afterwards |

## What we decline

A short list of trade-offs we make on purpose, to settle arguments before they start:

- We choose **a smaller claim we can prove** over a larger one we cannot.
- We choose **a slower institution** over one the student has no say in.
- We choose **a documented limitation** over an undocumented workaround.
- We choose **depth in the domains that are in a committed motion** over a thin presence in all of them. Unstaffed domains stay owned by Core and are not marketed.
- We choose **a named owner with a backup** over a hero.

## Making culture hold as people join

| Moment | Mechanism |
| --- | --- |
| Hiring | A trust interviewer with a veto on integrity; a values-based question set scored against the [rubric](04-organization-and-hiring.md#competency-rubric) |
| Onboarding | Day-one reading includes this page; the first merged change in week one behind the real gates ([04](04-organization-and-hiring.md#onboarding)) |
| Promotion | Levels reward the competencies here, not tenure ([04](04-organization-and-hiring.md#leveling)) |
| Conflict | The escalation path in [02](02-decision-rights.md#escalation-rules) |
| Founder load | Healthy disagreement includes disagreeing with the founder; the operator advisor checks that it is happening |

## Measuring it without a survey theatre

A quarterly five-question pulse (anonymous once there are 8 or more people; earlier, a conversation with the operator advisor): *Do I know what I own? Can I say what I disagree with and be heard? Do I know what students told us last month? Would I ship what I made today to a student I know? What should we stop?* Trend, not score.

## What to delete

If a principle has no mechanism in the table, delete the principle or build the mechanism. A culture page longer than this one is a poster.
