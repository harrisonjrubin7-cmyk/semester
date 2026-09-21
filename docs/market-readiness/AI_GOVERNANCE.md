# AI Governance

**Status: `IN_PROGRESS`**

## What exists

An AI surface: `app/src/lib/claude.ts`, `app/src/lib/openai.ts`,
`app/src/ai/`, `app/src/keygate.ts`, plus `app/src/lib/context.ts` and
research/explainer modules. Each has tests.

## What is missing, and why it matters institutionally

**No central AI gateway.** Calls are made from library modules rather than
routed through one place that enforces auth, tenant, permissions, model
routing, rate limits, logging, cost controls and safety. A university cannot be
told what the AI can see if the answer is "it depends which module called it".

**No tenant data boundary enforcement for AI.** The rule — AI receives only
what the authenticated user is authorised to see, and never data from another
tenant — is not enforced by construction. It currently depends on each call
site passing the right context.

**No cost controls.** Nothing tracks tenant, user, feature, model, tokens,
cost or latency. Universities need predictable economics before they sign.

**No model routing abstraction.** Business logic is not insulated from a
specific provider or model.

**No source citation.** When AI answers from Semester or university records,
there is no mechanism to say which record it came from.

## The rule that should govern the gateway when it is built

> AI must only receive data the authenticated user is authorised to access.
> Tenant data must never cross an AI request boundary.

This is a *construction* requirement, not a review requirement: the gateway
should make the unsafe call impossible to write, not merely discouraged.

## Next

The AI gateway is a prerequisite for any institutional AI claim, and it should
land after tenancy — a gateway that enforces a tenant boundary needs a tenant
boundary to enforce.
