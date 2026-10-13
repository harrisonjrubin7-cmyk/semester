# Harness status and activation
Generated locally, not committed, not deployed. This is a revised harness pack, not a replacement for the earlier complete API/PDF pack. Week 3 explicitly adds non-dictionary and unknown-field rejection. Revised visible suites are small concept checks, not comprehensive correctness proofs.

Existing workflow-lab is an AI workflow router with human-graded benchmark logic. Do not replace its grading model or root vercel.json. Inspect course-engine and root CI before deciding integration. Standalone vercel.json is for a separate synthetic preview project only.

Run local trusted feedback: python grader.py --lab 3 --submission week3_starter.py --report result.json. Templates intentionally fail until completed. Run expanded Week 3: python test_week3.py. No real records or secrets.

Container runner: provision Docker and a reviewed immutable Python image, set GRADER_IMAGE=repository@sha256:digest, then python docker_grade.py --lab 3 --submission week3_starter.py --report result.json. Image is never invented or auto-selected. Container execution was not tested here.

CI template is deliberately inactive: resolve verified full action SHA pins and approved image digest before renaming/installing. Use a separate synthetic submission repository, read-only token, no secrets, ephemeral hosted workers, no pull_request_target and no privileged workflow_run. Trusted harness and candidate are checked out separately; candidate shell scripts never run on host. Missing labs fail instead of silently skipping. Submission layout is submissions/week_1/starter.py through week_16/starter.py.

Docker is defense in depth, not a complete hostile-code sandbox. Same-process learner Python can spoof worker output; public visible cases are feedback, not trusted official assessment. Adversarial grading needs reviewed microVM isolation, external evidence verification, inaccessible hidden tests and instructor-authorized publication. No self-hosted product worker and no production secrets. Reports include source/test/image identifiers but are not signed institutional grades.

CD: static build only runs trusted build_portal.py. First approve a feature branch, then reviewed commit, then isolated Vercel preview. Separate approval per external write. Resolve preview target and verify browser routes/downloads and accessibility before any promotion. Never deploy learner code into Vercel functions. Production needs institutional/instructor authority, support and rollback.
