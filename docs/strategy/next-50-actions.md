# Next 50 actions

Source: the Semester maturity-program document (continue_12). Grouped by
dependency order, so breadth is not mistaken for progress. Every item started
`proposed`. Checked items are the `[x]` lines below, each with its evidence; the rest are
still `proposed` and unverified. Check an item only when its evidence exists in the
repository.

## Foundation

- [x] 1. Make capability maturity machine-readable. — `registry/maturity/capability-maturity.yaml`
- [ ] 2. Establish platform-pillar ownership. — `registry/platform/pillar-owners.yaml` (6 of 12 pillars have no owner)
- [x] 3. Create the contract-lab submission template. — `docs/engineering/contract-lab.yaml`
- [ ] 4. Validate all existing record-envelope schemas.
- [x] 5. Add tenant-isolation simulation to CI. — `packages/platform/src/isolation/isolation.test.ts` (in the app test include, `app/vite.config.ts`)
- [ ] 6. Add policy-reference checks to CI. — partial: `app/src/lib/registry/references.test.ts` (runs in `npm test`) ratchets passport references. 15 stay open, each listed with its reason, because no POL, EVD, TST, REL or SLO record exists yet.
- [ ] 7. Add API and event compatibility checks.
- [x] 8. Add release-evidence expiration rules. — `app/src/lib/governance/release-profiles.test.ts` (fails closed on stale, failed, revoked or expired evidence)
- [ ] 9. Add correlation IDs end to end.
- [x] 10. Create a source/freshness state test harness. — `app/src/lib/source-verification.test.ts` (every evaluation × freshness × connection combination)

## Pilot reliability

- [ ] 11. Certify the readiness connector to `pilot_approved` (needs 12, 14 and 16 first). Requires every `validated` item plus the `pilot_approved` list in `registry/connectors/connector-certification.yaml`, including approved-provider sandbox readback and target validation. — `registry/connectors/SIS-READINESS-001.yaml` is a connector record only, not a component passport
- [x] 12. Implement source-health monitoring. — `app/src/components/console/IntegrationHealth.tsx` with `supabase/migrations/20261005125000_console_integration_health.sql`
- [ ] 13. Complete stale/unknown/error UI states.
- [ ] 14. Test duplicate and out-of-order events.
- [x] 15. Test access revocation during workflow execution. — `packages/institution/src/access-saga.test.ts` (revocation while an install is in flight)
- [ ] 16. Test safe-off activation.
- [ ] 17. Run a reconciliation drill.
- [ ] 18. Run a restore/rebuild drill. — logical rehearsal recorded in `docs/evidence/restore/2026-10-12-logical-rehearsal.md`; a staging restore of a live-project backup is still open
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
- [x] 30. Publish the general student quick start. The registration-readiness pilot copy stays open (`docs/pilot/registration-readiness/README.md` row 25). — `docs/launch/STUDENT-QUICK-START.md` (linked from `docs/help/README.md`; registered `READY` in `app/src/lib/launch/content.ts`)

## Institutional repeatability

- [x] 31. Build tenant implementation workspace. — `app/src/components/console/TenantOperations.tsx` with `supabase/console-tenant-operations.check.sql`
- [x] 32. Package connector mapping template. — `docs/institutional-readiness/DATA-MAPPING-TEMPLATE.md` with `docs/institutional-implementation/INTEGRATION-WORKBOOK.md`
- [x] 33. Package configuration change workflow. — `docs/guides/institution/CONFIGURATION-AND-APPROVALS.md` with `docs/CONFIGURATION-STUDIO.md`
- [x] 34. Create source-authority review worksheet. — `docs/institutional-readiness/DATA-MAPPING-TEMPLATE.md` (controlled blank: creation only; no source, owner, authority or approval is filled in)
- [x] 35. Create role-mapping worksheet. — `docs/institutional-readiness/ROLE-AND-PERMISSION-MATRIX.md` (Target approval worksheet)
- [x] 36. Create institution launch checklist. — `docs/market-readiness/PILOT-LAUNCH-CHECKLIST.md`
- [ ] 37. Create pilot measurement packet. — controlled blank scorecard at `docs/commercial/PILOT-SCORECARD.md`; populating and approving it for a named pilot is still open
- [ ] 38. Complete renewal-decision workflow.
- [ ] 39. Simulate a second tenant.
- [ ] 40. Document reusable variations and exclusions.

## Deliberate expansion

- [ ] 41. Charter degree-scenario planning.
- [ ] 42. Charter advisor collaboration.
- [x] 43. Decide whether Course Studio is a near-term wedge. — `docs/decisions/D-1067.md`; Q3 pilot in `docs/product/EDUCATION_OS_BACKLOG.md`
- [x] 44. Establish course-source packet standard. — `app/src/lib/courserules.ts` (pack shape and authority classes), `docs/COURSE-SOURCE-AUTHORITY.md` (source-authority contract), `supabase/migrations/20260928309000_course_studio.sql` (versioned packs), `app/src/components/StudyStudio.packs.test.tsx` (enforcement). Source storage, upload and deployment remain separate items.
- [ ] 45. Complete AI evaluation and incident workflow.
- [ ] 46. Define external-audience identity boundaries.
- [ ] 47. Prototype developer sandbox internally.
- [ ] 48. Implement company billing controls.
- [x] 49. Define finance-entry preconditions. — `docs/finance/native-finance-sequence.yaml` (stage 3 `preconditions`); gates in `docs/finance/FINANCE_RELEASE_GATES.md`
- [ ] 50. Re-score the portfolio before opening another domain.

## Executive decision

Whether the next delivery cycle proves the registration-readiness wedge end to
end (source authority, policy, accessibility, support, reconciliation, release
evidence, measurable pilot outcome), or dilutes that proof by expanding into
conceptual domains. The recommendation in the source document is the first.
