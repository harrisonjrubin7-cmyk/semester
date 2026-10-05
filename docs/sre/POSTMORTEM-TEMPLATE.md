# Postmortem: <short, factual title>

Blameless. Written within five business days of resolution for any P0 or P1, or any incident that burned more than 10% of a journey's monthly error budget. A postmortem that names a person as the cause has stopped one step early: ask what made the mistake easy.

| | |
| --- | --- |
| Incident | id, severity, start, detected, mitigated, resolved (UTC) |
| Commander / scribe | names, or "one person" if that was true |
| Components | catalog ids |
| Journeys and budget | which journeys, minutes of impact, share of monthly budget burned (or "unmeasured") |
| Customer-visible | yes / no, and which communication went out |

## What happened

A timeline from the *measured* record (logs, run history, the status entry), not from memory. Mark every time that is a recollection.

## Impact

Who could not do what, for how long. Say what was **not** affected, and whether any data was lost, exposed or duplicated, with how that was established.

## Detection

How we found out. Who found out first: an alert, a probe, a student? How long between start and detection, and what would have made it shorter. If a human was the detector, that is a finding about the alert register.

## Response

What worked, what did not, and where the runbook was wrong, missing or followed. Link the runbook id; fix it in the same pull request as the action items.

## Contributing factors

Several, not one. Include the quiet ones: no backup responder, an alert in state `defined`, an unverified limit, a change made inside a freeze.

## What went well

Short, specific, and worth repeating.

## Action items

| Action | Owner (role) | Due | Evidence it is done | Type |
| --- | --- | --- | --- | --- |
| | | | | prevent / detect / mitigate / process |

Every item has an owner and a way to show it is done. Items go into the technical-debt register; an item without an owner is a wish.

## Register changes

List the edits made to `app/src/lib/sre/` as a result (alert state, runbook, experiment, catalog row, scorecard cell). If none, say why not.

## Claims check

Nothing in this document or in any customer communication states an achieved availability, response time or recovery time that the record above does not support.
