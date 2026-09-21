# MVP gap analysis — §46–48 against the app as it stands

Measured on 21 September 2026 against `origin/main` at `da1e581`.

This answers one question: **how far is Semester from the launch standard in §48**,
given the decision to treat §46–86 as a deliberate pivot toward a campus network.

## How this was measured, and why the first pass was wrong

The first pass grepped the client for the vocabulary of §46 and reported almost
every item "present". It was wrong, in the way this repository keeps catching in
its own instruments:

- **RSVP — "present (1 file)"** was `lib/export.ts` writing the `RSVP` property
  of an iCalendar attendee. There is no event RSVP anywhere in the app.
- **Reporting — "not found"** was also wrong, in the other direction. Reporting
  exists, as `public.reports`, with a reporter, a subject, a reason and a kept
  copy of the reported message. The client grep missed it because the feature is
  mostly server-side.

A keyword census proves that a word is in the tree. So the readings below are
taken from the **database schema first** — 32 tables across `supabase/migrations`
— because that is the layer that cannot be talked into agreeing, and from the
screens and libraries second.

## §48 launch standard, step by step

| # | Step | Status |
|---|---|---|
| 1 | Create an account | **Yes** — Supabase auth, `profiles` |
| 2 | Verify their identity | **Partial** — address confirmed, and *client-side only*; see below |
| 3 | Complete onboarding | **Yes** — onboarding and first-run exist |
| 4 | Build a profile | **Yes** — `profiles`, with a display name for classmates |
| 5 | Search their university | **Partial** — searches bundled campus data, not a university record |
| 6 | Find another student | **Partial** — only as *people in a course room* |
| 7 | Send a connection request | **No** — no connections table, no request |
| 8 | Have another account accept it | **No** — nothing to accept |
| 9 | Send messages | **Yes** — `messages`, `message_reactions`, blocking by policy |
| 10 | Find an organization | **No** — no organizations exist |
| 11 | Follow or join it | **No** — no follow, no membership |
| 12 | Discover an event | **No** — no campus events exist |
| 13 | RSVP | **No** |
| 14 | Receive relevant notifications | **Partial** — push delivery exists; no in-app notification feed |
| 15 | Refresh or log out | **Yes** |
| 16 | Return later | **Yes** |
| 17 | Find important state preserved | **Yes** — this is the app's strongest area |

**Seven of seventeen steps have no implementation at all**, and they are
contiguous: steps 6–13 are the social half of the loop in §47.

## What the schema does and does not contain

The 32 tables:

```
access_gate  access_log  app_admins  appointments  blocks  calendar_feeds
courses  enrollments  family_grants  form_responses  forms  group_members
group_tasks  groups  invites  lti_identity  lti_link_ticket  lti_nonce
lti_platform  message_reactions  messages  notes  profiles  push_devices
push_queue  referral_codes  referrals  reports  sittings  state  tasks  usage
```

Three of those names look like §46 features and are not:

- **`groups`** is a *coursework* group — `term`, a course `code`, a `due` date.
  It is group projects, not campus organizations.
- **`appointments`** is an opaque per-user sync row (`user_id`, `id`, `data`
  jsonb). It is the offline-first mirror of one student's own calendar, not a
  discoverable campus event.
- **`enrollments`** is `(user_id, term, code)` — what course a student *says*
  they are in.

Absent entirely, with no table and no column anywhere in the migrations:

```
connections / friendships        follows
organizations                    organization members
campus events                    rsvps
universities / schools           departments
in-app notifications
```

## The three structural findings

### 1. There is no social graph, and student discovery is not a directory

Today one student sees another **only** through a course room: school + term +
course code. `lib/classmates.ts` is explicit that this is people who *say* they
are in a class, because no student-usable registrar API exists.

That is a defensible design, but it is not §48 steps 6–8. A connection request
and an acceptance are a different shape from a shared room, and the Campus Graph
in §51 needs the edge to exist as a row.

### 2. Campus data is the frontend array §50 warns against

`app/src/data/` is **604K of shipped TypeScript**, 340K of it course catalogues:

```
courses/     340K, 4 files          campus.ts    289 lines
schools/     20K, 3 files, 216 ln   events.ts    246 lines
                                    catalog.ts   227 lines
```

§50 says not to maintain campus datasets this way, and gives the reason: no
ingestion, no validation, no dedup, no source tracking, no last-updated. Every
change is a rebuild and a redeploy.

### 3. `.edu` verification is a client check, and the repo says so

This is the finding that matters most for the pivot, and it is not mine —
`20260901000300_classmates_schools.sql` states it plainly:

> The client still applies the domain check where the school profile lists
> domains … **but a client check is not security**, and this file has always said
> the policies are the security.
>
> Restoring server-side strength for every school needs the `schools` table from
> Phase 2 and a `school_id` on `profiles`, so the policy can compare an address
> against that school's domains.

So §46's ".edu verification architecture" and §85's "enforce permissions
server-side" are the same missing piece, and the repository has already named
the fix.

## What follows, in the order the dependencies actually run

The pivot does not start with features. It starts with the row that everything
in §51 hangs off.

1. **`schools` table + `school_id` on `profiles`.** Named by the repo itself,
   unblocks server-side domain verification (§46), the university record step 5
   searches, and the root of the Campus Graph. Nothing else should go first.
2. **Move campus data behind ingestion** (§50) — seed and import scripts writing
   to the database, with source and last-updated columns.
3. **`connections`** — request, accept, the edge itself. Unblocks steps 6–8.
4. **`organizations` + membership + follows.** Unblocks steps 10–11.
5. **`events` + `rsvps`.** Unblocks steps 12–13. Note §64's rule that expired
   events must not show as upcoming needs a query that filters, not a client sort.
6. **In-app notification feed**, distinct from push. Unblocks step 14 and closes
   the §47 loop.

Two things from §46 are already done and should not be rebuilt: **reporting and
blocking**. Blocking is enforced by a row-level policy, so a blocked person's
words never reach the device — which is stronger than §69 asks for. Reports are
stored and, as `lib/classmates.ts` says outright, **not moderated**; §69's
moderation queue is the honest gap there.

## What this analysis does not cover

Sections 46–86 arrived duplicated and truncated — §86 AUDIT LOGS ends mid-list at
"Account suspended". Sections 1–45 are not in this repository; 396 markdown files
contain no MASTER PRODUCT TRANSFORMATION document, and nothing matching "MVP
DEFINITION", "Campus Graph" or "Directory 2.0". Anything those sections settle is
not reflected here.

Monetization (§76–78), university SaaS (§79) and the marketplace transaction
model (§70) are not assessed: none of their prerequisites exist yet, so a reading
would only restate that.
