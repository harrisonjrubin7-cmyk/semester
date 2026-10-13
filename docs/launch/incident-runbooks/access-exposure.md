# Runbook: role configuration exposed a record outside scope (RSK-002)

Trigger: any report that a user saw a record they are not authorized for, or a failed `cross_tenant_deny` / `role_scope_deny` check in production.

1. **Contain.** Revoke the affected session and grant (`access.revoked`). If scope is unclear, disable `registration_readiness_v1` for the tenant.
2. **Preserve evidence.** Export the audit events and policy decisions for the time window. Do not edit or delete them.
3. **Assess scope.** List every record and student the exposure could have reached. Use the policy decision log, not memory.
4. **Notify** per the process agreed with the institution (`institution.student_staff_communications_approved`). Do not notify ad hoc.
5. **Fix the cause** and add a failing test to the role-scope suite before re-enabling.

Owner: security_owner. Do not close the incident until the test exists and passes.
