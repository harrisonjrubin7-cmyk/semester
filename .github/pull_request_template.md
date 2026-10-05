## What and why

<!-- One paragraph. For a fix, the failure it fixes and how it was measured. -->

## Checked

Run from `app/`, not the repository root (see `CLAUDE.md`).

- [ ] `npx tsc -b`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run test:shuffle`
- [ ] `npm run build`
- [ ] Every new guard is shown to fail against a revert of the fix, and then restored.
- [ ] The documentation that describes this change moved with it — or the description says `Docs: none because <reason>` on a line of its own. `npm run docs:impact` checks the paths; `docs/documentation/OWNERSHIP-AND-REVIEW.md` says which.

## New dependency (skip if no package or Action is added)

`docs/SUPPLY-CHAIN.md` is the policy; `app/src/lib/supplychain.test.ts` fails on a licence or Action nobody has named.

- [ ] What it is for, and why an existing dependency or a few lines of our own code will not do.
- [ ] What it touches: student data, the network, the build only, or nothing at runtime.
- [ ] Its licence, and if it is not on the approved list, its entry in `NAMED` with the reason.
- [ ] A new Action is added to `ACTIONS` with its publisher and what its token can do.
## New module (skip unless this PR adds a module, screen family or integration)

The rule, from `SEMESTER-OPERATING-SYSTEM.md`: No new module launches unless it replaces, improves, or connects an existing student or institution workflow with measurable value.

1. What does this replace?
2. What student decision does it clarify?
3. What institution decision does it improve?
4. What data does it require?
5. Who owns it?
6. How is it supported?
7. How is it tested?
8. How does it fail?
9. How is it removed if it does not work?
10. What does it hold about a student? Its row in `app/src/lib/governance/pia.ts` with every question answered, or the sentence that says it touches no student data.

## Change advisory (skip unless this PR changes a policy, a permission, a retention rule, a data flow, an AI behaviour or a migration)

`docs/operating-model/CHANGE-MANAGEMENT.md` and `app/src/lib/governance/config-tiers.ts` say which tier a change is. A change above the lowest tier answers these before merge, in the PR, not after.

- [ ] Design: what a student or staff member sees differently, or that nothing visible changes.
- [ ] Privacy: what it holds about a person that it did not, or that it holds nothing new.
- [ ] Accessibility: how it was checked with keyboard only, or that it renders nothing.
- [ ] Data owner: who owns the data it touches, and that they know.
- [ ] Rollback: the exact step that undoes it, and whether the schema can go back (`ROLLBACK.md` says it cannot).

## Screens (skip if this PR changes nothing a student sees)

This is the quality contract from `docs/design/SEMESTER-UI-CONSTITUTION.md` §9.

- [ ] It renders inside `<Page>`, or is on `FRAMELESS` in `src/pageframe.test.ts` with a reason.
- [ ] Its header name comes from the registry. It has a one-sentence `blurb`.
- [ ] It has one primary action, and the other actions are visibly secondary.
- [ ] It uses components from constitution §5 and tokens from §4, with no new colour, radius, spacing or button pattern.
- [ ] It has loading, empty, error and permission states where the screen holds data.
- [ ] It shows source and freshness (`SourceBadge`) where a decision depends on outside data.
- [ ] Screenshots are attached at 390px and 1280px, on one dark and one light ground (`.claude/skills/run`).
- [ ] It works with keyboard only, and focus is visible. It reflows at 320px and at 200% zoom.
- [ ] A new destination is in `lib/navareas.ts` (`NAV_AREA_OF`).
