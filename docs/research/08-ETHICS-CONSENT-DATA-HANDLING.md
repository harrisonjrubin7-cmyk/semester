# 08 · Research ethics, consent and data handling

> **DRAFT FOR QUALIFIED REVIEW.** This is an operating standard and a set of
> templates, not legal advice. The repository's rule applies: qualified human
> counsel approves legal conclusions and consent text before any participant
> sees it. The `privacy` seat is held by outside counsel
> ([`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md)); this
> page is written to be handed to that seat.

## Principles

1. **Voluntary, informed, revocable.** Participation, each use of the data, and
   each form of contact are separate choices.
2. **Minimum necessary.** Collect what the decision needs. Research needs no
   grades, transcripts, diagnoses, immigration status, health, finances or
   conduct records, and does not ask for them.
3. **No participant pays for the research** in time, money, grades or standing.
4. **No deception that matters.** A labelled concept is not deception. A
   fake-door test is permitted only inside a session or invited cohort with
   disclosure and a debrief ([`04`](04-TESTING-AND-OBSERVATION.md)).
5. **The product's own privacy promises bind the research.** The app states it
   has no third-party analytics; research tooling stays out of the product and
   participants' app activity is never linked to research records without a
   separate, explicit opt-in.

## Is this "human subjects research"?

Not decided here. Product evaluation for internal decisions is commonly
treated differently from research "designed to contribute to generalizable
knowledge", and that line moves if results are published, presented as
findings, or shared with a university for its own purposes. **Open item for
counsel and the relevant university human-subjects office:** whether any
planned study needs a determination or review, particularly where the
researcher is also a student at the university whose students are recruited.
Until answered, the studies here apply the protections in this page as if
review applied, and nothing is published as research.

## Roles and conflicts

The founder builds, researches and sells. That is the central conflict.

| Risk | Control |
| --- | --- |
| Participants want the founder to succeed | Second moderator or note-taker for every observed session; scripted guides; findings tagged `route: warm` |
| Founder interprets toward the product | Atomised observations separate from interpretation; peer review of any insight that leads to a decision above `internal-reversible` |
| Research becomes selling | Separation rule in [`02`](02-STAKEHOLDER-RESEARCH-PLAN.md); no pitch in sessions |
| Participants are the founder's classmates | Treated as a power-sensitive group (below) |

## Power-sensitive participants

| Group | Risk | Protection |
| --- | --- | --- |
| Classmates and friends | Pressure to agree or to participate | Say so in consent; offer a real decline; an unpaid friend gets the same incentive as others |
| Students in a participant's or researcher's course | Grade-related pressure | Do not recruit students from courses the researcher is enrolled in with the participant's instructor; no participation affects any course |
| Staff whose employer is a prospective customer | Career risk if candid views reach management | Individual statements are never reported identifiably to the institution; aggregation only; staff may need employer permission to discuss process, and are told to obtain it, not to bypass it |
| Faculty/TAs | Reporting lines | Same as staff |
| Participants under 18 | Consent capacity; additional law | **Excluded by default.** Included only with counsel's approval and guardian consent plus the minor's assent |
| Guardians and students from the same family | Disclosure across the relationship | Interviewed separately; one side's answers are never relayed to the other |

## Consent: separate choices, not a bundle

A participant answers each independently. Declining any one never removes the
participant from the study unless the study cannot run without it.

| Tier | Choice | Default | Used for |
| --- | --- | --- | --- |
| T-A | Take part | — | The session itself |
| T-B | Record audio/video | **No** | Accurate notes; deleted on schedule below |
| T-C | Quote me internally, without my name | No | Internal synthesis |
| T-D | Quote me externally (decks, pages), without my name | **No** | Needs claims-register approval each time: quotes, endorsements and named institutions are **prohibited today** (CLM-013) |
| T-E | Contact me again | No | Panel and follow-up ([`07`](07-PILOT-AND-LONGITUDINAL.md)) |
| T-F | Link my research record to my in-app activity | **No** | Only by participant code, only for a stated question, only on opt-in |

Consent is recorded as a dated, versioned record (form version, tiers
chosen, who took it) in the restricted store. For in-app research prompts
the existing consent mechanism (`consent_record`, student-changeable,
versioned) is the model; a research purpose must be added there by its own
reviewed change before any in-app research consent is used. This pack
adds none.

### Consent summary (draft wording for counsel — plain language)

> I'm [name], building a planning tool for students called Semester. I'd like
> to ask you about how you manage school, and in some sessions watch you try an
> early version. It takes about [60] minutes. You can skip any question and stop
> at any time, and you'll still get [incentive].
> I won't ask for your grades, your health, or anything about other people.
> Please don't show me those. If something like that appears on your screen,
> I won't note it.
> With your permission I'll [record / take notes]. Notes and recordings are
> kept [privately, in a restricted place], and recordings are deleted by
> [date]. I'll remove your name from anything I keep. You can ask me to delete
> your data until [date]; after I've combined it with others' it can't be
> separated, but it will not identify you.
> I might use a short quote, without your name, only if you say yes below.
> Taking part has no effect on any course, job or relationship with the
> university. I'm a [student/founder] and this is not an official university
> study [unless determined otherwise].
> [Tiers T-B to T-F as separate yes/no choices.]

Consent form requirements: readable at about an 8th-grade level; available as
an accessible document or read aloud; verbal consent recorded as a form entry
is acceptable where a signature is a barrier; offered in the participant's
choice of channel.

## Sensitive information

| Category | Rule |
| --- | --- |
| Disability and health | Ask what helps, not what condition. If volunteered, record the access need; do not record the diagnosis. |
| Immigration, finances, conduct, mental health | Never solicited. If volunteered, the moderator redirects and the note-taker does not record it. |
| Education records | A participant may show their own materials in a session. Do not capture grades, IDs or other students' information. Observation of staff follows the no-records rule ([`04`](04-TESTING-AND-OBSERVATION.md)). |
| Third parties | Group chats, shared documents and others' emails are not shown or described identifiably. |
| Crisis | If a participant discloses imminent risk, stop, follow [`CRISIS-RESPONSE-RUNBOOK.md`](../CRISIS-RESPONSE-RUNBOOK.md), and make sure a person who can help is reached. Confirm in advance what the researcher's reporting obligations are, if any; the university may impose duties on employees and the answer depends on the researcher's status. |

## Data handling

**Classification.** Raw research data (recordings, transcripts, notes with
anything identifying) is treated as **T2 Student-owned at minimum** under
[`DATA-STEWARDSHIP.md`](../operating-model/DATA-STEWARDSHIP.md), and as T3 if
any education record is captured. T4 content is never intentionally collected.
Existing guidance in `RESEARCH-AND-SERVICE-DESIGN.md` ("keep recordings under
the T2 retention rule") is followed.

**Where data lives.**

| Data | Home | In this repository? |
| --- | --- | --- |
| Recordings, transcripts, raw notes, consent records, participant key (code ↔ person) | Restricted store with a named access list; key held **apart** from the data it unlocks | **Never** |
| De-identified observations | Restricted store | No |
| Insights, assumptions, bets, decision links | [`repository/register.json`](repository/register.json) | **Yes — coarse tags only** |

**What the repository may hold.** Participant codes and segment tags at the
coarsest level that answers the question, at most two combined attributes per
record; no emails, phone numbers, names, institutions identifiable to a
person, or verbatim quotes. The register test refuses an `@`, a digit run
that looks like a phone number, and long quoted strings. At small n, three
attributes can name a person: "a first-generation international junior in
a named major" is a name.

**Retention (proposal — no research row exists yet in `RETENTION.md`).**

| Item | Proposed clock |
| --- | --- |
| Recordings | Deleted within 30 days of transcript verification, and no later than 90 days after the study closes |
| Transcripts and notes | De-identified within 30 days; identifiable versions deleted at study close + 90 days |
| Consent records | Kept as long as the data they cover exists, plus the period counsel advises |
| Participant key | Deleted when the last re-contact consent lapses or is withdrawn |
| De-identified insights | Kept; subject to `reviewBy` expiry |

These need the `privacy` seat's approval, then a row in `RETENTION.md` in its
own change (its test checks the clocks); this pack does not edit it.

**Tools.** Any tool that holds participant data is a subprocessor candidate:
note-taking, video, transcription, survey, scheduling, payment of incentives.
Each is reviewed before use ([`SUBPROCESSORS.md`](../SUBPROCESSORS.md)); none
may use participant data to train models
([`AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md`](../trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md)).
Transcription by a model is acceptable only on a reviewed service, with human
verification, and the machine summary is class `desk`, not evidence.

**AI-assisted synthesis.** Allowed on de-identified text only. An AI-written
theme is a prompt to look, never a finding. Never present AI-generated
"synthetic participants" as research.

**Access.** Named individuals only; reviewed each term; access removed when a
role ends. Participants can ask what is held about them and ask for deletion;
the request is handled with [`DATA-RIGHTS-REQUEST-RUNBOOK.md`](../DATA-RIGHTS-REQUEST-RUNBOOK.md),
which must be extended to name the research store (open item). Participants in
other jurisdictions (for example the UK or EU) may bring additional rights;
counsel decides.

**Incidents.** A suspected exposure of research data is handled as a privacy
incident under [`SECURITY.md`](../../SECURITY.md) and the
[incident plan](../trust/INCIDENT-RESPONSE-PLAN.md); affected participants are
told.

## Incentives and fairness

- Paid for time, at a rate that does not make refusal costly; paid in full if
  the participant stops early.
- Incentive rules for staff recipients (gift and conflict policies) are
  checked with the institution before payment.
- Tax or reporting obligations of incentives are for counsel/accounting.
- Recruiting is inclusive by design: the segment list in [`02`](02-STAKEHOLDER-RESEARCH-PLAN.md),
  alternate formats, scheduling that works for working and commuter students,
  and compensation for assistive-technology users' extra time.
- Findings are checked for who was *not* heard before they are generalised.

## Reporting back

Participants are told what changed ("you said / we did") at the next
touchpoint. Withdrawal is honoured in practice: a participant's data is removed
from the restricted store and from any not-yet-combined analysis; the register
is edited only where a coded record can be traced.

## Open items for counsel and the privacy seat

1. Does any planned study need a human-subjects determination?
2. Approved consent text and recording language; verbal-consent validity.
3. Minors: exclusion default confirmed or conditions set.
4. Staff-participant protections; institution permission norms.
5. Researcher reporting obligations (if the researcher is an employee of, or
   acts for, an institution).
6. Retention clocks and a research row in `RETENTION.md`.
7. Research purpose in the consent mechanism, if in-app research is wanted.
8. Data-rights runbook extended to the research store.
9. Incentive tax treatment.
