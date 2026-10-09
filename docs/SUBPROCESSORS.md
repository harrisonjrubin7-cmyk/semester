# Subprocessors and Data Destinations

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Every third party a student's data can reach, and whose decision sends it
there. Launch-readiness Phase 4. This closes the procurement checklist's
"Subprocessor list: constructible from this tree" row and HECVAT PRIV-5's
"constructible today".

**The source of truth is `app/src/lib/trust/subprocessors.ts`.** The table
below is that data rendered, and `subprocessors.test.ts` fails if:

- the app's content-security policy (`app/index.html`, the browser's own
  list of every host the app can contact) names a host that is not listed
  here, or this list names one the policy no longer allows;
- a Supabase Edge Function exists that no row accounts for, or a row names one
  that is gone;
- a gateway AI provider exists that no row accounts for;
- a cited file is missing;
- this document differs from the data.

To change a row, change the data, then paste the new rendering here.

## Three kinds of destination

- **Subprocessor:** processes data on Semester's behalf, under Semester's
  account. A DPA names these.
- **Institution-directed:** reached only after an institution configures it
  (its LMS, its approved AI provider). The institution chose it; Semester runs
  the connection.
- **Student-directed:** the student's own account at a service the student
  chose to connect, reached from their own browser or relayed at their
  request. It is not Semester's subprocessor, and Semester has no contract
  with it. The privacy screen says what goes where before it happens.

Mixing the third kind into the first would overstate what Semester
controls. Leaving it out would understate where data goes. So both are
listed, and labelled.

## What this register does not cover

The table above is driven by the **app's** content-security policy. It does not
cover `company-site/`, which has its own hosting and loads: it is served from
GitHub Pages, embeds YouTube through `www.youtube-nocookie.com` and
`i.ytimg.com`, and posts its lead forms to the `lead-intake` function. Those
destinations see a visitor's IP address and are in no register yet. They are
listed as coverage gaps to close in
[`privacy-operations/03-VENDOR-REVIEW-PROCESS.md`](privacy-operations/03-VENDOR-REVIEW-PROCESS.md) §6 (including whether any
script CDN is loaded and whether the site's hosting is the same party as the
app's). Until a row exists for each, do not read this register as the
complete list for the company site.

## Before this is published

This register is accurate to the code and tested. Publishing it to an
institution or on the public site still needs:

1. **Counsel's review.** The kinds above are an engineering classification,
   not a legal opinion.
2. **Each subprocessor's own terms and data-processing addendum** on file
   under `docs/evidence/`, or held privately and referenced from there.
3. **Hosting regions** stated per subprocessor, as the institution's DPA will
   ask.

## Hosts a deployment adds

The content-security policy also takes hosts from five build settings
(`cspExtraConnect` in `app/vite.config.ts`). Each is an endpoint the operator
of a deployment configures, and none can be set by a student:

| Setting | What it points at | Kind |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | The deployment's Supabase project (above) | Subprocessor |
| `VITE_CLAUDE_PROXY` | A proxy holding the operator's AI key, if the operator runs one instead of the `claude` function | Subprocessor, operated by whoever runs the proxy |
| `VITE_ICS_PROXY` | A relay for calendar links, if not the `fetchcal` function | The operator's own service |
| `VITE_OAUTH_PROXY` | A token-exchange relay for the student-directed connections above | The operator's own service |
| `VITE_UNIVERSITY_GATEWAY_URL` | The institutional gateway (Vercel, above) | Subprocessor |

A deployment that points any of these at a new third party adds a
subprocessor, and must add its row above. CI can check only what is committed:
`subprocessors.test.ts` holds any origin set in `app/.env.production` to the
register. An origin set as a repository variable reaches the build without
passing through CI. For that case, `npm run build` prints a warning naming each
configured host the register does not list.

## The register

| Party | Kind | Purpose | Receives | When |
| --- | --- | --- | --- | --- |
| Supabase | Subprocessor | Database, authentication, storage of synced rows, and Edge Functions. | Account email and sign-in records; what a signed-in student chose to sync; usage counts; audit records. | When signed in |
| GitHub Pages | Subprocessor | Serves the public web app’s static files. | Standard request metadata (IP address, user agent) when the app is loaded. No student content. | Always |
| Vercel | Subprocessor | Runs the institutional gateway as serverless functions. | Institution-scoped requests from signed-in members of a connected institution. Action bodies are encrypted before they are stored. | Only once an institution enables it |
| Anthropic (Semester’s key) | Subprocessor | AI features for signed-in students who have not supplied their own key, metered per account. When the owner sets AI_GATEWAY_API_KEY the request reaches Anthropic through Vercel AI Gateway. | The text of the AI request the student made (for example a syllabus to turn into a course). | When signed in |
| Stripe | Subprocessor | Payments for a paid plan: the hosted checkout page, recurring billing, and the webhook that tells Semester a payment succeeded or failed. Not active until its keys are set; nothing is charged before then. | The student’s email address, the plan and price chosen, and the payment details they type into Stripe’s own page, which never pass through Semester. Semester keeps Stripe’s customer and subscription references, never card or bank data. | Only when the student turns it on |
| Resend | Subprocessor | Emails each company-site form submission to the Semester owner. The built support-notice path can send a generic hint after student opt-in, but remains inactive until vendor review, executed terms/DPA, ownership and activation approval are recorded in addition to its key and sender. | For site forms: the visitor’s submitted contact fields and reference. For opted-in support notices: the student’s email address, a support reference and app link, but never the reply body or approved diagnostic context. No IP address. | Only when someone sends a company-site form or an opted-in student has a support reply |
| OpenAI (institution-approved) | Institution-directed | AI over approved course sources, through the gateway, once an institution approves the provider and a budget. | The student’s request and the approved sources it cites; never data classified above what the institution’s rules allow to that destination. | Only once an institution enables it |
| The institution’s LMS (LTI 1.3 platform) | Institution-directed | Course launch, deep linking and, where an instructor placed a graded link, a quiz score. | Launch verification traffic; a score only for a graded link the instructor placed. | Only once an institution enables it |
| Anthropic (student’s own key) | Student-directed | AI features using a key the student entered on their device. | The student’s AI request, sent from their browser under their own key. | Only when the student turns it on |
| OpenAI (student’s own key) | Student-directed | AI features using a key the student entered on their device. | The student’s AI request, sent from their browser under their own key. | Only when the student turns it on |
| Microsoft | Student-directed | Signing in with Microsoft, and connecting the student’s own Outlook calendar and mail, OneDrive and Microsoft To Do. | Reads: whatever the student’s own Microsoft account returns to their browser, under the permission they granted. Writes, only when the student asks: a file saved to OneDrive (its name and contents), a calendar event (title, time and note) and a Microsoft To Do item (title and note). | Only when the student turns it on |
| Google | Student-directed | Signing in with Google, and connecting the student’s own Google Calendar, Gmail, Google Drive and Google Tasks. | Reads: whatever the student’s own Google account returns to their browser, under the permission they granted. Writes, only when the student asks: a file saved to Google Drive (its name and contents), a calendar event (title, time and note) and a Google Tasks item (title and note). | Only when the student turns it on |
| Zoom | Student-directed | Connecting the student’s own Zoom meetings. | The student’s own meeting list, read in their browser. | Only when the student turns it on |
| Apple | Student-directed | Signing in with Apple. | The sign-in exchange the student starts. | Only when the student turns it on |
| OpenStreetMap tile servers | Student-directed | Map images when the student opens the map. | The student’s IP address and which map area is being viewed. | Only when the student turns it on |
| Nominatim and Photon (address lookup) | Student-directed | Turning a typed address into a map position, and only if the student switched lookup on. | The text the student typed into the lookup box; their position only if they separately switched reverse lookup on. | Only when the student turns it on |
| Public institution source hosts | Student-directed | Checking the availability of a public source and whether it contains a reviewed exact excerpt. | A request to the public source URL chosen by the student. No Semester session token, reflections, or excerpt is sent to the source host. | Only when the student turns it on |
| Calendar and Canvas hosts the student links | Student-directed | Reading a calendar feed or Canvas instance the student pasted, relayed because those hosts refuse browser requests. | The request to the address the student supplied, with the token they supplied. | Only when the student turns it on |
| The student’s browser push service | Student-directed | Delivering reminders the student switched on. | An encrypted notification for the student’s device, via the push service their browser vendor runs. | Only when the student turns it on |
