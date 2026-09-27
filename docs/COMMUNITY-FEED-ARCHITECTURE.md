# Community feed architecture

Code: `app/src/community/feed.ts`, `communities.ts`.

## Ranking

```
rank = 0.30·path/course + 0.25·time + 0.20·explicit follow
     + 0.15·verified source + 0.10·preference
     − fatigue − duplication − safety
```

The server computes each signal (0–1) from allowed inputs and ships it with a
one-line reason. That reason becomes the "Why am I seeing this?" text
(`explain`). The ranker version is `community-rank-2026.09.1`.

## Excluded inputs, enforced

`rankItem` throws `ForbiddenSignal` when an item carries any name in
`FORBIDDEN_SIGNALS`, at any depth. The list covers:

- GPS, distance and geohash
- housing and movement
- schedule and attendance
- private messages
- counseling, disability, health, financial aid, immigration and conduct data
- grades and GPA
- follower counts, karma, votes and reaction counts
- reply counts and report counts
- controversy and outrage
- watch time
- inferred politics, identity and wellbeing
- safety state

A structural test checks that `feed.ts` never imports `safety-state.ts`.

## Finite by construction

- `PAGE_LIMIT` is 20. A page always returns `end: true`, and there is no cursor
  into a global stream.
- Surfaces: For Your Courses, For Your Path, From Your Communities, Study With
  Others, Campus This Week, Saved for Later.
- Each community has a chronological mode.
- Items under review, reduced, held or removed are never recommended. A
  community's chronological view still shows items under review, so a single
  report cannot silence a post.

## Student controls

| Control | Effect |
| --- | --- |
| Hide / Not relevant | Hides the item from this student's feed only. It never creates a report |
| Show less like this | Halves that community's scores for this student, per tap |
| Helpful | Recorded for discovery tuning. It is never credibility or enforcement |
| Block / Mute | Removes the author from this student's feeds and sessions |
| Chronological | Switches the ordering |

## Community types

`TYPE_RULES` sets, per type: membership visibility, open posting,
premoderation, structured requests and the posting rate. Support communities
hide membership. The bulletin and housing/transport types are premoderated.
There are no open DMs in v1. Career, mentorship and research communities get
structured requests only.

## Labels

Institution verified, Organization verified, Faculty approved, Student-created,
AI-assisted · source linked, Illustrative example.
