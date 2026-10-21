# LTI 1.3 adapters: Canvas and Blackboard

From `uploads/Build an interactive LTI 1.3 launch sequence diagr.pdf` (6 Oct). Tables: `007_lti_ags.sql`. Prototype:
- `#/operations/ltiseq`: an 11-step sequence with a Canvas/Blackboard toggle
- `#/operations/lti`: the 13 launch checks
- `#/faculty/grade`: rubric → draft → approved → published
- `#/faculty/gradesync`: grade passback

## Shared boundary (both adapters implement it)
```ts
interface LaunchStore {
  put(state: string, tx: Transaction): Promise<void>;
  consume(state: string, nonce: string): Promise<Transaction | null>;  // ONE atomic statement: sx_private.consume_launch
}
initiate(registration, loginHint, targetUri, store, messageHint?): Promise<URL>;      // random state + nonce, saved, OIDC URL built
validateLaunch(idToken, state, registration, store): Promise<VerifiedLaunch>;       // jose jwtVerify against registration.jwks_url only
getToken(platform, signingKey, scopes): Promise<AccessToken>;                        // client_credentials + signed client assertion (≤ 5 min)
postApprovedScore(platform, lineItemUrl, token, score, approved: true): Promise<Delivery>; // application/vnd.ims.lis.v1.score+json
```
- **Registration lookup:** resolve the registration from server-held launch state, never from an unverified token field.
- **Replay protection:** a separate read followed by a delete isn't enough. `consume` must be one conditional UPDATE.
- **Anonymous launches:** they may be recognized, but never get graded-submission or grade-writing rights.

## Where the platforms differ
| Concern | Canvas | Blackboard Learn |
|---|---|---|
| Registration | Approved developer key for each environment (prod / beta / test) | Approved Learn registration plus deployment |
| Service endpoints | Use the URLs Canvas advertises in the launch | Same. Docs show differing path spellings, so never build URLs from guessed ids. |
| Draft passback | Off by default | Off by default |
| Score behavior | `PendingManual` and `FullyGraded` update the score; `NotReady`, `Pending` and `Failed` ignore `scoreGiven` | Verify in the target institution |
| Comments | Student-visible: send approved feedback only | Verify release and visibility behavior |
| Extensions | `preserve_score`, `prioritize_non_tool_grade`, submission/file extensions: explicit opt-in only | Don't assume Canvas extensions apply |
| Results | Needs `result.readonly` | Readable for tool-created columns only |
| Overrides | Surface a conflict; never overwrite | Same |
| Student identity | Accepts the LTI user id or the Canvas user id; use the verified LTI `sub` | Launch `sub`, NRPS `user_id` or an approved REST UUID; use the verified LTI identity |
| Clearing a grade | A score with no `scoreGiven` clears the tool score | **Omitting a grade can delete it.** Never send progress-only updates after grading without testing. |
| Submission transport | Kept separate from grade transport | Same |

## Still to build (the starter package doesn't include these)
- **Storage and routes:** a Redis or Postgres `LaunchStore`, HTTP routes with duplicate-field rejection, and secure session creation.
- **Authorization and Deep Linking:** tenant, context and object permission checks, plus Deep Linking return-URL validation and response signing.
- **Platform operations:** registration admin with key rotation, and SSRF / egress controls on JWKS and token fetches.
- **Workers:** token caching, result pagination, and the durable sync worker (states in `007_lti_ags.sql`).
- **Testing:** in each LMS sandbox, before launch, cover the secure launch, course mapping, line-item discovery, approved score delivery, current-result reading, override handling, course copy and failure recovery.

## Compile the validator (ESM, Node)
`npm install` (jose, typescript and @types/node are already declared). Keep `"type": "module"` in package.json.

`tsconfig.json`:
```json
{ "compilerOptions": { "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext", "lib": ["ES2022", "DOM"], "types": ["node"],
  "strict": true, "verbatimModuleSyntax": true, "rootDir": ".", "outDir": "dist", "noEmitOnError": true, "forceConsistentCasingInFileNames": true, "skipLibCheck": true },
  "include": ["lti.ts", "adapters.ts"], "exclude": ["dist", "node_modules"] }
```
Scripts: `"typecheck": "tsc -p tsconfig.json --noEmit"` and `"build": "tsc -p tsconfig.json"`.

Smoke test: `node --input-type=module -e "import('./dist/lti.js').then(m => console.log(Object.keys(m)))"` should print initiate and validateLaunch. That shows the module imports; it isn't a launch test.

Import with the emitted extension: `import { validateLaunch } from "./lti.js"`.

**Callback order:**
1. Parse a bounded form body.
2. Reject duplicate id_token or state fields.
3. Resolve the registration from server-held state.
4. Run `validateLaunch`.
5. Map the deployment to a tenant.
6. Authorize the user, context and resource.
7. Create the session.

## Tenancy model: shared registry (008_lti_hardening.sql)
**Mapping chain:** registration (issuer + client_id + environment) → verified deployment_id → tenant → verified context.id → course → resource_link.id → assignment → advertised line-item URL.

**Never map (issuer, client_id) to one tenant.**

## Line items (008_lti_hardening.sql)
**Order:**
1. Use the launch's `lineitem` claim.
2. Otherwise discover a column in `lineitems` by our `resourceId` + `tag`.
3. Otherwise create it, and only with write scope.

**Safety rules:**
- `claim_lineitem` serializes concurrent launches.
- A creation timeout becomes `creation_unknown` and is rediscovered before any new POST.
- Blackboard: a direct POST can't set `resourceLinkId` (only Deep Linking can).
- Blackboard: don't send read-only fields such as `id` in updates.
- Course copies are rediscovered rather than reused.

## Starter gaps to close
- **Tokens:** check the scopes in the returned token, and cache tokens.
- **Workers:** the durable worker, the result reader and the full line-item client.
- **Launch store:** an atomic `Store.consume()`.

## Launch tracing (009_lti_trace_and_copy.sql)
Use one server-generated `traceId` per launch.

**Stages:**
login_initiation → authorization_redirect → callback_received → jwt_verified → claims_validated → transaction_consumed → context_authorized, or launch_rejected.

**Reason codes:**
STATE_INVALID, JWT_INVALID, NONCE_INVALID, DEPLOYMENT_UNTRUSTED, TARGET_INVALID, LTI_CLAIMS_INVALID, REPLAY_REJECTED, ACCESS_DENIED.

**Rules:**
- Write the event after each checkpoint actually passes.
- Don't call a launch "authorized" at `transaction_consumed`. Cryptographic validation and academic authorization are separate.
- **Never log** raw JWTs, subjects, emails, nonces, access tokens, client assertions or error objects.
- The HTTP layer returns a generic message with the trace id. The reason code goes to the restricted log, readable through `launch_trace()` with `integration.manage`.
- Retention is 30 days (`purge_launch_traces`).
- Replace the starter's generic errors with typed internal failures; never match on error-message strings.

**Prototype:** `#/operations/ltitrace`.

## Course copy
**Background:**
- LTI Core doesn't announce copies.
- `resource_link.id` isn't preserved across a copy.
- Gradebook copies can keep the tool's `resourceId` and `tag`.

**So:**
- **Three identities (corrected):**
  - `template_id`: the reusable content.
  - `activity_key`: which graded use of it (e.g. `report-week-4` vs `report-week-10`). It's preserved in copied launch parameters and used as the line-item `resourceId`.
  - The assignment instance: this course's dates, attempts and grades.
  - `(context, activity_key, tag)` is unique, because columns that share one resourceId + tag can't be told apart.
- **First launch in a new context:** validate → deployment → tenant → new context → template → new instance → query line items → match `resourceId` + `tag` → bind → create only if nothing matches and write scope exists.
- **Ambiguity:** more than one match raises `AMBIGUOUS_LINEITEM_MAPPING` for a person to resolve.
- **Keys are locators, never credentials.**

**Three ways course copy breaks passback:**
- **Stale destination:** reusing the original course's column URL. `assert_same_context` refuses it before sending.
- **Duplicate column:** creating a column without first discovering the copied one.
- **Shared instance:** reusing the old assignment instance, so last term's attempts and grades appear in the new course.

**Scopes:** the four AGS scope names are the same on Canvas and Blackboard. What differs is registration, the capabilities each install grants, endpoint availability and platform behavior.

**Ancestry:** optional context and resource-link history substitutions can help identify which course a copy came from. Check support before relying on them.

**Prototype:** `#/faculty/coursecopy`.

## Deep Linking 2.0 (Canvas and Blackboard use the same messages)
`LtiDeepLinkingRequest` → `LtiDeepLinkingResponse`, returned as a signed JWT in the `JWT` form field. Portable content item:
```json
{ "type": "ltiResourceLink", "title": "Research Report", "url": "https://semester.example/lti/activity",
  "custom": { "semester_template_id": "research-report-v1", "semester_activity_key": "report-week-4" },
  "lineItem": { "label": "Research Report", "scoreMaximum": 100, "resourceId": "report-week-4", "tag": "primary-grade" } }
```
**Payload rules:**
- Use `resourceId`, not `resource_id`. Custom values must be strings.
- Before replying, check `accept_types`, `accept_presentation_document_targets`, `accept_multiple`, `accept_lineitem` and `deep_link_return_url`.
- If `accept_lineitem` is false, line items are ignored. If it's absent, don't assume support.

**Response envelope:**
- `iss` is our client_id, `aud` is the platform issuer, with a new nonce and a short `exp`.
- The `deployment_id` is verified, and `data` is echoed back unchanged.
- Sign it with the active tool key from `tool_jwks()` and POST it only to the validated return URL.

**Canvas only (keep these in the Canvas adapter):**
- `lineItem` creates an assignment.
- `assignment_selection` can overwrite name, points and description; `preserveExistingAssignmentName` keeps an existing name.
- `submission.startDateTime` is ignored.
- Bulk placements can create assignments and module items, and a `module_name` claim names a new module.

**Auto-created columns (012_deep_linking.sql):**
- Returning a graded item is a request, not a confirmation.
  - `accept_lineitem: true` means the platform says it will create the column.
  - `false` means line items are ignored.
  - Absent means don't assume support.
  - `auto_create` false or absent means the instructor may still cancel.
- So Semester records the selection as **pending**, waits for the first launch from the new resource link, then discovers and binds the column.
  - Direct AGS creation is refused while a selection is pending (`DEEP_LINK_PENDING`).
  - Selections that never launch are abandoned after 14 days.
- **Canvas placements that create assignments:**
  - `assignment_selection`: creates an assignment and opens it for editing.
  - `course_assignments_menu`: creates one or more assignments; non-graded items go into a new module.
  - `module_index_menu_modal`: creates a module.
  - Returning a `lineItem` from other placements isn't a reliable way to create a graded assignment.

**Blackboard:** Deep Linking is how to create a linked column, because direct AGS creation can't set `resourceLinkId`. Test placement, dates and overwrite behavior in the target Learn deployment.

## Signature tests (tests/)
`JWT_signature_test_results.json`: 4 synthetic RS256 checks passed in Python `cryptography`:
- valid signature accepted
- tampered payload rejected
- wrong key rejected
- tampered signature rejected

`jwt-signature.test.mjs.txt` is the Node/jose suite (valid, tampered payload, wrong key, wrong issuer, expired). **It hasn't been run.** The latest attempt failed with `ERR_MODULE_NOT_FOUND` because jose isn't installed. A separate run with Node's built-in crypto passed 4 of 4 (exit 0). To run the jose suite: `npm i jose`, then `node --test`.

**Still missing:** a full-validator suite that covers JWKS fetching, \`validateLaunch\`, state and nonce replay, deployment mapping and Deep Linking claims.

These cover signature behavior only. They don't test real LMS keys, JWKS fetching, state or nonce consumption, deployment mapping, or the full validator.

## Claims-to-records mapping (ERP PDF part 2)
| Claim | Validation | Maps to |
|---|---|---|
| `iss` + `sub` | Trusted registration; sub present except for supported anonymous launches | `lti_identities` → person. **Never use name or email as identity.** |
| `deployment_id` | Known, enabled deployment | `lti_deployments` → tenant |
| `message_type`, `version` | Supported handler; 1.3.0 | Launch handler |
| `target_link_uri` | Matches the initiated target; approved route | Local route |
| `resource_link.id` | Valid within the deployment | `lti_resource_links` |
| `roles` | Recognized vocabulary, mapped by policy | **Course-scoped capabilities only.** Never registrar, admissions, housing, dining or platform admin. |
| `context.id` | Optional; map within the deployment | `lti_contexts` → section |
| name, email, `lis` | Optional display or contact attributes; never account-linking authority | Approved display fields only |
| custom | Allow-listed keys, schema-validated | Tool configuration (e.g. `semester_activity_key`) |
| `role_scope_mentor` | Only with a Mentor role, plus local disclosure rules | Restricted mentorship relationship |
| NRPS, AGS endpoints | Approved endpoints and scopes | Roster and grade-service config. NRPS isn't authority for other institutional records. |

**Three tokens, never interchangeable:**
- **Launch id_token:** validates the browser launch.
- **Service access token:** used for platform API calls.
- **Semester session:** identifies the local session and never holds student records.

**Audit:** `013_audit_logging.sql`. Every access is recorded, allowed or denied, with a scoped subject token in place of identity. Metadata keys are allow-listed. Records can only be added; reads fail closed if logging is down.

**Debug tool:** `#/operations/jwt` decodes and checks tokens locally, with RS256 verification against a pasted public JWK. It rejects private key material.

## Canvas Score API quirks (Canvas vs Blackboard audit PDF, 6 Oct)
| Behavior | Consequence for Semester |
|---|---|
| `PendingManual` can update the submission score | Never use it as a hidden-draft flag |
| `FullyGraded` can create or update a submission and score | Publish deliberately |
| `NotReady`, `Failed` and `Pending` ignore `scoreGiven` | Don't assume a numeric payload changed the grade |
| Timestamp earlier than the result's last update → **400** | Investigate ordering or an LMS-side change; never rewrite timestamps to force it through |
| `scoreGiven` without `scoreMaximum` → **422** | Validate before queuing (`ags_score_events` already requires a maximum) |
| Unknown user or non-student → **422** | Resolve the enrolled LTI identity first; send to `action_required`, don't retry |
| `comment` is student-visible | Internal grader notes never go in passback |
| File attachments return processing-progress URLs | Track file processing separately from score delivery |
| `submission.submittedAt` left unchanged doesn't increment the attempt | Always send the original submission time, so a regrade isn't counted as a new attempt |
| `preserve_score` and `prioritize_non_tool_grade` both default to false | Set them deliberately, **nested** under `"https://canvas.instructure.com/lti/submission"` together with `new_submission`, never as top-level keys. A 200 response can still mean "kept the old grade", so reconcile. |
| Submission side effects differ for the first line item on a resource link vs extra or unattached columns | Don't assume every column behaves the same |

**Preservation request** (`tests/canvas-preservation.test.mjs.txt`, the payload contract only; it doesn't show what Canvas actually does):
```json
{ "userId": "…", "timestamp": "…", "activityProgress": "Completed", "gradingProgress": "FullyGraded",
  "submission": { "submittedAt": "<original submission time>" },
  "https://canvas.instructure.com/lti/submission": { "new_submission": false, "preserve_score": true, "prioritize_non_tool_grade": true } }
```
- **No `scoreGiven`:** the request carries no score, so it can't clear one.
- **Sandbox acceptance test:**
  1. Seed an existing grade.
  2. POST this request with the score token to an isolated fixture.
  3. Read the results and the submission back.
  4. Assert the grade and the attempt number are unchanged.
- **Second fixture:** test `prioritize_non_tool_grade` with a replacement score against an instructor-entered grade.

## Blackboard login initiation
**Parameters:** `iss`, `login_hint`, `target_link_uri`, `lti_message_hint`, plus optional `client_id`, `lti_deployment_id` and `lti_storage_target`.
- **Hints:** pass `login_hint` and `lti_message_hint` back unchanged.
- **Deployment:** the initiation deployment hint only helps routing; the **signed** `deployment_id` decides the mapping.
- **Storage target:** `lti_storage_target` names the frame for the postMessage storage that supports iframe launches without third-party cookies.

**Placement differences:**
- **Graded placements** can advertise both `lineitem` and `lineitems`.
- **Non-graded placements** may advertise only `lineitems`. Discover or require setup there, never create blindly.
- **Deep Linking requests** don't carry normal resource-link claims, so don't require them.

**Prototype:** `#/operations/jwt` now includes an AGS score payload checker.

## node-jose verification (verification-logic and node-jose PDFs, 6 Oct)
**Verifier order:**
1. Bounded input (token ≤ 64 KB, no duplicate form fields).
2. Load the unexpired server-held state transaction.
3. Verify the browser binding.
4. Resolve the trusted registration.
5. Reject unsupported headers: **RS256 only**.
6. Pick exactly one trusted public RSA key by `kid`.
7. Verify the signature.
8. Check the standard claims (iss, aud, azp, exp/iat with bounded skew).
9. Check nonce (compared in constant time against a stored hash), deployment, target and LTI message type.
10. Check message-specific claims, and that endpoint origins match the platform.
11. Authorize tenant, course and action.
12. **Consume the transaction atomically.**
13. Return the verified launch context.

```js
const keystore = await jose.JWK.asKeyStore({ keys: [matchingTrustedPublicKey] });
const verified = await jose.JWS.createVerify(keystore, { allowEmbeddedKey: false, algorithms: ["RS256"] }).verify(token);
```
- **`allowEmbeddedKey: false`:** a key embedded in the token (`jwk` or `x5c` in the header) must never establish trust.
- **Key selection:** the keystore holds only the one trusted key chosen by `kid` from the registration's JWKS.

**Correction:** LTI Advantage AGS has **no refresh tokens**. Canvas and Blackboard both use the client-credentials grant with a signed RSA assertion. When the short-lived service token expires, request a new one; cache it until shortly before `expires_in`.

**Testing against a live Blackboard sandbox** needs that sandbox's issuer and JWKS URL plus a real signed launch token. Synthetic tokens only test the code path.

**Your package, now inline:** the four modules are extracted to `tests/`. They came from PDF text, so they need reformatting, and none has been compiled or run.

| Module | What it does |
|---|---|
| `verification.mjs.txt` | Launch verification |
| `canvas-token.mjs.txt` | Service token by client-credentials, signed RSA assertion |
| `ags.mjs.txt` | Line-item discovery, create and score sync |
| `mermaid-export.mjs.txt` | Sequence diagram export |

**Launch verification details:**
- Trusted URLs must be https with no credentials or fragment, from an allowed origin.
- Message-specific checks, including Deep Linking settings and their return-URL origin.

**Score sync details:**
- **Lease and locks:** `drain()` claims each job under a lease; `syncOnce` holds job locks.
- **Delivery states:** Delivered, DeliveredUnverified, VerificationPending, Verified or Conflict.
- **Comparing results:** scores are normalized (`resultScore/resultMaximum` vs `scoreGiven/scoreMaximum`, within 1e-6) because platforms can rescale. A missing `resultMaximum` defaults to 1.

**Integration contracts still to implement:**
- **`store.consume`:** atomic exact match, expiry check and replay prevention.
- **`getTrustedJwks`:** approved endpoint, bounded response, cached keys, controlled refresh on rotation.
- **`authorize`:** verified deployment → tenant, plus scoped academic permissions.
- **`parseNextLink`:** tested RFC 8288 pagination.
- **`repo.withJobLocks`:** fenced locks against duplicate creates and out-of-order updates.
- **`recordCreationIntent`:** a durable record written before an uncertain external create.
- **`recordFailureAndSchedule`:** bounded retries that honor Retry-After and keep uncertainty.
- **Network layer:** egress and DNS controls, bounded token and AGS responses.

**Never** point these at a live gradebook just to test the transport. The sequence diagram is in `user/Semester_Launch_Sequence.mmd`.

**Identity:** principal links come from a trusted linking workflow (`identity_links` in your DDL, or `auth_principal_links` in the RBAC PDF), **never an email match**. Scopes are explicit typed relationships, never free-form `scope_reference` strings from a client.

## Standalone verification service (Canvas AGS reference PDF, 6 Oct): the preferred package
This iteration uses **Node's built-in crypto** instead of node-jose, so it has no runtime dependencies, and **16 of 16 tests pass** (your report). It supersedes the node-jose modules in `tests/`.

| File | Purpose |
|---|---|
| `core.mjs` | OIDC initiation, RS256 verification, claim validation, JWKS retrieval, token client, Mermaid export |
| `ags.mjs` | Line-item discovery and creation, score delivery, result reconciliation, worker loop |
| `service.mjs` | Internal HTTP verification service: `POST /verify` and `POST /mermaid`, both behind an internal API key |
| `reference.test.mjs`, `test-results.txt` | Synthetic-key and mocked-HTTP tests, with their output |
| `package.json`, `README.md` | Node 20+; `npm test`, `npm run check` |

**What the 16 tests cover:**
- a valid launch
- rejection for wrong issuer, audience, nonce, deployment or expiry, a bad signature, or an altered payload
- a missing resource link rejected, and Deep Linking accepted without resource-link or roles claims
- a wrong browser binding rejected
- a replayed callback rejected, and concurrent callbacks producing exactly one success
- the token form and cache reuse
- the Mermaid participant allow-list
- AGS: discover an existing column, post the score, verify the normalized result, with no duplicate creation

**Signature hardening:** rejects other algorithms, ambiguous key matches, private key material in the JWKS, critical header extensions, and RSA keys under 2048 bits.

**Before production:**
- Replace the in-memory store with durable atomic storage before running more than one instance.
- Browser binding must come through the trusted app gateway, never from a public request.
- Bind the service to 127.0.0.1 or a private network only.
- No real LMS has been contacted: the tests use synthetic keys and mocked HTTP.

**The package itself wasn't attached.** Upload the ZIP and it goes in `tests/standalone/`.

## Queue extension package (Canvas AGS service PDF, 6 Oct)
This extends the standalone verifier. Your report: 5 local tests passed and 3 sandbox tests were skipped, because no sandbox was configured. **The ZIP wasn't attached.** The PDF is filed at `user/pdfs/Canvas-AGS-service-package.*`.

| File | Purpose |
|---|---|
| `schema.sql` | `ags_lanes` (tenant + lane key, lease owner, `fence`, blocked reason), `ags_jobs` (unique per event key and per lane + revision, payload hash, state, attempts, due_at) and `ags_audit` |
| `pg-queue.mjs` | Idempotent enqueue; `FOR UPDATE SKIP LOCKED` claiming; **fenced** completion, so a worker whose lease expired can't overwrite a newer one; retry loop |
| `auth-cache.mjs` | Token cache keyed by scope; JWKS cache with rotation; RS256 verification |
| `local.test.mjs`, `sandbox.test.mjs` | Local tests, plus opt-in sandbox token, signature and disposable grade-sync tests |

**How it relates to `007_lti_ags.sql` here:**
- **Lanes:** a lane is one (deployment, line item, student). It plays the role of `one_live_score_event`, plus a lease and fencing token.
- **Decided (6 Oct): one queue, the lanes design.** `019_ags_queue_consolidation.sql` adopts `ags_lanes`/`ags_jobs`/`ags_audit` (in `sx_private`) and drops 007's `ags_score_events` and `ags_deliveries`. 007–009 keep `ags_lineitems`, `ags_result_snapshots` and the LTI registration tables, and `enqueue_score` is redefined to write to the lane queue.
- **Signature layer only:** the rotation-aware signature function adds key rotation to the verifier. It doesn't replace the issuer, audience, nonce, state, message and authorization checks in `core.mjs`.
- **Database execution:** the SQL has been syntax-checked but never run against a database.
