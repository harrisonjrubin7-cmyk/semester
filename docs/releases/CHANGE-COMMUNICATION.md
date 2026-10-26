# Change communication

> **Type:** reference · **Audience:** contributors, institution-admins · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/releases.test.ts`

Who is told about which kind of change, by what route, before or after, and who
approves the words. Use it to decide what a pull request owes the people it
affects beyond the changelog.

**Status:** the classes, audiences and approvers come from rules already in the
repository. The **lead times are proposed starting points**, written here because
no contract, order form or policy in the repository sets one
([`TENANT-CONTRACT.md`](../TENANT-CONTRACT.md), `contracts/`,
[`PILOT.md`](../../PILOT.md) checked). Nothing here has been promised to a
customer, and nothing here should be repeated to one as a commitment until it is
in a signed document that counsel has reviewed.

## Classes of change

The classes follow the **Change advisory** section of
[`.github/pull_request_template.md`](../../.github/pull_request_template.md) —
policy, permission, retention rule, data flow, AI behaviour, migration — and the
tiers in [`CONFIGURATION-TIERS.md`](../operating-model/CONFIGURATION-TIERS.md).

| Class | It is… | Example |
| --- | --- | --- |
| `invisible` | A change no person can notice | A refactor; a comment; a test |
| `visible` | A change a person can see, with no effect on data, permissions, policy or an interface | A screen is rearranged; a label changes |
| `behaviour` | A change to what happens to a person's data or what they may do: policy, permission, retention, data flow, AI behaviour, a migration | A new thing is shared by default; a retention period changes; the AI is given a new source |
| `breaking` | A change that makes something that works today stop working for a caller or an administrator | A gateway route is removed; an event version changes; a setting is retired |
| `activation` | A capability is switched on for an institution that did not have it | A module is enabled for a school |
| `security` | A fix whose description would help an attacker | A vulnerability fixed before disclosure |
| `incident` | The service is degraded or an incident is declared | An outage; a data issue |

## Who is told, how, and when

Lead times are **proposed starting points** — see the status above. "At merge" means
the day the change reaches the live page.

| Class | Who is told | Route | Lead time | Words approved by | Record kept |
| --- | --- | --- | --- | --- | --- |
| `invisible` | No one | — | — | — | The commit |
| `visible` | Testers; students and staff of schools with the module on | `CHANGELOG.md`; the *What changed* screen | At merge | `product` | The changelog entry; the `NOTES` entry |
| `behaviour` | The above, **and** administrators at schools it affects, before their users see it | Both of the above; an [institution change notice](../documentation/templates/institution-change-notice.md) | Before it reaches a live school; 14 days proposed | `product` with `privacy` (and `security`, `accessibility` where the tier lists them — see [`config-tiers.ts`](../../app/src/lib/governance/config-tiers.ts)) | The notice; the change-impact assessment the [change-management page](../operating-model/CHANGE-MANAGEMENT.md) requires |
| `breaking` | Developers and administrators who use the interface | A [deprecation notice](../documentation/templates/deprecation-notice.md) to each known user; a **Status** line on the reference page | Before removal; the proposal in [`07-ENGINEERING-STANDARDS.md`](../target-architecture/07-ENGINEERING-STANDARDS.md) is 90 days for first-party callers and 12 months for external ones — proposed there, not enforced | `engineering`, with `success` for administrators | The notice; the reference page's history |
| `activation` | The institution's administrators and its champion | An institution change notice, then the activation runbook | Agreed in the implementation plan | `success`, with the institution | [`ACTIVATION-CONTROL-PLANE.md`](../ACTIVATION-CONTROL-PLANE.md) records the activation; the notice is kept with the plan |
| `security` | Affected institutions, after the fix is live; the public per [`SECURITY.md`](../../SECURITY.md) | A security notice by the disclosure rules in `SECURITY.md` | After the fix, never before | `security`, with `privacy` where personal data was involved | The advisory; the decision record |
| `incident` | By audience | [`INCIDENT-COMMUNICATIONS.md`](../operating-model/INCIDENT-COMMUNICATIONS.md); the [status page](../../app/public/status.html) | Within the audience's update cadence, which that page sets | The approvers that page lists per audience | `governance_incident_notices`; the status feed |

## Rules for the words

1. **Say what changed for the reader, in the reader's words.** A student reads
   what they will see. An administrator reads what their students and staff will
   see, what data or permission changes, and what they can turn off.
2. **Say what got worse or was taken away.** A feature that vanishes without a
   word teaches people to distrust the rest of the page
   ([`CHANGELOG.md`](../../CHANGELOG.md)'s own rule).
3. **Say what the reader must do, even if it is nothing.**
4. **No claim outruns its evidence.** A notice that says a change "improves
   privacy" or "makes the AI safer" is a claim and follows the
   [claims register](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md); say what the change
   does instead.
5. **Name the support route and its status honestly.** If the support seat is the
   founder, acting, a notice does not promise response times.
6. **Accessible by construction.** Plain headings, no information only in an image
   or a colour, link text that reads out of context
   ([style guide](../documentation/STYLE-GUIDE.md#accessibility-of-the-page-itself)).

## What is not built

- **Role-filtered release notes to institution administrators.** Designed, not
  built; a person sends the notice.
- **Delivery tracking.** Nothing records that an administrator read a notice. The
  record kept is that it was sent, and to whom.
- **A subscription for partner developers.** There is no changelog feed or mailing
  list for the gateway. A deprecation notice is sent to each known user by hand,
  which works while the user list is a handful of schools and does not scale.
