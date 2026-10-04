# Inclusive content and plain-language standard

Companion to [PROGRAM.md](PROGRAM.md). **Proposal, 2026-10-04.** For everyone who writes anything a person
meets in Semester: product copy, errors, emails, notifications, help, release notes, AI output templates, tenant
content, public pages. It is the content half of U-27 (ACCEPTANCE-CRITERIA) and the plain-language mode in
[../LOCALIZATION-PLAIN-LANGUAGE-INTERNATIONALIZATION.md](../LOCALIZATION-PLAIN-LANGUAGE-INTERNATIONALIZATION.md).
Vocabulary of the product (the five destinations, the retired terms) is enforced by `app/src/content/terms.ts` and
`npm run lint`; this page covers how to write, not which words.

## 1. Who we write for

A first-generation student at 11pm with a deadline. A guardian who reads English as a third language. A student with
dyslexia, ADHD, anxiety, a brain injury or low vision. A person using a screen reader who hears every word in order.
A staff member who needs to be sure what a setting will do. Write so the most tired and least familiar of them
succeeds on the first read, and nobody else loses anything.

## 2. The rules

### Plain language

1. **Say the main thing first.** Put the decision, deadline or consequence in the first sentence.
2. **One idea per sentence; one task per screen.** Aim for 15 to 20 words a sentence; shorter in errors and buttons.
3. **Target a lower-secondary reading level (about grade 7 to 9)** for interface and help; measure it, do not
   guess. Legal and policy text keeps its precision and is followed by a plain summary.
4. **Use the words a student uses.** "Hold" before it has been defined is jargon; define it once, link the
   definition, and use the same word for the same thing everywhere. A glossary (a data file, school-overridable)
   holds "bursar", "hold", "audit", "add/drop", "waitlist", "prerequisite".
5. **Active voice, present tense, direct address.** "You can drop this course until 14 October", not "Course
   withdrawal may be effected prior to the deadline."
6. **No idioms, sarcasm, metaphor or culture-bound references** in interface text: they fail in translation and
   for many neurodivergent readers.
7. **Spell out and define abbreviations** on first use, and wrap them in `<abbr>` with a title only where it
   helps. Do not rely on a tooltip for the meaning.
8. **Numbers and dates are written for the reader and the reader's reader.** "Tuesday 14 October, 11:59 pm Central
   time", never "10/14" alone; currency with its symbol and code where ambiguity exists; units written out.
   Dates, times and numbers go through `lib/locale.ts`, which already isolates mixed-direction values.

### Tone and safety

9. **Be direct, kind and unhurried.** No urgency pressure ("Hurry!", "Last chance!"), no guilt ("Don't you want
   to…"), no shaming copy. A missed deadline is described, then the way forward.
10. **Say what happened, why and what to do** in errors, in that order, with a way to fix it. Never blame the user.
    Never "Something went wrong" without the next step.
11. **Say what an action will do before it does it,** and what it will not do. Irreversible actions say so.
12. **Never use fear of failure as a nudge.** Wellness-aware content is opt-in and never diagnoses.
13. **Respect the person's own words.** Use the name, pronouns and language the person gave. When pronouns are
    not given, use *they* / *them*. Never infer gender, ethnicity, disability or age from a name.

### Inclusive language

14. **Person-first or identity-first as the person chooses; default to the community's own preference where it is
    known, and to neutral wording where it is not.** Say "a person who uses a wheelchair", not "wheelchair-bound";
    "a person with a disability" or "disabled person" following the reader's own usage.
15. **Do not use disability, illness or mental health as a metaphor** ("blind spot", "crippling", "insane",
    "crazy", "lame", "tone-deaf", "OCD about it"). Use the plain word for the thing.
16. **No gendered defaults,** no "guys", no "he" for an unknown person. Use "you", "they", or the role.
17. **No assumptions about family, money, ability, housing, immigration status or background.** "Parents or
    guardians", "the person who pays your bill", "your support network".
18. **Examples are varied and realistic.** Names, majors, backgrounds and life situations vary across examples
    and none is a stereotype. Sample data does not repeat one demographic.
19. **Avoid ableist and ageist assumptions about technology.** Do not say "simply", "just", "obviously", "easy".

## 3. Structure and layout

| Element | Standard |
| --- | --- |
| Headings | Describe the section ("Your deadlines this week"), sentence case, in order from `h1`; never skip levels; never a styled `div` |
| Paragraphs | Short; left-aligned; no justified text; no all-caps sentences; no italics for blocks |
| Lists | Real lists for steps and options; numbered when order matters; four to seven items |
| Links | Describe the destination ("Download the 2026 course catalogue (PDF, 2 MB)"); never "click here" or a bare URL in text; mark new windows and file types |
| Buttons | A verb and an object ("Save plan", "Drop MATH 201"); not "OK" or "Submit" alone where a clearer verb exists |
| Tables | Used for data only, with headers and a caption; a short summary sentence precedes a complex one |
| Instructions | Not by shape, colour or position alone ("the round green button on the right"); name the control |
| Emphasis | Bold for the one thing that matters; not colour alone; not capitals |
| Tooltips | Never the only home of a necessary instruction |
| Emoji | Not required to understand; if used, never in place of a word, never several in a row, and never as the only label |
| Language | The `lang` attribute follows the text; passages in another language are marked |

## 4. Images, icons and graphics

- **Informative image:** alt text that says what a reader needs to know from it, in a sentence, not "image of".
- **Decorative image:** empty alt (`alt=""`) or hidden from assistive technology.
- **Complex image (chart, diagram, map, schedule):** a short alt text that names it and says where the long
  description is, and the long description as text or a table beside it.
- **Icons:** carry text beside them; an icon-only control has an accessible name a person would say aloud.
- **Text in images:** not allowed for content (flyers, banners, schedules); if an organisation uploads one,
  a text version is required.
- **Screenshots:** described, and the interface text in them is also in the surrounding prose.
- **Maths and code:** MathML or the platform's maths with a spoken form; code in code blocks with a language
  label; never an image.
- **Alt-text authorship:** a human edits any machine-generated alt text before it is published. Alt text is
  checked in review: does it say what the image *does* in this place?

## 5. Media

- **Captions:** accurate, human-corrected, with speaker identification and meaningful sounds ("[door closes]").
  Auto-captions are a draft, not a deliverable.
- **Transcripts:** next to the media, with headings and speaker names, searchable; for audio-only and
  video-only content they are the equivalent.
- **Audio description** for any visual information not in the audio, or a described transcript; a script
  that can be read aloud ("As he says this, the chart on screen shows…").
- **No autoplay;** sound off by default; controls reachable; speed control.
- **Live events:** captions on by default for scheduled events, and a CART request route; recordings follow the
  prerecorded rules before they are posted.
- **Audio features of the app** (read-aloud, audio guides) have transcripts and respect the user's speed and
  voice setting.

## 6. Documents, emails and exports

- **PDF:** tagged, with a document title, language, headings, table headers, alt text, a logical reading order and
  a bookmark list if over a few pages. A scanned image of text is not a PDF.
- **Slides and spreadsheets:** built-in slide titles and reading order; no merged cells in data tables;
  sheet names that describe the sheet.
- **Email:** semantic HTML and a plain-text part; a descriptive subject that puts the action first; no information
  only in an image; links that describe their destination; a text size of at least 16px; sufficient contrast in
  light and dark.
- **Notifications:** readable alone, with the action and the deadline in the first line; the channel is the
  user's to choose.
- **Data exports:** machine-readable (CSV, JSON) and a human-readable accessible version.

## 7. AI-generated content

- **Same rules, applied by prompt and by check.** The system prompts for study material, summaries and
  explanations ask for plain language, headings, lists and tables as markup, defined terms, and no idioms. Outputs
  are checked against the criteria that can be checked (headings, link text, alt text, reading level).
- **State what it is:** AI-generated text is labelled as such and shows its sources as named links
  (`AI-TRANSPARENCY-AND-USER-NOTICE.md`).
- **Simplify on request, always:** "make this simpler", "shorter", "read it to me", "explain it step by step"
  are first-class actions, available without disclosing why.
- **No health, disability or capacity inferences,** and never a tone that infers frustration or diagnosis.
- **Uncertainty is stated in words,** not by a score alone.
- **Translation:** machine translation is labelled, and the original is one click away; the original language
  is preserved in `lang`.

## 8. Translation and international readers

- Every interface string is a message with a stable id, so a plain-language variant and each locale are
  alternate messages with the same id. Each translated string records its provenance
  (`official_translation · machine_translated · student_entered`).
- Do not concatenate fragments to build sentences; do not embed text in images; leave room for expansion
  (translations commonly run 30% longer); test right-to-left layouts and mixed-direction values.
- Dates, numbers and currencies go through `lib/locale.ts`; time zones are stated.
- Names and addresses: allow one-word names, long names, non-Latin characters and no "first / last" assumption.
  Never reject a name for its form.
- Machine translation of legal or safety text is not shown without a "translated by machine" label and the
  original beside it.

## 9. Checks

| Check | When | How |
| --- | --- | --- |
| Reading level and sentence length | Per copy change and each release | A readability script over the message catalogue (to be added); advisory under grade 9 on interface text, blocking over grade 12 |
| Banned and flagged phrases (idiom, ableist metaphor, urgency, "simply/just") | Each pull request | Added to the vocabulary rule beside `terms.ts`, with a control that plants one of each |
| Heading, link-text and alt-text checks on tenant content | Before publish | Authoring-flow validation (R-FAC-1, R-STF-4) |
| Plain-language review | G0 for any new screen | A content champion reads the screen text aloud, in order, as a screen reader would |
| Panel read | Quarterly | Dyslexic, ADHD, autistic, deaf and non-native English readers (E20) |
| Caption and transcript presence | Media import | Blocks publish; marks "Captions missing" and files a request (ISSUE-PROCESS §6) |

## 10. A short checklist for any piece of copy

```text
- Does the first sentence say what matters?
- Would a tired first-year understand every word without a definition?
- Is every term used the same way everywhere, and defined once?
- Could a screen reader read it aloud, in order, and be understood?
- Does it say what will happen, what won't, and what to do next?
- Is there a way out, a way back and a human route?
- Is any colour, shape, position or sound carrying meaning alone?
- Does it assume anything about the reader's body, family, money, language or past?
- Would it survive translation and a text size of 200%?
```
