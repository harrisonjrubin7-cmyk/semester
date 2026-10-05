# Incident Communication Templates

**Status: `READY_FOR_CONTACT_CONFIGURATION`** — the messages are prepared;
the sender, approver, Vanderbilt recipients and delivery channel are not.

These are factual shells, not promises to fill gaps with guesses. Replace every
bracketed field, remove inapplicable lines, have the named incident owner
approve the message, and preserve the sent copy in the incident record.

## Initial notice

**Subject:** Semester incident `[INCIDENT_ID]` — investigating `[SERVICE OR WORKFLOW]`

Semester detected `[SYMPTOM]` at `[TIME WITH TIME ZONE]` on `[DATE]`.

- Current status: Investigating
- Known affected scope: `[TENANT / COHORT / SERVICE / UNKNOWN]`
- Student impact observed: `[FACTS ONLY]`
- Data exposure: `[NOT INDICATED / SUSPECTED / CONFIRMED / UNKNOWN]`
- Containment taken: `[ACTION OR NONE YET]`
- Workaround: `[INSTRUCTION OR NONE AVAILABLE]`

We will send the next update by `[TIME WITH TIME ZONE]`, even if the status has
not changed. Contact `[NAMED INCIDENT OWNER]` at `[PHONE / EMAIL]` for this
incident.

## Status update

**Subject:** Semester incident `[INCIDENT_ID]` — update `[NUMBER]`

Since the last notice, Semester has `[NEW VERIFIED FACT OR ACTION]`.

- Current status: `[INVESTIGATING / CONTAINED / MONITORING / RESOLVED]`
- Confirmed affected scope: `[SCOPE OR STILL UNKNOWN]`
- Student impact: `[CURRENT VERIFIED IMPACT]`
- Data exposure: `[NOT INDICATED / SUSPECTED / CONFIRMED / UNKNOWN]`
- Action completed: `[ACTION]`
- Action in progress: `[ACTION]`
- Workaround: `[INSTRUCTION OR NONE AVAILABLE]`

The next update will be sent by `[TIME WITH TIME ZONE]`.

## Resolution notice

**Subject:** Semester incident `[INCIDENT_ID]` — resolved

Service was restored at `[TIME WITH TIME ZONE]` on `[DATE]` and has remained
healthy for `[OBSERVATION PERIOD]`.

- Actual affected scope: `[SCOPE]`
- Actual student impact: `[IMPACT]`
- Data exposure: `[FINAL VERIFIED FINDING]`
- Cause: `[CONFIRMED CAUSE OR STATE THAT ANALYSIS CONTINUES]`
- Resolution: `[CHANGE OR ROLLBACK]`
- Verification: `[TESTS, PROBES AND USER-JOURNEY CHECKS]`
- Student action required: `[ACTION OR NONE]`

Semester will provide a written postmortem by `[DATE]` for SEV1/SEV2 incidents,
including the prevention or detection control being added.

## Internal handoff record

Record before changing shifts or owners:

- Incident ID and severity
- Current owner and backup
- Timeline in one time zone
- Affected tenant(s) and workflows
- Facts established; hypotheses clearly separated
- Containment and rollback state
- Credentials or access revoked (never record secret values)
- University contacts notified and when
- Next promised update time
- Links to monitoring, logs, change, rollback and sent messages

## Configuration gate

Before a Vanderbilt pilot, fill and exercise:

| Field | Required value |
| --- | --- |
| Semester incident owner | Named person, phone and monitored email |
| Semester backup owner | Named person, phone and monitored email |
| Vanderbilt operational contact | Named role/person and approved channel |
| Vanderbilt security/privacy contact | Named role/person and approved channel |
| After-hours route | Tested escalation method |
| Tabletop evidence | Date, participants, scenario, gaps and follow-ups |

Do not put student records, access tokens, session cookies or unredacted logs
in email or chat. Use the institution-approved secure transfer path when the
recipient needs evidence containing protected data.
