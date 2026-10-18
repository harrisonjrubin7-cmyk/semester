# RB-01 · App unreachable or serving the wrong build

Class C1 · role platform · alerts `probe:public-failed`, `probe:half-configured`, `probe:no-recent-run`, `burn:today_load`, `burn:search` · components `github-pages`, `web-app`, `status-page`, `pipeline:production-smoke`.

## Symptom

The hourly production probe fails, the status page shows the app down, or a student reports a blank page, a stale version, or a route that fails after first render.

## Impact

First visits and updates fail. Anyone with the app installed or cached keeps working offline from the device store, so the student's own week is not lost; shared features resume when the app can reach the server.

## Diagnose

1. Open `app/public/status.html` in a clean browser. It probes the app, sign-in and the database API from your browser, with `no-store`, so it is not answered from the app's own cache.
2. Read the last `Production smoke` run in Actions. A failure in the `public` job names which of the bundle and the REST API failed; a missing run means the scheduler skipped (alert `probe:no-recent-run`).
3. Check the last `Deploy to Pages` run and GitHub's own status. A deploy refused as a stale release is a safe refusal, not a fault.
4. Compare the live build stamp with the commit you expect. A wrong build with a healthy host is a bad deploy: go to RB-08.

## Mitigate

1. If the host is down and GitHub reports an incident, do nothing to the app. Write the incident into `app/public/status-incidents.json` by hand so the status page says it.
2. If the deployed build is wrong, redeploy the last good commit: Actions → *Deploy to Pages* → *Run workflow* on the earlier commit (measured at 76 to 180 seconds in [ROLLBACK.md](../../../ROLLBACK.md)).
3. If only the REST API fails, it is the database: go to RB-03.
4. If students are mid-edit and the fault is on the server, set `VITE_READ_ONLY=true` and redeploy so clients stop writing while it is fixed (see ROLLBACK.md, *Read-only mode*).

## Escalate

Today the owner is also the only responder, so there is nobody to escalate *to*: say so in the incident record rather than implying a second line exists. When a backup is named in the role holders table, page them after 15 minutes without a mitigation. P0 (data exposed, cross-tenant access, destructive loss) goes straight to [SECURITY.md](../../../SECURITY.md) and counsel via `LEGAL-REVIEW-QUEUE.md`.

## Verify

- A clean browser loads Today and signs in.
- The next hourly probe is green, or you dispatched it manually and it is.
- The incident entry, if you wrote one, is closed with the time it ended.

## After

Open a postmortem from [the template](../POSTMORTEM-TEMPLATE.md) if this was P0 or P1, or if it burned more than 10% of any journey's monthly budget. Record the one-line result in `CHANGELOG.md`, including that it was fine.
