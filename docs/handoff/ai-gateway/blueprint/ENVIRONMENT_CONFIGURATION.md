# Environment configuration contract

Every deployment supplies a complete immutable environment binding. Values below are parameter names, not credentials or real IDs.

| Parameter | Local | Preview | Staging | Production | Rule |
|---|---|---|---|---|---|
| `SEMESTER_ENV` | `local` | `preview` | `staging` | `production` | Exact allowlist |
| `DEPLOYMENT_PROJECT_ID` | local identifier | preview project | staging project | production project | Must match manifest |
| `SUPABASE_PROJECT_REF` | local service | PR/preview branch | staging project | production project | No accidental production ref |
| `AUTH_ISSUER` | local issuer | preview issuer | staging issuer | production issuer | Exact token issuer |
| `AUTH_AUDIENCE` | local audience | preview audience | staging audience | production audience | Exact token audience |
| `AI_QUEUE_NAMESPACE` | local queue | preview queue | staging queue | production queue | Never shared |
| `AI_STORAGE_NAMESPACE` | local storage | preview storage | staging storage | production storage | Never shared |
| `AI_DATA_MODE` | synthetic | synthetic | synthetic/approved test | authorized | Nonproduction rejects production records |
| `AI_PRODUCTION_DATA_INCLUDED` | false | false | false | false unless explicit approved migration process | Branch include-data is forbidden by default |
| `AI_STUDENT_RECORD_EGRESS` | false | false | false | false | Must be false everywhere |
| `AI_RAW_CONTENT_LOGGING` | false | false | false | false | Metadata only by default |
| `AI_SHARED_PROVIDER_CACHE` | false | false | false | false | Cache is permission/context-bound only |
| `AI_PROVIDER_MODE` | mock | mock | mock/approved test | approved live route | Exact approved mode |
| `AI_LIVE_PROVIDER_APPROVAL` | false | false | explicit review | explicit review | Required for live route |
| `AI_TIMEOUT_MS` | bounded | bounded | bounded | bounded | 1–30,000 in reference |
| `AI_POLICY_VERSION` | fixture | fixture | release candidate | approved version | Included in every decision |
| `AI_EGRESS_ALLOWLIST_ID` | test list | preview list | staging list | reviewed list | Gateway only |
| `AI_AUDIT_SINK_ID` | local test | preview audit | staging audit | production audit | Failure blocks dispatch |

Vercel environments have independently scoped variables; a preview deployment does not affect production, but staged production deployments can use production variables and therefore must not be treated as an isolated test environment. [web:114][web:115]

Supabase branches start without production data or storage objects by default. Include-data branches copy production data and must be treated with production-level controls; this gateway contract disallows them for ordinary AI preview/testing. [web:112]
