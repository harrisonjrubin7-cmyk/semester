# Onboarding and lifecycle

The web-versus-native specifications say first value happens in the browser. An install is optional and later. This batch follows that.

## What is server-authoritative

Journey assignment, consent, membership, and an approved destination after sign-in belong on the server when an account exists. This batch does not add a server journey table.

## What may stay on the device

The registration plan is a draft the student typed. It is replaced by a catalog import when they have one. It is not a cache of a registrar record, because no registrar record was read.

Local storage and the device library are the existing persistence. The plan does not put a token in a URL.

## First-run doors

`FirstRun` still leads with “Add your first course”. The by-hand door remains only when no assistant key is configured (`keyless.test.tsx`). The new door, “Build your registration plan”, is offered with or without a key, because it does not call a model.

If the chosen client role has a first screen that is neither import nor the term plan, a third door opens that screen. Advisor opens meetings. Payer gets no extra door.

## Lifecycle this plan does not perform

Account linking, invite acceptance, role sunset, guardian expiry, employee offboarding, and developer retirement are specified in the role-flow PDF and in the operations lifecycle notes. They are not implemented by saving a course code.

Signing in, when the student later chooses to, is how the same device catalogue can move to another device. The form says that. It does not say that sign-in enrolls them.

## Resume

The courses remain in the catalogue. Returning to the Term plan with an empty registration catalog shows them again. There is no separate draft key to expire.
