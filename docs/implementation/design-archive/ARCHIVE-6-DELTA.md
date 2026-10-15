# Archive 6 delta

**Archive:** `The Main Semester design system (6).zip`, uploaded to the project on 2026-10-14
**Archive SHA-256:** `33f6a74ceabd1a98c08fa1e0f6695b9cf02a7db4a9c90952dabe34a8b81e82fa`
**Inspected:** 2026-10-14
**Disposition:** read-only evidence under the same rules as the inventoried archive ([DECISIONS-AND-CONFLICTS.md](DECISIONS-AND-CONFLICTS.md)). Its own README says the prototypes are "not the product — nothing here is deployed or connected to real systems".

## What it is

A later export of the archive already inventoried in [ARCHIVE-MANIFEST.md](ARCHIVE-MANIFEST.md): the clickable prototypes (`ui_kits/`), the component layer, tokens, fonts, brand assets and guideline pages. 888 entries; no absolute or traversal paths, symlinks or nested archives; uncompressed/compressed ratio 3.3.

## How it compares

Every entry was hashed (SHA-256) against the 2,750 unique hashes in [`manifest/`](manifest/).

| Result | Entries |
| --- | ---: |
| Identical to an inventoried entry | 682 |
| Differs only in the `@dsCard group="…"` label (catalog regrouping, e.g. `Components` → `Components & patterns · Components`) | 27 |
| Content not in the inventoried archive | 179 |
| **Total** | **888** |

**Unchanged, so nothing to merge:** `tokens/*.css`, `styles.css`'s token sources, every font (Barlow, Barlow Condensed, Cinzel and `OFL.txt`), all 108 icons, the logos already in `app/public/semester-design/`, and the eight `guidelines/0*.md` documents. The production token authorities (`lib/look.ts`, `styles/tokens.css`) are not affected.

**Component layer:** every `.jsx`/`.d.ts` in the archive matches the source integrated in `app/src/components/semester-design/` except for lint and focus fixes the repository made on import (for example `Tabs.jsx` derives its active focus instead of resetting it in an effect, and handlers use `if` rather than `a && a()`). The repository copy is ahead; nothing is taken back. The 75 `*.prompt.md` files stay excluded, as that directory's README requires.

**New content (179 entries):**

| Area | Entries | Files |
| --- | ---: | --- |
| `README.md` | 1 | README.md |
| `_ds_bundle.js` | 1 | _ds_bundle.js |
| `_ds_manifest.json` | 1 | _ds_manifest.json |
| `guidelines` | 37 | reference pages (all `.html`) |
| `index.html` | 1 | index.html |
| `ui_kits/academic-records` | 1 | index.html |
| `ui_kits/admissions` | 1 | index.html |
| `ui_kits/agent-ops` | 1 | index.html |
| `ui_kits/architecture` | 2 | ArchApp.jsx, index.html |
| `ui_kits/atlas` | 1 | index.html |
| `ui_kits/build-plan` | 2 | index.html, manifest-data.js |
| `ui_kits/business` | 9 | Market Research.html, Operating Manual.html, Operating Pack.html, Pilot One-Pager.html, Vanderbilt Campus Map.html, business-data.js, extras.js, gtm-copy.js, index.html |
| `ui_kits/campus-services` | 3 | index.html, ops-core.js, roommate.js |
| `ui_kits/capability-blueprint` | 1 | index.html |
| `ui_kits/capability-registry` | 3 | Registry.jsx, index.html, registry.js |
| `ui_kits/community` | 1 | index.html |
| `ui_kits/company-os` | 2 | company-os-data.js, index.html |
| `ui_kits/company-os-map` | 1 | index.html |
| `ui_kits/company-site` | 3 | Pages.jsx, Site.jsx, index.html |
| `ui_kits/company-workflows` | 1 | index.html |
| `ui_kits/completion-register` | 3 | green.js, index.html, kit.js |
| `ui_kits/compliance` | 1 | index.html |
| `ui_kits/connected-journeys` | 1 | index.html |
| `ui_kits/console` | 1 | index.html |
| `ui_kits/console-entry` | 1 | index.html |
| `ui_kits/course-studio` | 1 | index.html |
| `ui_kits/course-workspace` | 3 | CourseWorkspace.jsx, course-data.js, index.html |
| `ui_kits/data-model` | 1 | index.html |
| `ui_kits/demo-video` | 1 | index.html |
| `ui_kits/developer-portal` | 2 | index.html, reference.js |
| `ui_kits/device-permissions` | 1 | index.html |
| `ui_kits/ecosystem` | 1 | index.html |
| `ui_kits/every-screen` | 6 | bespoke-launchseq.jsx, bespoke-m1.jsx, bespoke-sync.jsx, every-rows.js, index-standalone.html, index.html |
| `ui_kits/external` | 1 | index.html |
| `ui_kits/faculty-grading` | 1 | index.html |
| `ui_kits/forms` | 1 | index.html |
| `ui_kits/gap-screens` | 1 | index.html |
| `ui_kits/governance-backbone` | 1 | index.html |
| `ui_kits/governed-workspace` | 1 | index.html |
| `ui_kits/investor` | 2 | Investor.jsx, index.html |
| `ui_kits/investor-portal` | 2 | impl.js, index.html |
| `ui_kits/journey` | 1 | index.html |
| `ui_kits/launch-kit` | 1 | index.html |
| `ui_kits/mainframe` | 1 | index.html |
| `ui_kits/master-catalog` | 4 | Catalog.jsx, catalog-ids.js, index.html, screen-loops.js |
| `ui_kits/master-control` | 1 | index.html |
| `ui_kits/mobile` | 1 | index.html |
| `ui_kits/native-finance` | 2 | controls.jsx, index.html |
| `ui_kits/native-ops` | 1 | index.html |
| `ui_kits/native-platform` | 2 | index.html, native-data.js |
| `ui_kits/network` | 1 | index.html |
| `ui_kits/one-place` | 1 | index.html |
| `ui_kits/ops` | 1 | index.html |
| `ui_kits/ops-inbox` | 1 | index.html |
| `ui_kits/phase-one` | 2 | index-print.html, index.html |
| `ui_kits/pilot-launch` | 2 | index.html, pilot-data.js |
| `ui_kits/platform` | 3 | appearance.js, index.html, live.js |
| `ui_kits/platform-maturity` | 2 | index.html, platform-data.js |
| `ui_kits/readiness-pilot` | 2 | Pilot.jsx, index.html |
| `ui_kits/registrar-console` | 1 | index.html |
| `ui_kits/registrar-replacement` | 1 | index.html |
| `ui_kits/role-lens` | 1 | index.html |
| `ui_kits/role-lifecycle` | 1 | index.html |
| `ui_kits/role-pages` | 1 | index.html |
| `ui_kits/role-workspaces` | 1 | index.html |
| `ui_kits/roles-access` | 3 | RolesAccess.jsx, index.html, roles-data.js |
| `ui_kits/scale-system` | 2 | index.html, scale-data.js |
| `ui_kits/screen-atlas` | 1 | index.html |
| `ui_kits/security-assurance` | 1 | index.html |
| `ui_kits/semester-account` | 1 | index.html |
| `ui_kits/semester-app` | 10 | All Screens.html, DependencyMap.jsx, GreenRegister.jsx, OdxSync.jsx, RealCourses.jsx, TiersRls.jsx, index.babel.html, index.html, mobile.html, semester-app.compiled.json |
| `ui_kits/ship-program` | 1 | index.html |
| `ui_kits/slack-integration` | 1 | index.html |
| `ui_kits/staff` | 1 | index.html |
| `ui_kits/staff-workspace` | 2 | index.html, model.js |
| `ui_kits/student` | 3 | StudentApp.jsx, index.html, student.compiled.json |
| `ui_kits/student-lifecycle` | 1 | index.html |
| `ui_kits/study-studio` | 1 | index.html |
| `ui_kits/traceability` | 2 | index.html, trace-data.js |
| `ui_kits/walkthrough-video` | 3 | index.html, vo-script.md, walkthrough.jsx |
| `ui_kits/wireframes` | 1 | index.html |
| `ui_kits/workflow-lab` | 1 | index.html |
| `ui_kits/workflow-runner` | 3 | Runner.jsx, index.html, runner-data.js |

## Use

- The prototypes stay outside the repository. They are evidence of intended screens and flows, read when a slice is built; DAC-003 and DAC-008 apply, so a prototype that shows a flow as done or approved is not evidence that it is.
- `ui_kits/faculty-grading` (rubric scoring, feedback, accommodations, AI suggestions that stay draft until reviewed) and `ui_kits/course-studio` (assessments and question bank, grade release, office hours) are the reference for the Faculty P0 slice in [the ecosystem build plan](../../master/SEMESTER_ECOSYSTEM_BUILD_PLAN.md).
- No asset was copied: the brand assets and fonts the app needs are already in `app/public/semester-design/` and `app/src/styles/fonts/`.
