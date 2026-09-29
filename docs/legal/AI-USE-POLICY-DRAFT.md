# Semester AI Use Policy — DRAFT

> **Not in force. Not reviewed by a lawyer.** A working draft for counsel, the
> privacy owner and the institutions Semester serves. It is the public,
> plain-language companion to the
> [AI Model Training and Data Use Policy](../trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md),
> which is the detailed version and prevails where they differ. Written from
> what the code does today: [`app/src/lib/context.ts`](../../app/src/lib/context.ts)
> decides what leaves your device. Do not publish or link it until the
> `terms-reviewed` gate in [`GO-NO-GO-CHECKLIST.md`](../GO-NO-GO-CHECKLIST.md)
> records a qualified review. Every `[DECIDE: …]` is a question only the owner
> or counsel can answer.

**Effective date:** [DECIDE]

## 1. Where Semester uses AI

To answer questions you ask the assistant, to turn a syllabus or reading into
deadlines and study material, and to explain or quiz you on course material.
AI never runs until you press something that asks for it. It is never used to
rank you or flag you as "at risk". [DECIDE: a rule on AI in grading — none
refuses it today; see `docs/operating-model/AI-GRADING-AND-INTEGRITY.md`.]

## 2. What is sent, and to whom

When you press an AI button, Semester sends only what that request needs: your
question, today's date, your course list, and the material you asked about.
It does not send your API keys or tokens, your notes or drafts unless the
question names them, anyone else's name, or your grades unless you asked about
them.

It goes to **Anthropic**, using Semester's key — or, if you entered your own
key, to **Anthropic or OpenAI** under your agreement with them. Where your
school approves it, AI over course materials may use **OpenAI** under your
school's agreement. Each provider is listed in the
[Privacy Policy](PRIVACY-POLICY-DRAFT.md) and the
[subprocessor register](../SUBPROCESSORS.md).

## 3. Training

**Semester does not use your content, your school's records, or your AI
conversations to train AI models, and does not let its providers do so.** Any
exception would need a separate written agreement with your school and your
opt-in; none exists.

## 4. Your conversations

Your assistant conversations are kept on your device, not on Semester's
servers. Delete them there. A school's deployment may keep a monthly count of
AI use for its budget, under the retention its AI policy sets.

## 5. Rules set by your school and your instructor

A school can choose which AI providers are allowed, set a budget, or switch AI
off. An instructor can set a course's AI use to allowed, allowed with
disclosure, required, or not allowed, and can publish rules the assistant shows
before it answers. A course's rules can let AI produce final answers to
assessments only if the instructor confirms it by name. You remain responsible
for following your course's rules.

## 6. Limits

AI can be wrong. Answers show where they came from and how strong the source
is; check anything that matters — a deadline, a requirement, a grade — against
your syllabus, your instructor or your school's official systems. Semester
never presents AI output as official information from your school.

Anything the assistant proposes to do — add a deadline, change your plan — is
shown to you first and happens only if you press it.

Text from documents you give the assistant is treated as material, not as
instructions to it.

## 7. Switching it off

Semester can switch AI generation off for everyone or for one school at once
if something goes wrong. The rest of the app keeps working.

## 8. Problems

Report a wrong or harmful answer from the assistant, or email
harrisonjrubin7@gmail.com [DECIDE: dedicated address]. [DECIDE: an AI incident
process — none is written yet.]
