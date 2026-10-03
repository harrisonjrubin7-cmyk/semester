# AI Data Use Standard

| Control | Value |
| --- | --- |
| Status | **CONTROLLED DRAFT — TARGET APPROVAL AND ENFORCEMENT EVIDENCE REQUIRED** |
| Owner | Harrison Rubin, Privacy/Security/AI Governance primary; backup `UNASSIGNED` |
| Evidence date | 2026-10-03 at repository revision `8fc5fd56` |
| Applies to | AI inputs, outputs, retrieval sources, embeddings/indexes, usage metadata, evaluations, safety review and support artifacts |

## Default rules

Use the least data necessary for a user-requested, approved purpose. Verify authority before sending another person's or institution's data. Keep tenants and resources separated. Treat model input and output as untrusted. Do not use customer, student or institutional production content to train or fine-tune a general-purpose model by default. A deviation requires a separate written agreement, lawful and institutional authority, explicit approved scope, technical segregation, notice/choice where required, retention limits and a new risk approval.

An AI route must fail closed when purpose, classification, source authority, provider, model, terms, region, retention/training posture or tenant policy is unresolved. Secrets, credentials, unrelated records and unnecessary sensitive data are prohibited from prompts.

## Data decision table

| Data/use | Default | Required control before use |
| --- | --- | --- |
| Public or approved source material | conditional allow | provenance, license/authority, source scope and prompt-injection treatment |
| User-authored ordinary content | conditional allow | clear user action, purpose notice, minimum excerpt and approved destination |
| Education-record or customer-confidential data | block unless specifically approved | institution authority, contract, classification rule, tenant isolation, minimum data, provider and retention approval |
| Credentials, secrets, payment authentication data | prohibit | no AI purpose authorizes submission; redact/block and route securely |
| Health, disability/accommodation, counseling, immigration, discipline, financial-aid or similar highly sensitive data | prohibit by default | exceptional written legal/customer approval and controls; initial high-impact decision uses remain prohibited |
| Prompts and outputs for general model training | prohibit by default | separate opt-in program meeting the conditions above |
| Synthetic or approved evaluation data | preferred | provenance, no real-person leakage, versioning, access and deletion rule |
| Usage/security metadata | conditional allow | purpose limitation, minimum fields, access control, retention and legal-hold rule |

## Provider, retention and deletion

The inventory record must distinguish Semester-controlled, institution-directed and student-directed provider paths. Published provider language is not an executed contract. `store: false` is not proof of zero retention. Before activation, record the provider account owner, product/API, model/version, region, subprocessors, training/secondary use, abuse-monitoring retention, deletion method and change notice.

Prompts, outputs and retrieved content must not be logged merely for convenience. Any retained content or metadata needs a defined purpose, access group, retention period, deletion propagation, legal-hold behavior and customer disclosure. Evaluation samples require the same controls and should use synthetic or expressly approved data.

## Repository and operational evidence

**Code/config evidence.** Classification tests block higher tiers from selected AI paths; tenant-scoped `ai_policy` and `approved_source` records constrain the institutional gateway; `app/server/institution/providers/openai.ts` sets `store: false`; gateway audit code records metadata without prompt/source bodies for that path; retention migrations address selected usage metadata.

**Operational evidence.** [`PROVIDER-TERMS.md`](PROVIDER-TERMS.md) records published terms but states they are unsigned. The [subprocessor register](../SUBPROCESSORS.md) inventories code-observed destinations. No complete target data-flow reconciliation, accepted provider terms, region proof, deletion exercise across every AI path, or named-customer authorization is evidenced.

**Missing test/proof.** Trace each live route from UI to provider; test prompt redaction/classification and cross-tenant denial end to end; verify deployed logs and retention; exercise deletion/hold behavior; obtain provider/configuration and customer approval; confirm notices match actual behavior.

## Claim ceiling

Semester may say it has a draft AI data-use standard, code controls for selected classification, source, tenant and metadata boundaries, and a default prohibition on general-purpose training with production customer/student content.

## Prohibited claims

Do not claim that no data is retained, no provider trains, data never leaves a device or region, every prompt is redacted, all AI data is deleted, or processing is FERPA/GDPR/state-law compliant without current path-specific technical, contractual and legal evidence.

## Related policy

[`AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md`](AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md) contains the broader proposed policy and detailed repository implementation table; where it states a promise, this standard's evidence and approval limits still apply.
