# Semester Developers

Internal app for Semester's own team, for running the developer platform that lets apps read a narrow set of synthetic data.

- **Platform:** app reviewers (founder-granted role) review third-party apps for exactly the scopes they request. They can also suspend or reinstate apps, revoke any install token, and read the append-only audit log.
- **Build:** engineers create test apps in an isolated sandbox tenant, mint short-lived test tokens and send requests to see every allow/deny result. There's also a short API reference.

No education records, grades, enrollment writes or payments are reachable through app tokens.
