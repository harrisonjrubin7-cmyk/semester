# 06 · User-facing privacy controls and transparency

**Status `DESIGNED`. 4 October 2026. Owner: privacy seat with the product owner.**

> Not legal advice. **Required notice content, consent standards and wording are [COUNSEL REQUIRED].** This file maps what a person can actually do today and what each control is backed by, so copy can be held to behaviour. Product design intent is in [`STUDENT-DATA-CONTROL-CENTER.md`](../STUDENT-DATA-CONTROL-CENTER.md) (its "nothing here is built yet" is stale; see 08-B6) and [`CONSENT-SHARING-DESIGN.md`](../CONSENT-SHARING-DESIGN.md) (decided 27 Sep).

## 1. Principle: the screen may not say more than the system does

`app/src/lib/privacy.ts` holds the in-app text and `privacy.test.ts` checks the checkable claims. The company site and policy drafts are not tied to behaviour the same way (`policydrift.test.ts` ties pricing and refund claims only). Every sentence below marked *check* is a claim to re-verify when the control changes.

## 2. Control map

| Control | Where | Backed by | State | Gap |
| --- | --- | --- | --- | --- |
| See what Semester holds | Privacy / Data screens | `account_data_map()` read by the page | Built | Not a single list including device files |
| Export my data | Privacy → Export | `export_my_data()` (JSON, `semester.account-export` v1) | Built | Device files; AI conversations on device; guardian-restriction leak (8-C4); no copy of audit events about me |
| Delete my account | Privacy | `delete-account` → `erase_account()` | Built | Shows what is kept and why; held accounts get an unexplained 409; staff with immutable history cannot self-erase |
| Raise a rights request | Privacy → Your privacy requests | `raise_my_data_subject_request()` | Built (intake only) | Shows a due date; **do not show it as a promise** until P-03 is decided *(check)*; no answer can be given (02) |
| Share with an advisor, support, or family | Sharing / Family | `advisor_shares`, `support_shares`, `family_*` | Built | No single Sharing list across the three; shares write no `consent_record`; revoke is permanent; supporter claim is by bearer code |
| See who read what I shared | Sharing | `family_access_events`, advisor/support read logs | Built | **No screen for support-access history** |
| Support access consent | Support | `consent_record` capability `support:read`, ≤ 7 days | Built | Same |
| Connected accounts | Connect | Provider tokens in the browser | Built | Revocation stops the next sync and **deletes nothing**; say so |
| AI: choose own key, see disclosure | AI Disclosure; Trust page | key on device | Built | Class not checked at runtime; training/sale statements are policy text, not a technical control |
| Notifications | Settings | `push_devices` | Built | Cron parked |
| Consent history | none | `consent_record` | **No screen** | Student cannot see their own consent history |
| Marketing and email preferences | none in app; "Your privacy choices" panel on the company site | `gtm_consent` (server only) | **No preference centre** | Unclear what the site toggles enforce; no sender approved |
| Cookie / storage choices | none | none | **No banner**; site and app say they set no cookies | `semester-site-prefs`, `semester-attribution`, `semester-site-getstarted` local/session storage on the site; storage notice blocked on deployed verification |
| Age and minor status | Sign-up; `state_my_age` | `private.account_ages` | Built | Once-only statement; no way to correct a wrong one |
| Guardian view of a minor | none | `guardian_links` | **Not built**; guardian reads only their own link row | Portal K12-003 |
| Academic record inspection | none | n/a | **No screen** for a student's own academic record (stated in the PIA) | **[CR]** right to inspect |

## 3. Transparency requirements (proposed; counsel reviews every sentence)

1. **Layered notice:** a short "what we do with your data" at sign-up; the full text one tap away; the same facts in the Trust page. Today every policy is a draft with an unset effective date, and the site's policy-versions page says no policy is in force. **Do not link a draft as in force** (the legal-review queue's own rule).
2. **Say where data goes, before it goes:** the privacy screen already states what goes where for student-directed connections; extend that to AI (which provider, whose key, what is sent) at the moment of first use.
3. **Source and authority labels** on anything official, connected, personal, AI-generated or pending (the audit's design law); privacy copy refers to them.
4. **Plain statement of what is kept after deletion** and why, with the 7-day backup tail and restore caveat **[CR]**.
5. **No response-time promise** anywhere until P-03 closes: check the Privacy screen, site, support-policy draft and privacy-policy draft.
6. **Minors:** a separate short notice for 13–17 accounts and a guardian-facing notice, drafted for counsel **[CR]**; neither exists.
7. **Marketing:** consent captured separately from terms, withdrawable in one step, honoured on the next send (`gtm_consent` already works that way server-side); a preference centre before any sender is approved.
8. **Contact:** a dedicated privacy address replaces the personal mailbox in `SECURITY.md`, `security.txt`, the policy draft and the site **[decision, then CR on wording]**.
9. **Assistant conversations:** reconcile the statement "on-device only" (retention draft) with the synced `ai_memories` table before publication (08-B12).
10. **Accessibility of privacy controls:** every control and notice meets the same acceptance criteria as the rest of the app, including plain-language and reading-level checks.

## 4. Consent record requirements (for the next build, not a design decision)

A consent record that a regulator or institution could rely on needs: the **exact text version shown** (a store of policy text or its hash, not the free-text `policy_version`), purpose, audience, timestamp, method, who recorded it, revocation time and reason, and the audit correlation id. The FERPA workflow already lists the missing fields (`signature_method`, `legal_basis`, `revocation_reason`, `audit_correlation_id`). **Whether a click is sufficient consent for a given purpose is [CR].** A share confirmation today is "a confirmation, not a signature".

## 5. Release check for any privacy-touching copy

Before merge: the sentence is true today (cite the test or migration); it does not promise a time, a certification, or a legal outcome; it matches the policy draft and the claims register (`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`); a person using only a keyboard and screen reader can reach and use the control.
