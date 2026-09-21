# The pilot

Stage 1 of the build-out plan ends when the pilot has run for two weeks with no
open critical issue, staging proven, a restore drill done and analytics
reporting. This is the document for the half of that which involves people:
who is in it, what they are told before they start, what is being measured, and
what ends it.

## The owner

Harrison Rubin. Every conversation in here is had by the same person who wrote
the code, which is the main thing that makes a ten-person pilot worth more
than a thousand-person launch: the person who can fix it is in the room when it
breaks.

## What the pilot is for

Four questions, and they are not the same question.

1. **Does it work for somebody who is not me?** Every path in this app has
   been walked by its author, who knows where the edges are. The pilot is the
   first time that stops being true.
2. **Do the three figures move?** Activation, weekly active use, 30-day
   retention — defined in [`ANALYTICS.md`](ANALYTICS.md), which also says at
   length what they cannot tell you with ten people in the sample.
3. **Would anybody pay for it?** Separately measured, because retention and
   willingness to pay are famously not the same thing.
4. **Does the syllabus extraction actually hold up?** On real syllabi, from
   real courses, in departments that format them differently. The gate is
   ≥98% exact and 100% cited, and it is checked per syllabus by a person.

## Before anybody is invited

**Switch the invite gate on first.** Not after the first tester, and not
"when we're ready" — the gate is the difference between a pilot and an open
sign-up page with ten people in it.

```sql
select public.set_invite_only(true);
```

Then add each tester's address before they try to sign up:

```sql
insert into public.invites (email) values ('someone@vanderbilt.edu');
```

Both run in the dashboard's SQL Editor, as the owner. The switch is
deliberately not reachable from the app: `set_invite_only` is revoked from
`anon` and `authenticated`, and `grants.check.sql` fails if that ever stops
being true — because a gate anybody holding the publishable key can open is
not a gate. [`20260921002428_invites.sql`](supabase/migrations/20260921002428_invites.sql)
argues the whole design.

Two things the gate does not do, both worth knowing before relying on it:

- **It does not evict anybody.** The trigger is `before insert` on
  `auth.users`, so every account that already exists keeps working, invited or
  not. Turning it on mid-pilot locks out new sign-ups and nothing else.
- **It is state, not an inference.** An empty invite list does not mean
  "everybody" and does not mean "nobody". Somebody has to decide, and the
  decision is the boolean.

Check it is on with block 3 of [`supabase/health.sql`](supabase/health.sql),
which prints `invite_only` beside the account count. It is the kind of thing
that is easy to leave undone and impossible to see from inside the app.

## Who is in it

**Five to ten testers, across majors.** The number is small because the
bottleneck is one person's attention, not recruitment.

The spread across majors is the part that matters and it is not diversity for
its own sake: **a syllabus is a departmental artefact**. An engineering
syllabus is a table of dates. A humanities syllabus is four pages of prose
with the readings in a paragraph. A lab course has two schedules that
disagree. The extraction either handles all of those or it handles the ones
its author happened to take, and there is no way to find out which from the
inside.

So the target is roughly: two from a quantitative course, two from a
reading-heavy course, one with a lab or studio component, and the rest
whoever will say yes. A pilot of five economics majors would produce a
confident number about one format.

**Everybody signs the consent form below before their account is made.** Not
after, and not "when we get round to it": the form is what makes the data
collection something they agreed to rather than something that happened to
them, and the order is the whole of that.

## The Pilot Consent form

*Copy this into a document, fill in the date, and get a signature — email
back with "I agree" is a signature for this purpose, and keeping the reply is
keeping the record. One per tester, before their account is made.*

---

### Semester — pilot consent

**What this is.** Semester is a study app built by Harrison Rubin, a
Vanderbilt undergraduate. It turns a course syllabus into deadlines, a study
guide and practice material, and it uses an AI model (Anthropic's Claude) to
do that. You are being asked to use it for a few weeks and say what you think.

**Who is running it.** Harrison Rubin, harrisonjrubin7@gmail.com. **This is a
student project. It is not a Vanderbilt service, it is not endorsed by the
university, and it is not connected to any university system.** Nothing you do
in it reaches Brightspace, your registrar, your transcript or your instructors.

**What it will hold.** Whatever you put into it: your courses and their
deadlines, your notes, grades you type in, and your practice answers. It also
records three things about your use of it — which days you opened it, whether
you had added a course by then, and whether you had answered a card by then —
so that the four questions this pilot is asking can be answered. It does not
record which screens you open, what you type, or when in the day you use it.
The full privacy description is on the Privacy screen inside the app, and it is
the same one every user sees, not a special one for this pilot.

**What the AI part means.** When you ask for a study guide, practice questions
or an answer, the text you sent goes to Anthropic to be answered, and
Anthropic's terms govern what happens to it there. It is sent when you press
the button and not before. **The model can be wrong**, including about dates
lifted from your syllabus. Check anything that matters against the syllabus
itself — the app shows you where each item came from so that you can.

**Academic integrity is yours.** This app can draft and explain. Your course's
rules about what help is permitted are the rules, they differ by course and
instructor, and using this app does not change them. If you are not sure
whether something is allowed in a course, ask that instructor before you use
it there. Nothing in this pilot is a defence.

**What is asked of you.** Use it for your real courses for at least two weeks.
Say when something is wrong, in whatever way is least effort for you. Possibly
one conversation of twenty to thirty minutes about what you would pay for, if
you are willing — that is optional and you can be in the pilot without it.

**What you get.** Nothing. There is no payment, no course credit and no gift
card. If that changes, you will be told before it does.

**Leaving.** You can stop at any time, for any reason, without saying why. You
can delete everything yourself — Settings → Delete my account — and it deletes
your rows rather than hiding them. If you would rather I did it, email me and
I will, and I will confirm when it is done. Asking me to remove your feedback
from my notes works the same way.

**Being quoted.** Your feedback may be quoted in materials about Semester —
to advisers, in a pitch, in a write-up. It is anonymous unless you say
otherwise in writing: no name, no course, no detail that identifies you. Say
no and you are still in the pilot.

**Research.** This is product development, not a research study, and it has
not been reviewed by an Institutional Review Board. If any of it is ever
written up for publication or presented as research, that needs IRB review
first, and you would be asked again before anything of yours were used that
way.

**Age.** You confirm you are 18 or older.

**The honest bit.** This is early software with one person behind it. It will
have bugs. Something you typed could be lost. Do not make it the only place a
deadline exists.

---

Name: ______________________  Major/year: ______________________

Signature: ______________________  Date: ______________

☐ I agree to be in the pilot, on the terms above.
☐ Optional: I am willing to be quoted anonymously.
☐ Optional: I am willing to have a conversation about pricing.

---

## The ambassadors

Two or three, with tracking codes. An ambassador is a tester who is also
willing to hand the app to other people — the link is generated in the app and
the two numbers it produces are how many people arrived on it and how many of
them are still syncing.

The feature is built: [`app/src/lib/referral.ts`](app/src/lib/referral.ts) and
[`20260921002623_referrals.sql`](supabase/migrations/20260921002623_referrals.sql),
with `referrals.check.sql` proving what one account may learn about another —
an ambassador sees two integers and never who arrived.

**The paying half is deliberately not built,** and it should stay unbuilt until
two or three real ambassadors have been tracked by hand off exactly those
numbers. A referral scheme with money in it before anybody has referred
anybody is a scheme for gaming a number nobody is reading.

One thing to say to an ambassador out loud, because the invite gate makes it
true and the link does not: **while invite-only is on, their link cannot make
an account.** `signup_open` in `referral_standing()` reports it, so the app can
say so, but somebody who was told "share this" in week one and finds out in
week three will reasonably feel it was a waste of their effort. Either open the
gate for their cohort or tell them the link is for later.

## Willingness to pay

The plan offers a soft paywall or 20–30 interviews. **For this pilot it is
interviews**, and the reason is arithmetic: a soft paywall shown to ten people
produces a number out of ten, and the difference between "two of ten converted"
and "one of ten converted" is one person changing their mind.

The interview is twenty minutes and the only rule is to stop asking what they
*would* do.

1. What do you use now for this, and what does it cost you? *(Money, or the
   half-hour a week they spend making a calendar by hand.)*
2. Walk me through the last time you used Semester. *(Not "do you like it".
   The last time, in order.)*
3. What did you stop using when you started using this? *(If nothing, that is
   the finding.)*
4. If it were £X a month, what would you do? Then: what would have to be true
   for that to be worth it? *(The second half is the answer. The first is a
   number people are polite about.)*
5. Who else should have this? *(An ambassador, if they name somebody.)*

Anchor at the plan's own price — $3.99 a month or $29.99 a year — and vary it
between people rather than asking each of them about three prices, which
teaches them the game.

**What a stated-preference number is worth: very little on its own.** Twenty
people saying they would pay four dollars is not four dollars. What the
interviews are actually for is the *reason* behind the answer, which is the
thing that tells you what to build; the number only becomes real at Stage 2,
when there is a Stripe page and somebody either types a card in or does not.

## The extraction-accuracy audit

Every syllabus a pilot tester imports gets checked, by hand, against the
syllabus: **≥98% of extracted items exactly right, 100% of them citing where
they came from.**

By hand, per syllabus, because this is the one claim in the product that a
student's grade depends on. The repository's automated gate for it is
`app/src/lib/extractaccuracy.test.ts`, which holds the extractor against fixed
documents in several formats — that is the regression guard, and it cannot
tell you anything about a syllabus it has never seen. The pilot is the only
source of those.

Record each one: course, department, format (PDF, Word, HTML, photograph),
items found, items wrong, and what was wrong about them. A single miss with a
reason is worth more than a percentage.

## What ends the pilot

The plan's exit gate, restated so it can be ticked:

- [ ] Running two weeks or more with real testers on real courses
- [ ] No open critical issue
- [ ] Staging proven — a preview branch *compared against* production, six
      fingerprints, not merely one that built. [`STAGING.md`](STAGING.md)
- [ ] Restore drill done and timed — [`RESTORE.md`](RESTORE.md)
- [ ] Analytics reporting — [`ANALYTICS.md`](ANALYTICS.md), block 0 first
- [ ] Extraction audit on every pilot syllabus, at the gate above
- [ ] Willingness-to-pay conversations done and written up

And one rule for the whole of it, from the plan and worth repeating here
because a pilot is exactly where it gets broken: **never market a live
connection Semester cannot actually deliver.** Nothing in this app is
connected to Vanderbilt. The consent form says so in bold, and every
conversation with a tester should say it too.
