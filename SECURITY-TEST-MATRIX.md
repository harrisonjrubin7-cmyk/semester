# Security test matrix

Legend: **covered** means an executable negative test was found; **partial** means adjacent controls exist but the exact case is not proven; **gap** needs a test before activation.

| Actor | Tenant/resource mismatch | Action | Expected refusal | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| anonymous | any tenant / public RPC | execute authenticated RPC | no callable public functions | `supabase/grants.check.sql` | covered |
| student | other student, same tenant | read/write private row | RLS denies | `tenancy.check.sql`, domain checks | covered |
| student | different school | read/write records or use role | no rows / 42501 | `school-membership.check.sql`, `roles.check.sql`, integration RLS checks | covered |
| student | guessed UUID | mutate share, grade, ticket, registration | generic not found/refused | family/advisor/support/gradebook/registration checks | covered |
| student | expired/revoked invite/share | claim/read | no data; same response as invalid | family/advisor/support checks | covered |
| student | suspended/minor/withdrawn membership | community/institution action | fail closed | minimum-age/community/school checks | covered |
| classmate | course mismatch | room/message read/write | no row / refusal | records/groups/classmates checks | covered |
| guardian | ungranted category/resource | read student data | empty/refused and logged | family checks | covered |
| advisor/support | other school or expired share | read student snapshot | refused; no existence leak | advisor/support checks | covered |
| instructor/TA | other course | grade/course-studio mutation | 42501 | gradebook/course-studio checks | covered |
| school admin | other tenant | configure/read tenant policy | refused | tenant plan/policy/console checks | covered |
| platform operator | missing capability/fresh MFA | console mutation | refused and no journaled action | console approval/control-plane checks | covered |
| integration worker | caller-supplied tenant conflicts with connection | ingest/write | tenant from connection; abort | `worker.test.ts`, integration checks | covered |
| service role | malformed tenant/resource pair | privileged RPC | function validates invariant | function-specific SQL checks | partial: 81-operation audit required |
| Stripe sender | invalid signature/stale timestamp/replay | webhook | 400; no side effect; duplicate no-op | billing webhook tests | covered |
| LTI platform | bad issuer/aud/deployment/nonce/state/role | launch/passback | generic refusal; no binding/grade | LTI unit + SQL checks | covered |
| OAuth callback | altered state/redirect/account link | callback | refuse | Microsoft/calendar/provider tests | partial: live provider exercise absent |
| signed-in user | DNS rebind/private redirect | source check | refuse before connection | source function address checks | gap: connection pinning/rebind test |
| signed-in user | excessive source checks | repeated outbound fetch | shared 429; second account unaffected | `productivity-source-rate-limit.check.sql`, `productivitysourcecheck.test.ts` | covered; PostgreSQL 17 execution pending |
| uploader | SVG/polyglot/magic-byte mismatch/oversize | community media | pending/rejected, never readable | SQL media state checks | gap: scanner absent |
| renderer | SVG handler/foreignObject/script/javascript/data/external URL | render | removed or text-only | diagram/creations/link tests | covered for central sinks; company-site constants reviewed statically |
| API caller | malformed/oversized body | HTTP handler | 400/413; no side effect | handler tests | covered for most; sourcecheck dedicated test missing |
| deleted account | export/erase across stores | delete/export | own data only; legal holds preserved | deletion, retention, subject-request checks | partial: backup/vendor deletion is operational evidence |

## Required additions

1. Expand the source-check handler suite beyond its new limiter regressions: method/auth/body bytes, IPv4/IPv6 ranges, redirects, DNS rebinding, timeouts, content type/size, and generic errors.
2. API-level authenticated HawkScan coverage for all 15 HTTP surfaces; current DAST scans only the frontend.
3. Community media worker tests before activation: MIME/extension/magic bytes, decompression/pixel bombs, SVG rejection, malware verdicts, retry/dead-letter, and deletion.
4. Restore, legal-hold, export and deletion exercises against representative backup/analytics/vendor copies.
5. A generated coverage map tying each of the 81 service-role operations to an owning boundary and a negative test.
