# Data lifecycle and deletion

## Required lifecycle

Every field used in a pilot must have an approved source, purpose, classification, owner, access role, retention period, export behavior, deletion behavior, backup exception, audit expectation, and offboarding disposition. Data not necessary for the approved outcome is not collected.

## User and institutional rights workflow

1. Authenticate and verify the requester without collecting excessive new data.
2. Identify applicable local, cloud, institutional, vendor, audit, and backup records.
3. Route legal hold or institutional-record questions to the authorized owner.
4. Produce a portable export through an approved secure channel.
5. Delete or de-identify eligible data and revoke access/integrations.
6. Record completion evidence without retaining the deleted content.
7. Explain residual backup/legal/audit exceptions and their expiration.

## Launch gate

The repository contains lifecycle machinery and documentation, but a paid pilot remains **RED** until export, deletion, revocation, retention, backups, support access, and clean offboarding are exercised in the target environment. Sources: [data inventory and lineage](../DATA-INVENTORY-AND-LINEAGE.md), [retention/export/deletion](../DATA-RETENTION-EXPORT-DELETION.md), [data-rights runbook](../DATA-RIGHTS-REQUEST-RUNBOOK.md), and [offboarding playbook](PILOT-OFFBOARDING-PLAYBOOK.md).
