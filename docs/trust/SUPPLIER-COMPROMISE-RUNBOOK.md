# Supplier-Compromise Runbook

Status: designed, not exercised or activated. This document defines a response path; it is not evidence that Semester has completed a tabletop, validated named responders, contacted a supplier or institution, or operated this process in production.

## Scope and triggers

Use this runbook when credible information suggests that a dependency, package registry, source or binary artifact, GitHub Action, build image, signing service, hosted integration, or other software supplier may have been compromised and may reach Semester systems or tenant data. Triggers include a supplier disclosure, a trusted advisory, an unexpected checksum or signature, unexplained publishing activity, malicious behavior in a build, or an internal finding with comparable evidence.

The incident lead records the source, time received, affected supplier or component, confidence, known indicators, suspected exposure window, and the repository, service, environment, or tenant paths that might be reachable. An unverified report starts triage; it does not by itself prove compromise.

## Immediate containment

The incident lead appoints security, engineering, operations, communications, and legal/privacy seats from the approved response roster. Until those seats and their authority have been validated, the team treats them as required roles rather than named responders.

Containment begins with the narrowest reversible action that reduces exposure: pause the affected workflow, block the suspect version or digest, disable the relevant integration or feature through an existing kill switch, and prevent new deployments from consuming the suspect input. Preserve service for unaffected tenants when isolation is demonstrated.

Production mutation requires explicit approval from the authorized incident lead and the environment owner. Record the approver, action, time, target, reason, and rollback path. Emergency urgency does not authorize unrecorded changes, destructive evidence cleanup, or broad tenant access.

## Evidence preservation

Before remediation changes the scene, preserve the exact artifact or package, version, lockfile, workflow run, commit SHA, and SBOM, plus available checksums, signatures, provenance, registry metadata, build logs, deployment records, audit logs, alerts, and relevant configuration. Store evidence in an access-controlled incident location and record who collected it, when, from where, and by what method.

Do not execute a suspect artifact merely to inspect it. Prefer hashes, immutable copies, provider exports, and isolated analysis. Never place credentials, tenant data, exploit material, or sensitive logs in a public issue, pull request, chat, or generated evidence document.

## Blast-radius and tenant assessment

Build a fact table that connects the supplier and affected versions to repositories, workflows, generated artifacts, services, environments, data classes, credentials, and tenants. Separate confirmed reachability, plausible reachability, and ruled-out reachability. Record the evidence and timestamp for every conclusion.

For each potentially affected tenant, identify the exposure window, relevant product surface, data or action the component could access, audit evidence available, and contractual or regulatory notification path. Absence of an observed indicator is not proof of absence. Tenant impact remains unknown until the required logs and dependency paths have been assessed.

## Dependencies, Actions, and build images

Pin or quarantine the suspect package, Action, image, or digest. Compare it with the last trusted artifact and verify checksums, signatures, provenance, transitive dependencies, install scripts, permissions, and workflow token scope. Search every maintained lockfile and build definition, including tooling and deployment repositories.

The response must not silently upgrade a dependency or substitute a moving tag as remediation. A replacement requires an explicit version or digest, reviewed change, updated lockfile and SBOM, clean rebuild, security checks, and a recorded reason. If no trusted replacement exists, keep the affected path disabled or use a reviewed fallback.

## Credentials and trust material

Identify credentials, tokens, signing keys, certificates, deployment identities, package-publishing rights, and secrets that the supplier or affected workflow could read or exercise. Revoke or rotate only through approved providers and record old identity, new identity, scope, owner, time, and dependent services.

Assume a secret remains exposed until rotation and dependent-service validation are complete. Do not paste secret values into the incident record. Re-establish trust from a known-clean administrative path, and invalidate artifacts or signatures produced during the suspected exposure window when the evidence warrants it.

## Customer and institution communications

Communications use the incident-communications approval path and distinguish facts, hypotheses, unknowns, containment actions, customer actions, and the time of the next update. Security owns technical accuracy; legal/privacy determines contractual and regulatory duties; the authorized communications owner approves external language.

Notify affected institutions when impact or a contractual trigger is established, or when the authorized legal/privacy decision records that uncertainty itself requires notice. Do not wait for perfect attribution if a notification deadline applies. Do not identify a supplier, tenant, attacker, or data category without evidence and approval. Record recipients, channel, approver, time, and the exact message sent.

## Recovery and re-entry

Re-entry requires a known-clean source, reproducible build, reviewed dependency and workflow changes, rotated exposed trust material, security and functional checks, a rollback path, and approval from the incident lead plus the environment owner. Restore incrementally, starting with the smallest non-production or isolated scope that can test the recovery hypothesis.

Monitor the recovered path for the defined observation period and retain the incident evidence. Reopening a workflow or integration is not incident closure. Closure also requires tenant-impact decisions, required notifications, corrective actions with owners and dates, and a retrospective that records remaining uncertainty.

## Tabletop exercise

The first exercise should simulate a compromised third-party GitHub Action that read a workflow token and produced an untrusted build artifact. Participants must trace repository and tenant reachability, preserve evidence, choose containment, decide whether and when to rotate credentials, draft an institution update, and apply the re-entry gate.

The facilitator records participants and response seats, scenario injects, decisions, timestamps, missing access or contacts, notification interpretations, stop conditions invoked, and corrective actions. A completed exercise produces a dated artifact under `docs/evidence/` linked from the strategic expansion register. Until that artifact exists and is independently reviewed, the tabletop remains unexecuted.

## Stop conditions and prohibitions

Stop and escalate when the response lacks an authorized incident lead, the target or tenant scope is ambiguous, evidence preservation cannot be maintained, a production change has no rollback path, a required approver is unavailable, or the action could expand access to tenant data.

The team must not claim the system is safe while reachability, credential exposure, tenant impact, or rebuild provenance remains unverified. It must not destroy or rewrite evidence, disclose secrets or tenant data, attribute the event without evidence, bypass required approvals, accept a known-vulnerable replacement without a recorded exception, or treat a clean scan alone as proof of recovery.
