# Product Readiness

**Status: `IN_PROGRESS`**

## Measured

- 1,330 `.ts`/`.tsx` files under `app/src`
- 601 test files, 11,880 tests passing, 10 skipped
- Suite passes in file order, shuffled order, and two non-local timezones
- Production build clean

## Breadth

Screens span academics, calendar, courses, degree planning, classmates,
groups, family, career, housing, athletics, study tooling, a design editor and
an AI surface. Feature breadth is not the constraint on university readiness.

## Gaps

| Gap | Effect |
| --- | --- |
| No per-university feature flags | Every university gets the same product; a pilot cannot scope down |
| No account lifecycle states | Graduation, leave and suspension are not modelled |
| Role model is one global admin bit | No department or university administrator exists |

## Next

Feature flags per tenant are the highest-leverage product change: they turn a
pilot from "all of Semester" into "the three things this department agreed to",
which is how pilots actually get signed.
