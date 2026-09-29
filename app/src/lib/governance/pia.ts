/**
 * The privacy impact assessment: the questions a surface that touches
 * student data answers before it ships, the surfaces that have answered
 * them, and the ones that owe an answer.
 *
 * R-15 in `risk.ts` names the mitigation — "write the privacy impact
 * assessment template so a new surface is asked the question before it
 * ships" — and the maturity crosswalk's eighth system said no template, no
 * register and no gate existed. This is the three: `QUESTIONS` is the
 * template, `ASSESSMENTS` and `OWED` are the register, and `GATE` is the line
 * the pull-request template asks of every new module, held there by the test.
 *
 * `docs/operating-model/PRIVACY-IMPACT-ASSESSMENT.md` is rendered from this
 * file by `pia.test.ts`; edit the data, then `npm run registers` from app/.
 *
 * ## The rule the answers are held to
 *
 * An answer is a sentence and the file that shows it. An answer whose
 * evidence includes a test that runs on every change is **held**; one whose
 * evidence is code or a document is **written**, which is a weaker thing and
 * says so on the page. Every cited path exists. No assessment claims a review
 * by the privacy seat, which is vacant: these are the founder's reading of
 * the tree, and the seat's first job is to read them again.
 *
 * The decision rule is the risk register's: if any answer is not clearly
 * yes, the surface is not launch-ready — narrow it, add a control, or defer.
 * An assessment's `open` list is where the not-clearly-yes answers go, so a
 * reader finds them without reading every row.
 */

import type { Seat } from '../launchreadiness';

export interface Evidence {
  path: string;
  shows: string;
}

export const QUESTION_IDS = [
  'purpose', 'fields', 'default', 'readers', 'identity', 'ai', 'retention', 'deletion', 'sharing', 'inference', 'guard',
] as const;

export type QuestionId = (typeof QUESTION_IDS)[number];

export interface Question {
  id: QuestionId;
  /** The question, as it is asked. */
  ask: string;
  /** What a clearly-yes answer looks like. Anything less goes in `open`. */
  clear: string;
}

/** The template. Eleven questions, in the order a reviewer reads them. */
export const QUESTIONS: readonly Question[] = [
  { id: 'purpose', ask: 'What does this surface do for the student, and what question does each piece of data answer?', clear: 'One purpose, stated; every field answers a question somebody wrote down first. A column nobody has a question for is a column that should not exist.' },
  { id: 'fields', ask: 'Which fields does it hold, and which of them are sensitive: grades, health, aid, disability, identity, location?', clear: 'The list is closed and enumerated, in schema or code, so nothing sensitive can ride along in a field invented later.' },
  { id: 'default', ask: 'What is its default visibility?', clear: 'Private to the student, enforced by the database, unless the student shares it deliberately.' },
  { id: 'readers', ask: 'Who at Semester or the institution can read any of it, through which function, and what do they never receive?', clear: 'Each reader is a named role holding a named capability, reading through a function whose return type is the whole of what they get.' },
  { id: 'identity', ask: 'Can a reader learn who the student is from a row that was meant to be anonymous?', clear: 'No: the return type carries no account id, name or address, and aggregates are suppressed below the cohort floor.' },
  { id: 'ai', ask: 'Does any of it reach a model, and if so, is it fenced as material and journaled without its body?', clear: 'Either nothing reaches a model, or what does is sent when the student presses the button, inside the fence, and the journal keeps metadata only.' },
  { id: 'retention', ask: 'Which clock deletes it, and where is that clock written?', clear: 'A row in RETENTION.md names the period and the sweep, and retention.test.ts holds the file to the schema.' },
  { id: 'deletion', ask: 'Does account deletion empty it, and can the student take it with them?', clear: 'Deletion removes every row that names the account, or says what survives and why; export covers what the student would want back.' },
  { id: 'sharing', ask: 'Is any sharing consented, revocable, and never a substitute for an institutional obligation?', clear: 'The student chooses, can undo it, and no institutional duty is dressed up as consent.' },
  { id: 'inference', ask: 'Does it produce or feed a score, flag or ranking about an individual?', clear: 'No: nothing on the never-measured list, and no per-student number leaves the surface.' },
  { id: 'guard', ask: 'Which test runs on every change to hold the answers above?', clear: 'A .test.ts or .check.sql that would go red if an answer stopped being true.' },
];

export type Answers = Readonly<Record<QuestionId, { answer: string; evidence: readonly Evidence[] }>>;

export type Rating = 'low' | 'medium' | 'high';

export interface Assessment {
  id: string;
  surface: string;
  /** What ships, in one sentence. */
  what: string;
  owner: Seat;
  /** The date of this reading, YYYY-MM-DD. */
  assessed: string;
  answers: Answers;
  /** The founder's rating of the residual risk after the controls named. */
  rating: Rating;
  /** The answers that are not clearly yes, each with what would make it so. */
  open: readonly string[];
}

const RETENTION: Evidence = { path: 'RETENTION.md', shows: 'The retention answer per table' };
const RETENTION_TEST: Evidence = { path: 'app/src/lib/retention.test.ts', shows: 'RETENTION.md is held to the schema in both directions' };
const DELETION_TEST: Evidence = { path: 'supabase/deletion.check.sql', shows: 'Account deletion empties what it claims to' };
const NEVER_MEASURED: Evidence = { path: 'app/src/lib/institution-ops.ts', shows: 'FORBIDDEN: the eight things never measured about an individual; defineMetric refuses any metric that sources one' };

/** The surfaces that have answered. Newest last. */
export const ASSESSMENTS: readonly Assessment[] = [
  {
    id: 'support-tickets',
    surface: 'Support tickets',
    what: 'A student asks Semester’s own support for help from inside the app, and support answers in the same thread.',
    owner: 'success',
    assessed: '2026-09-29',
    answers: {
      purpose: { answer: 'To answer the student. The data answers one question: what is this student stuck on. Nothing about tickets is aggregated, and the queue carries no identity to aggregate by.', evidence: [{ path: 'supabase/migrations/20260928210000_support_tickets.sql', shows: 'The tables and the functions that are the only way in' }, { path: 'docs/PRODUCT-ANALYTICS-DATA-ETHICS.md', shows: 'Support tickets are not analytics' }] },
      fields: { answer: 'The category, the words the student wrote, the app details they ticked from a closed list of six (version, device class, screen, signed in, sync state, offline), the timings, and the replies. A grade or a diagnosis cannot ride along: the context keys are a closed list checked in SQL.', evidence: [{ path: 'supabase/migrations/20260928210000_support_tickets.sql', shows: 'private.support_context_ok allows six keys, all about the app' }, { path: 'app/src/lib/supporttickets.test.ts', shows: 'The app’s list is held to the database’s' }] },
      default: { answer: 'Private to the student. Only the student opens a ticket, only about themselves, five a day; no staff capability can open one on a student’s behalf.', evidence: [{ path: 'supabase/support-tickets.check.sql', shows: 'Each rule walked by the account it is about and by one it should stop' }] },
      readers: { answer: 'A support_agent, through the queue and thread functions, which return a ticket’s category, words, ticked context and timings and never an account id, address or name. If the agent needs the student’s data to help, that is a separate student-granted support_access_grant.', evidence: [{ path: 'supabase/support-tickets.check.sql', shows: 'The agent reads the queue and the thread without the asker’s identity' }, { path: 'supabase/support-access.check.sql', shows: 'A support read of student data needs a live grant and is recorded' }] },
      identity: { answer: 'No. The staff functions’ return types are read by the check and any identity-shaped column fails it. What the student types into the body is theirs to type.', evidence: [{ path: 'supabase/support-tickets.check.sql', shows: 'Return types read; an identity-shaped column fails' }] },
      ai: { answer: 'Nothing. A ticket goes to the database and to the people who answer it; no prompt builder reads one.', evidence: [{ path: 'supabase/migrations/20260928210000_support_tickets.sql', shows: 'The functions are the only way in or out' }] },
      retention: { answer: 'Account deletion, through forget_my_support_tickets(); messages go with their ticket. There is no time-based purge of closed tickets yet, and RETENTION.md says the period must be set before a production launch opens them.', evidence: [RETENTION, RETENTION_TEST] },
      deletion: { answer: 'Deletion empties it. The thread is readable in the app; it is not part of the student’s export, which covers courses, notes, deadlines and the account file.', evidence: [DELETION_TEST, { path: 'app/src/lib/export.ts', shows: 'What the export covers' }] },
      sharing: { answer: 'None. Nothing in a ticket is shared with anyone but the agent answering it.', evidence: [{ path: 'supabase/support-tickets.check.sql', shows: 'A second student reads nothing of another’s ticket' }] },
      inference: { answer: 'None. Priority and the first-response target are computed from the category, which is a queue order, not a score about the student.', evidence: [{ path: 'supabase/migrations/20260928210000_support_tickets.sql', shows: 'Priority from the category; accessibility and privacy one business day' }] },
      guard: { answer: 'support-tickets.check.sql walks every rule with two students and an agent; privacy.test.ts holds the sentence the student is shown about who reads a ticket.', evidence: [{ path: 'supabase/support-tickets.check.sql', shows: 'The rules, walked' }, { path: 'app/src/lib/privacy.test.ts', shows: 'The wording on the Privacy screen is asserted' }] },
    },
    rating: 'low',
    open: [
      'Retention: no time-based purge of closed tickets exists; the period must be set before production opens them (RETENTION.md).',
      'Readers: nobody owns the queue yet, so “read by support staff” names a role with no person in it (#935).',
    ],
  },
  {
    id: 'beta-feedback',
    surface: 'Private beta feedback',
    what: 'A beta member writes to the beta from inside the app, and a triager reads what was written without learning who wrote it.',
    owner: 'product',
    assessed: '2026-09-29',
    answers: {
      purpose: { answer: 'To fix the app. Each row answers: what did a member want, find broken or find inaccessible, and on which screen.', evidence: [{ path: 'supabase/migrations/20260928220000_private_beta.sql', shows: 'Memberships, feedback, known issues and a way out' }] },
      fields: { answer: 'The kind, the body, the route (screen), a status, and the membership it came through, which is how the account is linked. The body is free text.', evidence: [{ path: 'supabase/migrations/20260928220000_private_beta.sql', shows: 'beta_feedback: membership_id, kind, body, route, status' }] },
      default: { answer: 'Private. The member writes it; no member reads another’s.', evidence: [{ path: 'supabase/beta.check.sql', shows: 'A member and a triager, each walked against what they should not see' }] },
      readers: { answer: 'A holder of beta:triage, through beta_feedback_queue, which returns the id, cohort kind, kind, body, route, status and time — no membership, no account.', evidence: [{ path: 'supabase/migrations/20260928220000_private_beta.sql', shows: 'beta_feedback_queue’s return type' }, { path: 'supabase/beta.check.sql', shows: 'Triage reads feedback without the sender’s identity' }] },
      identity: { answer: 'Not from the row. The queue’s return type carries no identity. A member who types their own name into the body has told the triager, which the closed list of six support-context keys cannot prevent for free text.', evidence: [{ path: 'supabase/beta.check.sql', shows: 'The queue’s columns, read as the triager' }] },
      ai: { answer: 'Nothing. Feedback is read by a person.', evidence: [{ path: 'supabase/migrations/20260928220000_private_beta.sql', shows: 'The functions are the only way in or out' }] },
      retention: { answer: 'Account deletion, by cascade from the membership. Leaving the beta does not delete it; deleting the account does.', evidence: [RETENTION, RETENTION_TEST] },
      deletion: { answer: 'Deletion empties it by cascade. Feedback is not in the export.', evidence: [DELETION_TEST] },
      sharing: { answer: 'Known issues are published from triage as text the triager writes, never as the member’s words with the member attached.', evidence: [{ path: 'supabase/migrations/20260928220000_private_beta.sql', shows: 'Known issues are a separate table the triager publishes' }] },
      inference: { answer: 'None. Accessibility feedback is ordered first in the queue, which is a priority, not a score about anyone.', evidence: [{ path: 'supabase/migrations/20260928220000_private_beta.sql', shows: 'order by (f.kind = accessibility) desc' }] },
      guard: { answer: 'beta.check.sql walks each rule as the account it is about and one it should stop.', evidence: [{ path: 'supabase/beta.check.sql', shows: 'The rules, walked' }] },
    },
    rating: 'low',
    open: [
      'Identity: the body is free text, so a member can name themselves; the triager sees what was typed.',
      'Retention: no time-based purge; feedback lives as long as the account does.',
    ],
  },
  {
    id: 'analytics',
    surface: 'The three pilot figures and the institutional aggregates',
    what: 'Activation, weekly active use and 30-day retention for the pilot, and course-demand and cohort-outcome aggregates for an institution.',
    owner: 'product',
    assessed: '2026-09-29',
    answers: {
      purpose: { answer: 'The three figures the pilot is judged on, and the two aggregates an institution asked for. A fourth figure needs a fourth question written into ANALYTICS.md first.', evidence: [{ path: 'supabase/migrations/20260921151000_activity.sql', shows: 'The three numbers, and nothing else' }, { path: 'ANALYTICS.md', shows: 'The operating document for the three figures' }] },
      fields: { answer: 'One row per account per day per mark, and the table’s check constraint allows only the three marks. Aggregates hold a count per cell and no row per student.', evidence: [{ path: 'supabase/migrations/20260921151000_activity.sql', shows: 'The check constraint on the mark' }, { path: 'docs/PRODUCT-ANALYTICS-DATA-ETHICS.md', shows: 'What is measured, grain by grain' }] },
      default: { answer: 'An activity row is readable by the account it is about, for the same reason the access log is. Aggregates are readable by the institution’s roles only above the floor.', evidence: [{ path: 'supabase/migrations/20260921151000_activity.sql', shows: 'select and delete granted to the account, scoped by policy' }] },
      readers: { answer: 'An institution reads aggregates through the institutional-ops functions, suppressed below ten students per cell. Nobody reads an individual’s activity but the individual.', evidence: [{ path: 'app/src/lib/institution-ops.ts', shows: 'MIN_COHORT = 10' }, { path: 'app/src/lib/cohortfloor.test.ts', shows: 'Every SQL floor is the same number as MIN_COHORT' }] },
      identity: { answer: 'No. The small-cell floor is one number, read out of every migration and held to the TypeScript constant; lowering one floor goes red.', evidence: [{ path: 'app/src/lib/cohortfloor.test.ts', shows: 'Reads each floor out of the migrations; the control lowers one' }] },
      ai: { answer: 'Nothing. No figure reaches a model.', evidence: [NEVER_MEASURED] },
      retention: { answer: 'activity: 400 days, purged on write inside note_activity(), scoped to the account being written to.', evidence: [RETENTION, RETENTION_TEST] },
      deletion: { answer: 'Account deletion removes every row that names the account, which the Privacy screen promises and deletion.check.sql holds for the tables it names; the account may also delete its own activity rows directly. Activity is not in the export.', evidence: [DELETION_TEST, { path: 'app/src/lib/privacy.ts', shows: 'The deletion promise as the student reads it' }] },
      sharing: { answer: 'None. Aggregates are the institution’s reading of its own cohort; no third-party analytics host is in the Content-Security-Policy, and adding one is a reviewed change to a test.', evidence: [{ path: 'app/src/lib/phase5docs.test.ts', shows: 'No analytics or session-replay vendor in the CSP' }] },
      inference: { answer: 'None, by list: risk scores, reading time, mouse and keystrokes, attention, individual AI usage, integrity flags, wellbeing scores and location are never measured, and defineMetric refuses a metric that sources one.', evidence: [NEVER_MEASURED, { path: 'app/src/lib/phase5docs.test.ts', shows: 'The page lists every never-measure id the code refuses, and no other' }] },
      guard: { answer: 'cohortfloor.test.ts for the floor, phase5docs.test.ts for the never-measured list and the CSP, institution-ops.test.ts for the constant.', evidence: [{ path: 'app/src/lib/cohortfloor.test.ts', shows: 'The floor' }, { path: 'app/src/lib/phase5docs.test.ts', shows: 'The list and the CSP' }, { path: 'app/src/lib/institution-ops.test.ts', shows: 'The constant' }] },
    },
    rating: 'low',
    open: [
      'Purpose: pilot outcome measures will need their own row in the measured table before any is reported to a university (docs/PRODUCT-ANALYTICS-DATA-ETHICS.md, open items).',
    ],
  },
  {
    id: 'ai-conversations',
    surface: 'AI conversations',
    what: 'A question answered, a study guide generated from a syllabus, or a draft critiqued, by a model, when the student presses the button.',
    owner: 'engineering',
    assessed: '2026-09-29',
    answers: {
      purpose: { answer: 'To answer the student’s question, or to work on the material the student chose. The text sent is the text needed for that answer, sent when the button is pressed and not before.', evidence: [{ path: 'app/src/lib/privacy.ts', shows: '“What the AI features send, and to whom”, as the student reads it' }] },
      fields: { answer: 'The question, the material the student chose (a syllabus, notes, a photograph of a whiteboard, a draft), what the screen shows, and on the local path the model named. The student’s own API key, if they added one, stays on the device.', evidence: [{ path: 'app/src/ai/prompt.ts', shows: 'What the assistant’s prompt carries' }, { path: 'app/src/lib/privacy.ts', shows: 'The key and attached files stay on this device' }] },
      default: { answer: 'The transcript is the student’s own, kept on the device under its own key, bounded in size, and not synced with the courses. Through the institution gateway the journal keeps who asked and what was decided, never what was asked.', evidence: [{ path: 'app/src/lib/chatlog.ts', shows: 'The transcript persists on the device, separately and bounded' }, { path: 'app/server/institution/intelligence.ts', shows: 'Source bodies are used only to assemble the request; never returned or journaled' }] },
      readers: { answer: 'The model provider receives the text: Anthropic on the app’s path, the tenant’s allowed provider through the gateway. Semester’s staff read none of it. The gateway journal is metadata only and is purged after 180 days.', evidence: [{ path: 'app/src/lib/trust/subprocessors.ts', shows: 'Anthropic and OpenAI: kind, purpose and what each receives' }, { path: 'app/server/institution/intelligence.test.ts', shows: 'Provider failure is mapped without logging questions or protected source bodies' }] },
      identity: { answer: 'The shared-key function counts calls per account, which is a cap and not a record of what was asked. The gateway journal holds an actor id and a tenant with no body.', evidence: [{ path: 'supabase/functions/claude/index.ts', shows: 'A monthly cap metered per account' }, RETENTION] },
      ai: { answer: 'Yes, by definition. Everything the student or a document wrote is fenced as material, every attached document or image is named as material by the rule, and the structural suite holds the fence on every builder; what a live model does with the fence is the red-team the owner has not yet run.', evidence: [{ path: 'app/src/ai/untrusted.ts', shows: 'The fence and the rule' }, { path: 'app/src/ai/injection.test.ts', shows: 'Twelve injection-shaped texts through every builder stay inside the fence' }] },
      retention: { answer: 'gateway_audit and gateway_intelligence_audit: 180 days, an hourly server-only sweep, metadata only. The device transcript: until the student clears it, and bounded in size meanwhile.', evidence: [RETENTION, RETENTION_TEST, { path: 'app/src/lib/chatlog.ts', shows: 'Bounded on purpose' }] },
      deletion: { answer: 'The transcript is on the device, so deleting the account does not reach it and clearing the browser does. No link is recorded from a conversation to a saved study artifact, so deleting a history does not find the artifact it produced (EC-AI-10).', evidence: [{ path: 'app/src/lib/governance/edgecases.ts', shows: 'EC-AI-10, owed' }] },
      sharing: { answer: 'None. The provider’s use of what it receives is the training policy’s subject: no student data is used to train a model, and the provider controls it names are the terms Semester requires.', evidence: [{ path: 'docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md', shows: 'The default rule and the model-provider controls' }, { path: 'app/src/lib/trust/ai-training-policy.test.ts', shows: 'The policy is held to the subprocessor register' }] },
      inference: { answer: 'None. Individual AI usage is on the never-measured list; the monthly cap is a limit, not a metric, and leaves the function only as a refusal.', evidence: [NEVER_MEASURED] },
      guard: { answer: 'injection.test.ts for the fence, claudeclamp.test.ts for what the shared key pays for, intelligence.test.ts for the journal, subprocessors.test.ts for the list of who receives it.', evidence: [{ path: 'app/src/ai/injection.test.ts', shows: 'The fence' }, { path: 'app/src/lib/claudeclamp.test.ts', shows: 'The clamp' }, { path: 'app/server/institution/intelligence.test.ts', shows: 'The journal' }, { path: 'app/src/lib/trust/subprocessors.test.ts', shows: 'The list cannot drift from the hosts the code calls' }] },
    },
    rating: 'medium',
    open: [
      'AI: the live red-team has never been run, so nothing here says what a model does with a fenced instruction (docs/LAUNCH-DECISIONS.md item 15).',
      'Deletion: no link from a conversation to the study artifact it produced (EC-AI-10).',
      'Sharing: no signed provider terms are recorded (AI-002).',
    ],
  },
  {
    id: 'billing',
    surface: 'Billing',
    what: 'Selling a plan to a student or an institution, invoicing it, collecting payment through Stripe, and cancelling: built, and off until its secrets are set.',
    owner: 'finance',
    assessed: '2026-09-29',
    answers: {
      purpose: { answer: 'To sell, bill, contract, deliver and renew. Each table answers one of four questions kept apart: what is sold, who pays for what, which features apply, and who may read which record; a subscription grants entitlements and never authorization.', evidence: [{ path: 'docs/COMMERCIAL-CORE.md', shows: 'Four ideas kept apart; who reads what' }, { path: 'supabase/migrations/20260929070000_commercial_core.sql', shows: 'The schema' }] },
      fields: { answer: 'A billing account, subscriptions with their periods, invoices and lines, contracts, the checkout consent (when, and to which wording), and payment events holding the provider’s event id and a hash of the body. No card or bank data is stored anywhere; the payment details are typed into Stripe’s own page and never pass through Semester.', evidence: [{ path: 'supabase/migrations/20260929070000_commercial_core.sql', shows: 'consent_at and consent_text_version; payment_events keeps an id and a hash' }, { path: 'app/src/lib/trust/subprocessors.ts', shows: 'What Stripe receives and what Semester keeps' }] },
      default: { answer: 'A student reads their own billing account, subscriptions, invoices and cancellations and nobody else’s; an institution’s billing contact reads its own contracts and invoices. payment_events is readable by nobody through the API.', evidence: [{ path: 'supabase/commercial.check.sql', shows: 'Payment events are unreadable and unwritable through the API; nobody writes the catalog' }] },
      readers: { answer: 'finance_operator reads every billing record; customer_success and account_executive read delivery records and account health, not invoices; every write is the service role’s except request_cancellation.', evidence: [{ path: 'docs/COMMERCIAL-CORE.md', shows: 'Who reads what, role by role' }, { path: 'supabase/commercial.check.sql', shows: 'A student cannot extend a subscription or pay an invoice by hand' }] },
      identity: { answer: 'An invoice names an individual account as “Individual subscriber”, never by email; after deletion the billing account points at nobody. Stripe holds the email and the card, on its side.', evidence: [RETENTION, { path: 'app/src/lib/trust/subprocessors.ts', shows: 'Stripe receives the email, the plan and the payment details' }] },
      ai: { answer: 'Nothing. No commercial record reaches a model.', evidence: [{ path: 'docs/COMMERCIAL-CORE.md', shows: 'No policy on student data reads a commercial table, and the reverse' }] },
      retention: { answer: 'Financial records, kept past account deletion; no time-based purge yet, and RETENTION.md says the period (typically seven years) must be set before the first charge.', evidence: [RETENTION, RETENTION_TEST] },
      deletion: { answer: 'Deleting an account sets billing_accounts.user_id to null, so the invoice survives without pointing at a person. Export and deletion stay available on every plan and in every subscription state, and cancelling is one call by the owner that nobody else can make.', evidence: [{ path: 'supabase/commercial.check.sql', shows: 'Nobody else can cancel; cancelling returns the end of the paid period' }, RETENTION] },
      sharing: { answer: 'Stripe, as a subprocessor on the register, receives the email, the plan and price, and the payment details. A paid subscription needs recorded consent to a named wording, or a contract.', evidence: [{ path: 'app/src/lib/billing/checkout.test.ts', shows: 'Explicit consent, to a named wording, before anything is recorded' }, { path: 'supabase/commercial.check.sql', shows: 'A paid subscription needs recorded consent or a contract' }] },
      inference: { answer: 'Account health is one snapshot per institution per day with a reason and a next action; it refuses student signals, and no per-student number exists in the commercial core.', evidence: [{ path: 'supabase/commercial.check.sql', shows: 'Health refuses student signals and unexplained statuses' }] },
      guard: { answer: 'commercial.check.sql and commercial-automation.check.sql in SQL; checkout.test.ts and webhook.test.ts for the two functions that talk to Stripe.', evidence: [{ path: 'supabase/commercial.check.sql', shows: 'The rules, walked' }, { path: 'supabase/commercial-automation.check.sql', shows: 'Dunning, contracts to tenants, account health' }, { path: 'app/src/lib/billing/webhook.test.ts', shows: 'Signature on the raw body; one application per event' }] },
    },
    rating: 'medium',
    open: [
      'Retention: the period for financial records is unset; it must be set before the first charge (RETENTION.md).',
      'Sharing: Stripe’s terms and data-processing agreement are not recorded on the vendor register (SEC-010).',
      'Everything: nothing has been charged; the first real delivery from Stripe has not been seen (COM-001).',
    ],
  },
  {
    id: 'student-accounts',
    surface: 'Student accounts, payments and financial aid',
    what: 'A school’s student account — ledger per term, aid from the school’s aid system accepted by the student, holds, payment plans, credit refunds and provider payments: built, and off until the module, a named finance owner and the council finance seat are all in place.',
    owner: 'finance',
    assessed: '2026-09-29',
    answers: {
      purpose: { answer: 'To show a student what they owe the school and why, and to let the school’s bursar and aid office keep that account. Each table answers one question: what was posted (entries), what aid the school offered and whether the student took it (awards), whether the account is held (holds), how the balance is divided (plans), and what the student started paying (intents).', evidence: [{ path: 'supabase/migrations/20260929320000_student_accounts.sql', shows: 'The seven tables and the functions that are the only way in' }, { path: 'app/src/lib/studentaccount/ledger.ts', shows: 'The four bill.ts rules, restated for the ledger' }] },
      fields: { answer: 'Amounts in integer cents, the term, a short description, aid kind, the school’s own award id, verification and academic-progress status as the school reports them, and a hold reason the bursar writes. Aid and academic progress are sensitive (T4). No card, bank or tax data: the provider’s page takes payment details and a payment event keeps an id, an amount and a hash.', evidence: [{ path: 'supabase/student_accounts.check.sql', shows: 'The check constraints are walked: whole cents, closed vocabularies, no raw payload' }, { path: 'app/src/lib/studentaccount/studentaccount.schema.test.ts', shows: 'The TS vocabulary is the SQL one, both ways' }] },
      default: { answer: 'Private to the student and the school’s finance offices. A student reads only their own rows; nobody writes a table directly; every write is a function that checks the caller.', evidence: [{ path: 'supabase/student_accounts.check.sql', shows: 'A second student reads none of the first’s ledger, awards, plans or holds' }] },
      readers: { answer: 'bursar:post (student_accounts_officer) reads the school’s ledger, awards, holds, plans and payment starts; aid:manage (financial_aid_officer) reads awards and aid entries; hold:read (registrar) reads nothing in any table and asks student_hold_status, whose return type is whether, which office and since when — never the reason or an amount. Payment events are read by nobody.', evidence: [{ path: 'supabase/student_accounts.check.sql', shows: 'The registrar learns the student is held and reads nothing of the hold' }, { path: 'app/src/lib/studentaccount/studentaccount.test.ts', shows: 'holdStatus returns no reason and no amount' }] },
      identity: { answer: 'Not applicable in the anonymous sense: every row is about a named student and read by that student or a named finance office at their school. A payment event carries no student id, only the intent, and loses that when the account is deleted.', evidence: [{ path: 'supabase/migrations/20260929320000_student_accounts.sql', shows: 'student_payment_events has no student column; intent_id is set null on deletion' }] },
      ai: { answer: 'Nothing. No prompt builder reads a student account table, and financial fields are T4, which routeAllowed refuses for every AI destination.', evidence: [{ path: 'app/src/lib/integration/classification.test.ts', shows: 'T4 goes nowhere outside Semester' }] },
      retention: { answer: 'Account deletion of the student, or the school’s removal; no time-based purge, because Semester’s copy is not the school’s book of record. The period a school wants must be set before it turns the module on.', evidence: [RETENTION, RETENTION_TEST] },
      deletion: { answer: 'Deleting the student’s account removes every row by cascade — the append-only trigger lets a foreign-key action through and nothing else. Export covers every column that names the account, through private.account_data_map.', evidence: [{ path: 'supabase/student_accounts.check.sql', shows: 'Deleting an account empties its ledger; deleting a bursar keeps what they posted' }, DELETION_TEST] },
      sharing: { answer: 'None beyond the school’s own finance offices, which is the institution’s duty rather than a consent. The only thing another office learns is whether a hold exists.', evidence: [{ path: 'supabase/student_accounts.check.sql', shows: 'Another school’s bursar reads and posts nothing; the registrar reads no reason' }] },
      inference: { answer: 'A hold is a flag about an individual, placed by a person at the bursar’s office on a posted balance over the school’s threshold, never computed by Semester. Semester decides no eligibility and no amount: awards, verification and academic progress arrive from the school’s system.', evidence: [{ path: 'app/src/lib/studentaccount/studentaccount.test.ts', shows: 'Awards only from the adapter; a hold only over the threshold' }, { path: 'supabase/student_accounts.check.sql', shows: 'A signed-in account cannot sync an award; a hold at the threshold is refused' }] },
      guard: { answer: 'student_accounts.check.sql walks every rule with two students, a bursar, the aid office, the registrar and another school’s bursar; studentaccount.test.ts holds the pure rules, including the duplicate and out-of-order webhook cases.', evidence: [{ path: 'supabase/student_accounts.check.sql', shows: 'The rules, walked' }, { path: 'app/src/lib/studentaccount/studentaccount.test.ts', shows: 'The ledger, aid, refund, hold, plan and payment rules' }] },
    },
    rating: 'high',
    open: [
      'Retention: no period is set; a school’s own must be recorded before it turns the module on (RETENTION.md).',
      'Readers: the council finance seat is vacant and no school has named a finance owner, so nobody is accountable yet.',
      'Sharing: no payment provider is chosen, so its terms and data-processing agreement are not on the vendor register.',
      'Inference: a hold feeds registration, a consequential flag; the wording a student is shown has not been reviewed by a school.',
    ],
  },
];

export interface Owed {
  surface: string;
  /** Built and shipping, or designed and not yet built. */
  state: 'built' | 'designed';
  /** Where the assessment starts: the design or model that already answers some of the questions. */
  start: string;
  why: string;
}

/** Surfaces that touch student data and have not answered. A new module joins this list or `ASSESSMENTS`, never neither. */
export const OWED: readonly Owed[] = [
  { surface: 'Community rooms and media', state: 'built', start: 'docs/COMMUNITY-PRIVACY-MODEL.md', why: 'Three identities, an allowlisted peer payload and a leak tripwire exist (app/src/community/identity.test.ts); the eleven questions have not been answered in one place.' },
  { surface: 'School records from an institution’s systems', state: 'built', start: 'docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md', why: 'Classification tiers and freshness exist behind a flag that is off until a connection is live; the reader, retention and deletion answers wait on a real source.' },
  { surface: 'Course Studio, what faculty publish to students', state: 'built', start: 'docs/FACULTY-COURSE-STUDIO-DESIGN.md', why: 'Published versions are immutable under a live grant (supabase/coursestudio.check.sql); what a faculty member learns about a student who reads them is unanswered.' },
  { surface: 'Brightspace launches through LTI', state: 'built', start: 'docs/INSTITUTIONAL-SSO-ARCHITECTURE.md', why: 'The launch, the account binding and the line item each have a test; what the platform receives back, and when, is not written as one answer.' },
  { surface: 'Transfer Transition Hub, Career and workforce, Basic-Needs Navigator', state: 'designed', start: 'docs/MODULE-PRIVACY-MODEL.md', why: 'The privacy-by-module rows are the data inventory; the assessment is written when the module is built, before it ships.' },
  { surface: 'Support access to a student’s data under a grant', state: 'built', start: 'docs/CONSENT-SHARING-DESIGN.md', why: 'Every read under a grant is recorded (supabase/support-access.check.sql); the assessment would say what the agent can see, screen by screen.' },
];

/**
 * The gate: the pull-request template asks the question where the change is
 * reviewed. Held verbatim by the test.
 */
export const GATE = {
  where: '.github/pull_request_template.md',
  line: '10. What does it hold about a student? Its row in `app/src/lib/governance/pia.ts` with every question answered, or the sentence that says it touches no student data.',
} as const;

export const isTest = (p: string): boolean => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);

/** Whether an answer's evidence includes a test that runs on every change. */
export const held = (evidence: readonly Evidence[]): boolean => evidence.some((e) => isTest(e.path));

export interface Coverage {
  assessed: number;
  owed: number;
  /** Answers across every assessment whose evidence includes a test. */
  heldAnswers: number;
  /** Answers whose evidence is code or a document only. */
  writtenAnswers: number;
}

export function coverage(assessments: readonly Assessment[] = ASSESSMENTS, owed: readonly Owed[] = OWED): Coverage {
  let heldAnswers = 0;
  let writtenAnswers = 0;
  for (const a of assessments) {
    for (const id of QUESTION_IDS) {
      if (held(a.answers[id].evidence)) heldAnswers += 1;
      else writtenAnswers += 1;
    }
  }
  return { assessed: assessments.length, owed: owed.length, heldAnswers, writtenAnswers };
}
