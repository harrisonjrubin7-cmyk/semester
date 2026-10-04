<!-- Generated from app/src/lib/sre by sre.test.ts. Edit the register, then run `npm run registers`. -->

# Capacity demand by scenario (generated)

Every figure derives from the **assumptions** in `app/src/lib/sre/capacity.ts` using Little's law. None is a measurement. The ceilings below are unverified, so this page cannot say any scenario fits.

## Invitation beta (30 accounts)

| Scenario | Concurrent accounts | Requests/s | In flight | DB connections | AI calls/min | Notifications |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Registration opens | 14 | 4.2 | 4 | 1 | 2.8 | 30 in 600 s (0.05/s) |
| Deadline night | 9 | 1.5 | 2 | 1 | 5.4 | 30 in 900 s (0.03/s) |
| Grades are released | 17 | 2.27 | 2 | 1 | 1.7 | 60 in 300 s (0.2/s) |
| Billing run and due date | 4 | 0.4 | 1 | 1 | 0 | 30 in 3600 s (0.01/s) |
| AI study surge | 6 | 0.3 | 2 | 1 | 12 | 0 in 600 s (0/s) |
| Campus emergency | 18 | 3.6 | 2 | 1 | 0 | 30 in 60 s (0.5/s) |

## Design partner cohort (500 accounts)

| Scenario | Concurrent accounts | Requests/s | In flight | DB connections | AI calls/min | Notifications |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Registration opens | 225 | 67.5 | 54 | 6 | 45 | 500 in 600 s (0.83/s) |
| Deadline night | 150 | 25 | 30 | 3 | 90 | 500 in 900 s (0.56/s) |
| Grades are released | 275 | 36.67 | 22 | 4 | 27.5 | 1,000 in 300 s (3.33/s) |
| Billing run and due date | 60 | 6 | 9 | 1 | 0 | 500 in 3600 s (0.14/s) |
| AI study surge | 100 | 5 | 20 | 1 | 200 | 0 in 600 s (0/s) |
| Campus emergency | 300 | 60 | 30 | 2 | 0 | 500 in 60 s (8.33/s) |

## One campus (6,000 accounts)

| Scenario | Concurrent accounts | Requests/s | In flight | DB connections | AI calls/min | Notifications |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Registration opens | 2,700 | 810 | 648 | 65 | 540 | 6,000 in 600 s (10/s) |
| Deadline night | 1,800 | 300 | 360 | 30 | 1080 | 6,000 in 900 s (6.67/s) |
| Grades are released | 3,300 | 440 | 264 | 40 | 330 | 12,000 in 300 s (40/s) |
| Billing run and due date | 720 | 72 | 108 | 11 | 0 | 6,000 in 3600 s (1.67/s) |
| AI study surge | 1,200 | 60 | 240 | 4 | 2400 | 0 in 600 s (0/s) |
| Campus emergency | 3,600 | 720 | 360 | 15 | 0 | 6,000 in 60 s (100/s) |

## A university system (30,000 accounts)

| Scenario | Concurrent accounts | Requests/s | In flight | DB connections | AI calls/min | Notifications |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Registration opens | 13,500 | 4050 | 3240 | 324 | 2700 | 30,000 in 600 s (50/s) |
| Deadline night | 9,000 | 1500 | 1800 | 150 | 5400 | 30,000 in 900 s (33.33/s) |
| Grades are released | 16,500 | 2200 | 1320 | 198 | 1650 | 60,000 in 300 s (200/s) |
| Billing run and due date | 3,600 | 360 | 540 | 54 | 0 | 30,000 in 3600 s (8.33/s) |
| AI study surge | 6,000 | 300 | 1200 | 18 | 12000 | 0 in 600 s (0/s) |
| Campus emergency | 18,000 | 3600 | 1800 | 72 | 0 | 30,000 in 60 s (500/s) |

## Ceilings (target utilisation 60%)

| Resource | Verified ceiling | Where to read it |
| --- | --- | --- |
| inFlight | **unverified** | Edge Function and gateway concurrent-invocation ceiling on the production plan |
| dbConnections | **unverified** | Postgres max connections minus reserved, behind the pooler, on the production compute size |
| aiCallsPerMinute | **unverified** | The AI provider account rate limit, per model, on the production key |
| notificationsPerSecond | **unverified** | The push and email providers' send rate on the production account |
