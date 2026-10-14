# Architecture and activation boundaries
Reuse Semester identity, Action Center, search, workspace, canonical education graph and design tokens when integrating. This standalone preview has no authentication or official-record access.

Gateway: TLS/limits -> validated token -> app/environment/installation/grant -> tenant/purpose policy -> object/property policy -> tenant-aware transaction -> audit/outbox -> filtered response. Token scope alone is insufficient. Revocation blocks requests, queued jobs and replay. No student records to AI under the existing project standard.

Grading: immutable submission -> disposable isolated worker -> bounded output -> independently verified evidence -> human review -> authorized grade publication. grader.py is trusted-local-only. Its subprocess time/output limits do not isolate host files, network or descendants. Same-process Python can spoof test outputs. Do not expose it as a web endpoint or run adversarial student code in product CI. Production requires reviewed microVM/container controls, no secrets, no network, resource limits, cleanup and external evidence verification.

Candidate CI validates trusted fixtures and static build only. Learner grading CI remains inactive until an approved isolated execution boundary is supplied. Preview Vercel serves static files only. Root vercel.json, existing /lab routing and course-engine migrations stay unchanged.

Certification: register publisher; verify contacts; declare purpose; register app; inventory data/subprocessors; request minimal permissions; provision synthetic sandbox; test contracts; prove isolation; review credentials/egress; review accessibility; rehearse recovery/offboarding; freeze evidence; independent decision; institution-specific pilot approval; reconcile and activate. Publisher certification never grants institutional authority.

Proposed developer-console APIs remain separate from this preview. It does not implement the previously drafted 67-operation contract. Evidence references must identify exact release, environment, verifier and date. No deployment or institutional authorization is implied by a successful build.
