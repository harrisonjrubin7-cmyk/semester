# Campus moderation SOP

Code: `app/src/community/moderation.ts`.

## Workflow

A case moves through these steps:

1. A report or automated signal arrives.
2. `openCase` writes a frozen audit event.
3. `triage` sets a provisional severity.
4. The minimum reversible protection is applied.
5. The case goes to a qualified human queue.
6. The reviewer calls `decide` with a policy reason code.
7. The student gets a notice.
8. The student may appeal: `fileAppeal`, then `decideAppeal` by a different
   professional.
9. The case's retention date is set.

## Categories and provisional severity

| Category | Default | Raised by |
| --- | --- | --- |
| private_information_or_doxxing | P0 | — |
| nonconsensual_media | P0 | — |
| threat_or_safety_concern | P1 | imminent → P0 |
| hate_or_discrimination | P1 | — |
| harassment_or_bullying | P2 | stalking, severe or sexual → P1 |
| impersonation | P2 | serious → P1 |
| spam_scam_or_phishing | P2 | credible scam → P1 |
| academic_integrity | P2 | — |
| other | P3 | self-harm concern → P1. Imminent or involves a minor → P0 |

## Triage thresholds (`TRIAGE_THRESHOLDS`)

| Condition | Protection |
| --- | --- |
| One needs-review signal | Queue |
| Two distinct signals in 30 minutes | Queue and monitor |
| One high-risk report (doxxing, threat, NCII, hate) | Temporary hold, professional route |
| Three distinct reporters in 60 minutes | Reduced distribution pending review |
| PII detector confidence ≥ 0.9 | Temporary hold, P0 |
| Coordinated-reporting cluster | Reports set aside, integrity review, no protection on the target |
| Three confirmed P2 in 30 days | Recommends a professional restriction review |
| One confirmed P1 | Recommends a temporary restriction and senior review |
| One confirmed P0 | Recommends an immediate hold and urgent review |

The account-level rows are recommendations. `accountReview` never restricts
anyone on its own.

## Who decides

- **Automation** only calls `protect`, which can apply reduce distribution,
  rate limit or preserve evidence. It never removes content, restricts an
  account or escalates.
- **Volunteers** see only P3, plus P2 spam or "other", on the standard route.
  A removal needs two independent volunteers who agree. If volunteers
  disagree, the case goes to a professional.
- **Professionals** decide everything else. A P0 account restriction needs a
  senior professional. Only professionals escalate.
- **Appeals** are decided by a professional who took no part in the
  original decision.

## Actions

The actions are:

- allow
- label
- reduce distribution
- remove
- lock thread
- limit replies
- rate limit
- community restriction
- account restriction
- preserve evidence
- escalate
- close with no action

Every decision carries a reason code.

## What the student is told

`studentNotice` gives a plain sentence and the appeal route. It never shows a
number or score, and never names the reporter.

## Community guidelines (student-facing)

> Semester Communities are for learning, connection, and opportunity. Be
> respectful. Protect privacy. Share useful, source-aware information. Follow
> course, organization, and campus rules.
>
> Do not harass, threaten, discriminate, stalk, target, dox, impersonate, post
> scams/spam/phishing/malware, share prohibited assessment answers, or post
> sexual, violent, hateful, exploitative, or nonconsensual material.
>
> Semester Community is not an emergency-response service. Use Block, Mute,
> Report, and Leave whenever you need them.

**Supplement for career, research, alumni and mentor spaces:**

- Be accurate about your identity and your opportunities.
- Never pressure students for contact, financial, immigration, health or
  academic details.
- Use structured requests, and honour a "no".
- Do not use Semester data to build external contact lists.
