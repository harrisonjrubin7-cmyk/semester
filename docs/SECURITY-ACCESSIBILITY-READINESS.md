# Security, Accessibility and Trust Packet

What Semester can hand a university's security, privacy, accessibility and
procurement reviewers, at what level of confidentiality, and how access is
granted and reviewed. Launch-readiness Phase 4.

This is an index. The claims live in the registers, which are test-checked:

| Register | Covers | Held by |
| --- | --- | --- |
| [`market-readiness/HECVAT_READINESS.md`](market-readiness/HECVAT_READINESS.md) | Security, accessibility (VPAT/ACR, WCAG), AI, resilience, legal | `app/src/lib/hecvat-readiness.test.ts` |
| [`FERPA-COPPA-1EDTECH-READINESS.md`](FERPA-COPPA-1EDTECH-READINESS.md) | FERPA, minors and COPPA, LTI and 1EdTech | `app/src/lib/trust/ferpa-coppa-readiness.test.ts` |
| [`SUBPROCESSORS.md`](SUBPROCESSORS.md) | Every third party data can reach, and on whose decision | `app/src/lib/trust/subprocessors.test.ts` |
| [`market-readiness/PROCUREMENT_CHECKLIST.md`](market-readiness/PROCUREMENT_CHECKLIST.md) | What procurement will ask for, and what exists | `app/src/lib/marketreadiness.test.ts` |

## The packet, by tier

| Item | Exists | Tier |
| --- | --- | --- |
| Privacy disclosure (as shown in the app) | Yes: `app/src/lib/privacy.ts` | **Public** |
| No-surveillance statement | Yes: `docs/operating-model/TRUST-BRAND-AND-LEGAL.md` | **Public** |
| Subprocessor register | Yes, pending counsel's review | **Public** once reviewed; **NDA** before then |
| HECVAT readiness register | Yes | **NDA** |
| FERPA/COPPA/1EdTech readiness register | Yes | **NDA** |
| Architecture, data flows and retention (`RETENTION.md`, `SECURITY.md`, `docs/UNIVERSITY-OS-ARCHITECTURE.md`) | Yes | **NDA** |
| CI evidence: policy-suite and accessibility-audit results for a named commit | Yes, on request | **NDA** |
| Incident response process and notice templates | Yes; never exercised | **NDA** |
| Security contact and disclosure policy | Yes: `app/public/.well-known/security.txt` (RFC 9116), with `SECURITY.md` as its policy — the reporting rules, four severities and a remediation target each. Safe-harbour wording waits on counsel | **Public** |
| Accessibility statement | **No** | Public, when it exists |
| VPAT / ACR | **No.** Needs a formal evaluation | Public, when it exists |
| Penetration test report | **No** | NDA, when it exists |
| SOC 2 report | **No**, and none is planned before a first pilot | — |
| Terms of service, privacy policy, DPA | **No** | Public / per contract, when they exist |
| Insurance certificate | **No** | NDA, when it exists |

**Never shared, at any tier:** secrets, keys, production data, any student's
records, other institutions' configurations or contacts, or anything under
`supabase/` that names a real account.

## Granting access to NDA material

1. **A named person at the institution asks,** in their role (IT security,
   privacy office, procurement, accessibility). The request is logged in the
   company's CRM against that opportunity (see `INSTITUTIONAL-GTM-PLAYBOOK.md`
   in #827).
2. **The NDA is signed first.** No NDA-tier item goes out on the promise of
   one.
3. **The packet is generated from a named commit.** The registers are read at
   that commit, so what is sent can be reproduced later, and it says which
   commit it was.
4. **It is shared by an expiring link to that institution's reviewers,** not
   as email attachments. The link and who received it are recorded against the
   request.
5. **Nothing is edited for the audience.** If a row reads "No", it goes out
   as "No", with its "what moves it".

## Reviewing the packet

- **Every quarter,** at the policy review in
  `docs/operating-model/TRUST-BRAND-AND-LEGAL.md`, re-read the three
  registers against the code. Most of that is already done by their tests;
  the review covers the parts a test can't (whether a "what moves it" is
  still the plan).
- **When a status goes up** (an ACR delivered, a pen test done, a DPA signed),
  the document goes under `docs/evidence/` in the same commit that raises the
  status. The tests refuse the raise otherwise.
- **When a new third party is added** to the code or to the page's fixed
  policy, the subprocessor register fails CI until the party is listed.
  That is how the register stays current without anyone remembering to
  update it. It cannot see a proxy origin set only as a deployment's build
  variable. For those, the build prints a warning naming every configured host
  the register does not list, and the operator adds the row before deploying.
