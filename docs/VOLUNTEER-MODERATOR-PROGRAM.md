# Volunteer moderator program

Code: `app/src/community/volunteer.ts`, plus `mayDecide` and `blindView` in
`moderation.ts`. Flag: `VITE_VOLUNTEER_MODERATION` (high-risk, off, production
refused).

| Rule | Value |
| --- | --- |
| Eligibility | Verified, 30-day account age, no active restriction, training, confidentiality agreement, recusal acknowledged |
| Calibration | 20 onboarding tasks, pass at ≥ 85% (17 of 20) |
| Quality | Last 20 control tasks, 5 points each |
| Status | Active ≥ 85, probation 75–80, paused < 75, revocable |
| Caps | 20 reviews an hour, 100 a day |
| Queues | P3, and clear P2 (spam, other) on the standard route |
| Never | P0/P1, hate, doxxing, minors, sexual content, stalking, contextual harassment, appeals, escalation |
| Removal | Two independent volunteers who agree. Disagreement goes to a professional |
| Blind view | Category, severity and status only. No name, email, ID, reporter, GPS, social graph or other votes |
| Recusal | Own reports, communities they lead, block relationships |

Jodel uses karma as one eligibility signal. Semester has no karma, so it does
not.
