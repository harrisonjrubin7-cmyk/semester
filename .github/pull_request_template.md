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
- [ ] A new destination is in `lib/journey.ts` (`AREA_OF`).
