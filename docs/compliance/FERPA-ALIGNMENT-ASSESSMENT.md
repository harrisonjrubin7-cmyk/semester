# FERPA alignment assessment

**Status:** Technical-control assessment published; **no certification is claimed or available**.

**Assessment date:** 1 October 2026

**Owner:** Harrison Rubin, founder

**Scope:** Education-record handling in Semester's institutional data paths

FERPA obligations depend on the institution, the facts of the arrangement, and
the applicable exception or consent. This assessment is not legal advice and
does not decide that an institution's use of Semester complies with FERPA.

## Control evidence

| Area | Repository evidence | Current conclusion |
| --- | --- | --- |
| Access logging | `supabase/access.check.sql`, `supabase/support-access.check.sql` | Implemented and tested for covered paths |
| Scoped disclosure and revocation | `supabase/support-access.check.sql`, `supabase/family.check.sql` | Implemented and tested for covered sharing paths |
| Student access, export, and deletion | `app/src/lib/export.ts`, `supabase/deletion.check.sql` | Implemented and tested for covered data |
| Data minimization | `app/src/lib/ltikey.test.ts`, `RETENTION.md` | Controls exist; production institutional scope still requires validation |
| Tenant isolation | `supabase/tenancy.check.sql` | Institutional layer tested; legacy-table coverage remains incomplete |
| AI data routing | `supabase/integration-control-plane.check.sql`, `app/src/lib/integration/classification.test.ts` | Policy floor is tested; a real pilot source exercise remains open |
| Incident handling | `docs/market-readiness/INCIDENT_RESPONSE.md` | Written; owner/contact assignment and a recorded tabletop remain open |
| Subprocessors | `docs/SUBPROCESSORS.md` | Register exists; counsel/terms/region review remains open |

## Legal and operational gates

Before an institution relies on a school-official arrangement, counsel must
approve the terms, the institution must determine that the arrangement meets
its requirements, and the parties must sign a DPA or equivalent agreement that
states purpose limitation, direct control, redisclosure restrictions, retention,
security, incident notice, return/deletion, and subprocessor terms. The controls
must then be exercised against a real, isolated institutional tenant.

Until those gates are complete, the permitted public claim is:
**"FERPA-alignment assessment published; counsel and signed institutional terms
pending."**
