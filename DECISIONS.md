# Decisions that are made

A decision is only made if it is written down. Two things in this project have
been settled twice, by different people at different times, because the first
settlement lived in a conversation — and one of them was re-argued in a pull
request that had to be closed.

This file holds the ones that are meant to stay settled. Each says what was
decided, what it rules out, what it costs, and **what would change it** —
because a decision with no reopening condition is either a rule nobody can
question or one everybody quietly ignores, and both are worse than a date.

---

## 1 · Vanderbilt depth before multi-LMS breadth

**Decided 21 September 2026. Holds until the Stage 4 gate.**

### The decision

Go deep at one university before going wide across learning-management
systems. Until a Vanderbilt data agreement exists and the first real adapter
is live, no engineering effort goes into supporting a second institution's
systems, and no adapter is written for an LMS that Vanderbilt does not use.

### What that rules out

- No Blackboard or Moodle adapters, however often they are asked for.
- No "works at any university" positioning, on the site, in the deck, or in a
  conversation with an adviser.
- Canvas stays as it is. The token sync landed on 19 September and is a
  student-side convenience — it reads a student's own courses with a token
  they pasted in, needs nobody's permission, and is not an institutional
  integration. Hardening it to L2 is a Stage 4 item and does not reopen this.
- Brightspace is the exception, because Brightspace is what Vanderbilt uses.
  It is the *first* adapter in the plan, not a second one.

### Why

**Breadth is the cheaper thing to build and the more expensive thing to be
wrong about.** Four LMS adapters is four times the surface and four times the
maintenance, against four institutions none of which has signed anything —
and an adapter without an agreement behind it is a screen holding only what
somebody typed in, which `lib/role.ts` argues at length is "a confident thing
that is not true".

**One signature is the product.** Stage 5's entire ordering — courses, then
forms, then feeds, then registration, then money — assumes a counterparty. Each
domain needs an agreement, an adapter and a review, and none of that
generalises to the next university without a second set of all three. Doing
one to completion teaches what the second costs; doing four halfway teaches
nothing and produces four half-integrations to maintain.

**The founder is at Vanderbilt.** The advantage is proximity: the Wond'ry,
VUIT, CTTC, the academic-integrity office and the registrar are all people who
can be met this term. That advantage does not transfer to a university nobody
here has walked into, and it is the only unfair advantage this project has.

**Depth is defensible and breadth is not.** Anyone can write a Canvas
importer. A signed Brightspace read agreement with an audit journal behind it
is a thing a competitor has to go and negotiate, one university at a time.

### What it costs, stated rather than glossed

A student at another university cannot use the campus half of this app, and
will not be able to for a year. The self-serve features — syllabus import,
study, revise, the personal screens — work for anybody, and that is the
honest description of what Semester is outside Nashville until Stage 4.

It also means that if the Vanderbilt conversation fails, the institutional
track restarts from nothing somewhere else. That risk is accepted knowingly:
the self-serve product does not depend on it, and Stage 4's self-serve half is
deliberately arranged to be shippable with no agreement at all.

### What would change it

Any one of these, and it is a decision to be re-made rather than an argument
to be re-had:

- Vanderbilt says no, or says nothing for two consecutive terms.
- A second university approaches Semester first, with somebody inside it
  willing to sign. Being invited is a different proposition from cold
  outreach.
- Self-serve usage outside Vanderbilt becomes large enough that the campus
  features are what those users are asking for — measured, not assumed, from
  the figures in [`ANALYTICS.md`](ANALYTICS.md).

### Where the work lives

Stage 4 of the build-out plan: the self-serve campus half needs no agreement
and is engineering; the institutional half is the Vanderbilt data-agreement
conversation through VUIT and legal, the institutional gateway hosted
properly, and Brightspace through the two-phase confirm and audit-journal
path.

---

## 2 · The migration ledger is never edited to look tidy

**Decided 21 September 2026 and already tested once.**

Recorded here because it was a live proposal that got as far as a written plan
— [`MIGRATION-HISTORY.md`](MIGRATION-HISTORY.md) step 5 — and was withdrawn on
evidence gathered doing the other steps. It would have written a history that
cannot replay, which is a worse fault than the untidy one it was fixing.

The rule it leaves behind: **read before write, and never write to production
to make a record tidy.** Seven migrations were renumbered in files instead, and
the six schema fingerprints were byte-identical before and after, which is what
says the renumbering moved names and not schema.

**What would change it:** nothing short of a Supabase mechanism for correcting
a ledger entry that is itself replayable. Until then a mismatched version is
the truthful state and is written down rather than corrected.
