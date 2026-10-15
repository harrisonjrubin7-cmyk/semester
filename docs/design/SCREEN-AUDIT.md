# Screen audit

Generated 2026-10-01 at `9d1e1d81` by `npm run audit:screens -- --write` (run from `app/`). Do not edit by hand.

Every screen in `app/src/screens.tsx`, the navigation area `lib/navareas.ts` files it under, and the five criteria of the constitution’s rubric (§9) that can be read from source. The other five — responsive layout, verified accessibility, complete states, navigation clarity, plain language — need a person with the app open and are **not scored here**. Scores are per module: screens drawn from the same file share a row’s numbers.

## Summary

- **96 screens** from **90 modules**.
- In the shared `Page` frame: 73 modules; in `SettingsPage`: 8; frameless: 9.
- Showing a purpose sentence: 78 of 96 screens — 33 their own, 45 the registry's by default.
- With colour literals (hex or `rgb()`/`rgba()`) instead of tokens: 4 modules, 5 literals in all.
- Using the second primary-button style, `.portal-primary` (`styles/features.css`), beside `.btn-primary`: 2 screen modules (components are not scanned).
- Showing a source or trust label: 6 modules. Using the shared `EmptyState`: 16.

| Band (automatable half, out of 10) | Screens |
|---|---:|
| System-ready (9–10) | 29 |
| Targeted migration (6–8) | 55 |
| Redesign before new features (0–5) | 12 |

| Area | Screens | Mean score |
|---|---:|---:|
| Today | 4 | 7.5 |
| Plan | 18 | 7.8 |
| Learn | 31 | 7.2 |
| Help | 5 | 8.0 |
| Campus | 11 | 7.5 |
| Progress | 5 | 8.6 |
| You | 15 | 7.5 |

## Criteria

| Column | 2 | 1 | 0 |
|---|---|---|---|
| Frame | renders `<Page>` | renders `<SettingsPage>` (the second frame) | neither |
| Purpose | its own `blurb`, or the registry sentence `Page` draws by default | — | neither |
| Colour | no colour literals | 1–3 | 4 or more |
| Action | 1–2 primary buttons | none, or 3–4 | 5 or more |
| Styling | ≤3 inline `style={{` per 100 lines | ≤8 | more |

## Every screen

| Area | Screen | Shelf | Module | Frame | Purpose | Colour literals | Primaries | Inline styles / 100 lines | Empty state | Trust label | Score | Band |
|---|---|---|---|---|---|---:|---:|---:|---|---|---:|---|
| — | Your activity `activity` | — | `screens/Activity.tsx` | Page | own | 0 | 0 | 15.0 | yes | — | 7 | Targeted migration |
| — | What changed `whatsnew` | — | `screens/WhatsNew.tsx` | Page | own | 0 | 0 | 14.0 | — | — | 7 | Targeted migration |
| — | escalation agreements `agreements` | — | `screens/Agreements.tsx` | Page | own | 0 | 3 | 7.8 | — | — | 8 | Targeted migration |
| — | Recovery `recovery` | — | `screens/Recovery.tsx` | Page | own | 0 | 3 | 6.0 | — | — | 8 | Targeted migration |
| — | the volunteer programme `volunteers` | — | `screens/Volunteers.tsx` | Page | own | 0 | 2 | 6.2 | — | — | 9 | System-ready |
| Today | this gap between classes `gap` | — | `screens/Gap.tsx` | none | — | 0 | 1 | 5.9 | yes | — | 5 | Redesign before new features |
| Today | Today `home` | Semester | `screens/Today.tsx` | Page | — | 0 | 2 | 6.9 | yes | — | 7 | Targeted migration |
| Today | Notices `hub` | Semester | `screens/Hub.tsx` | Page | own | 0 | 0 | 0.0 | — | yes | 9 | System-ready |
| Today | Alerts `notifs` | Data | `screens/Me.tsx` | Page | registry | 0 | 2 | 4.6 | yes | — | 9 | System-ready |
| Plan | this note `note` | Life | `screens/Mine.tsx` | Page | — | 0 | 8 | 6.3 | yes | — | 5 | Redesign before new features |
| Plan | Community `community` | Life | `screens/Community.tsx` | Page | own | 0 | 11 | 8.1 | — | — | 6 | Targeted migration |
| Plan | Career `career` | Beyond | `screens/Career.tsx` | Page | registry | 0 | 33 | 7.3 | — | — | 7 | Targeted migration |
| Plan | this event `event` | Semester | `screens/Calendar.tsx` | Page | — | 0 | 2 | 5.6 | yes | — | 7 | Targeted migration |
| Plan | Personal `mine` | Life | `screens/Mine.tsx` | Page | registry | 0 | 8 | 6.3 | yes | — | 7 | Targeted migration |
| Plan | the review queue `moderation` | Life | `screens/Moderation.tsx` | Page | own | 0 | 5 | 5.1 | — | — | 7 | Targeted migration |
| Plan | Pathway `pathway` | Beyond | `screens/Pathway.tsx` | Page | registry | 0 | 11 | 6.8 | — | — | 7 | Targeted migration |
| Plan | Applications `applying` | Beyond | `screens/Applying.tsx` | Page | registry | 0 | 1 | 8.3 | — | — | 8 | Targeted migration |
| Plan | Term deadlines `registrar` | Courses | `screens/Registrar.tsx` | Page | registry | 0 | 2 | 8.8 | — | yes | 8 | Targeted migration |
| Plan | Exam runway `runway` | Study | `screens/Runway.tsx` | Page | registry | 0 | 4 | 6.5 | yes | — | 8 | Targeted migration |
| Plan | volunteer moderation `volunteer` | Life | `screens/Volunteer.tsx` | Page | own | 0 | 4 | 3.5 | — | — | 8 | Targeted migration |
| Plan | Registration `yes` | Courses | `screens/Yes.tsx` | Page | registry | 0 | 1 | 8.5 | — | — | 8 | Targeted migration |
| Plan | A change to a date `announce` | Courses | `screens/Changes.tsx` | Page | own | 0 | 0 | 1.7 | — | — | 9 | System-ready |
| Plan | Calendar `calendar` | Semester | `screens/Calendar.tsx` | Page | registry | 0 | 2 | 5.6 | yes | — | 9 | System-ready |
| Plan | Money `costs` | Life | `screens/Costs.tsx` | Page | registry | 0 | 1 | 7.1 | — | — | 9 | System-ready |
| Plan | Launchpad `launchpad` | Semester | `screens/Launchpad.tsx` | Page | own | 0 | 0 | 0.0 | — | — | 9 | System-ready |
| Plan | Opportunities `opportunities` | Beyond | `screens/Opportunities.tsx` | Page | own | 0 | 0 | 0.0 | — | — | 9 | System-ready |
| Plan | Enrollment `registration` | Semester | `screens/Registration.tsx` | Page | own | 0 | 0 | 0.0 | yes | — | 9 | System-ready |
| Learn | this drill `drill` | Study | `screens/Drill.tsx` | none | — | 2 | 4 | 6.9 | yes | — | 3 | Redesign before new features |
| Learn | this quiz `quiz` | Study | `screens/Drill.tsx` | none | — | 2 | 4 | 6.9 | yes | — | 3 | Redesign before new features |
| Learn | this study guide `guide` | Study | `screens/Guide.tsx` | Page | — | 0 | 5 | 8.6 | — | — | 4 | Redesign before new features |
| Learn | Ask Semester `ask` | Study | `ai/Chat.tsx` | none | — | 0 | 0 | 1.9 | — | yes | 5 | Redesign before new features |
| Learn | these predictions `guess` | — | `screens/Guess.tsx` | Page | — | 0 | 3 | 10.2 | — | — | 5 | Redesign before new features |
| Learn | these slides `slides` | Study | `screens/Slides.tsx` | none | — | 0 | 2 | 6.5 | — | — | 5 | Redesign before new features |
| Learn | Add a course `import` | Courses | `screens/Import.tsx` | Page | registry | 1 | 5 | 4.3 | — | — | 6 | Targeted migration |
| Learn | this course `course` | Courses | `screens/Courses.tsx` | Page | — | 0 | 2 | 7.1 | — | — | 7 | Targeted migration |
| Learn | Create `create` | Make | `screens/Create.tsx` | Page | registry | 0 | 7 | 5.2 | — | — | 7 | Targeted migration |
| Learn | Equations, and the graph `equations` | Make | `screens/Equations.tsx` | Page | own | 0 | 10 | 5.6 | — | — | 7 | Targeted migration |
| Learn | Practice paper `exam` | Study | `screens/Exam.tsx` | Page | registry | 0 | 5 | 7.2 | — | — | 7 | Targeted migration |
| Learn | this deadline `item` | Courses | `screens/Courses.tsx` | Page | — | 0 | 2 | 7.1 | — | — | 7 | Targeted migration |
| Learn | this lesson `lesson` | Study | `screens/Lesson.tsx` | Page | — | 0 | 2 | 3.3 | — | — | 7 | Targeted migration |
| Learn | Study `study` | Study | `screens/Study.tsx` | Page | registry | 0 | 7 | 4.5 | — | — | 7 | Targeted migration |
| Learn | Add a reading `update` | Study | `screens/Update.tsx` | Page | own | 1 | 3 | 4.5 | — | — | 7 | Targeted migration |
| Learn | Work on it `work` | Semester | `screens/Work.tsx` | Page | registry | 0 | 7 | 5.9 | — | — | 7 | Targeted migration |
| Learn | Write a document `write` | Make | `screens/Write.tsx` | Page | own | 0 | 16 | 3.6 | — | — | 7 | Targeted migration |
| Learn | Make a deck `deck` | Make | `screens/Deck.tsx` | Page | registry | 0 | 3 | 5.3 | — | — | 8 | Targeted migration |
| Learn | Edit the course `edit` | Courses | `screens/EditCourse.tsx` | Page | registry | 0 | 2 | 8.7 | — | — | 8 | Targeted migration |
| Learn | Group work `groupwork` | Campus | `screens/Groupwork.tsx` | Page | registry | 0 | 3 | 6.8 | yes | — | 8 | Targeted migration |
| Learn | Check the writing `proof` | Make | `screens/Proof.tsx` | Page | registry | 0 | 0 | 5.7 | — | — | 8 | Targeted migration |
| Learn | Sheet or table `sheet` | Make | `screens/Sheet.tsx` | Page | own | 0 | 8 | 1.8 | yes | — | 8 | Targeted migration |
| Learn | Analyse data `analyse` | Study | `screens/Analyse.tsx` | Page | registry | 0 | 1 | 4.9 | — | — | 9 | System-ready |
| Learn | Timers and alarms `clocks` | Life | `screens/Clocks.tsx` | Page | registry | 0 | 1 | 7.6 | — | — | 9 | System-ready |
| Learn | Courses `courses` | Courses | `screens/Courses.tsx` | Page | registry | 0 | 2 | 7.1 | — | — | 9 | System-ready |
| Learn | Draw it `draw` | Make | `screens/Draw.tsx` | Page | registry | 0 | 2 | 5.3 | — | — | 9 | System-ready |
| Learn | Draft it `essay` | Make | `screens/Essay.tsx` | Page | registry | 0 | 1 | 6.9 | — | — | 9 | System-ready |
| Learn | the gradebook `gradebook` | Courses | `screens/Gradebook.tsx` | Page | own | 0 | 0 | 0.0 | — | — | 9 | System-ready |
| Learn | Where courses meet `meet` | Study | `screens/Meet.tsx` | Page | own | 0 | 1 | 4.9 | yes | — | 9 | System-ready |
| Learn | Work the problem `solve` | Study | `screens/Solve.tsx` | Page | registry | 0 | 1 | 4.7 | — | — | 9 | System-ready |
| Learn | Sources `sources` | Courses | `screens/Sources.tsx` | Page | own | 0 | 1 | 6.5 | yes | — | 9 | System-ready |
| Help | Family `family` | Beyond | `screens/Family.tsx` | Page | registry | 0 | 8 | 7.5 | — | — | 7 | Targeted migration |
| Help | When you are behind `behind` | Semester | `screens/Behind.tsx` | Page | registry | 0 | 0 | 6.1 | — | — | 8 | Targeted migration |
| Help | How this works `help` | Data | `screens/Help.tsx` | Page | own | 0 | 0 | 6.2 | — | — | 8 | Targeted migration |
| Help | People and letters `people` | Life | `screens/People.tsx` | Page | registry | 0 | 3 | 7.7 | — | — | 8 | Targeted migration |
| Help | Support `support` | Life | `screens/Support.tsx` | Page | own | 0 | 0 | 0.0 | — | — | 9 | System-ready |
| Campus | Video call `call` | Campus | `screens/call/Index.tsx` | none | — | 0 | 0 | 0.0 | — | — | 5 | Redesign before new features |
| Campus | Email `mail` | Life | `screens/Mail.tsx` | none | — | 0 | 1 | 0.8 | yes | — | 6 | Targeted migration |
| Campus | NIL deals `nil` | Beyond | `screens/Nil.tsx` | Page | registry | 0 | 6 | 10.1 | — | yes | 6 | Targeted migration |
| Campus | Athletics `athletics` | Beyond | `screens/Athletics.tsx` | Page | registry | 0 | 7 | 6.1 | — | — | 7 | Targeted migration |
| Campus | Getting there `maps` | Campus | `screens/Maps.tsx` | Page | registry | 0 | 5 | 5.5 | — | — | 7 | Targeted migration |
| Campus | University `university` | Campus | `screens/University.tsx` | Page | registry | 0 | 18 | 5.2 | — | — | 7 | Targeted migration |
| Campus | Activities `activities` | Campus | `screens/Activities.tsx` | Page | registry | 0 | 1 | 8.2 | yes | — | 8 | Targeted migration |
| Campus | Classmates `classmates` | Campus | `screens/Classmates.tsx` | Page | registry | 0 | 1 | 3.6 | — | — | 9 | System-ready |
| Campus | Housing `housing` | Campus | `screens/Housing.tsx` | Page | registry | 0 | 1 | 7.3 | — | — | 9 | System-ready |
| Campus | Links `links` | Life | `screens/Links.tsx` | Page | registry | 0 | 2 | 7.1 | — | — | 9 | System-ready |
| Campus | Meal plan `meals` | Campus | `screens/Meals.tsx` | Page | registry | 0 | 1 | 7.6 | — | — | 9 | System-ready |
| Progress | The degree `degree` | Courses | `screens/Degree.tsx` | Page | registry | 0 | 6 | 7.7 | — | yes | 7 | Targeted migration |
| Progress | Reports `brief` | Semester | `screens/Reports.tsx` | Page | registry | 0 | 0 | 2.5 | — | — | 9 | System-ready |
| Progress | the operations console `console` | Semester | `screens/Console.tsx` | Page | own | 0 | 0 | 1.6 | — | — | 9 | System-ready |
| Progress | dining at your school `dining` | Semester | `screens/Dining.tsx` | Page | own | 0 | 3 | 0.4 | yes | yes | 9 | System-ready |
| Progress | Progress `me` | Semester | `screens/Me.tsx` | Page | registry | 0 | 2 | 4.6 | yes | — | 9 | System-ready |
| You | Settings `settings` | Data | `screens/settings/Index.tsx` | none | — | 0 | 0 | 3.6 | — | — | 4 | Redesign before new features |
| You | Your data and how it is running `data` | Data | `screens/Data.tsx` | Page | own | 0 | 0 | 8.1 | — | — | 7 | Targeted migration |
| You | Settings: Alerts `setAlerts` | Semester | `screens/settings/Alerts.tsx` | SettingsPage | own | 0 | 0 | 7.4 | — | — | 7 | Targeted migration |
| You | Settings: Assistant `setAssistant` | Semester | `screens/settings/Assistant.tsx` | SettingsPage | own | 1 | 1 | 4.9 | — | — | 7 | Targeted migration |
| You | Settings: Courses `setCourses` | Semester | `screens/settings/Courses.tsx` | SettingsPage | own | 0 | 0 | 6.6 | — | — | 7 | Targeted migration |
| You | Settings: Look `setLook` | Semester | `screens/settings/Look.tsx` | SettingsPage | own | 0 | 0 | 4.3 | — | — | 7 | Targeted migration |
| You | Connect accounts `connect` | Data | `screens/Connect.tsx` | Page | registry | 0 | 4 | 6.5 | — | — | 8 | Targeted migration |
| You | Privacy and your rights `privacy` | Data | `screens/Privacy.tsx` | Page | registry | 0 | 0 | 6.0 | — | — | 8 | Targeted migration |
| You | Profile `profile` | Life | `screens/Profile.tsx` | Page | registry | 0 | 0 | 4.0 | — | — | 8 | Targeted migration |
| You | Settings: About `setAbout` | Semester | `screens/settings/About.tsx` | SettingsPage | own | 0 | 1 | 6.9 | — | — | 8 | Targeted migration |
| You | Settings: Grading `setGrading` | Semester | `screens/settings/Grading.tsx` | SettingsPage | own | 0 | 0 | 0.0 | — | — | 8 | Targeted migration |
| You | Settings: Nav `setNav` | Semester | `screens/settings/Nav.tsx` | SettingsPage | own | 0 | 0 | 2.3 | — | — | 8 | Targeted migration |
| You | Settings: Workload `setWorkload` | Semester | `screens/settings/Workload.tsx` | SettingsPage | own | 0 | 0 | 0.0 | — | — | 8 | Targeted migration |
| You | Account `account` | Data | `screens/Account.tsx` | Page | registry | 0 | 1 | 7.6 | — | — | 9 | System-ready |
| You | Take it with you `export` | Data | `screens/Export.tsx` | Page | registry | 0 | 2 | 6.1 | — | — | 9 | System-ready |
| Shell | all apps `directory` | — | `screens/Directory.tsx` | none | — | 0 | 0 | 0.0 | — | — | 5 | Redesign before new features |
| Shell | the search home `search` | — | `screens/Search.tsx` | none | — | 0 | 0 | 0.0 | — | — | 5 | Redesign before new features |
