# Semester data retention and deletion standard — controlled draft

- **Status:** `PARTIAL`
- **Owner:** Privacy/Data owner with Operations and system/data owners
- **Evidence date:** 2026-10-03
- **Legal state:** periods and exceptions require qualified review for actual entities, customers, ages, data roles, and jurisdictions

## Standard

Every data set and processing activity must have an approved purpose, active retention rule, deletion/anonymization trigger, backup/archive tail, legal-hold treatment, shared-record behavior, subprocessor propagation, evidence record, and accountable owner. “Until account deletion,” configured sweep intervals, and provider documentation are candidate rules—not universal legal conclusions.

The detailed repository schedule is [`RETENTION.md`](../../RETENTION.md). The public-language source is the [draft retention policy](../legal/DATA-RETENTION-AND-DELETION-POLICY-DRAFT.md); unresolved `[DECIDE]` and `[VERIFY]` entries remain blockers.

## Control map

| Control | Code/config evidence | Operational evidence | Owner | Missing test/proof |
| --- | --- | --- | --- | --- |
| table coverage and configured periods | retention schedule and tripwire tests | target schema/sweep reconciliation incomplete | Privacy/Data | scheduled production-equivalent sweep evidence |
| account deletion | transactional erasure code/database checks | representative target execution absent | Privacy/Engineering | target failure/recovery and receipt test |
| backups and restore | documented provider assumptions and restore plans | verified settings, expiry and deletion replay incomplete | Operations | target restore/delete replay |
| institution/source offboarding | designs and partial checks | whole-tenant/source purge not proven | Data/Operations | customer-scoped offboarding exercise |
| providers | subprocessor schedules | contract, region and deletion evidence incomplete | Privacy/Vendor | propagation/verification record |

## Exceptions and safeguards

Legal holds, audit/security, billing, shared records, disputes, safety, and statutory/contract records require counsel-approved scope and explanation. A failed deletion must fail closed, remain visible, and escalate; it must not silently report success. Release from a hold resumes the approved schedule rather than causing uncontrolled deletion.

## Claim ceiling and activation blockers

Permitted: “Repository schedules and automated tests cover defined database retention and deletion paths.” Prohibited: complete deletion, verified backup expiry, universal retention legality, provider propagation, or whole-tenant offboarding. Blocks: qualified schedule approval, target settings, owners/backups, provider terms, representative exercises, exception/hold process, monitoring, customer acceptance, and evidence retention.
