# 01 · The evidence model

| Control | Value |
| --- | --- |
| Status | **PROPOSAL — not yet registered in `SEMESTER-OPERATING-SYSTEM.md`; the product seat accepts it by decision** |
| Owner seat | `product` (held by the founder, acting) |
| Written | 2026-10-04 at `dac31c9` |
| Machine-readable form | [`repository/register.json`](repository/register.json), held by `app/src/lib/ops/researchregister.test.ts` |

Everything else in this pack uses the words defined here. If another page
disagrees with this one, this one wins and the other page has a bug.

## The rule

**An opinion is evidence about the person who holds it, not about the product.**

A stakeholder's opinion, a feature request, a sponsor's enthusiasm, a
competitor's positioning, a third-party audit's assertion and a model's
synthesis are all *inputs to a hypothesis*. None is a finding. A request is a
data point about a problem somebody believes they have; the problem is what
gets recorded, and the proposed solution is thrown away until the problem is
tested.

Two consequences the rest of the pack enforces:

1. **Volume does not convert opinion into evidence.** Forty people asking for a
   feature is forty opinions. Four people *observed* failing at a task is a
   stronger signal than the forty.
2. **Building a thing is not evidence anyone needs it.** Tests passing, a
   screen existing and a capability being `DESIGN_PARTNER` in
   [`CAPABILITY-STATUS-REGISTRY.json`](../market-readiness/CAPABILITY-STATUS-REGISTRY.json)
   establish that it *exists and behaves as built*. [`VALIDATED.md`](../../VALIDATED.md)
   already says what this leaves open: zero users, zero retention data, zero
   willingness-to-pay observations. This pack is the plan for changing that,
   and its first act is to refuse to count the existing build as demand.

## Source classes — what kind of thing was this?

Every piece of evidence has exactly one class. The class sets a **ceiling** on
what it can establish alone.

| Class | What it is | Can establish alone | Cannot establish alone | Ceiling |
| --- | --- | --- | --- | --- |
| `measured-outcome` | A result under a pre-registered method, population and denominator ([`EXPERIMENTATION-PROTOCOL.md`](../market-readiness/EXPERIMENTATION-PROTOCOL.md)) | That the measured change happened in that population | Causation without a comparison design; generalisation | C4 |
| `observed-use` | Someone seen or measured doing the task: moderated usability, workflow observation, product activity marks | What people actually do, where they fail, how long it takes | Why they do it; whether they would choose it unprompted | C3 |
| `commitment` | A costly action: scheduled time, shared real data, a referral, a signed letter or order, money | That the intent was strong enough to cost something | That the commitment will be kept; what the person needs | C3 |
| `self-report` | Interview, survey, diary entry, in-app feedback | Perceptions, vocabulary, remembered events, stated reasons | What they do; accurate frequencies; future behaviour | C2 |
| `artifact` | An institution's document, form, policy, ticket log or published SLA | What the institution formally says it does | What actually happens at the desk | C2 |
| `opinion` | A stakeholder view, preference, forecast or feature request; a champion's or sponsor's enthusiasm; interest expressed on a sales call | That the person holds the view | Anything about need, usage, price or outcome | C1 |
| `desk` | Competitor material, analyst reports, third-party audits (including the audit this pack answers), the repository's own documents, any AI-generated synthesis | Where to look, what to ask | Anything about users | C1 |

A thing's class is decided by how it was obtained, not by who said it. A
registrar's *description* of a process is `self-report`; the same registrar's
*written policy* is `artifact`; the same registrar *watched doing the process*
is `observed-use`; the same registrar saying *"we'd definitely buy this"* is
`opinion` however senior.

## Confidence levels — how far does the pile of evidence go?

Confidence belongs to an **insight** (a claim about people), never to a quote
or a session. The levels are cumulative.

| Level | Name | Requirement (all of it) | May justify |
| --- | --- | --- | --- |
| **C0** | Unevidenced | Asserted only: `opinion`/`desk` sources, or no source. The default state of every claim, including this pack's own. | Choosing what to test next. Nothing else. |
| **C1** | Signal | One independent source in a class above `opinion`/`desk`, **or** several `opinion`/`desk` sources that agree. | A cheap, reversible experiment. |
| **C2** | Supported | At least **two** independent sources from classes above `opinion`/`desk`, in the target segment; for a pattern across people, at least **five** independent participants in that segment. | A flagged, reversible product change. |
| **C3** | Established | C2, **plus** at least one `observed-use` or `commitment` source (the say/do check), **plus** a recorded disconfirmation search, **plus** replication in a second round, cohort or term. | Hard-to-reverse choices: pricing, data scope, navigation roots, integration commitments, hiring. |
| **C4** | Outcome-validated | A `measured-outcome` source with method, population, denominator and comparison stated. | Claims about outcomes. Causal wording only if the design was causal. |

The numbers (five participants, two sources) are **defaults set before any
data exists**, in the manner [`ANALYTICS.md`](../../ANALYTICS.md) fixes its
windows before the first row. They are tuned by a recorded decision, never
adjusted to make an inconvenient finding pass.

**Independence.** Two quotes from one session are one source. Two participants
introduced by the same champion are correlated, not independent: count them as
one source until a participant arrives by another route. Two surveys sent to
the same list are one source. Evidence the founder collected from friends
counts, but is tagged `route: warm` and cannot be the whole base of a C3.

**Say/do.** C3 exists because what people say and what they do diverge. An
insight resting only on self-report tops out at C2 however many people said it.

**Expiry.** A level lapses one step at its `reviewBy` date: student behaviour
at the end of the following term; institutional process 12 months; price and
market findings 6 months. An expired C3 is a C2 and is not used to justify a
hard-to-reverse choice until re-confirmed.

**Segment.** An insight applies only to the segment it was sampled from. A
finding from sophomores at one private university is a finding about that, not
about "students".

**Counter-evidence is kept, not resolved away.** A refuting source is attached
to the insight; it lowers the level or splits the segment. Nobody deletes it.

## Insight taxonomy — what is the claim about?

Every insight has one `type`, one `stakeholder`, one `scope` and, where it
applies, one `moment`.

| `type` | A claim about… | Example shape (hypothetical wording) |
| --- | --- | --- |
| `need` | A job or problem the person has, whether or not they have a solution | "Students re-enter the same deadline in three places" |
| `behavior` | What people do, with what frequency, in what order | "Planning happens in the 24 hours before a deadline" |
| `friction` | Where a task slows or fails | "Participants stalled at the source-confirmation step" |
| `workaround` | What they do instead; the strongest need signal available | "Keeps a hand-built spreadsheet beside the LMS" |
| `motivation` | Why they act or don't | "Plans only when a due date is within a week" |
| `constraint` | A rule, policy, schedule or technical limit | "Aid office will not accept data it did not originate" |
| `trust-concern` | What they fear or want protected | "Does not want an advisor to see AI chat history" |
| `access-barrier` | Where assistive-technology or ability needs are unmet | "Focus order breaks after a modal closes" |
| `willingness` | Intent to adopt, share data, consent or pay (always paired with the evidence class, since it is the claim most often built on opinion) | "Would pay $X monthly" |
| `workflow-fact` | How an institutional process actually runs, who owns each step | "Registrar corrects holds in a nightly batch" |
| `outcome` | A change in a measure over time | "Missed-deadline count fell over the term" |

| Tag | Values |
| --- | --- |
| `stakeholder` | `student`, `family`, `faculty`, `advisor`, `registrar`, `finance`, `student-affairs`, `it`, `accessibility`, `employer`, `alumni`, `partner` |
| `scope` | a capability `id` from the capability registry; an **audit surface** from [`05-AUDIT-VALIDATION.md`](05-AUDIT-VALIDATION.md); or `thesis`, `market`, `pricing` |
| `moment` | the eight ids in `lib/momentfeedback.ts`: `first-plan`, `support-routed`, `advising`, `study-session`, `ai-answer`, `accessibility-support`, `registration`, `course-ended` — reused so an interview finding and an in-product prompt answer land in the same place |
| `route` | `warm` (founder's network), `cold` (recruited without prior relationship), `institutional` (via an office), `inbound` (came unprompted) |

## Decision linkage — what may a level justify?

A decision is classed by how hard it is to undo and who it reaches. The class
sets the **minimum confidence** of the insights it rests on.

| Class | Reach | Minimum | Also required |
| --- | --- | --- | --- |
| `internal-reversible` | Order of work, internal experiments, copy tests behind a flag | **C1** | A named guardrail ([`EXPERIMENTATION-PROTOCOL.md`](../market-readiness/EXPERIMENTATION-PROTOCOL.md)) |
| `user-reversible` | A flagged change real users see | **C2** | Flag, rollback path |
| `hard-to-reverse` | Pricing, data scope, consent model, navigation roots ([`DO-NOT-BUILD.md`](../DO-NOT-BUILD.md) rule 1), integration or hiring commitments | **C3** | A recorded decision `D-<pull request number>` |
| `claim` | Any external statement about users, needs, adoption, outcomes or institutions | **C3** for need or adoption, **C4** for outcome | [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) approval. This system supplies the *minimum* evidence; the register decides whether the words may be used. |

**A decision below its minimum is allowed only as a bet.** A bet records the
confidence gap, a kill criterion, a review date, an owner and the cap on
reversible cost. Most pre-pilot decisions will be bets, and that is fine; the
discipline is that they are *called* bets. Two rules keep bets honest:

- **Shipping a bet does not raise the assumption's confidence.** A feature that
  exists and gets used because it was placed on the home screen is not
  evidence of need. Usage can only support an insight when it is voluntary and
  the alternative was available.
- **Evidence never trades against a floor.** Security, privacy, accessibility,
  tenant isolation and legal authority gates ([`BETA_EXIT_CRITERIA.md`](../../BETA_EXIT_CRITERIA.md)
  non-waivable list) are not weighed against demand. A strong demand signal
  cannot buy a waiver; a weak one cannot remove a floor.

## Anti-patterns this model exists to refuse

| Pattern | What it looks like here | The control |
| --- | --- | --- |
| Loudest voice | The most senior or most insistent stakeholder's request becomes the roadmap | Class `opinion`, ceiling C1, whoever it is |
| Champion drift | Every interviewee arrived through one sponsor | `route` tag; correlated sources count once |
| Friendly-participant bias | The founder tests with classmates who want him to succeed | `route: warm` cannot be the whole base of a C3; a second moderator for observed sessions |
| Leading questions | "Wouldn't it help if…?" | Guides in [`03-INTERVIEW-GUIDES.md`](03-INTERVIEW-GUIDES.md) ask about the last time, not the hypothetical |
| Build-as-validation | "It's shipped and the tests pass, so it's needed" | Repository evidence is `artifact`/`desk`-adjacent; see the rule above |
| Vanity usage | Counting opens as value | [`ANALYTICS.md`](../../ANALYTICS.md) states what *opened* cannot say; this pack repeats it |
| Synthetic users | An AI-written persona or "simulated interview" cited as a finding | Class `desk`, ceiling C1, and never cited as a participant |
| Anecdote promotion | One vivid session becomes a theme | Needs five independent participants for a pattern claim (C2) |
| Statistical theatre | A percentage from n = 8 on a slide | Report n of N inside research; anything leaving research follows `MIN_COHORT = 10` in `lib/institution-ops.ts` |
| Stale certainty | A term-old finding still driving pricing | `reviewBy` expiry |

## How an insight ends

An insight is **refuted** (a stronger source contradicts it; the record stays),
**expired** (past `reviewBy` and not re-confirmed; it drops a level), or
**superseded** (a narrower or better-segmented insight replaces it and links
back). It is never edited into a different claim; the record shows what we
believed and when.
