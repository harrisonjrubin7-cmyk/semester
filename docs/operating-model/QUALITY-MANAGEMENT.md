# Quality-management system

"We test features" is a practice. A quality-management system goes further: it says what must be true at each point in
a feature's life, who signs, and what is measured afterwards to find out whether any of it worked.

Source: [`app/src/lib/governance/quality-gates.ts`](../../app/src/lib/governance/quality-gates.ts). `gate()` returns
the open items in order. The repository's own engineering gates (`tsc -b`, lint, `test`, `test:shuffle`, `build`,
described in [REGRESSION-CHECKLIST.md](../../REGRESSION-CHECKLIST.md)) are how the *Done* line "tests pass" is
checked.

## Definition of Ready

- User problem defined
- Owner identified
- Data source known
- Policy and classification known
- Accessibility acceptance criteria written
- Design complete
- Test strategy defined
- Cost model understood
- Support and rollback plan ready

A product charter that passes `charterProblems()` satisfies most of this list (see
[PORTFOLIO-GOVERNANCE.md](PORTFOLIO-GOVERNANCE.md)).

## Definition of Done

- Code complete
- RLS and authorization tested
- Unit, integration and regression tests pass
- Accessibility tested
- Source and freshness visible
- Analytics privacy reviewed
- Monitoring added
- Docs and runbook updated
- Feature flag and kill switch available
- Support notes and release notes ready
- Rollback tested

## Release gate

The release gate is made of signatures, not checkboxes, because releasing means a person accepts a risk.

- Product
- Engineering
- Security and privacy
- Accessibility
- Support and customer success
- Operational monitoring
- Tenant or pilot, where the tenant asked to approve releases

## Quality metrics, reviewed monthly

| Metric | Better |
| --- | --- |
| Defect escape rate | Lower |
| Regression rate | Lower |
| Mean time to detect | Lower |
| Mean time to resolve | Lower |
| Accessibility defect aging | Lower |
| Source-freshness failures | Lower |
| Connector failure recovery time | Lower |
| AI evaluation failures | Lower |
| Support contacts per feature | Lower |
| Adoption against intended outcome | Higher |

"Adoption against intended outcome" compares against the charter's own hypothesis, not against other features. A
feature that is heavily used but misses its intended outcome is a candidate for redesign.
