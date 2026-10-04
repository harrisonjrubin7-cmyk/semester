# Frontend architecture

Status: 4 October 2026. Written against the code on `origin/main`, not against a blank page. The existing UI is a
React 19 / Vite 8 PWA with ~150 lazy screens, a local-first store, an outbox, a conflict review and a typed source
vocabulary. This document does not replace it. It says what the frontend is, what one change set added
(**Built here**), and what is still a plan (**Planned**), so a reader can tell the two apart.

Read with [`frontend-backend-contracts.md`](frontend-backend-contracts.md) (the contract rule),
[`universal-state-model.md`](universal-state-model.md) (the fourteen states),
[`offline-sync-contract.md`](offline-sync-contract.md) (what may be offline) and
[`../ROLE-LAUNCH-REGISTER.md`](../ROLE-LAUNCH-REGISTER.md) (which roles may launch).

## 1. Shape: one shell, role *workspaces*, not seven apps

The seven audiences (student, faculty, staff, guardian, alumni, partner, support) are **not** seven codebases.
Today one shell serves every role and filters by `forRole` (`lib/role.ts`), tenant capability and
`workspaceFor` (`lib/institutional-ia.ts`). `lib/role.ts` says the role is presentation, not a security boundary,
and `lib/institutional-access.ts` already separates that from server-verified, scoped, expiring grants. Keep that:

| Layer | Owns | Where it lives |
| --- | --- | --- |
| Shell | chrome, navigation, search, notifications entry, error boundary, offline strip, deep links | `App.tsx`, `lib/chrome.ts`, `lib/nav.ts`, `components/Boundary.tsx` |
| Workspace | one role's destinations and defaults | `lib/institutional-ia.ts`, `lib/role.ts` |
| Screen | one destination, one lazy chunk | `screens/*`, registry in `screens.tsx` |
| Read model | what a screen may claim about its data | `lib/read/*` (**Built here**) |
| Renderer | turns a read model into words | `components/unity/ReadState.tsx` (**Built here**) |

**Role gating.** `docs/ROLE-LAUNCH-REGISTER.md` has 69 roles and none launch-approved. A role gets its own
workspace entry only when it reaches the register's `usable` rung with evidence; until then it stays a preview
(`InstitutionalPreviewBar`). Authorization stays in RLS and `decide()` (ADR 0002, 0007); the client never grants.

Guardian is `family`/`payer` in the client `Role` union and its projection is online-only
(`offline-sync-contract.md`). Partner and support exist as database roles only. Adding them to the client union
is a separate, reviewed change.

## 2. Shell standards

- **Routing.** Screen state is `state.screen`; the URL is a hash map (`lib/route.ts`) because hosting is static.
  Every destination is reachable by `?screen=` only if it is in `LINKABLE_LEAVES` (`lib/deeplink.ts`). No router
  library is added: the cost is a second source of truth for the screen.
- **Navigation.** One registry (`lib/nav.ts`); student tabs stay Home · Courses · Study · Calendar · Me per the
  University OS plan. Role workspaces add destinations to the registry; they do not add a parallel nav.
- **Search.** One ranker (`lib/find.ts`, ADR 0006). A role's results are filtered by the same grants as its nav.
- **Notifications.** The screen reads `lib/read/notifications.ts` (**Built here**); firing and listing share
  `state/reminders.ts` so they cannot disagree.
- **Errors.** `ScreenTrouble` wraps each screen so navigation survives a crash and tells an absent chunk (offline)
  from a stale chunk (deploy). **Planned:** a root boundary above the shell for provider failures.
- **Data fetching.** Local-first reads come from the store through selectors. Server reads go through a read
  model returning `ReadEnvelope<T>`. A fetch hook is added per journey when its first server read exists; no
  generic client cache is added speculatively. Cache keys carry tenant and permission scope; sensitive or
  official records default to no-store (`frontend-backend-contracts.md`).

## 3. Responsive IA and device behaviour

Already enforced: every permitted capability is reachable at every width (`CAPABILITY-PARITY-MATRIX.md`,
`widthgate.test.ts`), with tab bar, rail, desk and sidebar chosen by `lib/chrome.ts`. New work follows
`RESPONSIVE-CONTRACTS.md` at 320 / 768 / 1280, 44px targets (`taps.test.ts`) and text scale (`textscale.test.ts`).
Device-specific behaviour is a capability check (installed, notification permission, share target), never a
user-agent branch.

## 4. Offline-aware UX

The honest current state (`offline-sync-contract.md`): a local-first PWA, **not** an encrypted offline client.

| Need | Existing | Rule for new work |
| --- | --- | --- |
| Local state | IndexedDB `semester-store`, localStorage fallback | Student-owned data only |
| Sync queue | Held-send outbox (`lib/sync/outbox.ts`): waiting/sending/sent/unknown/failed/expired; student taps Send | Official or financial writes are `online-only`; never queued (`lib/sync/classes.ts`) |
| Conflicts | Three-way review (`lib/conflicts.ts`, `merge.ts`); sync state `review` | Source wins authoritative fields; student annotations survive |
| Stale indicator | `freshnessState`, `SourceBadge`, offline ledger badge | Null freshness renders as stale (**Built here**, `effectiveState`) |
| Recovery | `ScreenTrouble`, `Recovery` screen, restore/export | Every failed state carries a recovery action and a reference |

A queued item is never drawn as submitted, paid or synced. **Planned** (per the contract's delivery sequence,
none of it started here): device-installation ids, hybrid logical clocks, authoritative receipts, native
SQLCipher. Browser storage must not be described as encrypted.

## 5. Design system

Plain CSS tokens (`styles/tokens.css`, `lib/look.ts`), primitives in `components/ui.tsx` and `components/unity/*`,
guarded by source-reading tests (`tokens`, `hex`, `taps`, `motion`, `contrast`, `a11y/*`). New components reuse
those; this change adds **no** new visual primitives, only a renderer that composes existing ones.
Accessibility contract for a state renderer: loading announces in a polite live region; failure is `role=alert`;
meaning is never colour or shape alone (`a11y/tellings.test.ts`); every recovery is a real button.

**Visual regression is not in place.** There is no screenshot-diff suite. Planned: use the existing
`scripts/*.mjs` Chromium harness to capture the state matrix per screen and compare, behind an explicit decision
on baseline storage. Until then, "looked at the screenshot" (CLAUDE.md) remains the check, and none is claimed.

## 6. State model

One typed contract: `ReadEnvelope<T>` and the fourteen `OperationalState`s (**Built here**, `lib/read/envelope.ts`).
The eight surfaces the product needs map as:

| Surface | From state | Draws | Never |
| --- | --- | --- | --- |
| loading | `loading` | polite status, still bars | empty or failed |
| empty | `empty` | why, next action, limitations | implies data exists |
| denied | `permission_denied` (or `canRead:false`) | boundary, no data | leaks content or existence |
| offline | `offline` | last data + strip | says submitted/synced |
| pending | `pending_approval` | data + "not final" | says approved |
| degraded | `stale`, `syncing`, `unavailable`, unknown | last data + notice | says current |
| failed | `error` | alert, preserved work, reference | raw exception |
| recovery | any state with `recovery[]` | the action as a button | an action the server did not offer |

Rules enforced in code: unknown state → `unavailable`; denial drops data; `verified` needs a verifier time *and* an
authority that can verify (`derived` and `student` cannot); `connected` needs a parsed observation time and not
past `staleAfter`. `universal-state-model.md`'s "client-side role changes cannot create `permission_denied →
connected`" holds because `canRead` is read from the envelope, not derived on the client.

## 7. Performance, bundles, observability

- **Budgets.** `perf-budgets.json` (gzip): first load 490,496 B, per-route default 49,152 B, enforced by
  `npm run budgets`. A new route gets the default; raising one needs a measured reason. `lib/read/*` and
  `ReadState` are small and ride the screens that import them; the Notifications chunk is the only one touched.
- **Splitting.** One chunk per screen via `lazy()`; `Today` is the only static screen (cold start). No
  `manualChunks` today. Role workspaces split by screen, never by role bundle, so a role's code is not shipped to
  another role.
- **Caching.** Service worker (`public/sw.js`): navigation network-first with shell fallback, media cache-first,
  150 MB cap. Official records are not cached (contract above).
- **Observability.** Today it is local only: `lib/timing.ts`, `lib/diagnose.ts`. **Planned:** content-free Core
  Web Vitals and error-code counts to the gateway telemetry routes, consent-gated per `ANALYTICS.md` (D-005),
  carrying the envelope's `correlationId`. Not built; no vendor is chosen here.

## 8. Test strategy

| Layer | Tool in repo | Covers |
| --- | --- | --- |
| Pure model | vitest | envelope rules, feed ordering, fail-closed cases, each with a control |
| Component | vitest + jsdom + `createRoot`/`act` | every surface of `ReadState`; unmount in an after hook (`rootunmount.test.ts`) |
| Accessibility | `axe-core` on the real `<App/>`, source-reading guards | serious/critical violations, landmarks, labels, focus |
| Keyboard | per-screen `*.keyboard.test.tsx`, `scripts/keyboard-pass.mjs` | operable without a pointer |
| E2E / smoke | `scripts/*.mjs` on Chromium (not in CI) | cold start, golden path, sync |
| Visual | **none** | planned, see §5 |

Playwright is not a dependency and is not added here. Guards are proven by reverting the rule and watching them
fail (CLAUDE.md); the two fail-closed rules above were.

## 9. Migration from the current UI

Additive, one journey at a time, nothing removed or renamed (`ADDITIVE-UNIVERSITY-OS-MIGRATION-PLAN.md`).

1. **Contract** — `ReadEnvelope`, `present()`, `ReadState`. *Built here.*
2. **Notifications** — real reminders replace static demo data. *Built here.*
3. **Today / tasks / calendar** — wrap their existing selectors in envelopes; render stale/empty/offline through
   `ReadState`. Their local reads are `authority: derived|student`, so they cannot claim `verified`.
4. **School-sourced facts** — `From your school` cards take `institution`/`sis` authority from the gateway, the
   first place `verified` is reachable.
5. **Role workspaces** — only past the role-launch gate.
6. **Retire** legacy per-screen status fields only when usage is zero and parity tests pass.

Capabilities preserved by construction: the reducer action `clearNotifs`, the `cleared` flag and every route are
untouched; only the screen's source of data changed.

## 10. First vertical slice: where it stands

| Slice item | State |
| --- | --- |
| Authenticated student shell | Exists (Supabase auth, `App.tsx`); unchanged |
| Today | Exists; not yet on envelopes (step 3) |
| Tasks | Exists (`Work.tsx`); not yet on envelopes (step 3) |
| Calendar | Exists (`Calendar.tsx`); not yet on envelopes (step 3) |
| **Notifications** | **Built here**: real, ordered by tier, with why-lines, put-away, offline and permission limitations |
| **Source labels** | **Built here** for notifications: authority `derived`, label `estimated`, never institution-verified |
| Accessibility | Renderer reuses the audited state components; screen covered by the app-wide axe sweep |
| Offline states | **Built here** for notifications (list kept, "nothing external can arrive"); other screens per §4 |

This is one screen on one contract, not the whole slice. Today, tasks and calendar remain to be moved onto the
envelope, and no server-owned notification feed exists: what is listed is worked out on the device, which the
screen says.
