# Software engineering with Semester - 16-week syllabus

## Status and prerequisites
Proposed course, subject to instructor and institutional approval. Basic programming, Git and introductory web concepts required. Suggested workload: two instructor-led sessions and 4-6 independent hours weekly; adjust for learner needs. Python 3 runs the small concept drills without third-party packages. The application capstone follows Semester's documented TypeScript direction; learners may use an instructor-approved equivalent typed stack. The Python drills do not replace full-stack labs.

## Outcomes
Design contracts; distinguish authentication from authorization; isolate tenants; build accessible workflows; preserve audit and provenance; implement retry-safe operations; operate event delivery; produce a typed SDK; threat-model integrations; reconcile pilots; defend engineering decisions.

## Capstone
Build a synthetic Semester planning extension with tenant-scoped tasks, shared-shell UI, typed API client, duplicate-safe events, redacted diagnostics, revocation and certification evidence. No real student data, production credentials or official-record mutations.

## Weekly rhythm
Before class: read architecture guide and lab. First session: concepts and guided drill. Second session: capstone implementation and review. End of week: code, visible test evidence, three added boundary tests, design note and 150-250 word reflection. Instructor sets actual dates, late/resubmission rules and office hours. Each starter intentionally raises NotImplementedError.

## Assessment
Weekly labs 40%; midterm architecture review 15%; capstone 35%; peer review/reflection 10%. Weekly rubric: correctness 30, tests 25, security/privacy 20, maintainability 15, documentation/reflection 10. Automated grading computes up to 30 correctness points from visible cases; remaining 70 require instructor review. No automatic final grade.

Capstone rubric: functionality 20, authorization/isolation 20, reliability/reconciliation 15, contracts/SDK 15, accessibility 10, evidence/docs 10, defense 10. Midterm rubric: boundary clarity 30, contract quality 25, threat model 25, evidence/communication 20. Peer review: actionable findings 40, justified suggestions 30, respectful collaboration 20, timeliness 10.

Performance levels: exemplary 90-100 (reproducible and justified), proficient 75-89 (complete with minor gaps), developing 60-74 (partial or weak evidence), insufficient below 60 (core requirements missing). These bands are proposed and must match institutional grading policy. Security defects block deployment regardless of academic grade. Remediation is recorded and instructor-approved.

## Academic integrity and AI
Cite reused code and permitted assistance; explain understanding in reflection/defense. Never send private records or credentials to AI. Instructor defines permitted assistance for each assessment. No plagiarism allegation or final grade is issued automatically. Provide accessible alternatives and an appeal route through instructor/institution policy.

## Tools and support
Local Python concept runner; Git; instructor-selected TypeScript toolchain and synthetic backing store for capstone. No external service account required for concept drills. Portal is a local HTML prototype with browser-local progress; it has no authentication, shared roster or official grading backend.

## Safety
grader.py executes trusted local code only and is not a sandbox. Never run untrusted submissions on a personal or institutional host. Production runners need isolation specified in architecture-guides.md.
