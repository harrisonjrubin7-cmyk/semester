# Account linking and identity privacy

Status: **LTI linking BUILT. SSO first-login binding BUILT. Personal ↔
institutional linking for SSO accounts NOT BUILT.**

## The rule everything below follows

**An email match alone never joins two accounts.** An email claim is a string
some registered system sent. Anything that finds an account by it hands that
account to whoever can get one registration wrong.

## What exists

**SSO first login → SCIM membership.** `bind_institution_sso_membership` binds a
Supabase Auth user to a membership only when *all* of these hold. It is callable
only by the service role.

- the Auth session came from that exact `authorized` provider;
- the asserted email's domain is one of the provider's domains;
- a SCIM-provisioned, active identity in that tenant has that `userName`;
- the membership is not already bound to another user or another provider.

This binds an institutional login to its institutional membership. It never
touches a personal Semester account with the same address.

**LTI launch → Semester account.** Found by `(issuer, subject)` in
`lti_identity`. A new person gets a synthesised `…@lti.invalid` address that
cannot collide with, or be recovered into, a real mailbox. Linking to an account
the student already has requires a single-use `lti_link_ticket` redeemed from
inside a signed-in session. That makes it verified on both sides and explicit.

**LTI launch → institutional membership.** A launch joins a membership only
through a *linked* identity: the ticket above, redeemed by someone signed in to
their campus SSO account. A never-linked launch opens the `lti.invalid` account,
which no membership is bound to, so it cannot join, and nothing tries to join it
by email instead.

## Not built: personal ↔ institutional for SSO

A student who used Semester personally and then signs in with campus SSO has two
accounts. A link flow must:

1. require a live SSO session *and* a live personal session, with no email match;
2. show exactly what moves across and what the institution will be able to see;
3. keep personal and institutional data logically separate after linking;
4. allow unlinking where the institution permits, explain what access is lost,
   and offer an export first;
5. write an audit row for each step.

Until it exists, the two accounts stay separate, which is the safe default.

## Privacy defaults

- Peers never see legal name, campus email, student ID, affiliation or role.
- A verified-student badge exposes the fact, not the identifier.
- A faculty or course affiliation never widens access beyond that course.
- Institutional data is not used for advertising, behavioural profiling or
  unapproved AI processing
  ([ADR 0004](architecture/0004-ai-through-a-metered-gateway.md)).
