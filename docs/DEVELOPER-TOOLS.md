# Developer-tool curation

Semester does not install the GitHub `developer-tools` topic wholesale. The
topic is an open label spanning tens of thousands of unrelated repositories;
membership is not a security review, compatibility guarantee or licence grant.
Tools enter this repository only when they close a measured gap.

## Adopted

| Tool | Semester use | Installation boundary | Security decision |
| --- | --- | --- | --- |
| [actionlint](https://github.com/rhysd/actionlint) | Statically checks every GitHub Actions workflow, expression and embedded shell block | Temporary CI/local binary; never shipped | Version and release SHA-256 are pinned in `scripts/developer-tools.sh` |
| [OSV-Scanner](https://github.com/google/osv-scanner) | Scans every supported lockfile, including the non-runtime `pipeline/` and `video/` trees omitted by the app-only npm audit | Temporary CI/local binary; never shipped | Version and release SHA-256 are pinned; findings fail CI |

Run both from the repository root:

```sh
./scripts/developer-tools.sh
```

The script supports the GitHub-hosted Linux runner and the project's current
Apple-silicon development environment. It downloads over HTTPS into a uniquely
named directory under `/tmp`, verifies each binary before execution and removes
the directory on exit.

## Evaluated but not installed

| Tool or category | Decision |
| --- | --- |
| Puppeteer | Duplicates the existing Playwright browser automation and would add another browser/runtime tree. |
| Hoppscotch and Bruno | API clients are useful once Semester publishes a stable OpenAPI contract; installing both now would not create that contract. |
| LocalStack | Semester's deployed application uses Supabase and Vercel, not an AWS application stack. |
| Streamlit | A second Python web application framework does not fit the React/Vite product architecture. |
| OpenHands, Agno, Daytona and agent harnesses | Developer-agent platforms do not belong in the student-facing runtime or its CI trust boundary. |
| Graphify and codebase-memory MCP servers | Optional workstation indexing tools; they would copy or index repository content outside the application boundary and require a separate data-handling decision. |
| Archify | Mermaid is already a reviewed runtime dependency and covers Semester's in-product diagrams. |
| Yazi and Files | Personal desktop file managers, not repository or product dependencies. |
| Skill and “awesome” collections | Catalogues are discovery sources rather than auditable application dependencies. Each underlying tool must be reviewed individually. |

Revisit a deferred tool only when a concrete product or engineering requirement
exists, and repeat the ownership, licence, provenance, permissions, maintenance,
transitive-dependency and data-flow review before installation.
