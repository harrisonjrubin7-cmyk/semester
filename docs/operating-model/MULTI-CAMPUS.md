# Multi-campus, multi-brand and consortium architecture

Semester has to work for university systems with many campuses. The same goes for community-college districts, branch
campuses, and professional and continuing-education schools. It also has to handle shared-service systems and
cross-registration agreements.

[ADR 0005](../architecture/0005-multi-campus-scoping.md) established campus scoping: an admin-written `schools` table,
and a `school_id` that its own subject cannot write. This document adds the hierarchy above and below a campus, and
the rule for inheriting policy through it. That rule is enforced by
[`app/src/lib/governance/hierarchy.ts`](../../app/src/lib/governance/hierarchy.ts).

```text
System tenant
→ campus tenant
→ college/school
→ program
→ course/community scope
```

## The inheritance rule

| What | How it inherits | Why |
| --- | --- | --- |
| Feature state | **Narrows**: a child may set `off`/`preview`/`sandbox`/`production` no higher than its parent | Central governance means something; a branch may be stricter |
| Data-class routes | **Narrows**, from the platform floor down | The same rule `tighten` enforces for one tenant, applied at every level |
| AI allowed | **Narrows**: once off, off below | A law school may forbid AI that the system allows |
| Retention | **Narrows**: a child may shorten, never lengthen | Longer retention is a new data use |
| Brand | **Overrides**: nearest level wins | Local identity is Tier 1 content, not a weaker control |

Every time a child asks for something looser than its parent, `resolve()` records it in `clamped`, and the admin
console should show that list. Silently ignoring a setting is how an administrator ends up believing something is on
when it isn't.

**Isolation:** a chain resolves only if every node belongs to the same system. Nodes must also sit in level order, the
root must be a system, and the chain must have no cycles. Data crosses campuses by **agreement** (cross-registration),
never by hierarchy.

## What to build on this

| Capability | Status | Note |
| --- | --- | --- |
| Central policy inheritance with campus overrides | **Built**: rule in `hierarchy.ts`, records in `governance_policy_nodes` | The table refuses a node out of level order, in another system, below another school's campus, or opening a class route past the platform floor. Only the platform attaches a campus to a system |
| Brand inheritance and local branding | Rule in code | Tier 1 settings per node |
| Shared connectors with campus-specific mapping | Designed | One connection per system; `integration.field_mapping` per campus node |
| Cross-campus identity and role resolution | Designed | A role is granted at a node and applies to its subtree only |
| Data isolation between campuses | Rule in code; ADR 0005 in DB | `private.same_school()` generalises to `same_subtree()` |
| Shared resource directory with local availability | Designed | Resource at system node, availability at campus node |
| Cross-registration workflow | Designed | Home campus owns the record; host campus gets section-level T3 by agreement, audited |
| Central reporting with privacy-safe comparisons | Partial | Aggregates only, under the small-cell floor `lib/institution-ops.ts` already applies (n < 10 suppressed, #818). Cross-campus comparison is not built |
| System-level rollout and feature flags | Rule in code | Set at the system node; campuses narrow |
| Shared procurement and trust documentation | Process | One HECVAT/VPAT/DPA per system, with campus addenda |
