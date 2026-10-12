# Manuals by audience

The master manual governs the system. People use the manual written for their role.

## Students and users
- **Your account:** creating it, signing in and out, recovery and profile.
- **Your data:** what you see, where it comes from (official, synced, entered by you, AI suggestion), how fresh it is and its limits.
- **Your settings:** privacy, consent, family sharing, notifications and quiet hours, data requests.
- **Reporting:** how to report harmful content, suspicious activity, accessibility barriers and wrong information.
- **Staying safe:** a unique password, MFA when offered, device security, phishing warnings.
- **Before anything permanent:** a warning, then a confirmation or undo.

## Institution administrators
- **Responsibilities:** least-privilege role assignment.
- **Setup:** enrollment, configuration, approvals and revocations.
- **Oversight:** audit-log review and escalation.
- **Exports and accounts:** export limits and handling; suspending users, recovering accounts, access expiry.
- **Emergencies:** the break-glass process, which needs a reason, a legal basis and a second person.
- **Reviews:** quarterly permission reviews.
- **Prohibited:** shared accounts, service-role keys in a browser, bulk exports to personal storage, bypassing approvals.

## Semester operators (on-call)
- **Watching:** dashboards and signals (doc 08); triage and escalation (doc 06).
- **Changing production:** deploy, rollback, backup, restore and maintenance (doc 07).
- **Credentials:** secret rotation, revoking integration credentials, responding to a compromised account.
- **Migrations:** run them, then rerun the RLS validation.
- **Communication:** incident templates and who decides.

The in-app versions live at `ui_kits/semester-app`: `#/operations/*` for operators and `#/trust/*` for security and privacy.
