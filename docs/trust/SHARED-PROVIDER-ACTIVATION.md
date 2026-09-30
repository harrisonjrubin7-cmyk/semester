# Shared AI provider activation

<!-- Rendered from supabase/functions/_shared/provideractivation.ts by app/src/lib/trust/provideractivation.test.ts. Edit the record, then run `npm run registers` from app/. -->

**The shared key is off.** The `claude` function serves nobody until every row below is *recorded* with evidence under `docs/evidence/vendors/` **and** the deployment sets `SHARED_AI_PROVIDER=on`. Either alone serves nobody. Nothing below is recorded, because none of it has happened: no company is formed, no terms are accepted in Semester's name, and nothing is decided or approved. These are the owner's acts; no pull request may record one without its evidence, and the test refuses one that tries.

The key answered production on 29 September 2026 (the kill-switch drill in `docs/evidence/ai/`). From the first deploy of the function carrying this gate it refuses every caller with the sentence below, and the app says so in place of a missing-key message.

> The shared key is switched off until Semester's agreements with its AI provider are in place. Add your own key under Ask Claude → Settings to carry on.

## What is owed

| Requirement | Status | Next step | Evidence that records it |
| --- | --- | --- | --- |
| a legal entity to be the Customer | pending the owner | Form the company that will be the Customer in each provider agreement. | The formation document, or the state filing receipt. |
| Anthropic's Commercial Terms accepted by that entity | pending the owner | Open the Anthropic Console organization under that company, accepting the Commercial Terms, and file the acceptance. | The Console organization’s acceptance record under the entity, or a dated pointer to it (never the key). |
| a decision on student education records (an addendum, or counsel’s opinion that none are sent) | pending the owner | Get Anthropic’s answer on a student-data addendum, and with counsel decide whether the shared key may carry education records. | The signed addendum, or counsel’s written opinion that the shared key carries no education records. |
| a retention setting for the account | pending the owner | Request zero data retention, or record that the default retention is knowingly accepted. | Anthropic’s written grant of zero data retention, or the owner’s dated acceptance of the default. |
| an approval of who the shared key may serve | pending the owner | Record who the shared key may serve: individual students, and any school that approved it. | The owner’s dated approval naming who may be served; for a school, that school’s written approval. |
| the deployment switch | not set by the repository | Set `SHARED_AI_PROVIDER=on` with `supabase secrets set`, only after every row above is recorded. | The deploy log. The test refuses a workflow or config file that sets it. |

## Recording a decision

1. Do the act itself. Nothing here does it for you.
2. Put its evidence under `docs/evidence/vendors/`, with no key, password or account secret in it.
3. In `supabase/functions/_shared/provideractivation.ts`, change that field to `recorded` with the evidence path and the date. For accepted terms, move the Anthropic row of `app/src/lib/trust/provider-terms.ts` off `published` in the same pull request: the test holds the two together.
4. Run `npm run registers` from app/ to rewrite this page, and the gates.
5. Only when every row is recorded, and after the pull request is merged and deployed, set the switch.

## Where the gate is, and where it is not

- **Gated:** `supabase/functions/claude`, the only function holding a key of Semester’s. The test fails if another function reads `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`.
- **Not this gate:** a student’s own key goes from their browser to the provider under their own agreement, and the institution gateway (`app/server/institution`, not deployed) spends a university’s own OpenAI key under that university’s tenant policy. Neither is Semester’s key.
- **Turning it off again:** unset the switch, or engage `kill.ai_generation`. Either stops the function before it counts a call.
