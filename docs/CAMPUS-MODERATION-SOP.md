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
8. The student may appeal within thirty days of the decision
   (`APPEAL_RULES`): `fileAppeal`, then `decideAppeal` by a different
   professional. There is no deadline for deciding an appeal yet.
9. The case's retention date is set: 90 days after a no-action close, a year
   after enforcement or an appeal. The daily `community-retention` sweep
   deletes it after that date, unless the case is open or under appeal.

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
| Coordinated reporting (see Brigading) | Reports set aside and integrity review. Never a reduction; a high-risk report still holds |
| Three confirmed P2 in 30 days | Recommends a professional restriction review |
| One confirmed P1 | Recommends a temporary restriction and senior review |
| One confirmed P0 | Recommends an immediate hold and urgent review |

The account-level rows are recommendations. `accountReview` never restricts
anyone on its own.

## Detectors

Code: `community_detector_rules` and `private.community_run_detectors` in the
migration, mirrored in `app/src/community/detectors.ts`. `detectors.test.ts`
fails if the two copies differ.

The detectors run on every post and every edit, on the server, so no client can
skip them. Each hit is recorded in `community_signals` with its rule,
confidence, version and route. When a person decides the case, the decision is
recorded against every signal on it. That is how a rule that keeps being
overruled shows up.

| Detector | Rules | Severity | What a hit does |
| --- | --- | --- | --- |
| Private information / doxxing | Someone else's address, room, number or schedule | P0 | Holds the post at confidence ≥ 0.9, and routes it to urgent professional review |
| Threat language | Harm aimed at a person, weapons on campus, wishing death | P1 (a weapon on campus is P0) | Routes to a professional. Never holds |
| Crisis language | Self-harm | P1 | Routes to a professional. The author sees support resources. Never holds or silences |
| Hate / slur risk | Dehumanizing phrases, "go back to your country" | P1 | Routes to a professional |
| Scam / phishing | Shortened links, upfront payment, credential requests | P2–P3 | Queues |
| Academic integrity | Answer keys, "do my exam" | P2 | Queues. The author sees the course policy before posting |
| Impersonation | An unverified post claiming to be an office | P2 | Queues |
| Posting burst | Eight or more posts in ten minutes, anywhere in Community | P2 | Queues |

- **Two or more detectors firing on one post** put its case under monitoring.
- **Rule access:** only reviewers can read the rules, because publishing the
  patterns would publish the way round them.
- **Tuning:** a senior reviewer can switch a rule off or change its
  confidence, and the change is stamped with a hash of who made it. A new
  pattern is a migration.
- **Media safety** has no rule yet, because Community has no image posting
  yet. Uploads already have their metadata stripped (`metadata.ts`).

## Brigading

A report is set aside when either of these holds:

- **New-joiner cluster.** In a community more than a week old, the reporter
  joined in the last day, and at least two other new members reported the
  same post in the last 30 minutes. The age condition is there because in a
  new community everyone is new.
- **Unfounded repeats.** A reviewer has already closed two of this
  reporter's reports on this author with no action in the last 30 days.
  Someone reporting repeated abuse counts normally, however often they
  report.

What happens to a set-aside report:

- It is kept, and reviewers see a brigading signal. The reporter cannot tell
  it was set aside.
- It never counts toward reducing a post's distribution, and it sends the
  case to integrity review.
- It still holds a post for a high-risk category. The hold protects the
  person the post is about, and a reviewer can lift it.

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
