# Pseudonymity policy

Code: `app/src/community/alias.ts`. Flag: `VITE_SCOPED_PSEUDONYMITY` (high-risk,
off, production refused).

- An alias exists only in one community that is both approved for aliases and
  of an eligible type (support, study group).
- It is unique within that community, case-insensitively. The same name
  elsewhere is an unrelated alias.
- It can be searched only inside its own community. There is no alias history,
  graph, karma, location, account age, mutuals, follower count or post list.
- It never sends direct messages (`messagingMode` returns `none`).
- It posts under tighter limits: 3 posts and 10 replies an hour, against 10 and
  30 for named members.
- It can rotate unless a safety or fraud preservation hold applies.
- It is never used for official aid, billing, health, disability, housing,
  conduct, emergency or advising workflows.

Students are told plainly (`ALIAS_DISCLOSURE`):

> Other members see only this name. Semester still knows it is you, and
> trained Trust & Safety staff can check during a safety investigation.
