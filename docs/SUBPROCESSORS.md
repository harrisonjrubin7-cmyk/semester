# Subprocessors and Data Destinations

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
subprocessor, and must add its row above.

## The register

| Party | Kind | Purpose | Receives | When |
| --- | --- | --- | --- | --- |
| Supabase | Subprocessor | Database, authentication, storage of synced rows, and Edge Functions. | Account email and sign-in records; what a signed-in student chose to sync; usage counts; audit records. | When signed in |
| GitHub Pages | Subprocessor | Serves the public web app’s static files. | Standard request metadata (IP address, user agent) when the app is loaded. No student content. | Always |
| Vercel | Subprocessor | Runs the institutional gateway as serverless functions. | Institution-scoped requests from signed-in members of a connected institution. Action bodies are encrypted before they are stored. | Only once an institution enables it |
| Anthropic (Semester’s key) | Subprocessor | AI features for signed-in students who have not supplied their own key, metered per account. | The text of the AI request the student made (for example a syllabus to turn into a course). | When signed in |
| OpenAI (institution-approved) | Institution-directed | AI over approved course sources, through the gateway, once an institution approves the provider and a budget. | The student’s request and the approved sources it cites; never data classified above what the institution’s rules allow to that destination. | Only once an institution enables it |
| The institution’s LMS (LTI 1.3 platform) | Institution-directed | Course launch, deep linking and, where an instructor placed a graded link, a quiz score. | Launch verification traffic; a score only for a graded link the instructor placed. | Only once an institution enables it |
| Anthropic (student’s own key) | Student-directed | AI features using a key the student entered on their device. | The student’s AI request, sent from their browser under their own key. | Only when the student turns it on |
| OpenAI (student’s own key) | Student-directed | AI features using a key the student entered on their device. | The student’s AI request, sent from their browser under their own key. | Only when the student turns it on |
| Microsoft | Student-directed | Signing in with Microsoft, and connecting the student’s own Outlook calendar and mail. | Whatever the student’s own Microsoft account returns to their browser, read under the permission they granted. | Only when the student turns it on |
| Google | Student-directed | Signing in with Google, and connecting the student’s own Google calendar, mail and tasks. | Whatever the student’s own Google account returns to their browser, read under the permission they granted. | Only when the student turns it on |
| Zoom | Student-directed | Connecting the student’s own Zoom meetings. | The student’s own meeting list, read in their browser. | Only when the student turns it on |
| Apple | Student-directed | Signing in with Apple. | The sign-in exchange the student starts. | Only when the student turns it on |
| OpenStreetMap tile servers | Student-directed | Map images when the student opens the map. | The student’s IP address and which map area is being viewed. | Only when the student turns it on |
| Nominatim and Photon (address lookup) | Student-directed | Turning a typed address into a map position, and only if the student switched lookup on. | The text the student typed into the lookup box; their position only if they separately switched reverse lookup on. | Only when the student turns it on |
| Calendar and Canvas hosts the student links | Student-directed | Reading a calendar feed or Canvas instance the student pasted, relayed because those hosts refuse browser requests. | The request to the address the student supplied, with the token they supplied. | Only when the student turns it on |
| The student’s browser push service | Student-directed | Delivering reminders the student switched on. | An encrypted notification for the student’s device, via the push service their browser vendor runs. | Only when the student turns it on |
