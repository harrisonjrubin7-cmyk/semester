# Volunteer moderator program

Code: `app/src/community/volunteer.ts`, plus `mayDecide` and `blindView` in
`moderation.ts`. Enforced by the `community_volunteers`,
`community_calibration_items`, `community_volunteer_tasks`,
`community_volunteer_votes` and `community_volunteer_events` tables and their
functions in `20260928032000_community.sql`. `programs.test.ts` holds the two
copies of every number to each other.

**Two switches, both off.** The build flag `VITE_VOLUNTEER_MODERATION` is
high-risk, off by default, and refuses `production`. The school's
`community_programs` row (`volunteer_moderation`) is off unless present, and
only the service role can write it. Every volunteer function checks it.

**Blind tasks.** A volunteer only ever holds an opaque task id, and sees the
category, severity, community type and text. Control items with known answers
look exactly like real cases, so a volunteer cannot tell which answers are
being scored. Training is recorded by a senior reviewer. The confidentiality
agreement and the recusal rules are signed by the volunteer. Paused and
revoked are sticky until a senior reviewer acts, and every status change is
an event carrying hashes.

**Managing it.** Senior reviewers use the Volunteers screen, opened from the
moderation console. It lists each volunteer's training, agreements,
calibration progress and quality. Each of the three actions takes a reason:
record training, send back to calibration, or revoke. Sending back is a fresh
start: it clears the volunteer's queue, including any real cases handed out,
and counts only answers from the new calibration (`calibration_started_at`).
Revoking clears the queue too. The screen also manages each school's practice
cases. It warns when there are fewer than 20 onboarding items, because nobody
can finish calibrating until there are.

| Rule | Value |
| --- | --- |
| Eligibility | Verified, 30-day account age, no active restriction, training, confidentiality agreement, recusal acknowledged |
| Calibration | 20 onboarding tasks, pass at ≥ 85% (17 of 20) |
| Quality | Last 20 control tasks, 5 points each |
| Status | Active ≥ 85, probation 75–80, paused < 75, revocable |
| Caps | 20 reviews an hour, 100 a day |
| Queues | P3, and clear P2 (spam, other) on the standard route. Never a support community |
| Never | P0/P1, hate, doxxing, minors, sexual content, stalking, contextual harassment, appeals, escalation |
| Removal | Two independent volunteers who agree. Disagreement goes to a professional |
| Blind view | Category, severity and status only. No name, email, ID, reporter, GPS, social graph or other votes |
| Recusal | Own reports, communities they lead, block relationships |

Jodel uses karma as one eligibility signal. Semester has no karma, so it does
not.
