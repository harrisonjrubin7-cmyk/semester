# 0004 · AI through a server-side metered gateway, tool-based

**Status:** Accepted. Written, tested, and **not deployed**.

## Decision

Two routes to Claude, in this preference order:

1. **A key the student set on their own device** — used when present.
2. **`supabase/functions/claude`** — the gateway, used otherwise.

The gateway verifies the caller's JWT, holds the Anthropic key as a function
secret, meters usage per account in `usage` with a monthly cap counted in one
atomic statement, and passes streaming through unchanged.

Above that, the assistant is **tool-based**: `lib/assistant.ts` and
`lib/lookup.ts` give the model typed access to the app's own functions —
schedule, courses, deadlines, documents — rather than a prose summary.

## Why the key is not in the page

Because it cannot be. `ANTHROPIC_API_KEY` is deliberately read **without** the
`VITE_` prefix, so Vite refuses to compile it into the bundle; only the dev
proxy and the deployed function ever see it. That is a mechanical guarantee
rather than a convention somebody could forget.

## Why the device key is preferred over the gateway

A student who brought their own key should spend their own quota. It also means
the gateway is a *fallback*, which had one consequence worth recording: a
reader testing with a device key configured never sees the gateway fire, and
concludes it does not exist. That is how the previous strategy document came to
list a built gateway as the critical missing prerequisite.

## Why tool-based rather than a chatbot with context pasted in

§13 of the command states the rule and it is the right one: **AI must call
actual application functions, and must never hallucinate that an action
succeeded.** A model handed a prose dump can only describe; a model handed tools
either succeeds or reports a failure it did not invent. Consequential writes
require confirmation.

This also constrains verification. `lib/cite.ts` checks each quote the model
produces against the spans the API says it used, and the verdict is binary on
purpose — a three-state badge with a "close enough" middle is a badge nobody
reads.

## What it was chosen over

A client-only key (what the app had) — rejected because it makes every new user
visit `console.anthropic.com` before they can import a syllabus, which is the
single largest adoption barrier the product had.

## What remains

Three commands: apply `usage_atomic`, set the function secret, deploy. Until
then the gateway is unreachable and the app is effectively still client-key-only
for anybody who is not the founder. And per [0003](0003-no-application-server.md),
no preview branch deploys it, so it has never run outside a manual test.
