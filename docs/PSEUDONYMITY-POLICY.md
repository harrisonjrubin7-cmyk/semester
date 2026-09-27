# Pseudonymity policy

Code: `app/src/community/alias.ts`, enforced by `community_aliases`,
`claim_community_alias` and `create_community_post` in
`20260927210000_community.sql`.

**Two switches, both off:**

- The build flag `VITE_SCOPED_PSEUDONYMITY` is high-risk, off by default, and
  refuses `production`.
- The school's `community_programs` row (`scoped_pseudonymity`) is off
  unless present, and only the service role can write it. A community
  manager then approves a specific support or study-group community.

**How the server keeps an alias from unmasking its owner:**

- **Separate reference.** An alias post has its own author reference, salted
  with the alias, so it cannot be joined to the same person's named posts. A
  new alias gets a new reference.
- **Blocking mutes instead.** Blocking an alias mutes that alias in that
  community instead of blocking the account. An account block would hide the
  person's named posts as well, and which posts vanished would reveal who the
  alias is.
- **Accountability stays.** Reports, decisions and restrictions still reach
  the account.
- **No lookalike names.** An alias cannot be any member's handle at that
  school.

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
