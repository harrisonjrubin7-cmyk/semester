# Handoff index

Generated 6 Oct 2026: 418 files. **New: start at `START-HERE.md` (one prompt), then `BUILD.md` → "Read this first".** Prototype inventory: `prototype/SCREEN-INVENTORY.md`. Streams 19–24 added for academic records, social, Work Studio, trust/FERPA, collaboration reliability and shell/mobile. The live repo wins every conflict; everything here is a reference to port. Build order: `PHASES.md`. Repo mapping: `REPO-CROSSWALK.md`. Super-app blueprint mapping: `EDUCATION-OS-BLUEPRINT.md`. Security: `assurance/00-*`.

## Install order: database (fresh staging only, never production first)
1. `reference-slice/enterprise-v4/complete_enterprise_schema.sql`, then `002_access`, `003_permission_seed`, `004_note_command`
2. `membership_stripe_migration.sql`, then `006_membership_completion`
3. `007_lti_ags`, `008_lti_hardening`, `009_lti_trace_and_copy`, `012_deep_linking`, `019_ags_queue_consolidation`
4. `user/semester_campus_portals.sql` (129 tables), then `user/014` read policies, `user/015` degree and AI, `user/016` retention guard, `user/017` housing and dining commands, then `user/020` marketplace and social, then `user/021` academic operations, then `user/022` notifications, then `user/023` workflow ledger, then `user/024` profiles and announcements, then `user/025` Business OS, then `user/026` double-entry ledger

Run the tests after each step:
- `membership_tests`
- `user/014_*_test`
- `user/016_structural_tests`
- `user/017_command_tests`
- `user/018_remaining_access_tests`
- `user/housing_allocations_isolation_tests`
- `user/tenant_isolation_baseline_tests`

**Don't apply:**
- **Superseded by `user/semester_campus_portals.sql`:** 010, 011 and 013. Port their functions; don't run them.
- **Sandbox only:** `user/housing_dining_reference.sql`.
- **Reviewed definition of a table that already exists:** `user/housing_allocations_migration.sql`.

## Files by folder

### `handoff/` (10)
Entry points: start at BUILD.md, then PHASES.md and REPO-CROSSWALK.md
- BUILD.md
- PHASES.md
- PORTALS-SPEC.md
- README.md
- REPO-CROSSWALK.md
- install.sh
- manifest.json
- preflight.sh
- role-reconcile.sh
- verify.sh

### `handoff/api/` (3)
- README.md
- api_contracts.ts.txt
- endpoints.json

### `handoff/assurance/` (20)
Security assurance manual, standards, registers, PR template
- 00-MASTER-SECURITY-ASSURANCE-MANUAL.md
- 01-SYSTEM-BOUNDARY-AND-DATA-CLASSIFICATION.md
- 02-THREAT-MODEL.md
- 03-ACCESS-CONTROL-AND-RLS-STANDARD.md
- 04-SECURE-DEVELOPMENT-AND-RELEASE-STANDARD.md
- 05-SECURITY-TEST-PLAN.md
- 06-INCIDENT-RESPONSE-RUNBOOK.md
- 07-BACKUP-RESTORE-AND-ROLLBACK-RUNBOOK.md
- 08-LOGGING-MONITORING-AND-EVIDENCE-STANDARD.md
- 09-VULNERABILITY-MANAGEMENT.md
- 10-USER-ADMIN-AND-OPERATOR-MANUALS.md
- PULL_REQUEST_TEMPLATE.md
- RLS-COVERAGE-REGISTER.csv
- SECURITY-DEFINER-REGISTER.csv
- access-register.csv
- control-matrix.csv
- evidence-register.csv
- exception-register.csv
- risk-register.csv
- vulnerability-register.csv

### `handoff/assurance/user/` (17)
Your governing security documents (PDF + .txt)
- 00-MASTER-SECURITY-ASSURANCE-MANUAL.pdf
- 00-MASTER-SECURITY-ASSURANCE-MANUAL.txt
- 03-ACCESS-CONTROL-AND-RLS-STANDARD.pdf
- 03-ACCESS-CONTROL-AND-RLS-STANDARD.txt
- 05-APPLICATION-SECURITY-TESTING-AND-DEBUGGING-RUNBOOK.pdf
- 05-APPLICATION-SECURITY-TESTING-AND-DEBUGGING-RUNBOOK.txt
- APPSEC-10-COMMON-VULNERABILITIES-RUNBOOK.pdf
- APPSEC-10-COMMON-VULNERABILITIES-RUNBOOK.txt
- ASVS-5-REQUIREMENT-MAPPING-GUIDE.pdf
- ASVS-5-REQUIREMENT-MAPPING-GUIDE.txt
- OWASP-ASVS-audit-checklist-10-core.pdf
- OWASP-ASVS-audit-checklist-10-core.txt
- RLS-AC-03-CROSS-TENANT-TEST-WALKTHROUGH.pdf
- RLS-AC-03-CROSS-TENANT-TEST-WALKTHROUGH.txt
- Security-audit-checklist.pdf
- Security-audit-checklist.txt
- control-matrix.csv

### `handoff/claude-code-toolkit/` (8)
- .claude
- .github
- .mcp.json
- CLAUDE.md.design-system-section.md
- EXECUTE.md
- PROMPTS.md
- README.md
- gitignore.addition

### `handoff/claude-code-toolkit/app/` (1)
- package.scripts.json

### `handoff/claude-code-toolkit/app/scripts/` (2)
- design-system-audit.mjs.txt
- design-system-report.mjs.txt

### `handoff/claude-code-toolkit/app/src/lib/` (1)
- designsystem.test.ts.txt

### `handoff/claude-code-toolkit/docs/design-system/` (3)
- FIGMA-MAPPING.md
- README.md
- SEMESTER-DESIGN-SYSTEM-BASELINE.md

### `handoff/control-plane/` (7)
- README.md
- VERSIONS.md
- access.asyncapi.yaml
- access.openapi.yaml
- access.rego
- component.schema.json
- policy-data.json

### `handoff/control-plane/baseline/` (1)
- README.md

### `handoff/control-plane/baseline/db/` (1)
- 001_access_jobs.sql

### `handoff/control-plane/baseline/policies/` (5)
- data.json
- saga.rego
- saga_test.rego
- zta.rego
- zta_test.rego

### `handoff/control-plane/baseline/scripts/` (1)
- verify.sh

### `handoff/control-plane/baseline/worker/` (2)
- durable-access-worker.ts.txt
- saga-worker.ts.txt

### `handoff/control-plane/v2/` (6)
- README.md
- access-request.schema.json
- access-saga.ts.txt
- access.asyncapi.yaml
- access.openapi.yaml
- request-envelope.example.json

### `handoff/control-plane/v3/` (7)
- README.md
- RUNBOOK.md
- access-coordinator.ts.txt
- access.asyncapi.yaml
- access.openapi.yaml
- policy-data.json
- semester_access.rego

### `handoff/control-plane/v4/` (9)
- README.md
- access-runbook.ts.txt
- access-worker.ts.txt
- pe.asyncapi.yaml
- pep.asyncapi.yaml
- policy-data.json
- policy_enforcement.rego
- policy_engine.rego
- policy_test.rego

### `handoff/control-plane/v4/policies/` (2)
- saga.rego
- saga_test.rego

### `handoff/control-plane/v4/scripts/` (1)
- verify-access-policies.sh

### `handoff/design_handoff_permissions_and_queues/` (1)
- README.md

### `handoff/design_handoff_permissions_and_queues/design/components/data/` (1)
- SlaTimer.jsx.txt

### `handoff/design_handoff_permissions_and_queues/design/components/navigation/` (2)
- FilterChips.jsx.txt
- Tabs.jsx.txt

### `handoff/design_handoff_permissions_and_queues/design/components/permissions/` (12)
- DelegationRow.d.ts.txt
- DelegationRow.jsx.txt
- DelegationRow.prompt.md
- PermissionPrompt.d.ts.txt
- PermissionPrompt.jsx.txt
- PermissionPrompt.prompt.md
- PermissionRow.d.ts.txt
- PermissionRow.jsx.txt
- PermissionRow.prompt.md
- SessionRow.d.ts.txt
- SessionRow.jsx.txt
- SessionRow.prompt.md

### `handoff/design_handoff_permissions_and_queues/design/screen-atlas/` (4)
- ScreenAtlas.jsx.txt
- atlas-data.js
- bespoke-2.jsx.txt
- bespoke.jsx.txt

### `handoff/design_handoff_permissions_and_queues/design/templates/` (5)
- CourseStudio.dc.html
- DevicePrivacyMobile.dc.html
- OpsInbox.dc.html
- RegistrarConsole.dc.html
- RoleWorkspace.dc.html

### `handoff/design_handoff_permissions_and_queues/design/tokens/` (1)
- components-2.css

### `handoff/design_handoff_permissions_and_queues/screenshots/` (10)
- atlas-capabilities.jpg
- atlas-registrar-overrides.jpg
- atlas-role-advisor.jpg
- atlas-student-today.jpg
- course-studio.jpg
- device-privacy-mobile.jpg
- ecosystem-map.jpg
- ecosystem-registration.jpg
- ops-inbox.jpg
- registrar-console.jpg

### `handoff/execute/` (20)
- 00-INDEX.md
- 00-setup.md
- 01-platform-core.md
- 02-identity-sso.md
- 03-student-os.md
- 04-staff-academic.md
- 05-institution-integrations.md
- 06-ai-gateway.md
- 07-community-career-family.md
- 08-ops-command-center.md
- 09-trust-security.md
- 10-launch.md
- 11-company-site-grow.md
- 12-one-place.md
- 13-platform-maturity.md
- 14-native-platform.md
- 15-native-finance.md
- 16-native-operations.md
- 17-web-to-app-journey.md
- 18-role-system.md

### `handoff/mainframe/` (2)
- EXECUTION_PROMPT.md
- START.md

### `handoff/ops-console-visibility/` (1)
- PROMPT.md

### `handoff/reference-slice/` (5)
- README.md
- UPLOADED-README.md
- api_contracts.ts.txt
- architecture_dashboard.html.txt
- semester_schema.sql.txt

### `handoff/reference-slice/enterprise-v3/` (4)
- 001_core.sql.txt
- 002_billing.sql.txt
- 003_rls.sql.txt
- README.md

### `handoff/reference-slice/enterprise-v4/` (38)
Reference schema 001–019 (sx schema), LTI, memberships, tests
- 001_schema.sql
- 002_access.sql
- 003_permission_seed.sql
- 004_note_command.sql
- 006_membership_completion.sql
- 007_lti_ags.sql
- 008_lti_hardening.sql
- 009_lti_trace_and_copy.sql
- 010_campus_portals.sql
- 011_ferpa_access_and_ledgers.sql
- 012_deep_linking.sql
- 013_audit_logging.sql
- 019_ags_queue_consolidation.sql
- LTI-ADAPTERS.md
- README.md
- admin_member_viewer_navigation.pdf
- all_table_rls_audit.sql
- backend_rls_membership_notes.pdf
- backend_routes.ts.txt
- billing_state_machines.pdf
- commerce_adapter.ts.txt
- complete_enterprise_schema.sql
- complete_screen_inventory.csv
- enterprise_erd.mmd
- fixture_manifest_runner.psql
- frontend_component_specs.pdf
- housing_dining_erd.mmd
- membership_stripe_audit_notes.pdf
- membership_stripe_migration.sql
- membership_tests.sql
- per_screen_role_navigation.csv
- proposed_membership_catalog.json
- reference_scope_and_runbook.pdf
- rls_reference_tests.sql
- screen_workflow_matrix.csv
- stripe_membership_webhook.ts.txt
- student_workspace_specs.pdf
- table_inventory.csv

### `handoff/reference-slice/enterprise-v4/tests/` (7)
Signature and verifier code and results (.txt = not compiled)
- JWT_signature_test_results.json
- ags.mjs.txt
- canvas-preservation.test.mjs.txt
- canvas-token.mjs.txt
- jwt-signature.test.mjs.txt
- mermaid-export.mjs.txt
- verification.mjs.txt

### `handoff/reference-slice/enterprise-v4/user/` (19)
Your 129-table campus DDL (semester schema) + 014–018 policies, commands and tests
- 014_semester_read_policies.sql
- 014_semester_read_policies_test.sql
- 015_degree_and_ai.sql
- 016_disclosure_retention_guard.sql
- 016_structural_tests.sql
- 017_command_tests.sql
- 017_housing_dining_commands.sql
- 018_remaining_access_tests.sql
- README.md
- Semester_Launch_Sequence.mmd
- Semester_Sortable_Audit_Tracer.html.txt
- course-permission-evaluator.ts.txt
- housing_allocations_isolation_tests.sql
- housing_allocations_migration.sql
- housing_dining_reference.sql
- semester_campus_portals.sql
- semester_ddl_review_notes.docx
- semester_schema_manifest.csv
- tenant_isolation_baseline_tests.sql

### `handoff/reference-slice/enterprise-v4/user/pdfs/` (17)
Your PDFs, filed with .txt extractions
- Canvas-AGS-service-package.pdf
- Canvas-AGS-service-package.txt
- Canvas-AGS-verification-service.pdf
- Canvas-AGS-verification-service.txt
- Housing-allocations-DDL.pdf
- Housing-allocations-DDL.txt
- Interactive-ERD-explore-tables.pdf
- Interactive-ERD-explore-tables.txt
- PostgreSQL-migration-package.pdf
- PostgreSQL-migration-package.txt
- README.md
- Semester-AI-feature-audit.pdf
- Semester-AI-feature-audit.txt
- Semester-AI-outline.pdf
- Semester-AI-outline.txt
- housing_dining_review_notes.pdf
- housing_dining_review_notes.txt

### `handoff/reference-slice/live/` (9)
- 001_persistence.sql.txt
- README.md
- db.ts.txt
- documentService.ts.txt
- module_registry.json
- server.ts.txt
- transition.js.txt
- transition.test.js.txt
- webhooks.ts.txt

### `handoff/reference-slice/v2/` (4)
- SemesterDashboard.tsx.txt
- api_contracts_v2.ts.txt
- enterprise_workflow_simulator.html.txt
- semester_reference_v2.sql.txt

### `handoff/registry/` (2)
- PROMPT.md
- capabilities.json

### `handoff/semester-core/` (11)
- README.md
- access.ts.txt
- aigateway.ts.txt
- approvals.ts.txt
- consequence.ts.txt
- core.test.ts.txt
- freshness.ts.txt
- nextaction.ts.txt
- pilot.ts.txt
- provenance.ts.txt
- scoring.ts.txt

### `handoff/semester-platform/` (6)
- .env.example.txt
- .env.test.txt
- .github
- README.md
- SERVER.md
- middleware.security.ts.txt

### `handoff/semester-platform/app/api/ai/` (1)
- route.ts.txt

### `handoff/semester-platform/app/api/community/reports/` (1)
- route.ts.txt

### `handoff/semester-platform/app/api/market/listings/` (1)
- route.ts.txt

### `handoff/semester-platform/app/api/payments/webhook/` (1)
- route.ts.txt

### `handoff/semester-platform/app/api/signatures/` (1)
- callback.route.ts.txt

### `handoff/semester-platform/lib/` (1)
- validate.ts.txt

### `handoff/semester-platform/lib/ai/` (1)
- redact.ts.txt

### `handoff/semester-platform/lib/auth/` (1)
- return-path.ts.txt

### `handoff/semester-platform/lib/payments/` (3)
- sandbox-adapter.ts.txt
- state.ts.txt
- types.ts.txt

### `handoff/semester-platform/supabase/` (1)
- seed.sql.txt

### `handoff/semester-platform/supabase/migrations/` (24)
- 010_platform_core.sql.txt
- 020_community.sql.txt
- 030_marketplace.sql.txt
- 040_ops.sql.txt
- 050_security_hardening.sql.txt
- 060_command_functions.sql.txt
- 070_ai_gateway.sql.txt
- 080_sources_storage_delegations.sql.txt
- 090_native_finance.sql.txt
- 100_controlled_actions.sql.txt
- 110_onboarding_growth.sql.txt
- 120_handoff_preview_devices.sql.txt
- 130_academic_core.sql.txt
- 140_coursework_comms.sql.txt
- 150_operations.sql.txt
- 160_company.sql.txt
- 170_ownership_learning_docs_workflow_commerce.sql.txt
- 180_document_state_machine.sql.txt
- 190_document_gaps.sql.txt
- 200_institution_domains.sql.txt
- 210_company_ops_domains.sql.txt
- 220_outbound_webhooks.sql.txt
- 230_commands.sql.txt
- 240_housing_family.sql.txt

### `handoff/semester-platform/tests/` (11)
- REQUIRED.md
- ai-redteam.test.ts.txt
- commands.test.ts.txt
- controlled-actions.test.ts.txt
- finance.test.ts.txt
- handoff.test.ts.txt
- helpers.ts.txt
- onboarding.test.ts.txt
- rls.test.ts.txt
- security.test.ts.txt
- validate.test.ts.txt

### `handoff/semester-platform/tests/database/` (2)
- documents.test.sql.txt
- required.test.sql.txt

### `handoff/semester-platform/workers/` (3)
- retention.ts.txt
- webhook-delivery.ts.txt
- webhook-store.supabase.ts.txt

### `handoff/specifications/` (3)
- depect-semester-flow-for-every-role.pdf
- role-system-execution-prompt.pdf
- semester-mainframe.pdf

### `handoff/workflow-router-app/` (9)
- .env.example.txt
- README.md
- install.sh
- middleware.ts.txt
- next.config.ts.txt
- package.json.txt
- postcss.config.mjs.txt
- tsconfig.json.txt
- vitest.config.ts.txt

### `handoff/workflow-router-app/app/` (3)
- globals.css.txt
- layout.tsx.txt
- page.tsx.txt

### `handoff/workflow-router-app/app/api/exports/benchmark/` (1)
- route.ts.txt

### `handoff/workflow-router-app/app/api/exports/recommendation/` (1)
- route.ts.txt

### `handoff/workflow-router-app/app/auth/confirm/` (1)
- route.ts.txt

### `handoff/workflow-router-app/app/auth/sign-in/` (1)
- page.tsx.txt

### `handoff/workflow-router-app/app/auth/sign-out/` (1)
- route.ts.txt

### `handoff/workflow-router-app/app/benchmark/` (2)
- actions.ts.txt
- page.tsx.txt

### `handoff/workflow-router-app/app/benchmark/-suiteId-/` (1)
- page.tsx.txt

### `handoff/workflow-router-app/app/workflow-router/` (2)
- actions.ts.txt
- page.tsx.txt

### `handoff/workflow-router-app/components/auth/` (1)
- auth-button.tsx.txt

### `handoff/workflow-router-app/components/benchmark/` (6)
- benchmark-dashboard.tsx.txt
- benchmark-run-detail.tsx.txt
- grading-form.tsx.txt
- leaderboard.tsx.txt
- run-form.tsx.txt
- workflow-matrix.tsx.txt

### `handoff/workflow-router-app/components/workflow-router/` (6)
- decision-tree.tsx.txt
- feature-matrix.tsx.txt
- platform-matrix.tsx.txt
- prompt-builder.tsx.txt
- recommendation-panel.tsx.txt
- workflow-router.tsx.txt

### `handoff/workflow-router-app/lib/benchmark/` (2)
- benchmark.config.ts.txt
- scoring.ts.txt

### `handoff/workflow-router-app/lib/benchmark/adapters/` (5)
- capability-guard.ts.txt
- chatgpt-canvas.adapter.ts.txt
- claude-artifacts.adapter.ts.txt
- types.ts.txt
- v0.adapter.ts.txt

### `handoff/workflow-router-app/lib/benchmark/probes/` (2)
- persistence.ts.txt
- source-structure.ts.txt

### `handoff/workflow-router-app/lib/exports/` (3)
- csv.ts.txt
- json.ts.txt
- markdown.ts.txt

### `handoff/workflow-router-app/lib/supabase/` (3)
- client.ts.txt
- middleware.ts.txt
- server.ts.txt

### `handoff/workflow-router-app/lib/validation/` (2)
- benchmark.ts.txt
- workflow-router.ts.txt

### `handoff/workflow-router-app/lib/workflow-router/` (2)
- engine.ts.txt
- prompts.ts.txt

### `handoff/workflow-router-app/supabase/` (1)
- seed.sql.txt

### `handoff/workflow-router-app/supabase/migrations/` (2)
- 001_core_workflow_router.sql.txt
- 002_benchmark_grading.sql.txt

### `handoff/workflow-router-app/tests/` (6)
- RLS-TEST-PLAN.md.txt
- exports.test.ts.txt
- persistence.test.ts.txt
- routing.test.ts.txt
- scoring.test.ts.txt
- validation.test.ts.txt

### `handoff/workflow-router-app/types/` (1)
- database.ts.txt
