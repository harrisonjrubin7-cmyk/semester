# Crisis response runbook

Code: `app/src/community/crisis.ts`.

## The notice, shown verbatim on every report form and crisis-adjacent surface

> If someone is in immediate danger, contact local emergency services or your
> campus emergency/safety service now. Semester Community is not monitored as
> an emergency-response service.

## Handling

1. **Routing.** P0 and P1 go to professional Trust & Safety only
   (`professional_urgent` and `professional`). Volunteers never see them.
2. **First action.** Apply the minimal reversible intervention: a temporary
   hold, and preserve evidence.
3. **Crisis language.** A detector hit is a `possible_concern`. It routes to a
   professional, and the author is offered support resources. Keyword matches
   are never treated as a diagnosis or an enforcement reason.
4. **Evidence.** Preserve it in the restricted case store, with a retention
   date.
5. **Escalation to the institution** follows
   [CAMPUS-ESCALATION-POLICY.md](CAMPUS-ESCALATION-POLICY.md). It is off by
   default.
