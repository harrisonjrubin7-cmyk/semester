# Implementation Playbook

**Status: `NOT_STARTED`**

## Phases

```
DISCOVER → CONFIGURE → INTEGRATE → PILOT → EXPAND → OPERATE
```

**Discover.** Which departments, which cohorts, which workflows, which systems.
Written down and agreed, because scope creep in a university pilot is the
normal failure mode.

**Configure.** Tenant, branding, calendar, features. Blocked today on the
per-tenant configuration and feature-flag work — see `UNIVERSITY_ONBOARDING.md`.

**Integrate.** Only where an approved adapter exists. Where none does, say so
and run the pilot without it rather than mocking it.

**Pilot.** See `PILOT_PLAYBOOK.md`.

**Expand.** Only after the pilot's success criteria are measured, not asserted.

**Operate.** Support, incident response, review cadence.

## Roles on our side

| Role | Owns |
| --- | --- |
| Implementation lead | The plan and the relationship |
| Engineer | Configuration, integration, defects |
| Support lead | Student and staff questions |

For a first pilot these can be one or two people. They cannot be zero, and
whoever it is should be named to the university.

## The rule that protects both sides

Never configure a university to depend on a capability that does not exist
yet. If a feature is on the roadmap, the pilot plan says "not in this pilot",
not "coming soon".
