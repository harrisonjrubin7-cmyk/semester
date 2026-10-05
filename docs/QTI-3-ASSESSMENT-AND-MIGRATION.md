# QTI 3: assessment content and migration

<!-- Rendered from app/src/lib/assessment/qti.ts by qti.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

QTI 3 as the content model for accessible, reusable, versioned assessment
objects: the design principles, the interaction library with an accessible
equivalent for every pattern, the authoring flow, the item analytics and what
they must never become, the AI item-generation workflow with its provenance
and controls, and the legacy item-bank migration programme — from four
documents of 28 September 2026, held to what the tree already has for a
question. The [LMS and learning roadmap](LMS-LEARNING-ROADMAP.md) already
records question banks and QTI import as missing; this page says what
“present” would have to mean.

**QTI 3 does not generate AI questions by itself. It is an interoperability specification for representing and exchanging assessment items, tests, interactions, scoring, results, accessibility features and metadata. AI can draft an item; QTI 3 can encode the reviewed, approved item so it can move between authoring, delivery and reporting systems.**

| Supplied document | What it holds |
| --- | --- |
| [EdTech stack audit (QTI 3 interactive assessment design)](expansion/EdTech-Stack-Audit-LTI-AI-Grading-and-API-Extensibility.pdf) | The design principles, the interactive question library with accessible equivalents, the authoring flow and the item analytics. |
| [Canvas vs Blackboard vs Moodle vs D2L (QTI 3 and AI item generation)](expansion/LMS-Sortable-Matrix-and-AI-Grading-Comparison.pdf) | The correct AI item-generation workflow, the required AI item metadata and the ten item-generation controls. |
| [Gradescope vs Copyleaks vs Turnitin (QTI 3 legacy item-bank migration checklist)](expansion/Gradescope-Copyleaks-Turnitin-and-QTI-3-Migration.pdf) | The five-phase migration checklist, and its inventory, crosswalk, validation, accessibility and round-trip items. |
| [Sortable LMS API comparison (QTI 3 migration steps and tools)](expansion/LMS-API-Comparison-Rate-Limits-Scopes-and-LTI-Endpoints.pdf) | The ten migration phases with their outputs and exit gates, the toolchain and the acceptance thresholds. |

## Design principles

One assessment object is item content + response rules + scoring logic + metadata + accessibility alternatives + outcome mapping + version history.

- Do not bury accessibility in a separate accommodation afterthought.
- Do not create interactions that work only by drag, hover, colour, mouse or a single sensory mode.
- Do not make a question portable only in appearance: test import, delivery, response processing, scoring and the accessible alternatives.

## The interaction library, against what the app delivers

Five question kinds exist across the practice paper and the quiz; 5 of 16 patterns have a renderer, and the test holds every named kind to the types `app/src/lib/exam.ts` and `app/src/state/shape.ts` export. Every non-text interaction must have an accessible equivalent; where the app has the interaction at all, it already does.

| Pattern | Learning purpose | Accessible equivalent | Delivered as | Note |
| --- | --- | --- | --- | --- |
| Multiple choice | Recognize the one correct concept among plausible distractors | Keyboard-operable radio group with clear feedback | `choice` | Four options, an index answer and a `why`; the quiz kind of the same name draws from cards. |
| Multiple response | Distinguish several correct concepts | Keyboard-operable checkbox group with clear feedback | — | Every choice question has exactly one right option. |
| True or false | Test a claim against the material | Two keyboard-operable options; the claim read in full | `truefalse` | The quiz kind; the `claim` the statement proposes may not be the right one. |
| Matching | Connect concepts, definitions or examples | Select-based pairing alternative; no drag-only requirement | `match` | Already tap-to-join: a term to a definition in two taps, never a drag. |
| Ordering | Sequence a process, logic or chronology | Number or select order interface with keyboard controls | — | No ordering question. Orderings elsewhere in the app (Reorder) have arrow controls, which is the rule this pattern would follow. |
| Fill in the blank | Recall a term or value in context | A labelled text input per blank, with the sentence read whole | — | No cloze question. |
| Short answer | Explain reasoning briefly | Accessible editor, word guidance, autosave | `short` | Self-marked against a model answer; never auto-scored. |
| Essay | Synthesize evidence at length | Rubric, word limit, format guidance, accessible editor and autosave | `long` | Self-marked against a model answer; the practice paper is kept on the device for seven days. |
| Numeric or formula response | Practice quantitative reasoning | Accessible math input, unit checks, visible notation guidance | — | No numeric response, tolerance or unit check. |
| Hotspot or image label | Identify visual features | Textual description, labelled list, or selectable-region alternative | — | No hotspot interaction exists, so nothing is drag- or mouse-only. |
| Graph or data interpretation | Read data and make an evidence-based conclusion | Data table, text summary, labelled axes, accessible formula and values | — | No data-interpretation item. |
| Simulation or case | Apply decisions to a realistic context | Keyboard-operable scenario controls and a text equivalent | — | No scenario item. |
| Audio or video response | Demonstrate oral communication or analysis | Captions and transcript; an alternative response format where policy permits | — | Recording and transcription exist for notes, not for a response. |
| Coding exercise | Apply programming concepts | Sandboxed editor, keyboard workflow, deterministic tests, accessible output logs | — | No sandbox; the documents put this in the high-risk phase. |
| Peer review | Practice evaluative judgment | Structured rubric; anonymity and accessibility controls | — | No peer-review item. |
| Portfolio | Demonstrate longitudinal work | Artifact alternatives, ownership and consent, a rubric and reviewer workflow | — | The career evidence workspace holds artifacts; nothing assesses a portfolio. |

### What the tree already does

| Rule | Evidence | Shows |
| --- | --- | --- |
| Practice is always labelled practice, never an official assessment. | `app/src/lib/studystudio.ts` | STUDY_FORMATS: a paper is practice, never an official assessment |
| A written answer is self-marked, never auto-scored. | `app/src/lib/exam.test.ts` | short and long answers are marked by the student against a model answer |
| Matching has no drag-only requirement. | `app/src/screens/quizkinds.test.tsx` | joins a term to a definition in two taps |
| An ordering has a keyboard alternative. | `app/src/a11y/dragging.test.ts` | WCAG 2.5.7: every ordering has arrow controls |
| The clock is the wall clock and never takes anything away. | `app/src/lib/examattempt.test.ts` | time is up: nothing has been taken away |
| A paper is kept on the device and can be resumed. | `app/src/lib/examattempt.test.ts` | autosave, the seed, the clock and a receipt |
| Item analytics never become a student-risk label. | `app/src/lib/institution-ops.ts` | FORBIDDEN: individual student risk scores, attention inference |
| Generated questions cite the material. | `app/src/lib/studystudio.ts` | STUDY_SYSTEM: exact quotes per section; do not invent page numbers |

### What it does not, yet

- No question bank, item versioning, tags, pools or instructor authoring (LMS-008).
- No QTI import or export, and no Common Cartridge (INT-007, INT-008).
- No item analytics: difficulty, discrimination, distractor performance, time-to-complete or skip rate (LMS-017).
- No accommodation applied to timing or format (LMS-009), and no enforced timing at all: the paper is a practice paper.
- No per-item provenance for an AI-drawn question.

## The authoring flow

1. A learning outcome is selected.
2. An assessment blueprint is created.
3. The item type is selected.
4. The author writes the prompt and the response and scoring rules.
5. The author adds the accessibility alternative and the media description.
6. The author assigns metadata: topic, difficulty, outcome, cognitive level, source, rights, language, review date.
7. The author previews the student, keyboard and screen-reader modes.
8. A reviewer validates the content, the scoring and the accessibility.
9. The item version is approved and added to the item bank.
10. Assessment delivery uses the approved version.
11. Item analytics inform future revision.

## Item analytics

Use analytics to improve questions, never to profile students.

- Difficulty
- Discrimination
- Distractor performance
- Time-to-complete distribution
- Technical error rate
- Accessibility issue reports
- Question skip and abandon rate
- Rubric consistency
- Outcome alignment
- Version comparison

**Suppress small groups, and do not use item interaction behaviour to create individual student-risk labels. Item analytics drive review, not automatic deletion or student profiling.**

## AI item generation

QTI 3 encodes the reviewed, approved item; it does not draft one. The
workflow, in order:

1. The instructor selects the learning outcome, source material, cognitive level, item type, difficulty target, accessibility requirements and policy.
2. AI drafts one or more candidate items.
3. The system attaches provenance: model and version, prompt template, source set, date, editor.
4. The instructor reviews factual correctness, alignment, bias, ambiguity, intellectual-property risk and accessibility.
5. The reviewer modifies or approves the item.
6. The system creates a versioned QTI 3 item.
7. The accessibility alternative and the scoring logic are validated.
8. The item enters the approved bank.
9. The assessment uses the approved version.
10. Results and item analytics inform later human review.

### The metadata every AI-assisted item carries, against `Question`

2 of 15 fields have a property on the practice paper’s question; the test reads the type and holds each named property to one that exists. The largest gap is provenance: no item records the model, the prompt template, the source set or an editor.

| Field | Property | Note |
| --- | --- | --- |
| Item id and version | `id` | An id, no version; a re-sat paper is reproduced from its seed, not from a versioned item. |
| Learning outcome or competency | — | No outcome authoring or mapping (LMS-015). |
| Course and tenant scope | — | `from` names a unit or topic; nothing names a course or a tenant. |
| Author and reviewer | — | Items are drawn by the model for one student; nobody authors or reviews them. |
| AI-assisted status | — | Every model-drawn paper is AI-assisted; nothing marks it per item. |
| Model, provider and version | — | Recorded per call in the gateway’s intelligence audit, never on the item. |
| Prompt-template version | — | Prompts are not versioned (AM-19). |
| Source references and rights status | `from` | The unit or topic it came from, when known; no page anchor and no rights status. |
| Creation and approval time | — | The attempt records when it started; the item records nothing. |
| Accessibility review status | — | None. |
| Scoring rule and rubric version | — | `points` is only the maximum mark; no property encodes the response-processing rule (index match for a choice, self-marking for a written answer) or a rubric version. |
| Difficulty and cognitive-level tags | — | None. |
| Known limitations | — | The paper carries the practice label; the item carries nothing. |
| Approval expiry and review date | — | None. |
| Usage history | — | One attempt slot at a time; no per-item exposure record. |

### Controls

- [ ] AI cannot directly publish an item to a live assessment.
- [ ] Item generation is limited to authorized source material and rights-cleared inputs.
- [ ] Every AI-generated item has provenance and human approval.
- [ ] Each interactive question has a keyboard-operable accessible equivalent.
- [ ] Scoring and response processing are independently previewed and tested.
- [ ] Generated distractors are reviewed for plausibility, ambiguity, stereotype or bias, unintended clues and alignment to the learning outcome.
- [ ] Items are versioned; previously delivered items remain reproducible.
- [ ] Item analytics drive review, not automatic deletion or student profiling.
- [ ] Item banks are tenant- and course-scoped; no cross-institution content leakage.
- [ ] Assessment exposure and reuse controls protect item security.

## Migration: a controlled content-conversion programme

A valid XML package that changes scoring, accessibility, media or item intent
is not a successful migration. Preserve the originals, build a semantic
crosswalk, validate scoring and accessibility in the destination, and retain
evidence for every exception.

| Phase | Activities | Deliverables | Exit gate |
| --- | --- | --- | --- |
| 0. Govern | Define scope, owners, source and destination systems, rights, security and acceptance criteria | Migration charter, RACI, data-handling plan | Stakeholders approve what “equivalent” means |
| 1. Preserve | Export all originals, attachments, metadata, media, rubrics, score fixtures and usage history | Immutable originals, checksums, source inventory | Originals verified and access restricted |
| 2. Inventory | Classify items by source format, interaction type, scoring complexity, accessibility, rights and risk | Item inventory and migration ids | Every object is categorized |
| 3. Crosswalk | Map source semantics to QTI 3 constructs; define unsupported-feature treatment | Versioned mapping specification | Scoring and accessibility mapping approved |
| 4. Pilot convert | Convert representative low-, medium- and high-complexity item samples | Pilot packages, conversion diagnostics | Pilot behaviour is accepted |
| 5. Bulk convert | Convert at scale with logs, an exception queue and a repeatable pipeline | QTI 3 packages and an exception register | No unreviewed errors |
| 6. Validate | Schema, package, scoring, rendering, asset, accessibility, security and metadata tests | Automated test report | Required pass rate met |
| 7. Destination test | Import into the real destination sandbox, deliver sample attempts, score, export results | Destination acceptance report | Behaviour matches approved fixtures |
| 8. Round trip | Export from the destination, validate again, compare original, migrated and re-exported state | Round-trip evidence | Portability demonstrated |
| 9. Release | Approve banks, assign review dates, archive evidence, enable use | Release record and support runbook | Content owner signs off |

Every proprietary construct gets exactly one disposition: map exactly / transform with review / supported extension / manual rebuild / omit with warning / block migration.

### Source inventory

- [ ] Identify the source format: QTI 1.2, QTI 2.1/2.2, proprietary XML or JSON, CSV, Word or PDF, SCORM package, LMS export or database extract.
- [ ] Assign a stable migration id to every bank, test, section, item, asset, rubric, outcome and external reference.
- [ ] Capture author, owner, rights and licence, review date, course and tenant scope, lifecycle state, language and use history.
- [ ] Identify shared stimuli, item dependencies, reusable feedback, question pools, randomization, branching, timing and attempts.
- [ ] Record current expected-score fixtures for representative student responses.
- [ ] Hash and package all source assets and preserve immutable originals.

### Semantic and scoring crosswalk

- [ ] Map identifiers and avoid collisions.
- [ ] Map response declarations, outcome declarations, response processing, template processing, feedback and scoring logic.
- [ ] Map partial credit, penalty scoring, negative marking, tolerance, units, rounding, randomized variables and adaptive branching.
- [ ] Map test parts, sections, ordering, selection, item pools, presentation rules, timing, attempt policies and delivery constraints.
- [ ] Map metadata: outcomes, topic, difficulty, cognitive level, language, author, rights, provenance, review date and accessibility status.
- [ ] Document every proprietary construct with one disposition.

### Accessibility conversion

- [ ] Preserve or add alt text, captions, transcripts and media descriptions.
- [ ] Verify language metadata and plain instructions.
- [ ] Ensure keyboard completion of every interaction.
- [ ] Provide equivalent alternatives for drag-and-drop, hotspot, graph, simulation, audio, video and colour-dependent questions.
- [ ] Validate accessible math input and rendering.
- [ ] Test screen-reader labels, focus order, state-change announcements, zoom and reflow, contrast and mobile rendering.
- [ ] Test timing, attempts and available accommodation configurations.
- [ ] Route inaccessible items to a manual-remediation queue.

### Validation

- [ ] Validate the QTI package manifest and the XML/schema structure.
- [ ] Validate the destination-supported QTI 3 profile.
- [ ] Import into a non-production destination bank.
- [ ] Test response capture, response processing, feedback, scoring, partial credit, randomization, timing, attempts and branching.
- [ ] Compare expected against actual outcomes using golden response fixtures.
- [ ] Test all media and assets; validate rights, rendering, fallback and inaccessible or expired external links.
- [ ] Test item metadata, outcome mapping, rubrics and grade and result reporting.
- [ ] Test student, instructor and administrator views.
- [ ] Test keyboard, screen reader, zoom and reflow, mobile and accommodation paths.
- [ ] Export the item from the destination and independently revalidate the package.
- [ ] Record the exact version of source, transformer, validator, destination and test fixture used.

### The toolchain

A toolchain, never a single black-box importer.

| Tool | Purpose | Semester implementation |
| --- | --- | --- |
| Source extractor | Pull item banks, assets and metadata from the source LMS | Versioned connector; read-only export; source checksums |
| Canonical inventory store | Maintain migration ids, metadata, mappings and exceptions | Tenant-scoped migration database with audit events |
| QTI transformer | Convert the source format to a QTI 3 package and manifest | Versioned transformation service; deterministic builds |
| QTI validator | Check schema, package and semantic-profile compliance | Automated validation in CI and the migration pipeline |
| Scoring test runner | Execute fixture responses and compare outcomes | Golden-response test suite |
| Rendering test harness | Render items in the target delivery environment | Screenshot, DOM and accessibility snapshot tests |
| Accessibility test suite | Keyboard, screen reader, contrast, text alternatives | Automated scans plus trained human testing |
| Asset processor | Package and rewrite media, equations, URLs and fonts | Rights, malware, broken-link and hash validation |
| Exception console | Assign, document, approve and close nonconforming items | Owner, severity, remediation, decision log |
| Acceptance dashboard | Report conversion health and sign-off status | Counts, defects, pass rate, unresolved blockers |

### Acceptance thresholds

Set before conversion begins; every one is all or nothing.

| Of | Must |
| --- | --- |
| high-stakes items | 100% have human content and accessibility sign-off |
| scoring fixtures | 100% pass for released items |
| external assets | 100% are packaged, resolved, or intentionally removed |
| critical accessibility barriers | 0 unresolved |
| critical scoring deviations | 0 unresolved |
| exceptions | 100% have an owner and a disposition |
| released items | 100% have provenance and version metadata |
| final packages | 100% import into the target production-equivalent sandbox |
