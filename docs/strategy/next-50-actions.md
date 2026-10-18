# Next 50 actions

Source: the Semester maturity-program document (continue_12). Grouped by
dependency order, so breadth is not mistaken for progress. Every item started
`proposed`. Items 1 and 3 are now checked because their files exist in the
repository; the rest are still `proposed` and unverified. Check an item only when
its evidence exists in the repository.

## Foundation

- [x] 1. Make capability maturity machine-readable. — `registry/maturity/capability-maturity.yaml`
- [ ] 2. Establish platform-pillar ownership. — `registry/platform/pillar-owners.yaml` (6 of 12 pillars have no owner)
- [x] 3. Create the contract-lab submission template. — `docs/engineering/contract-lab.yaml`
- [ ] 4. Validate all existing record-envelope schemas.
- [ ] 5. Add tenant-isolation simulation to CI.
- [ ] 6. Add policy-reference checks to CI.
- [ ] 7. Add API and event compatibility checks.
- [ ] 8. Add release-evidence expiration rules.
- [ ] 9. Add correlation IDs end to end.
- [ ] 10. Create a source/freshness state test harness.

## Pilot reliability

- [ ] 11. Certify the readiness connector (needs 12, 14 and 16 first). — `registry/connectors/SIS-READINESS-001.yaml` is a passport only
- [ ] 12. Implement source-health monitoring.
- [ ] 13. Complete stale/unknown/error UI states.
- [ ] 14. Test duplicate and out-of-order events.
- [x] 15. Test access revocation during workflow execution. — `packages/institution/src/access-saga.test.ts` (revocation while an install is in flight)
- [ ] 16. Test safe-off activation.
- [ ] 17. Run a reconciliation drill.
- [ ] 18. Run a restore/rebuild drill.
- [ ] 19. Finalize hypercare ownership.
- [ ] 20. Complete a pilot activation decision record. — requires a PR number under `docs/decisions/`

## Student and staff wedge

- [ ] 21. Finish the Today action center.
- [ ] 22. Implement readiness receipt history.
- [ ] 23. Complete advisor handoff queue.
- [ ] 24. Complete registrar exception queue.
- [ ] 25. Implement student privacy/session controls.
- [ ] 26. Complete support-handoff consent preview.
- [ ] 27. Build accessible mobile critical path.
- [ ] 28. Verify screen-reader and keyboard paths.
- [ ] 29. Train pilot staff with scenarios.
- [ ] 30. Publish student quick start.

## Institutional repeatability

- [ ] 31. Build tenant implementation workspace.
- [ ] 32. Package connector mapping template.
- [ ] 33. Package configuration change workflow.
- [ ] 34. Create source-authority review worksheet.
- [ ] 35. Create role-mapping worksheet.
- [ ] 36. Create institution launch checklist.
- [ ] 37. Create pilot measurement packet.
- [ ] 38. Complete renewal-decision workflow.
- [ ] 39. Simulate a second tenant.
- [ ] 40. Document reusable variations and exclusions.

## Deliberate expansion

- [ ] 41. Charter degree-scenario planning.
- [ ] 42. Charter advisor collaboration.
- [ ] 43. Decide whether Course Studio is a near-term wedge.
- [ ] 44. Establish course-source packet standard.
- [ ] 45. Complete AI evaluation and incident workflow.
- [ ] 46. Define external-audience identity boundaries.
- [ ] 47. Prototype developer sandbox internally.
- [ ] 48. Implement company billing controls.
- [ ] 49. Define finance-entry preconditions.
- [ ] 50. Re-score the portfolio before opening another domain.

## Executive decision

Whether the next delivery cycle proves the registration-readiness wedge end to
end (source authority, policy, accessibility, support, reconciliation, release
evidence, measurable pilot outcome), or dilutes that proof by expanding into
conceptual domains. The recommendation in the source document is the first.
