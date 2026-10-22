# AI governance in the interface

Source: `docs/BRAND-PLATFORM.md` §6.1, `TRUST-CUES-AND-SOURCE-PRESENTATION.md` (AI presentation), `components/StudyStudio.tsx`.

**Stance:** assistive, source-linked, reviewable, interruptible. A tool, not a person. Name: **Ask Semester**. No human name, avatar face, sparkle orb or "I" in marketing.

## Every AI answer shows (AIResponse)
1. The label **AI-assisted** (violet chip, ✦) — always, wherever it speaks.
2. **Allowed data scope** ("Allowed to read BIO 210 materials, Your calendar"). The student can change scope before asking.
3. **Numbered sources** with their own provenance chips; inline `.ai-cite` markers.
4. **Confidence** and what it can't know ("time estimates are mine, not your instructor's").
5. **Request cost** and remaining allowance.
6. **Policy** that applies (course AI policy set by the instructor; institution switches).
7. **Actions** — anything that writes, sends, shares, pays or registers opens Dialog + ActionPreview first.

## Show the work
Use StepStatus ("Reading sources → Drafting → Matching quotations → Ready"), marking the step that failed. Never fake an instant, certain answer. No shimmer, no typing animation.

## Words
Say: "Ask Semester drafts a plan from the sources you gave it. Review it before you use it." · "It can be wrong. Check the source linked beside each answer."
Never: "AI-powered", "intelligent", "knows you", "accurate", "no hallucinations", "handles it for you", "Ask anything".

## Course policy
When an instructor restricts AI (e.g. outlining only), show it on the course workspace (object card "Course AI policy · set by instructor") and as a policy chip on every answer in that course; disable the disallowed actions with a reason rather than hiding them.
