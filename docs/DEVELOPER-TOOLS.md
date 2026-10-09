# Developer-tool curation

Semester does not install the GitHub `developer-tools` topic wholesale. The
topic is an open label spanning tens of thousands of unrelated repositories;
membership is not a security review, compatibility guarantee or licence grant.
Tools enter this repository only when they close a measured gap.

## Adopted

| Tool | Semester use | Installation boundary | Security decision |
| --- | --- | --- | --- |
| [actionlint](https://github.com/rhysd/actionlint) | Statically checks every GitHub Actions workflow, expression and embedded shell block | Temporary CI/local binary; never shipped | Version and release SHA-256 are pinned in `scripts/developer-tools.sh` |
| [ShellCheck](https://github.com/koalaman/shellcheck) | Checks every tracked standalone `.sh` file at warning severity or higher | Temporary CI/local binary; never shipped | Version and release SHA-256 are pinned; sourced fragments declare their shell and inherited variables explicitly |
| [OSV-Scanner](https://github.com/google/osv-scanner) | Scans every supported lockfile, including the non-runtime `pipeline/` and `video/` trees omitted by the app-only npm audit | Temporary CI/local binary; never shipped | Version and release SHA-256 are pinned; findings fail CI |

Run all three from the repository root:

```sh
./scripts/developer-tools.sh
```

The script supports the GitHub-hosted Linux runner and the project's current
Apple-silicon development environment. It downloads over HTTPS into a uniquely
named directory under `/tmp`, verifies each binary before execution and removes
the directory on exit.

## Topic-page snapshot

The public [developer-tools topic](https://github.com/topics/developer-tools)
is volatile, so coverage is recorded against a dated snapshot rather than
implied to be permanent. On 2026-10-08, the first two topic pages displayed 40
repositories. Every displayed repository is accounted for below. ShellCheck
closed the standalone-script lint gap; the other page-two repositories did not
supply a new Semester product or CI requirement.

## Evaluated but not installed

| Tool or category | Decision |
| --- | --- |
| [ECC](https://github.com/affaan-m/ECC) and [Ponytail](https://github.com/DietrichGebert/ponytail) | Agent instruction and hook bundles overlap Semester's existing reviewed skills and repository instructions. Installing them would change developer-agent behavior without closing a measured product or CI gap. |
| [Graphify](https://github.com/Graphify-Labs/graphify) and [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) | Optional workstation indexers would create persistent derived copies of repository content and require a separate data-handling, retention and access review. |
| [Puppeteer](https://github.com/puppeteer/puppeteer) | Duplicates the existing Playwright browser automation and would add another browser/runtime tree. |
| [OpenHands](https://github.com/OpenHands/OpenHands) and [Daytona](https://github.com/daytonaio/daytona) | Agent execution platforms do not belong in the student-facing runtime or its CI trust boundary. Daytona was also archived when evaluated. |
| [RTK](https://github.com/rtk-ai/rtk) | Its purpose is to filter and truncate shell output. That conflicts with Semester's evidence-first CI and release audits; it may be benchmarked as an optional personal tool, but must not mediate repository verification. |
| [Hoppscotch](https://github.com/hoppscotch/hoppscotch) and [Bruno](https://github.com/usebruno/bruno) | API clients are useful once Semester publishes a stable OpenAPI contract; installing both now would not create that contract. |
| [Archify](https://github.com/tt-a1i/archify) | Mermaid is already a reviewed runtime dependency and covers Semester's in-product diagrams. |
| [awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills), [agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills) and [GitHubDaily](https://github.com/GitHubDaily/GitHubDaily) | Discovery catalogues are not auditable application dependencies. Each underlying tool must be reviewed individually. |
| [LocalStack](https://github.com/localstack/localstack) | Semester's deployed application uses Supabase and Vercel, not an AWS application stack. The repository was archived when evaluated. |
| [i-have-adhd](https://github.com/ayghri/i-have-adhd) | A response-formatting skill is a user-level accessibility preference, not a repository, runtime or CI dependency. |
| [Streamlit](https://github.com/streamlit/streamlit) | A second Python web application framework does not fit the React/Vite product architecture. |
| [Files](https://github.com/files-community/Files) and [Yazi](https://github.com/sxyazi/yazi) | Personal desktop file managers, not repository or product dependencies. |
| [Herdr](https://github.com/herdrdev/herdr) | A local terminal and agent-session manager duplicates the worktree and task orchestration already supplied by the development environment; it has no application or CI role. |
| [Agno](https://github.com/agno-agi/agno), [Codewhale](https://github.com/codewhale-hq/Codewhale), [Continue](https://github.com/continuedev/continue), [Tabby](https://github.com/TabbyML/tabby), [GPT Pilot](https://github.com/Pythagora-io/gpt-pilot) and [Composio](https://github.com/ComposioHQ/composio) | Agent, coding-assistant and integration platforms overlap the existing development environment and would expand its execution or data-sharing boundary without an application requirement. |
| [Appsmith](https://github.com/appsmithorg/appsmith), [Refine](https://github.com/refinedev/refine) and [Reflex](https://github.com/reflex-dev/reflex) | Alternative application frameworks would create parallel frontend or Python application stacks instead of strengthening Semester's React/Vite architecture. |
| [IT Tools](https://github.com/CorentinTh/it-tools) and [DevToys](https://github.com/DevToys-app/DevToys) | General developer utility collections are personal workstation tools, not repository or product dependencies. |
| [DevDocs](https://github.com/freeCodeCamp/devdocs) | An offline API-documentation browser does not belong in the application or CI dependency graph. Official sources remain the authority for engineering decisions. |
| [Lapce](https://github.com/lapce/lapce) and [Void](https://github.com/voideditor/void) | Alternative code editors are user workstation choices, not Semester dependencies. |
| [HTTPie](https://github.com/httpie/cli) | Like Hoppscotch and Bruno, it becomes useful when a stable, published API contract exists; installing another client does not create that contract. |
| [AI Website Cloner](https://github.com/JCodesMore/ai-website-cloner-template) | A site-cloning template has no legitimate product, CI or design-system role in Semester. |
| [DeepSeek Reasonix](https://github.com/esengine/DeepSeek-Reasonix) | A model-reasoning research project is not a deterministic repository tool or application dependency. |
| [SurrealDB](https://github.com/surrealdb/surrealdb) | A second database would conflict with the governed Supabase/PostgreSQL architecture and its tested policies. |
| [Lighthouse](https://github.com/GoogleChrome/lighthouse) | Semester already enforces performance budgets, accessibility journeys and cold-route browser checks with its reviewed Playwright stack. Revisit only if a Lighthouse-specific metric becomes a release requirement. |

Revisit a deferred tool only when a concrete product or engineering requirement
exists, and repeat the ownership, licence, provenance, permissions, maintenance,
transitive-dependency and data-flow review before installation.
