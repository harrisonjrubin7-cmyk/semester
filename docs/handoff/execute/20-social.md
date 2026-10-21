# Stream 20: Semester Social: feeds, video, threads, profiles, ranking, moderation, analytics

Branch `semester/social` from `origin/main`. Depends on streams 01 (platform core) and 02 (identity). Read `handoff/BUILD.md` "Read this first" before starting: **the live repo wins every conflict**; extend its authorization core, schema and design system instead of creating parallel ones.

## Inputs
- Prototype files (acceptance reference, not code to ship): `ui_kits/semester-app/Social.jsx`, `ui_kits/semester-app/SocialMod.jsx`, `ui_kits/semester-app/SocialRank.jsx`, `ui_kits/semester-app/FeedDelivery.jsx`, `ui_kits/semester-app/SocialDesktop.jsx`, `ui_kits/semester-app/SocialVideo.jsx`, `ui_kits/semester-app/SocialConnected.jsx`, `ui_kits/semester-app/Outbox.jsx`, `ui_kits/semester-app/FeedAnalytics.jsx`, `ui_kits/semester-app/AiRisk.jsx`, `ui_kits/semester-app/Incidents.jsx`, `ui_kits/semester-app/ProfilePortfolio.jsx`, `ui_kits/semester-app/Networking.jsx`
- Source specifications (copy to `docs/specifications/source/`): `uploads/social-rec-safety.pdf (copy of the & filename)`; `uploads/social-delivery-arch.pdf`; `uploads/Map the native social media architecture….pdf`; `wireframe-toolkit.pdf + redis-ranking-rmf.pdf (copies of comma filenames)`; `Build an interactive React component library….pdf`; `Build a fully interactive student social feed prot.pdf + FERPA data flow mapper….pdf`; `uploads/social-edge-ai-risk.pdf`; `social-os-incident.pdf`
- Screen list with components: `handoff/prototype/SCREEN-INVENTORY.md` (filter Stream = 20)
- Design rules and tokens: `readme.md`, `SKILL.md`, `styles.css`

## Screens to build (32)

| Route in prototype | Screen | Prototype component |
| --- | --- | --- |
| `#/applicant/admitted` | Admitted checklist | NwxAdmitted (Networking.jsx) |
| `#/student/profile` | Profile and portfolio | ProfilePortfolio (ProfilePortfolio.jsx) |
| `#/student/network` | Network | NwxStudentNetwork (Networking.jsx) |
| `#/student/feed` | Feed | SocFeed (Social.jsx) |
| `#/student/me-social` | My social profile | SocProfile (Social.jsx) |
| `#/student/social-privacy` | Social privacy | SocPrivacy (Social.jsx) |
| `#/student/advise` | Course advisor | CaxAdvisor (SocialMod.jsx) |
| `#/trust/social` | Social moderation | SmxModeration (SocialMod.jsx) |
| `#/trust/ranking` | Feed ranking lab | SrxRanking (SocialRank.jsx) |
| `#/trust/safety` | Social safety pipeline | SrxSafety (SocialRank.jsx) |
| `#/trust/airisk` | AI risk and filters | ArkRisk (AiRisk.jsx) |
| `#/trust/aiaudit` | AI RMF audit | SvxAudit (SocialVideo.jsx) |
| `#/trust/incident` | Moderation incident | InxIncident (Incidents.jsx) |
| `#/trust/manage` | Triggers and rollback | InxManage (Incidents.jsx) |
| `#/trust/auditpkg` | Audit package | ObxAudit (Outbox.jsx) |
| `#/alumni/directory` | Directory | NwxAlumniDirectory (Networking.jsx) |
| `#/alumni/mentor` | Mentorship | NwxAlumniMentor (Networking.jsx) |
| `#/alumni/groups` | Groups and events | NwxAlumniGroups (Networking.jsx) |
| `#/alumni/jobs` | Shared jobs | NwxAlumniJobs (Networking.jsx) |
| `#/alumni/visibility` | Who sees what | NwxAlumniPrivacy (Networking.jsx) |
| `#/operations/feeddelivery` | Feed delivery | FdxDelivery (FeedDelivery.jsx) |
| `#/social/home` | Home | SdxHome (SocialDesktop.jsx) |
| `#/social/compose` | Create | SdxCompose (SocialDesktop.jsx) |
| `#/social/video` | Video feed | SdxVideo (SocialDesktop.jsx) |
| `#/social/thread` | Thread | SdxThread (SocialDesktop.jsx) |
| `#/social/profile` | Profile | SdxProfile (SocialDesktop.jsx) |
| `#/social/project` | Project | SdxProject (SocialDesktop.jsx) |
| `#/social/reels` | Scroll feed | SvxFeed (SocialVideo.jsx) |
| `#/social/comments` | Comment tree | SvxThread (SocialVideo.jsx) |
| `#/social/studio` | Connected prototype | CnxStudio (SocialConnected.jsx) |
| `#/social/outbox` | Mixed feed + outbox | ObxFeed (Outbox.jsx) |
| `#/social/analytics` | Analytics and approvals | AnxDash (FeedAnalytics.jsx) |

## Behaviors to reproduce
Each bullet is the as-built prototype behavior. Implement it against real data and services; where the prototype simulates (timers, toggles, fake servers), build the real mechanism and keep the toggle as a test fixture.

- **Feed analytics (6 Oct):** FeedAnalytics.jsx (ANX*): #/social/analytics — Feed tab records qualified views (≥65% visible for 1 continuous second, tab visible, deduped per session), likes/comments; Analytics (pairs, engagement rate, per-format views/engaged/rate/share, Semester localStorage keys+KB, navigator.storage.estimate labelled as origin estimate); Approvals (pending + reported posts, approve/hide/remove with event log); staff toggle shows 403 when off. Social OutboxSign-out clears account cache; mock signup has K-12 gatekeeper.
- **Outbox + audit package (6 Oct):** Outbox.jsx (OBX*, loads after NavGroups): #/social/outbox (vertical snap feed mixing video, horizontal snap carousel with counter, text cards; optimistic likes as desired-boolean ops + comments with op IDs; persisted outbox; server reachable/unreachable; sync with retries, 422 validation failure retained for review; sync log), #/trust/auditpkg (10 audit sections with status, 12-field control record with completeness + intent-vs-operation evidence check). From Build a fully interactive student social feed prot.pdf + FERPA data flow mapper….pdf.
- **Incidents (6 Oct):** Incidents.jsx (INX*): #/trust/incident (sample false-positive incident: SEV picker, 9-step runbook, kill switch, restore count, 9 required evidence items gating re-enable), #/trust/manage (8 Manage triggers with simulate, ranker canary 0–5% with promote / chronological fallback / restore, false-positive prevention list). From social-os-incident.pdf.
- **Connected social (6 Oct):** SocialConnected.jsx (CNX*): #/social/studio — one localStorage store shared by Feed (prev/next, like/save, comment counts, reduced-motion), Profile (follow toggle updates count, edit name/bio/school/major with validation + 160 limit, Posts/Portfolio inline detail/About), Discussion (flat parentId comments rebuilt as tree, collapse branches, “replying to” past depth 2, 500-char composer, aria-live announcements). From Build an interactive React component library….pdf.
- **Scroll feed + comment tree + AI audit (6 Oct):** SocialVideo.jsx (SVX*): #/social/reels (real CSS scroll-snap feed, IntersectionObserver ≥65% sets active slide, pauses on hidden tab, keyboard ↑↓/Page, play/mute/CC/like, comments open beside), #/social/comments (tree with shallow indent capped at 2 levels → “Continue this thread” focus view, creator badge, reply-to, likes), #/trust/aiaudit (intended vs prohibited use per AI system, 8 Govern controls with evidence + status). From wireframe-toolkit.pdf + redis-ranking-rmf.pdf (copies of comma filenames).
- **Social desktop (6 Oct):** SocialDesktop.jsx (SDX*), new workspace `social`: #/social/home (680 feed + 300 sidebar, carousel dots/arrows, private save, loading/empty/error states), compose (Post/Thread/Project update, 10-item media tray with reorder, required alt text, video processing gate, project picker, draft), video (dark vertical stage + side discussion, play/mute/captions/next), thread (shallow replies, focused subthread with author badge), profile (cover, pinned, Posts/Media grid/Portfolio filter/About), project (facts, overview, contribution, gallery, outcomes, updates, discussion, unavailable state). From uploads/Map the native social media architecture….pdf.
- **AI risk (6 Oct):** AiRisk.jsx (ARK*): #/trust/airisk — live ensemble filter (PII regex + policy terms, quoted-context lowering, threshold policy → allow/label/limit/hold/urgent, human-review flag), model registry with runtime rollback switches, NIST AI RMF Govern/Map/Measure/Manage controls, 10-state case machine + appeal outcomes. Feed delivery gained a Latency budget tab (12–42 ms cache hit). From uploads/social-edge-ai-risk.pdf.
- **Feed delivery (6 Oct):** FeedDelivery.jsx (FDX*): #/operations/feeddelivery — explicit score calculator (0.25G+0.18I+0.12T+0.27Q+0.10A−0.05F−0.03R, freshness e^(−λ·age) by content type), write path with fan-out-on-write vs read toggle, Redis key table, read path with cache hit/miss, CDN Cache-Control classes, invalidation event map + versioned keys, 6 policy states and lane SLAs. From uploads/social-delivery-arch.pdf.
- **Social ranking + safety (6 Oct):** SocialRank.jsx (SRX*): #/trust/ranking (candidates → safety filters with excluded list → 6 configurable weights → diversity cap → delivered page with Why? + 4 controls; personalized / chronological / non-profiled modes; prohibited features) and #/trust/safety (confidence bands → publish/limit/hold/quarantine, 7 escalation queues with SLAs, scope-hashed cache keys + invalidation demo, feed + safety metrics). Feed gained ordering modes + per-post “Why am I seeing this?”; moderation case needs reason code, second reviewer for high severity, adds Lock and Escalate. From uploads/social-rec-safety.pdf (copy of the & filename).
- **Moderation + course advisor (6 Oct):** SocialMod.jsx (SMX*/CAX*): #/trust/social (moderation queue, case evidence, human-review gate for remove/suspend, welfare escalation, appeals uphold/modify/reverse, who-moderates table), #/student/advise (eligibility then ranking, reasons, Why?, not interested, interests toggle, freshness record + pending recalculation). Social feed gained alt-text-required, schedule, sensitive-content gate, promoted label, report dialog with at-risk routing. #/os/matrix gained Permissions + FERPA gaps tabs. Source: uploads/social-os-prd.pdf (copy of the & filename) + Side-by-side feature matrix PDF.
- **Social + PRD controls (6 Oct):** Social.jsx (SOC*): #/student/feed (For You/Following/Campus/Communities/Network/Explore, 8-format composer with audience/comments/tags/reshare/download-off/hide-likes, threads, polls, video mode, mute/block/report, official-campus badge), #/student/me-social (modular profile, reorder/hide sections, field visibility, mentor preview, portfolio project page), #/student/social-privacy (12 controls, keyword filters, comment approval, moderation flow). Controls.jsx (CTX*): #/student/firstrun (4-step first login + 2-action activation), #/trust/permissions (4-check permission evaluator + spec cases), #/institution/exceptions (7-state exception, student/registrar views, delegated authority gate), #/finops/payments (payment-intent → ledger postings + 7 validation hooks; hold lifecycle + hold record), #/applicant/status, #/os/flows (11 demo flows). RecordsFlow.jsx (RFX*): #/faculty/posting (11-step pipeline, 4 state tracks, per-student partial rejection, configurable approval), #/student/scenario (what-if with snapshot, allocation changes, stale + recompute, draft plan), #/os/matrix (role matrices, integration note, FERPA). Uploads with & or () in names were copied to uploads/prd-figma-screen.pdf and uploads/social-outline-2.pdf to read.
- **Networking + admitted (6 Oct):** Networking.jsx (NWX*): alumni directory/mentor/groups/jobs/visibility (per-field Public/Campus/Alumni only/Invite only/Hidden; message requests), #/student/network (by major/org/cohort/interest/industry, saved contacts, intro requests, event chats), #/applicant/admitted (9 cross-office milestones, deposit gated on intent, opt-in class peers, graduate to student). Onboarding gained alumni + PDF checklists for student/faculty/admin; transition gained Ad angles + shared IA.

## Tasks
1. Map each screen to the repo’s routing and layout; reuse existing components from the design system bundle before adding new ones.
2. Define or extend the data model and API for every state the screens show. Server-authoritative for permissions, grades, money and enrollment.
3. Enforce authorization on the server for every read and write (deny by default). Add negative tests.
4. Implement empty, loading, error, offline and permission-denied states shown in the prototype.
5. Write unit, integration and accessibility tests for each behavior bullet. Use synthetic data only.
6. Keep copy and labels from the prototype unless the repo’s content guide says otherwise.

## Exit gates
- [ ] Every screen above reachable from navigation for the right roles and absent for others
- [ ] Every behavior bullet covered by a passing test
- [ ] Typecheck, lint, unit, integration and a11y checks pass (`handoff/verify.sh`)
- [ ] No production data, secrets or remote migrations touched
- [ ] Report written to `docs/execute/20-social-report.md` with evidence; PR opened; STOP for human review
