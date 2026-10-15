# 06 · The research repository

Where evidence lives, how it becomes an insight, and how an insight reaches a
decision. The rules are in [`01`](01-EVIDENCE-MODEL.md); the privacy limits are
in [`08`](08-ETHICS-CONSENT-DATA-HANDLING.md).

## Two stores, on purpose

| Store | Holds | Access | Retention |
| --- | --- | --- | --- |
| **Restricted store** (outside this repository; named access list; key held apart) | Recordings, transcripts, raw notes, atomic observations, consent records, the participant-code key | Researcher and note-takers only; reviewed each term | Per the schedule in `08` (a proposal until the privacy seat approves it) |
| **The register** ([`repository/register.json`](repository/register.json), in git) | Assumptions, insights, decisions and bets, with coarse tags | Whoever can read the repository | Kept; insights expire by `reviewBy` |

Git history is permanent. Anything committed here cannot be withdrawn, so the
register holds nothing about a person: no names, emails, phone numbers,
institutions identifiable to an individual, verbatim quotes or long free text.
`researchregister.ts` fails the build on the first three and on text over 400
characters.

## The chain

```text
Study  ->  Source  ->  Observation  ->  Insight  ->  Assumption  ->  Decision
(plan)     (session)   (atomic fact)    (claim +      (testable      (what we
                                         level)        belief)        do, with bets)
```

| Record | Lives in | Id | Contains |
| --- | --- | --- | --- |
| Study | Restricted store; the plan is a short note in the register's `test.study` | `S-<slug>` | Question, method, sample frame, pre-registered tasks and criteria, decision served |
| Source | Restricted store; summarised inside an insight | `SRC-n` within an insight | Class, route, origin, participants, round |
| Observation | Restricted store only | — | One fact, anchored to a timestamp or quote, no interpretation |
| **Insight** | Register `insights` | `INS-nnn` | One claim about a segment; `type`, `stakeholder`, `scope`, optional `moment`; sources; `confidence`; `disconfirmationSearched`; `reviewBy`; the assumptions it `supports` |
| **Assumption** | Register `assumptions` | `ASM-nnn` | A belief the product depends on, how it would be tested, and what would kill it. Confidence cannot exceed its best linked insight |
| **Decision** | Register `decisions`; a decided hard-to-reverse or claim decision also has `docs/decisions/D-<n>.md` | `DEC-nnn` | Class, the assumptions it rests on, status, and a bet if it is below its minimum |

## Workflow

| Step | Who | Time box | Rule |
| --- | --- | --- | --- |
| 1 Capture | Note-taker | Within 24 h | Atomic observations only. Quotes and interpretations in separate fields |
| 2 Tag | Moderator and note-taker, independently | Within 48 h | Type and moment; disagreements discussed and recorded, not overwritten |
| 3 Synthesise | Researcher | End of study round | Group observations into candidate insights; each lists sources with class, route, origin |
| 4 Challenge | A second person | Before any level above C1 | Looks for contrary cases; records the search (`disconfirmationSearched`) |
| 5 Level | Researcher | — | Declare the level; the validator computes the ceiling and rejects an overclaim |
| 6 Link | Researcher | — | Attach to assumptions; update the assumption's confidence to match |
| 7 Decide | Product seat | At the decision's date | Check the class minimum; below it, record a bet |
| 8 Revisit | Product seat | `reviewBy` | Re-confirm, lower, refute or supersede. Nothing is silently deleted |

## Insight card (the shape of one register entry)

```json
{
  "id": "INS-001",
  "statement": "One claim about a named segment, in plain words, with no identifying detail.",
  "type": "friction",
  "stakeholder": "student",
  "scope": "manual-setup",
  "moment": "first-plan",
  "confidence": "C2",
  "sources": [
    { "id": "SRC-1", "cls": "observed-use", "route": "cold", "origin": "usab-round-1", "n": 3, "round": "r1" },
    { "id": "SRC-2", "cls": "self-report",  "route": "institutional", "origin": "interviews-a", "n": 3, "round": "r1" }
  ],
  "disconfirmationSearched": false,
  "reviewBy": "2027-01-15",
  "supports": ["ASM-007"]
}
```

A `measured-outcome` source must also carry `method` and `denominator`, or it
counts as nothing above C1.

## Tagging

- **Stakeholder** (12), **type** (11), **moment** (8), **route** (4): fixed
  lists in `register.json` → `vocabulary`; extending one is a change to the
  vocabulary, the model doc and the test together.
- **Scope**: a capability id, an audit surface from
  [`05`](05-AUDIT-VALIDATION.md), or `thesis`, `market`, `pricing`, `platform`.
  The scope is how a product change finds the evidence behind it.
- **Segment** is never a free tag. It is the study's sampled segment, kept in
  the restricted store; the register carries at most the stakeholder group.
  Combining attributes in git is how small cells re-identify people.

## Using it

- **Before building:** find the assumption for the capability. If its
  confidence is C0 and the work is `user-reversible` or above, either run the
  `test.study` first or record the work as a bet.
- **In a pull request:** a change that adds or widens a user-facing capability
  names the `ASM-` ids it rests on in its description. (A convention; not
  enforced by the build, and the project's own style of review decides whether
  to make it so.)
- **In a decision record:** `D-<n>.md` cites `DEC-nnn`, the assumptions with
  their levels at the time, and any bet.
- **For a claim:** the claims register ([`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md))
  decides whether words may be used. The register here only says what
  evidence level exists.

## Health measures of the system itself

| Measure | Meaning | Healthy |
| --- | --- | --- |
| Assumptions above C0 | Evidence has arrived | Rising slowly; a fast rise is suspicious |
| Evidence debt | Open decisions whose assumptions are below their minimum | Shown, never hidden |
| Expired insights | Past `reviewBy` | Zero without a re-confirmation plan |
| Bets past review | Decided below minimum and not revisited | Zero |
| Segment coverage | Stakeholders with at least one C2 | The honest gaps are listed with every finding that claims breadth |
| Warm share | Share of sources with `route: warm` | Falls over time |

## What the validator does not do

It does not check that an insight is *true*, that a quote exists, or that a
study was run well. It checks that the register's claims are no stronger than
the structure it records for them, and that nothing identifying is in git. The
people who review insights (step 4) do the rest, and the first reviewer is not
the person who wrote the insight.
