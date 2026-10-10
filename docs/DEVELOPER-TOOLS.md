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
implied to be permanent. On 2026-10-09, a refreshed review of the first four
topic pages displayed 80 repository cards covering 80 unique repositories.
The ranking changed during the same day: 21 repositories not present in the
earlier three-page snapshot were reviewed and added below. Every repository in
the refreshed four-page snapshot is accounted for. ShellCheck closed the
standalone-script lint gap; the other repositories did not supply a new
Semester product or CI requirement.

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
| [Repomix](https://github.com/yamadashy/repomix) and [GitDiagram](https://github.com/ahmedkhaleel2004/gitdiagram) | Both produce derived representations of a codebase for AI-assisted analysis. Semester already has repository-native inventories and diagrams; introducing either would require a separate review of generated-content retention, exclusions, access and any external processing. |
| [Qwen Code](https://github.com/QwenLM/qwen-code), [Archon](https://github.com/coleam00/Archon), [SWE-agent](https://github.com/SWE-agent/SWE-agent) and [Paseo](https://github.com/getpaseo/paseo) | Coding-agent and orchestration platforms overlap the existing reviewed development environment and would expand its execution, credential or data-sharing boundary without a repository requirement. |
| [claude-skills](https://github.com/alirezarezvani/claude-skills), [khazix-skills](https://github.com/KKKKhazix/khazix-skills) and [Vibe Coding CN](https://github.com/tradecatlabs/vibe-coding-cn) | Skill catalogues and tutorial collections are discovery material, not auditable application dependencies. Any underlying workflow must be reviewed individually before use. |
| [D2](https://github.com/d2lang/d2) | A second diagram language would duplicate the repository's existing Mermaid-based diagrams and add another binary/rendering toolchain without a missing diagram requirement. |
| [Responsively](https://github.com/responsively-org/responsively-app) and [Eruda](https://github.com/liriliri/eruda) | Responsive and mobile debugging are already exercised through the reviewed browser-development and Playwright paths. A separate browser or an embedded production console would not improve the current release evidence. |
| [marimo](https://github.com/marimo-team/marimo), [Taipy](https://github.com/Avaiga/taipy) and [iii](https://github.com/iii-hq/iii) | Notebook, Python application and service-composition frameworks would introduce parallel runtime and deployment architectures rather than strengthen Semester's React/Vite, Supabase and Vercel stack. |
| [Wave Terminal](https://github.com/wavetermdev/waveterm) and [nnn](https://github.com/jarun/nnn) | Terminal and file-manager applications are personal workstation choices, not repository, CI or student-facing dependencies. |
| [daily.dev](https://github.com/dailydotdev/daily) | A developer news feed is an optional personal information source and has no deterministic build, test or product role. |
| [Hack](https://github.com/source-foundry/Hack) | A source-code typeface is a workstation preference. Semester's product typography is governed by its design system, so the font does not close a repository or product gap. |
| [OpenCodex](https://github.com/lidge-jun/opencodex), [Plandex](https://github.com/plandex-ai/plandex) and [Superset](https://github.com/superset-sh/superset) | Agent, model-proxy and orchestration tools overlap Semester's reviewed development environment. They would expand its model credential, execution or repository-data boundary without a measured application or CI requirement. |
| [Harper](https://github.com/Automattic/harper) | An offline grammar checker could be useful as an optional editor tool, but Semester has no measured prose-lint gate or approved vocabulary and false-positive policy. Installing it repository-wide now would create configuration and maintenance work without a defined release requirement. |
| [Public API Lists](https://github.com/public-api-lists/public-api-lists) and [FreeDomains](https://github.com/stackryze/FreeDomains) | Discovery lists of public APIs and free services are not authoritative integration, procurement, availability or data-processing evidence. Semester integrations must remain requirement-led and independently reviewed. |
| [DVC](https://github.com/treeverse/dvc) and [FiftyOne](https://github.com/voxel51/fiftyone) | ML dataset, model and computer-vision workflows do not match Semester's current React/Vite, Supabase and Vercel product architecture or its CI inputs. |
| [Skaffold](https://github.com/GoogleContainerTools/skaffold), [Kaniko](https://github.com/GoogleContainerTools/kaniko) and [DevPod](https://github.com/loft-sh/devpod) | Kubernetes build/deploy and containerized development-environment tooling does not serve the current Vercel/Supabase deployment path. Kaniko was also archived when evaluated. |
| [Semantica](https://github.com/semantica-agi/semantica) | A separate knowledge-graph AI platform would duplicate repository-native registries and provenance controls while adding another service, model and data-retention boundary. |
| [Corsair](https://github.com/corsairdev/corsair) | A managed OAuth and integration platform would handle credentials and user data. It should be considered only for a named provider requirement with security, privacy, tenancy and lifecycle review. |
| [CCStatusLine](https://github.com/sirmalloc/ccstatusline) and [Codeburn](https://github.com/getagentseal/codeburn) | Agent status and local usage-log tools are personal workstation utilities. Reading local agent state or logs does not provide a deterministic product, build or release gate. |
| [Zeal](https://github.com/zealdocs/zeal) | Like DevDocs, an offline documentation browser is a workstation choice, not an application or CI dependency. Official documentation remains authoritative. |
| [Posting](https://github.com/darrenburns/posting) | Like HTTPie, Bruno and Hoppscotch, an API client becomes useful after Semester has a stable published API contract; installing another client does not create or validate that contract. |
| [ILLA Builder](https://github.com/illacloud/illa-builder) | Another low-code application and internal-tool stack would create a parallel frontend and deployment architecture instead of strengthening Semester's governed product. |
| [Pyroscope](https://github.com/grafana/pyroscope) | Continuous runtime profiling should follow an observed production performance gap and a telemetry, access and retention review. The current repository has no requirement that justifies adding its collection and storage boundary. |
| [Fireworks Tech Graph](https://github.com/yizhiyanhua-ai/fireworks-tech-graph) | AI-generated architecture diagrams duplicate the repository's Mermaid workflow and would add external model processing plus generated-artifact provenance concerns without a missing diagram requirement. |
| [Rea](https://github.com/morluto/rea) | An agent for reverse-engineering applications and native binaries has no legitimate Semester product or CI role and would expand the execution, security and legal-review boundary. |

Revisit a deferred tool only when a concrete product or engineering requirement
exists, and repeat the ownership, licence, provenance, permissions, maintenance,
transitive-dependency and data-flow review before installation.
