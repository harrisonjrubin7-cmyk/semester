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

## Release readiness

**Code: `release-readiness.ts`.** The three gates above ask whether a *change* is ready, done and approved. Release
readiness asks something else, later: is a *feature* ready to meet more people than it has met so far? Each owning
reviewer scores their dimension 0–100, and the weights make a total out of 100.

| Dimension | Weight | Release question |
| --- | --- | --- |
| User value | 20% | Does it solve a demonstrated student or institution job? |
| Usability | 15% | Can target users finish the job unaided? |
| Accessibility | 15% | Does it pass critical WCAG 2.2 and assistive-technology checks? |
| Security and privacy | 15% | Is data minimized, authorized, auditable and revocable? |
| Reliability | 15% | Does it have SLOs, monitoring, recovery and rollback? |
| Data trust | 10% | Are source, freshness, uncertainty and limits visible? |
| Supportability | 5% | Can support explain, diagnose and resolve it? |
| Commercial readiness | 5% | Are scope, packaging and documentation ready to sell? |

### Proof before scale

A feature climbs one stage at a time. `promote()` refuses to skip a rung, so the evidence that it survived each
stage is what earns the next.

| Stage | Evidence | Total needed | High-stakes total |
| --- | --- | --- | --- |
| Internal | Works with synthetic or test data, staff workflows and automated tests | 0 | 0 |
| Design partner | Used by a narrow permissioned cohort under direct observation | 70 | 75 |
| Pilot | Used by real students or institution users under a defined agreement and support | 85 | 90 |
| General availability | Meets adoption, reliability, accessibility, security and support evidence thresholds | 90 | 95 |
| Enterprise | Meets contractual SLA, integration, migration, audit and 24/7 support requirements | 95 | 97 |

"High-stakes" means assessment and grade workflows, where a wrong answer is a student's mark.

**No dimension may score under 60 past internal, whatever the total.** A feature at 100 on user value and 40 on
accessibility has not averaged its way to ready, for the same reason one zero overrides a high total on the portfolio
scorecard. The pilot threshold of 85 comes from the execution plan; the others, and the floor, were chosen for this
file and are open to the council to change. Change them in code, and this table's test will say where the doc
disagrees.
