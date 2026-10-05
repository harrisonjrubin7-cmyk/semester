<!-- Rendered from app/src/lib/governance/pia.ts by pia.test.ts. Edit the data, then run `npm run registers` from app/. -->

# Privacy impact assessment

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

The questions a surface that touches student data answers before it ships, the
surfaces that have answered them, and the ones that owe an answer. R-15 in
[RISK-GOVERNANCE.md](RISK-GOVERNANCE.md) asked for the template so that a new
surface is asked the question before it ships; the eighth maturity system on the
same page said no template, register or gate existed. This is the three.

**7 surfaces have answered; 6 owe an answer.** Of the 77 answers written,
46 cite a test that runs on every change and 31 cite code or a document only,
which is a weaker thing and is marked *written* below. No assessment has been
reviewed by the privacy seat, which is vacant: these are the founder’s reading of
the tree, and the seat’s first job is to read them again.

## The rule

An answer is a sentence and the file that shows it. If any answer is not clearly
yes, the surface is not launch-ready: narrow the scope, add a control, or defer
it. Each assessment’s **Open** list is where the not-clearly-yes answers go, so
a reader finds them without reading every row.

## The gate

[`.github/pull_request_template.md`](../../.github/pull_request_template.md) asks, of every pull request that adds a module:

> 10. What does it hold about a student? Its row in `app/src/lib/governance/pia.ts` with every question answered, or the sentence that says it touches no student data.

A new module joins the assessed or the owed list below, never neither. The test
holds the line in the template verbatim.

## The template

| # | Question | What clearly yes looks like |
| --- | --- | --- |
| 1 | What does this surface do for the student, and what question does each piece of data answer? | One purpose, stated; every field answers a question somebody wrote down first. A column nobody has a question for is a column that should not exist. |
| 2 | Which fields does it hold, and which of them are sensitive: grades, health, aid, disability, identity, location? | The list is closed and enumerated, in schema or code, so nothing sensitive can ride along in a field invented later. |
| 3 | What is its default visibility? | Private to the student, enforced by the database, unless the student shares it deliberately. |
| 4 | Who at Semester or the institution can read any of it, through which function, and what do they never receive? | Each reader is a named role holding a named capability, reading through a function whose return type is the whole of what they get. |
| 5 | Can a reader learn who the student is from a row that was meant to be anonymous? | No: the return type carries no account id, name or address, and aggregates are suppressed below the cohort floor. |
| 6 | Does any of it reach a model, and if so, is it fenced as material and journaled without its body? | Either nothing reaches a model, or what does is sent when the student presses the button, inside the fence, and the journal keeps metadata only. |
| 7 | Which clock deletes it, and where is that clock written? | A row in RETENTION.md names the period and the sweep, and retention.test.ts holds the file to the schema. |
| 8 | Does account deletion empty it, and can the student take it with them? | Deletion removes every row that names the account, or says what survives and why; export covers what the student would want back. |
| 9 | Is any sharing consented, revocable, and never a substitute for an institutional obligation? | The student chooses, can undo it, and no institutional duty is dressed up as consent. |
| 10 | Does it produce or feed a score, flag or ranking about an individual? | No: nothing on the never-measured list, and no per-student number leaves the surface. |
| 11 | Which test runs on every change to hold the answers above? | A .test.ts or .check.sql that would go red if an answer stopped being true. |

## Assessed

### Support tickets

A student asks Semester’s own support for help from inside the app, and support answers in the same thread. Owner: **success** seat. Assessed 2026-09-29. Residual rating: **low**.

| Question | Answer | Shown by |
| --- | --- | --- |
| What does this surface do for the student, and what question does each piece of data answer? | To answer the student. The data answers one question: what is this student stuck on. Nothing about tickets is aggregated, and the queue carries no identity to aggregate by. *(written)* | `supabase/migrations/20260928210000_support_tickets.sql` — The tables and the functions that are the only way in<br>`docs/PRODUCT-ANALYTICS-DATA-ETHICS.md` — Support tickets are not analytics |
| Which fields does it hold, and which of them are sensitive: grades, health, aid, disability, identity, location? | The category, the words the student wrote, the app details they ticked from a closed list of six (version, device class, screen, signed in, sync state, offline), the timings, and the replies. A grade or a diagnosis cannot ride along: the context keys are a closed list checked in SQL. | `supabase/migrations/20260928210000_support_tickets.sql` — private.support_context_ok allows six keys, all about the app<br>`app/src/lib/supporttickets.test.ts` — The app’s list is held to the database’s |
| What is its default visibility? | Private to the student. Only the student opens a ticket, only about themselves, five a day; no staff capability can open one on a student’s behalf. | `supabase/support-tickets.check.sql` — Each rule walked by the account it is about and by one it should stop |
| Who at Semester or the institution can read any of it, through which function, and what do they never receive? | A support_agent, through the queue and thread functions, which return a ticket’s category, words, ticked context and timings and never an account id, address or name. If the agent needs the student’s data to help, that is a separate student-granted support_access_grant. | `supabase/support-tickets.check.sql` — The agent reads the queue and the thread without the asker’s identity<br>`supabase/support-access.check.sql` — A support read of student data needs a live grant and is recorded |
| Can a reader learn who the student is from a row that was meant to be anonymous? | No. The staff functions’ return types are read by the check and any identity-shaped column fails it. What the student types into the body is theirs to type. | `supabase/support-tickets.check.sql` — Return types read; an identity-shaped column fails |
| Does any of it reach a model, and if so, is it fenced as material and journaled without its body? | Nothing. A ticket goes to the database and to the people who answer it; no prompt builder reads one. *(written)* | `supabase/migrations/20260928210000_support_tickets.sql` — The functions are the only way in or out |
| Which clock deletes it, and where is that clock written? | Account deletion, through forget_my_support_tickets(); messages go with their ticket. There is no time-based purge of closed tickets yet, and RETENTION.md says the period must be set before a production launch opens them. | `RETENTION.md` — The retention answer per table<br>`app/src/lib/retention.test.ts` — RETENTION.md is held to the schema in both directions |
| Does account deletion empty it, and can the student take it with them? | Deletion empties it. The thread is readable in the app; it is not part of the student’s export, which covers courses, notes, deadlines and the account file. | `supabase/deletion.check.sql` — Account deletion empties what it claims to<br>`app/src/lib/export.ts` — What the export covers |
| Is any sharing consented, revocable, and never a substitute for an institutional obligation? | None. Nothing in a ticket is shared with anyone but the agent answering it. | `supabase/support-tickets.check.sql` — A second student reads nothing of another’s ticket |
| Does it produce or feed a score, flag or ranking about an individual? | None. Priority and the first-response target are computed from the category, which is a queue order, not a score about the student. *(written)* | `supabase/migrations/20260928210000_support_tickets.sql` — Priority from the category; accessibility and privacy one business day |
| Which test runs on every change to hold the answers above? | support-tickets.check.sql walks every rule with two students and an agent; privacy.test.ts holds the sentence the student is shown about who reads a ticket. | `supabase/support-tickets.check.sql` — The rules, walked<br>`app/src/lib/privacy.test.ts` — The wording on the Privacy screen is asserted |

**Open:**

- Retention: no time-based purge of closed tickets exists; the period must be set before production opens them (RETENTION.md).
- Readers: nobody owns the queue yet, so “read by support staff” names a role with no person in it (#935).

### Private beta feedback

A beta member writes to the beta from inside the app, and a triager reads what was written without learning who wrote it. Owner: **product** seat. Assessed 2026-09-29. Residual rating: **low**.

| Question | Answer | Shown by |
| --- | --- | --- |
| What does this surface do for the student, and what question does each piece of data answer? | To fix the app. Each row answers: what did a member want, find broken or find inaccessible, and on which screen. *(written)* | `supabase/migrations/20260928220000_private_beta.sql` — Memberships, feedback, known issues and a way out |
| Which fields does it hold, and which of them are sensitive: grades, health, aid, disability, identity, location? | The kind, the body, the route (screen), a status, and the membership it came through, which is how the account is linked. The body is free text. *(written)* | `supabase/migrations/20260928220000_private_beta.sql` — beta_feedback: membership_id, kind, body, route, status |
| What is its default visibility? | Private. The member writes it; no member reads another’s. | `supabase/beta.check.sql` — A member and a triager, each walked against what they should not see |
| Who at Semester or the institution can read any of it, through which function, and what do they never receive? | A holder of beta:triage, through beta_feedback_queue, which returns the id, cohort kind, kind, body, route, status and time — no membership, no account. | `supabase/migrations/20260928220000_private_beta.sql` — beta_feedback_queue’s return type<br>`supabase/beta.check.sql` — Triage reads feedback without the sender’s identity |
| Can a reader learn who the student is from a row that was meant to be anonymous? | Not from the row. The queue’s return type carries no identity. A member who types their own name into the body has told the triager, which the closed list of six support-context keys cannot prevent for free text. | `supabase/beta.check.sql` — The queue’s columns, read as the triager |
| Does any of it reach a model, and if so, is it fenced as material and journaled without its body? | Nothing. Feedback is read by a person. *(written)* | `supabase/migrations/20260928220000_private_beta.sql` — The functions are the only way in or out |
| Which clock deletes it, and where is that clock written? | Account deletion, by cascade from the membership. Leaving the beta does not delete it; deleting the account does. | `RETENTION.md` — The retention answer per table<br>`app/src/lib/retention.test.ts` — RETENTION.md is held to the schema in both directions |
| Does account deletion empty it, and can the student take it with them? | Deletion empties it by cascade. Feedback is not in the export. | `supabase/deletion.check.sql` — Account deletion empties what it claims to |
| Is any sharing consented, revocable, and never a substitute for an institutional obligation? | Known issues are published from triage as text the triager writes, never as the member’s words with the member attached. *(written)* | `supabase/migrations/20260928220000_private_beta.sql` — Known issues are a separate table the triager publishes |
| Does it produce or feed a score, flag or ranking about an individual? | None. Accessibility feedback is ordered first in the queue, which is a priority, not a score about anyone. *(written)* | `supabase/migrations/20260928220000_private_beta.sql` — order by (f.kind = accessibility) desc |
| Which test runs on every change to hold the answers above? | beta.check.sql walks each rule as the account it is about and one it should stop. | `supabase/beta.check.sql` — The rules, walked |

**Open:**

- Identity: the body is free text, so a member can name themselves; the triager sees what was typed.
- Retention: no time-based purge; feedback lives as long as the account does.

### The three pilot figures and the institutional aggregates

Activation, weekly active use and 30-day retention for the pilot, and course-demand and cohort-outcome aggregates for an institution. Owner: **product** seat. Assessed 2026-09-29. Residual rating: **low**.

| Question | Answer | Shown by |
| --- | --- | --- |
| What does this surface do for the student, and what question does each piece of data answer? | The three figures the pilot is judged on, and the two aggregates an institution asked for. A fourth figure needs a fourth question written into ANALYTICS.md first. *(written)* | `supabase/migrations/20260921151000_activity.sql` — The three numbers, and nothing else<br>`ANALYTICS.md` — The operating document for the three figures |
| Which fields does it hold, and which of them are sensitive: grades, health, aid, disability, identity, location? | One row per account per day per mark, and the table’s check constraint allows only the three marks. Aggregates hold a count per cell and no row per student. *(written)* | `supabase/migrations/20260921151000_activity.sql` — The check constraint on the mark<br>`docs/PRODUCT-ANALYTICS-DATA-ETHICS.md` — What is measured, grain by grain |
| What is its default visibility? | An activity row is readable by the account it is about, for the same reason the access log is. Aggregates are readable by the institution’s roles only above the floor. *(written)* | `supabase/migrations/20260921151000_activity.sql` — select and delete granted to the account, scoped by policy |
| Who at Semester or the institution can read any of it, through which function, and what do they never receive? | An institution reads aggregates through the institutional-ops functions, suppressed below ten students per cell. Nobody reads an individual’s activity but the individual. | `app/src/lib/institution-ops.ts` — MIN_COHORT = 10<br>`app/src/lib/cohortfloor.test.ts` — Every SQL floor is the same number as MIN_COHORT |
| Can a reader learn who the student is from a row that was meant to be anonymous? | No. The small-cell floor is one number, read out of every migration and held to the TypeScript constant; lowering one floor goes red. | `app/src/lib/cohortfloor.test.ts` — Reads each floor out of the migrations; the control lowers one |
| Does any of it reach a model, and if so, is it fenced as material and journaled without its body? | Nothing. No figure reaches a model. *(written)* | `app/src/lib/institution-ops.ts` — FORBIDDEN: the eight things never measured about an individual; defineMetric refuses any metric that sources one |
| Which clock deletes it, and where is that clock written? | activity: 400 days, purged on write inside note_activity(), scoped to the account being written to. | `RETENTION.md` — The retention answer per table<br>`app/src/lib/retention.test.ts` — RETENTION.md is held to the schema in both directions |
| Does account deletion empty it, and can the student take it with them? | Account deletion removes every row that names the account, which the Privacy screen promises and deletion.check.sql holds for the tables it names; the account may also delete its own activity rows directly. Activity is not in the export. | `supabase/deletion.check.sql` — Account deletion empties what it claims to<br>`app/src/lib/privacy.ts` — The deletion promise as the student reads it |
| Is any sharing consented, revocable, and never a substitute for an institutional obligation? | None. Aggregates are the institution’s reading of its own cohort; no third-party analytics host is in the Content-Security-Policy, and adding one is a reviewed change to a test. | `app/src/lib/phase5docs.test.ts` — No analytics or session-replay vendor in the CSP |
| Does it produce or feed a score, flag or ranking about an individual? | None, by list: risk scores, reading time, mouse and keystrokes, attention, individual AI usage, integrity flags, wellbeing scores and location are never measured, and defineMetric refuses a metric that sources one. | `app/src/lib/institution-ops.ts` — FORBIDDEN: the eight things never measured about an individual; defineMetric refuses any metric that sources one<br>`app/src/lib/phase5docs.test.ts` — The page lists every never-measure id the code refuses, and no other |
| Which test runs on every change to hold the answers above? | cohortfloor.test.ts for the floor, phase5docs.test.ts for the never-measured list and the CSP, institution-ops.test.ts for the constant. | `app/src/lib/cohortfloor.test.ts` — The floor<br>`app/src/lib/phase5docs.test.ts` — The list and the CSP<br>`app/src/lib/institution-ops.test.ts` — The constant |

**Open:**

- Purpose: pilot outcome measures will need their own row in the measured table before any is reported to a university (docs/PRODUCT-ANALYTICS-DATA-ETHICS.md, open items).

### AI conversations

A question answered, a study guide generated from a syllabus, or a draft critiqued, by a model, when the student presses the button. Owner: **engineering** seat. Assessed 2026-09-29. Residual rating: **medium**.

| Question | Answer | Shown by |
| --- | --- | --- |
| What does this surface do for the student, and what question does each piece of data answer? | To answer the student’s question, or to work on the material the student chose. The text sent is the text needed for that answer, sent when the button is pressed and not before. *(written)* | `app/src/lib/privacy.ts` — “What the AI features send, and to whom”, as the student reads it |
| Which fields does it hold, and which of them are sensitive: grades, health, aid, disability, identity, location? | The question, the material the student chose (a syllabus, notes, a photograph of a whiteboard, a draft), what the screen shows, and on the local path the model named. The student’s own API key, if they added one, stays on the device. *(written)* | `app/src/ai/prompt.ts` — What the assistant’s prompt carries<br>`app/src/lib/privacy.ts` — The key and attached files stay on this device |
| What is its default visibility? | The transcript is the student’s own, kept on the device under its own key, bounded in size, and not synced with the courses. Through the institution gateway the journal keeps who asked and what was decided, never what was asked. *(written)* | `app/src/lib/chatlog.ts` — The transcript persists on the device, separately and bounded<br>`app/server/institution/intelligence.ts` — Source bodies are used only to assemble the request; never returned or journaled |
| Who at Semester or the institution can read any of it, through which function, and what do they never receive? | The model provider receives the text: Anthropic on the app’s path, the tenant’s allowed provider through the gateway. Semester’s staff read none of it. The gateway journal is metadata only and is purged after 180 days. | `app/src/lib/trust/subprocessors.ts` — Anthropic and OpenAI: kind, purpose and what each receives<br>`app/server/institution/intelligence.test.ts` — Provider failure is mapped without logging questions or protected source bodies |
| Can a reader learn who the student is from a row that was meant to be anonymous? | The shared-key function counts calls per account, which is a cap and not a record of what was asked. The gateway journal holds an actor id and a tenant with no body. *(written)* | `supabase/functions/claude/index.ts` — A monthly cap metered per account<br>`RETENTION.md` — The retention answer per table |
| Does any of it reach a model, and if so, is it fenced as material and journaled without its body? | Yes, by definition. Everything the student or a document wrote is fenced as material, every attached document or image is named as material by the rule, and the structural suite holds the fence on every builder; what a live model does with the fence is the red-team the owner has not yet run. | `app/src/ai/untrusted.ts` — The fence and the rule<br>`app/src/ai/injection.test.ts` — Twelve injection-shaped texts through every builder stay inside the fence |
| Which clock deletes it, and where is that clock written? | gateway_audit and gateway_intelligence_audit: 180 days, an hourly server-only sweep, metadata only. The device transcript: until the student clears it, and bounded in size meanwhile. | `RETENTION.md` — The retention answer per table<br>`app/src/lib/retention.test.ts` — RETENTION.md is held to the schema in both directions<br>`app/src/lib/chatlog.ts` — Bounded on purpose |
| Does account deletion empty it, and can the student take it with them? | The transcript is on the device, so deleting the account does not reach it and clearing the browser does. No link is recorded from a conversation to a saved study artifact, so deleting a history does not find the artifact it produced (EC-AI-10). *(written)* | `app/src/lib/governance/edgecases.ts` — EC-AI-10, owed |
| Is any sharing consented, revocable, and never a substitute for an institutional obligation? | None. The provider’s use of what it receives is the training policy’s subject: no student data is used to train a model, and the provider controls it names are the terms Semester requires. | `docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md` — The default rule and the model-provider controls<br>`app/src/lib/trust/ai-training-policy.test.ts` — The policy is held to the subprocessor register |
| Does it produce or feed a score, flag or ranking about an individual? | None. Individual AI usage is on the never-measured list; the monthly cap is a limit, not a metric, and leaves the function only as a refusal. *(written)* | `app/src/lib/institution-ops.ts` — FORBIDDEN: the eight things never measured about an individual; defineMetric refuses any metric that sources one |
| Which test runs on every change to hold the answers above? | injection.test.ts for the fence, claudeclamp.test.ts for what the shared key pays for, intelligence.test.ts for the journal, subprocessors.test.ts for the list of who receives it. | `app/src/ai/injection.test.ts` — The fence<br>`app/src/lib/claudeclamp.test.ts` — The clamp<br>`app/server/institution/intelligence.test.ts` — The journal<br>`app/src/lib/trust/subprocessors.test.ts` — The list cannot drift from the hosts the code calls |

**Open:**

- AI: the live red-team has run once, on one model (29 September 2026, claude-opus-5, 21 of 21 held; docs/evidence/ai/); nothing screens material before it is sent.
- Deletion: no link from a conversation to the study artifact it produced (EC-AI-10).
- Sharing: no signed provider terms are recorded (AI-002).

### Billing

Selling a plan to a student or an institution, invoicing it, collecting payment through Stripe, and cancelling: built, and off until its secrets are set. Owner: **finance** seat. Assessed 2026-09-29. Residual rating: **medium**.

| Question | Answer | Shown by |
| --- | --- | --- |
| What does this surface do for the student, and what question does each piece of data answer? | To sell, bill, contract, deliver and renew. Each table answers one of four questions kept apart: what is sold, who pays for what, which features apply, and who may read which record; a subscription grants entitlements and never authorization. *(written)* | `docs/COMMERCIAL-CORE.md` — Four ideas kept apart; who reads what<br>`supabase/migrations/20260929070000_commercial_core.sql` — The schema |
| Which fields does it hold, and which of them are sensitive: grades, health, aid, disability, identity, location? | A billing account, subscriptions with their periods, invoices and lines, contracts, the checkout consent (when, and to which wording), and payment events holding the provider’s event id and a hash of the body. No card or bank data is stored anywhere; the payment details are typed into Stripe’s own page and never pass through Semester. *(written)* | `supabase/migrations/20260929070000_commercial_core.sql` — consent_at and consent_text_version; payment_events keeps an id and a hash<br>`app/src/lib/trust/subprocessors.ts` — What Stripe receives and what Semester keeps |
| What is its default visibility? | A student reads their own billing account, subscriptions, invoices and cancellations and nobody else’s; an institution’s billing contact reads its own contracts and invoices. payment_events is readable by nobody through the API. | `supabase/commercial.check.sql` — Payment events are unreadable and unwritable through the API; nobody writes the catalog |
| Who at Semester or the institution can read any of it, through which function, and what do they never receive? | finance_operator reads every billing record; customer_success and account_executive read delivery records and account health, not invoices; every write is the service role’s except request_cancellation. | `docs/COMMERCIAL-CORE.md` — Who reads what, role by role<br>`supabase/commercial.check.sql` — A student cannot extend a subscription or pay an invoice by hand |
| Can a reader learn who the student is from a row that was meant to be anonymous? | An invoice names an individual account as “Individual subscriber”, never by email; after deletion the billing account points at nobody. Stripe holds the email and the card, on its side. *(written)* | `RETENTION.md` — The retention answer per table<br>`app/src/lib/trust/subprocessors.ts` — Stripe receives the email, the plan and the payment details |
| Does any of it reach a model, and if so, is it fenced as material and journaled without its body? | Nothing. No commercial record reaches a model. *(written)* | `docs/COMMERCIAL-CORE.md` — No policy on student data reads a commercial table, and the reverse |
| Which clock deletes it, and where is that clock written? | Financial records, kept past account deletion; no time-based purge yet, and RETENTION.md says the period (typically seven years) must be set before the first charge. | `RETENTION.md` — The retention answer per table<br>`app/src/lib/retention.test.ts` — RETENTION.md is held to the schema in both directions |
| Does account deletion empty it, and can the student take it with them? | Deleting an account sets billing_accounts.user_id to null, so the invoice survives without pointing at a person. Export and deletion stay available on every plan and in every subscription state, and cancelling is one call by the owner that nobody else can make. | `supabase/commercial.check.sql` — Nobody else can cancel; cancelling returns the end of the paid period<br>`RETENTION.md` — The retention answer per table |
| Is any sharing consented, revocable, and never a substitute for an institutional obligation? | Stripe, as a subprocessor on the register, receives the email, the plan and price, and the payment details. A paid subscription needs recorded consent to a named wording, or a contract. | `app/src/lib/billing/checkout.test.ts` — Explicit consent, to a named wording, before anything is recorded<br>`supabase/commercial.check.sql` — A paid subscription needs recorded consent or a contract |
| Does it produce or feed a score, flag or ranking about an individual? | Account health is one snapshot per institution per day with a reason and a next action; it refuses student signals, and no per-student number exists in the commercial core. | `supabase/commercial.check.sql` — Health refuses student signals and unexplained statuses |
| Which test runs on every change to hold the answers above? | commercial.check.sql and commercial-automation.check.sql in SQL; checkout.test.ts and webhook.test.ts for the two functions that talk to Stripe. | `supabase/commercial.check.sql` — The rules, walked<br>`supabase/commercial-automation.check.sql` — Dunning, contracts to tenants, account health<br>`app/src/lib/billing/webhook.test.ts` — Signature on the raw body; one application per event |

**Open:**

- Retention: the period for financial records is unset; it must be set before the first charge (RETENTION.md).
- Sharing: Stripe’s terms and data-processing agreement are not recorded on the vendor register (SEC-010).
- Everything: nothing has been charged; the first real delivery from Stripe has not been seen (COM-001).

### Academic-record ledger

A school’s registrar staff keep each student’s academic record in Semester as an append-only ledger, changed only by a proposal someone else approves. Owner: **privacy** seat. Assessed 2026-09-29. Residual rating: **high**.

| Question | Answer | Shown by |
| --- | --- | --- |
| What does this surface do for the student, and what question does each piece of data answer? | To keep the school’s academic record with a history that answers who changed what, why, who approved it, when it took effect and what it replaced. Each column answers one of those eight questions and nothing else. *(written)* | `supabase/migrations/20260929210000_academic_record_ledger.sql` — Three tables whose columns are the eight questions<br>`app/src/lib/record/ledger.ts` — EIGHT and explain(): each question answered from an entry |
| Which fields does it hold, and which of them are sensitive: grades, health, aid, disability, identity, location? | The school’s student identifier, a kind from a closed list of seven, what the entry is about, a value of at most 200 characters, dates, a reason and a source from a closed list of six. These are education records, and grades and standing are sensitive; there is no column for a name, a health fact, aid or a disability, and the kinds cannot grow without a migration. | `supabase/migrations/20260929210000_academic_record_ledger.sql` — Check constraints on kind, source, action and student_ref<br>`app/src/lib/record/ledger.test.ts` — Every vocabulary held to the migration word for word |
| What is its default visibility? | Not the student’s to share: this is the school’s record. It is readable by the school’s record staff and, once an approver links their account, by the student themselves, and by no one else. A student cannot link themselves. | `supabase/academic-record.check.sql` — An unlinked student, another student and a researcher read nothing; a linked student reads their own |
| Who at Semester or the institution can read any of it, through which function, and what do they never receive? | Accounts holding record:read or record:approve at the school (registrar and dean), directly under row-level security. A faculty member proposes and reads only their own proposals, never the ledger. An institutional researcher and a registrar at another school read nothing. | `supabase/academic-record.check.sql` — Each reader walked, and each refused one |
| Can a reader learn who the student is from a row that was meant to be anonymous? | The record is identified on purpose: a registrar reads a named student’s record by the school’s identifier. Nothing anonymous is derived from it, and no aggregate is published from it. *(written)* | `supabase/migrations/20260929210000_academic_record_ledger.sql` — No view, function or export reads across students |
| Does any of it reach a model, and if so, is it fenced as material and journaled without its body? | Nothing. No prompt builder reads these tables, and the screen sends nothing to a model. *(written)* | `app/src/lib/record/api.ts` — The client’s only calls: lookup, pending, propose, decide, withdraw |
| Which clock deletes it, and where is that clock written? | Kept until the school is removed, because it is the school’s education record; the ledger has no purge. RETENTION.md says a shorter schedule must be set by the school before real use. The account link goes with the account. | `RETENTION.md` — The retention answer per table<br>`app/src/lib/retention.test.ts` — RETENTION.md is held to the schema in both directions |
| Does account deletion empty it, and can the student take it with them? | Deleting a student’s account removes their link and leaves the school’s record, which is not theirs to erase; deleting a staff account clears them as proposer or approver and leaves every entry. The student export does not include the school’s record. | `supabase/deletion.check.sql` — Account deletion empties what it claims to<br>`supabase/academic-record.check.sql` — An account deleted: the link goes, the record stays, no longer naming staff |
| Is any sharing consented, revocable, and never a substitute for an institutional obligation? | No sharing. The only widening of who reads a record is an approver linking the student’s own account, which is audited. *(written)* | `supabase/migrations/20260929210000_academic_record_ledger.sql` — Links are made by record:approve holders and audited |
| Does it produce or feed a score, flag or ranking about an individual? | None. The ledger holds what the school recorded; it computes no score, flag or ranking, and nothing reads it to produce one. *(written)* | `app/src/lib/institution-ops.ts` — FORBIDDEN: the eight things never measured about an individual; defineMetric refuses any metric that sources one |
| Which test runs on every change to hold the answers above? | academic-record.check.sql walks every rule as the account it concerns; ledger.test.ts holds the vocabularies and the fold; RecordLedger.test.tsx holds the screen to proposing, deciding and the eight answers. | `supabase/academic-record.check.sql` — The rules, walked<br>`app/src/components/institutional/RecordLedger.test.tsx` — The screen |

**Open:**

- Default: a student has no screen to read their own record yet, though the database lets a linked student read it; FERPA’s right to inspect wants that screen before real use.
- Retention: the school sets the schedule; none is set, and the ledger keeps everything until then.
- Readers: faculty propose only with a school-wide grant; course-scoped faculty grants do not reach this, which is safer and also means most faculty cannot use it yet.
- Identity: accounts are linked by id, and there is no screen that links one; that step is manual until one exists.

### Student accounts

A school’s bursar and business office keep each student’s account in Semester as an append-only ledger of charges, payments, refunds, adjustments and aid credits, changed only by a request someone else approves. Owner: **finance** seat. Assessed 2026-09-29. Residual rating: **high**.

| Question | Answer | Shown by |
| --- | --- | --- |
| What does this surface do for the student, and what question does each piece of data answer? | To keep the school’s record of what each student owes and has paid under financial controls: who asked, who approved, what it answered, and that a month was reconciled with the payment provider before it closed. *(written)* | `supabase/migrations/20260929220000_student_accounts.sql` — The ledger, the requests, the reconciliations and the closes |
| Which fields does it hold, and which of them are sensitive: grades, health, aid, disability, identity, location? | The school’s student identifier, a kind and a category from closed lists, an amount in whole cents, a description, the payment provider’s reference and dates. Amounts owed are sensitive financial information. There is no column for a card, a bank account or a name, and a run of 13 to 19 digits is refused in every field a person types. | `supabase/migrations/20260929220000_student_accounts.sql` — student_account_request_no_pan and the closed vocabularies<br>`app/src/lib/finance/accounts.test.ts` — The card pattern and the vocabularies held to the migration |
| What is its default visibility? | The school’s record, readable by its finance staff and, once an approver has linked their account on the academic record, by the student themselves; by no one else. | `supabase/student-accounts.check.sql` — An unlinked student, a student linked to another record, and another school read nothing |
| Who at Semester or the institution can read any of it, through which function, and what do they never receive? | Accounts holding finance:read, finance:approve or finance:close at the school, under row-level security. An aid officer requests and reads; a requester reads their own requests. Reconciliations carry totals and a file fingerprint, never a payment’s details. | `supabase/student-accounts.check.sql` — Each reader walked, and each refused one |
| Can a reader learn who the student is from a row that was meant to be anonymous? | The account is identified on purpose: staff read a named student’s account by the school’s identifier. Nothing anonymous is derived from it, and no aggregate is published from it. *(written)* | `supabase/migrations/20260929220000_student_accounts.sql` — No view, function or export reads across students |
| Does any of it reach a model, and if so, is it fenced as material and journaled without its body? | Nothing. No prompt builder reads these tables. *(written)* | `app/src/lib/finance/api.ts` — The client’s only calls |
| Which clock deletes it, and where is that clock written? | Kept until the school is removed; the school’s financial-records schedule governs it, and RETENTION.md says it must be set before real use. | `RETENTION.md` — The retention answer per table<br>`app/src/lib/retention.test.ts` — RETENTION.md is held to the schema in both directions |
| Does account deletion empty it, and can the student take it with them? | Deleting a student’s account removes their link and leaves the school’s record; deleting a staff account clears them as requester, approver, recorder or closer and leaves every entry. | `supabase/deletion.check.sql` — Account deletion empties what it claims to<br>`supabase/student-accounts.check.sql` — An officer deleted: their entries stay, no longer naming them |
| Is any sharing consented, revocable, and never a substitute for an institutional obligation? | None. The only widening of who reads an account is an approver linking the student’s own account. *(written)* | `supabase/migrations/20260929220000_student_accounts.sql` — The student reads through academic_record_subjects |
| Does it produce or feed a score, flag or ranking about an individual? | A financial hold is computed — overdue past the school’s window and above its minimum — and shown as the hold card’s neutral sentence with no amount. It is the school’s rule applied to the school’s record, not a score. | `app/src/lib/finance/accounts.test.ts` — The hold rule and its sentence, which carries no amount |
| Which test runs on every change to hold the answers above? | student-accounts.check.sql walks every control as the account it concerns; accounts.test.ts holds the vocabularies, signs, card pattern and arithmetic; StudentAccounts.test.tsx holds the staff screen and MyStudentAccount.test.tsx the student’s. | `supabase/student-accounts.check.sql` — The controls, walked<br>`app/src/components/institutional/StudentAccounts.test.tsx` — The staff screen<br>`app/src/components/MyStudentAccount.test.tsx` — The student’s screen, which never shows who approved an entry |

**Open:**

- Readers: a linked student reads each entry’s description as staff typed it, on Bill; nothing reviews that wording before a student reads it.
- Inference: a payment plan being kept lifts the hold, and whether it is kept is worked out by the app from the ledger; the database does not hold it, so anything else that reads holds must work it out the same way.
- Retention: the school sets the schedule; none is set, and the ledger keeps everything until then.
- Readers: no one has reviewed this with a school’s bursar or auditor; the controls are the brief’s, read by the founder.
- Sharing: nothing reaches the payment provider from here; its settlement file is read by hand, so a missed month is not noticed by the system.

## Owed

Surfaces that touch student data and have not answered. Each starts from the
design or model that already answers some of the questions.

| Surface | State | Starts from | Why it is owed |
| --- | --- | --- | --- |
| Community rooms and media | built | `docs/COMMUNITY-PRIVACY-MODEL.md` | Three identities, an allowlisted peer payload and a leak tripwire exist (app/src/community/identity.test.ts); the eleven questions have not been answered in one place. |
| School records from an institution’s systems | built | `docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md` | Classification tiers and freshness exist behind a flag that is off until a connection is live; the reader, retention and deletion answers wait on a real source. |
| Course Studio, what faculty publish to students | built | `docs/FACULTY-COURSE-STUDIO-DESIGN.md` | Published versions are immutable under a live grant (supabase/coursestudio.check.sql); what a faculty member learns about a student who reads them is unanswered. |
| Brightspace launches through LTI | built | `docs/INSTITUTIONAL-SSO-ARCHITECTURE.md` | The launch, the account binding and the line item each have a test; what the platform receives back, and when, is not written as one answer. |
| Transfer Transition Hub, Career and workforce, Basic-Needs Navigator | designed | `docs/MODULE-PRIVACY-MODEL.md` | The privacy-by-module rows are the data inventory; the assessment is written when the module is built, before it ships. |
| Support access to a student’s data under a grant | built | `docs/CONSENT-SHARING-DESIGN.md` | Every read under a grant is recorded (supabase/support-access.check.sql); the assessment would say what the agent can see, screen by screen. |
