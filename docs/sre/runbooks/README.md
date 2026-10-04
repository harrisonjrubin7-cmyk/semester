# Runbooks

Sixteen runbooks, one per way the system is expected to hurt. Every alert in the [alert register](../generated/ALERTS.md) and every row in the [service catalog](../generated/SERVICE-CATALOG.md) names one by id. `app/src/lib/sre/sre.test.ts` fails if:

- an index entry has no file, or a file has no index entry;
- a runbook is missing any of the seven sections, or has them out of order;
- a runbook names a repository path that does not exist;
- a runbook is not reached from any alert or catalog row.

A runbook is for a person who is tired and was not there when it was written. Write for them: the safest reversible step first, exact names, and an honest line when nobody exists to escalate to. Start a new one from [TEMPLATE.md](TEMPLATE.md) and add it to `app/src/lib/sre/runbooks.ts`.

No runbook here has been exercised by anyone other than its author, and no alert has delivered to a human. The [experiments register](../generated/EXPERIMENTS.md) is how that changes.
