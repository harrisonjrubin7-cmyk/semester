# Executable connected workflow lab
Run from the package root: python -m lab.server
Open http://127.0.0.1:8765 in a local browser. Binds loopback only. Run tests: python -m unittest discover -s tests -v
No third-party runtime dependencies. SQLite database is created locally. Demo bearer tokens are intentionally public synthetic credentials, not production identity; never reuse for real data. Delete the synthetic database to reset.

1. Student: onboarding.complete, then submission.create.
2. Faculty: grade.draft; grade.request_release; copy approval ID.
3. Reviewer: grade.approve_release with that ID. Student sees no draft grade.
4. Operator: process outbox. Student receives released synthetic score in projection.
5. Registrar: hold.request_clear using current student version; reviewer approves.
6. Student remains unknown if prerequisite is missing. Registrar source.confirm_prerequisite with latest version makes the synthetic checklist ready_as_of; never enrolled.

Existing official systems are not called. No official transcript/final-grade posting, AI provider, funds movement, institution SSO or live tenant provisioning exists in this lab. Map tested invariants into canonical TypeScript/Postgres systems; do not add this SQLite model as a second production authority.
