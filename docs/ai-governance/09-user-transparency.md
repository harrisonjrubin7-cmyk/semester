# 09 · User-facing transparency

**Builds on:** [`../trust/AI-TRANSPARENCY-AND-USER-NOTICE.md`](../trust/AI-TRANSPARENCY-AND-USER-NOTICE.md) (the standard, the
notice template and the claim ceiling; not repeated here),
[`../learning-university-systems/STUDENT-AGENCY-AND-TRANSPARENCY-STANDARD.md`](../learning-university-systems/STUDENT-AGENCY-AND-TRANSPARENCY-STANDARD.md),
[`../legal-drafts/AI-FEATURES-DISCLOSURE-DRAFT.md`](../legal-drafts/AI-FEATURES-DISCLOSURE-DRAFT.md),
`app/src/ai/Answer.tsx`, `Turns.tsx`, `Actions.tsx`, `HelpNotice.tsx`, `app/src/lib/spend.ts`,
`app/src/lib/source-locker.ts`, `app/src/lib/threads.ts`.

The standard says what a notice must contain. This chapter specifies the **states a person meets**, the controls they
hold, and what each must do for someone using a screen reader at midnight. Transparency is not a disclosure page; it is
whether the person can tell what they are talking to, where an answer came from, how far to trust it, what happens to
what they typed, and how to reach a human, **at the moment it matters**.

## What exists, as verified

| Capability | State |
| --- | --- |
| Route label (`routeLabel`): which route will answer | built in `lib/assistant.ts` |
| Help-state notice before and instead of an answer: checking the school's policy, unreachable, switched off by a school or course, framed as "a boundary, not a fault" | built (`HelpNotice.tsx`) |
| Proposed action as a card with the word on the button, and an undo | built (`Actions.tsx`, `tools.ts`) |
| Sources and citations on answers; the app's own sentence for a failed or cut answer | built; coverage by feature not inventoried |
| What asking has cost: tokens as fact, money as a labelled estimate with the rates and their date | built (`spend.ts`) |
| Per-material AI block and "what was built from each" | built (Source Locker, `source-locker.ts`) |
| Delete all conversations | built (`threads.clearAll`) |
| Standing preferences: typed by the student, never inferred or written by the model, kept until deleted | built (`lib/aboutme.ts`, `components/AboutMe.tsx`); appended at the one door |
| Feedback on an answer | **local only: nothing is sent, "there is nowhere to send it"** (`Turns.tsx`) |
| Report an unsafe or wrong output to an owner, with a response | **not built** |
| Non-AI path and human route on every refusal | not systematic |
| Notice coverage by route | **no route-by-route inventory** (the standard says so) |

The honest state of the feedback control is the right one: a thumb that quietly did nothing is worse than none, and
this one says so. The gap is that there is no *report* path behind it.

## The states

Each state has an ID that tests, the console and the red-team cite. A state is **required** for a feature when its
condition applies; "not applicable" is a recorded decision.

| ID | State | When | Content |
| --- | --- | --- | --- |
| `UT-01` | **Before first use** | A feature's first run per account, and again when purpose, data, route or terms change | The notice template of the standard with **every bracket filled**: what the tool does, that AI is involved, **which route** (Semester-managed, institution-directed, your own key) and what each means for who sees the data, which categories are sent, provider and retention terms **as verified**, the course or institution rule, the non-AI option, the human contact, a link to more. Affirmative choice or institutional authorisation where the analysis requires |
| `UT-02` | **Route and data line** | Every request | The existing "using" line, extended: route class, and the categories the request will carry (deadlines, grades, notes, selected sources) in the person's words, before send |
| `UT-03` | **At the output** | Every AI output | A visible **AI-generated** label that survives copy and export; "may be wrong"; that this is **not an official record or decision** |
| `UT-04` | **Provenance** | Every output that rests on a source | Each claim linked to the source, its title, **anchor**, **authority** (faculty-approved, institution-published, student-selected, general knowledge) and **as-of date**; stale or missing sources named in plain words, including what the answer left out and why |
| `UT-05` | **Kind of statement** | Within an answer | Separate **from your sources**, **inference**, **estimate**, **general knowledge**. No numeric confidence the system cannot justify |
| `UT-06` | **Why this** | A proactive suggestion, a ranked list, a plan | The reason, in a sentence, and the data it used; the person can hide it or show fewer like it |
| `UT-07` | **Policy in force** | Where a course or institution policy limits help | "Your instructor's policy allows concept explanations on this assignment", with the source of the rule; an unknown policy is said to be unknown |
| `UT-08` | **Refusal** | Any refusal | Why, in plain words, without accusation; what the person can do instead; **a human route** (instructor, advisor, support, crisis as the class demands). Never a dead end |
| `UT-09` | **Action preview** | Any proposal | The server-rendered preview of [chapter 04](04-tool-broker.md): exact target, effect, before → after, reversibility, who is notified; accessible; confirm and undo |
| `UT-10` | **Switched off** | Kill switch, policy, budget, outage | One sentence, no blame, what still works, that nothing typed was lost. The existing sentence is the model |
| `UT-11` | **Fallback** | A different provider processed the request | Said, with the new route, because it changes who handled the data (`GW-18`) |
| `UT-12` | **High-impact boundary** | Any topic that touches admission, aid, grading, discipline, accommodation, health, immigration, employment | "This tool can't decide that. Here is who can, and how to reach them." |

## Limitations the person is told

Limits are stated where the person is, in the person's words, not in terms:

- It can be wrong, especially on dates, numbers and quotations. Check anything that matters against the source and the
  official system.
- It does not know what it was not given, and a source may be old.
- It cannot tell whether an assignment allows AI; your instructor's policy does.
- It is not your advisor, instructor, counsellor, lawyer or doctor.
- It does not remember you beyond what the preferences you can see say.
- Your own key means your provider's terms, not Semester's.

## Feedback and reporting

Two different things, built differently.

| | **Rating** | **Report** |
| --- | --- | --- |
| Purpose | Quality signal | Harm, error or policy problem |
| Where | On every answer, one tap, keyboard and screen-reader operable | "Report a problem" on every answer and every refusal |
| Categories | Helpful; not helpful | Wrong or made up; unsafe; unfair or biased; shouldn't have refused; leaked or shouldn't have seen something; other |
| Content | Nothing attached by default | The person chooses whether to attach the exchange, shown exactly what would be sent |
| Goes to | Aggregate metrics | A named owner; severity-graded ([chapter 07](07-incident-response-and-shutdown.md)); a leak or a wrong-action report is P1 until triaged |
| Back to the person | Nothing | An acknowledgement with a reference, a stated response time, an outcome, and how to contest it |
| Rule | No retaliation, no inference about the person from using it | A report **never** counts against a student |

Today only the rating exists, and it is local. The report path, an owner and a response time are the missing pieces,
and the standard names them as unproven (`no universal report-to-owner flow or response evidence`).

## Data controls

All reachable from one place, in plain language, for every account.

| Control | Meaning | State |
| --- | --- | --- |
| **See** | What is stored: conversations, preferences memory, AI-generated drafts with their route, sources and policy decision | partial: threads and memory visible |
| **Delete** | One conversation, all conversations, one preference, one generated artifact; deletion propagates to derived data (indexes, caches) and says when it is complete | partial: all conversations; propagation not specified |
| **Export** | Everything above in a portable form | partial |
| **Block a source** | A material the AI may not see (Source Locker); the block applies to retrieval as well as the client | built (client) |
| **Turn a feature off** | Per feature, within what the institution has permitted; an institution that has turned a feature off says so (`UT-10`) | partial |
| **Memory off** | The assistant uses no standing preferences | built (`includePreferences`) |
| **Training** | Shown as *off*, with the policy sentence; no control, because there is nothing to opt into by default | designed (`AI-MODEL-TRAINING-AND-DATA-USE-POLICY`) |
| **Spend** | What asking has cost, tokens as fact and money as estimate | built |

Institution-directed data is **not the student's to delete in every case**: an education record the institution holds
is governed by its retention and the student's rights under the law and the contract, which counsel determines. The
control says which kind of data it is acting on and does not promise a deletion it cannot make.

## Escalation to a person

Every context has a named route, shown, not buried. The route depends on the class:

| Class | Route | Rule |
| --- | --- | --- |
| Course content or policy | The instructor's published route | Offered with every policy refusal |
| Academic planning | The human advisor | Offered at the end of every requirement answer |
| Wellbeing, crisis, safety | The crisis and campus-escalation runbooks | **The assistant steps aside**; no AI answer is offered first |
| Basic needs | The campus resource route | Immediate, with a human |
| Technical or account | Support | A ticket draft the person confirms |
| Unfair, harmful or wrong output | The report path | `UT` report rules above |

Escalation is a feature with a staffed owner, hours and a response time. A button that opens a mailbox nobody reads
is the same failure as a thumb that does nothing, and is worse because it looks like help.

## Accessibility of the AI surface

- **Streaming is announced politely**: one live region, no per-token chatter; the completed answer is a reachable
  landmark; the stop and regenerate controls are operable by keyboard.
- Labels and limits are **text**, not colour or icon alone; AI-generated markers survive high contrast and forced colours.
- Reading level, language and dyslexia-aware modes apply to AI output; an answer in one language can be re-explained in
  another, and the provenance stays in the person's language.
- Reduced motion is honoured in streaming and transitions.
- Previews and notices are announced before the control that confirms them.
- Every state here is tested with a screen reader and a keyboard, **by a person who uses them**, as a launch-gate item.

## Young and dependent users

Where an account is a minor, or a guardian relationship exists, the family portal's consent rules govern what any
AI feature may show or send, and a guardian's visibility never extends to a student's AI conversations unless the
consent record says so and the law permits it. This chapter specifies the *surface*; the rule is counsel's.

## Requirements

| ID | Requirement | State |
| --- | --- | --- |
| `UT-R01` | A route-by-route notice inventory: every AI entry and output state mapped to a notice | not started (the standard says so) |
| `UT-R02` | Every feature renders the AI label at the output (`UT-03`); a structural test fails a feature that does not | not started |
| `UT-R03` | Provenance panel with title, anchor, authority and as-of date (`UT-04`) | partial: sources; authority and as-of not shown |
| `UT-R04` | Statement kind separated within answers (`UT-05`) | partial: prompts ask for it |
| `UT-R05` | Refusals carry why, an alternative and a human route; a test checks the three | not started |
| `UT-R06` | Report path to a named owner with a response time and a reference | not started |
| `UT-R07` | Reports are never used against the reporter, and cannot be turned into a record about them | not started: policy |
| `UT-R08` | Data controls in one place: see, delete with propagation, export | partial |
| `UT-R09` | Source block applies to server retrieval as well as the client | not started |
| `UT-R10` | Fallback disclosure (`UT-11`) | not started (`GW-18`) |
| `UT-R11` | The high-impact boundary state (`UT-12`) tested on the eight classes | not started |
| `UT-R12` | Screen-reader and keyboard test of every state by users of those tools | not started |
| `UT-R13` | Notice published only with every bracket filled and verified; counsel approval recorded | designed |
| `UT-R14` | Escalation owners, hours and response times staffed and published | not started: backup seats `UNASSIGNED` |
