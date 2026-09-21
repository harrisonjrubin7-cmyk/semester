# Executive Readiness

**Audited at `57783cf`, 2026-09-21.** Index: [`SEMESTER_MARKET_READINESS.md`](../../SEMESTER_MARKET_READINESS.md).

## The one-paragraph answer

Semester is a large, well-tested student application — 1,330 source files,
11,880 passing tests — with an unusually strong integration contract and an
unusually weak institutional posture. It is not ready for a university pilot,
and the gap is not features. It is tenancy, identity, observability and the
paperwork a procurement office asks for.

## What a university would find impressive today

- **The integration gateway.** `@semester/institution` names 37 service areas
  and validates a transport contract; `app/server/institution/` implements a
  two-phase action with an encrypted journal that records an action *before*
  attempting it and marks it `uncertain` when the outcome is unknown, with no
  transition out of `uncertain` on a timer or a retry. Most student products
  would have retried and double-dropped a course.
- **The refusal to simulate.** The adapter registry is empty on purpose. No
  screen draws a plan as an official submission. This is the single most
  credible thing in the repository for an institutional buyer.
- **The testing culture.** Guards are verified by reverting the fix and
  watching the test go red. CI runs the suite three times — in file order, in
  a shuffled order, and in two other timezones.

## What would end a security review today

1. **No multi-tenant isolation.** See the scorecard. Tenant identity landed
   hours ago; nothing enforces it yet.
2. **No SSO.** No SAML, no OIDC. A university cannot put this behind its IdP.
3. **No observability.** If it breaks in production, nobody finds out from the
   system.
4. **No admin audit log in the database.** The gateway journals its own
   actions; role changes and tenant setting changes are not recorded.
5. **No HTTP security headers.**

## Sequenced recommendation

Do not pursue all fifteen scorecard areas at once. In order:

1. Finish tenancy (claim screen → policies read `same_school()` → cross-tenant
   tests). It blocks every institutional conversation.
2. Observability. Cheap, and it converts every later fix from guesswork.
3. SSO. The first thing a CIO asks; long lead time on metadata exchange.
4. Audit log + security headers + data classification.
5. Procurement pack, once 1–4 are true rather than planned.

## Honest positioning

Until an adapter is approved and implemented, Semester is an *experience and
planning layer* over university life, not a system of record. Every
institutional claim should be phrased that way. The product is strong enough
not to need overstatement.
