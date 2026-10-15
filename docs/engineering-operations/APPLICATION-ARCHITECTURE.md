# Application Architecture

| Control | Value |
| --- | --- |
| Status | **CONTROLLED APPLICATION MAP — BROAD IMPLEMENTATION; ROUTE-WIDE ACCEPTANCE PARTIAL** |
| Owner | Harrison Rubin — application architecture and frontend release owner; backup reviewer unassigned |
| Evidence date | 2026-10-03 at repository revision `fb6adc7a` |

## Runtime composition

The application is a React 19, TypeScript and Vite single-page application using stable hash routes. `app/src/screens.tsx` is the screen registry, `app/src/lib/route.ts` resolves routes, and `app/src/lib/nav.ts` supplies navigation structure. Shared UI, tokens, state, source/freshness, accessibility and interaction contracts live under `app/src/components/`, `app/src/lib/`, `app/src/styles/`, `app/src/state/`, `app/src/a11y/` and `app/src/intelligence/`.

The application is intentionally usable without sign-in for individual device-local work. Authentication adds synchronization and server-backed capabilities; it must not silently change the meaning or authority of existing data. Service-worker/offline behavior, local persistence and recovery are part of the product boundary, not optional polish.

## Layer rules

| Layer | Responsibility | Rule |
| --- | --- | --- |
| screens/routes | compose a user job and states | use the registry and stable routing; preserve back/context behavior |
| shared components | interaction, accessibility and trust patterns | reuse before creating; one-off controls require documented need and tests |
| domain libraries | pure rules, formatting, validation and state transitions | keep deterministic logic separate from rendering and provider calls |
| device state | local-first working data and preferences | version stored shapes; preserve data through refresh/error/offline paths |
| cloud client | auth and explicitly owned synchronized records | publishable key only; authorization remains on the server/RLS boundary |
| intelligence/AI | governed assistance, disclosure and source handling | no hidden consequential decision; show basis, limits and human/non-AI route |
| gateway/functions | secret-bearing and external operations | authenticate, authorize, validate, rate-limit, audit and fail closed |

## Change contract

A changed user flow must identify routes, data, authority, flags, all critical states, accessibility behavior, responsive behavior, telemetry, support, rollback and claim impact. New synchronized data requires lifecycle/export/deletion coverage. New provider calls require an approved server boundary. New flags require default-off semantics for sensitive scopes, owner, expiry, kill-switch behavior and target readback.

## Evidence state

**Code/config evidence.** Route, navigation, component, token, accessibility, source, local-state, cloud and feature-control tests cover many application contracts. Production builds and focused critical-flow suites have passed at recorded revisions.

**Operational evidence.** No current artifact proves every route/state on representative devices, every stored-shape upgrade, all offline recovery, privacy-safe field behavior or a complete named-customer application acceptance.

**Missing test/proof.** Complete the route/state census, critical-flow browser matrix, storage migration/recovery tests, performance/accessibility execution, target error telemetry and signed UAT for each activated scope.

## Claim ceiling

Semester may describe its application structure, local-first behavior and specific tested contracts. It may call a route tested only with the exact test, environment and revision stated.

## Prohibited claims

Do not claim every route is end-to-end verified, universally accessible, offline-safe, production-monitored, customer-approved or ready for broad acquisition from component/unit coverage alone.
