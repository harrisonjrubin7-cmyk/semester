# Stream 28: Career OS + Interview Studio

Source: `docs/system/Career OS and Interview Studio.pdf`. Prototype: `#/student/interview` (`ui_kits/semester-app/CareerOS.jsx`). Extend the existing career stream (skills, evidence, opportunities, employer-approved evidence, feature switches, revocation tests); don't build a parallel system.

## Flow
Explore → skills + evidence → discover → apply → prepare → practice → interview → follow up → decide → transition → reflect. Shares account, Action Center, calendar/Master plan, search, education graph, notifications, AI gateway.

## Interview Studio
- One preparation record per interview: opportunity, JD source + retrieval date, stage/format, time zone, interviewers (only if provided), submitted résumé version, materials, goals, tasks, known / assumed / missing. Unknowns stay unknown.
- Briefing: org, role, required vs preferred, relevant experiences, recruiter questions, questions to ask, dated sources.
- Requirement → evidence table; missing evidence = gap, not proof of inability.
- Story bank: title, situation, task, actions personally taken, result, learned, individual vs team, evidence, competencies, confidentiality, approval. STAR optional. Never invent achievements; keep "I" vs "we".
- Plans by window (same day / several days / 1–2 weeks / none); prep blocks go through the Master plan, not silent overrides.
- 13 practice modes incl. human mock. Text, voice with editable transcript, optional video (no appearance scoring), adjustable timers, pause/skip/clarify, captions, low-bandwidth.
- Simulator asks, waits, follows up on what was said, labels every session simulated; generated questions never presented as employer questions.
- Feedback: separate dimensions (relevance, specificity, contribution, reasoning, evidence, structure, completeness, reflection, technical accuracy vs a reference) each with quote, observation, why, one change, retry. No hireability score; never infer personality, honesty, emotion, disability or employability from face, gaze, accent, pitch or pace.
- Loop: answer → feedback → choose one change → retry → compare → save or discard.
- Technical packs: sandboxed execution; published rubric + owner + reference; versioned; students can challenge feedback.

## Connected systems
Exploration (versioned competency framework, e.g. NACE), skill states (claimed / AI-suggested / evidence-linked / human-reviewed / issuer-verified, never merged), portfolio (private, role-specific, expiring share, revocation, attribution), Application Studio (fact bank, versions, every claim traceable), opportunity matching (eligibility separate from ranking, sponsorship disclosed), tracker (Saved → Preparing → Submitted → Screening → Interviewing → Offer/Rejected/Withdrawn/Closed; student vs source-confirmed updates), mentoring (opt-in, no mining private conversations), offers (student-weighted comparison; no legal/tax/immigration/financial authority).

## Workspaces and access
Career staff: assigned + student-shared only. Employers: approved evidence, expiring access; candidate scoring out of scope. Leaders: aggregate only; recordings/transcripts never analytics inputs.

## Open decision
Career stream says AI never receives student records; role spec allows policy-governed context. Start with student-selected material; institutional records need separately approved policy.

## Entities (reconcile with schema)
CareerGoal, CareerPreference, CompetencyFramework, SkillClaim, EvidenceArtifact, Verification, PortfolioCollection, ShareGrant, EmployerOrganization, Opportunity, Application, ApplicationDocumentVersion, Interview, PreparationPlan, Story, PracticeSession, PracticeResponse, FeedbackObservation, CoachReview, MentorProfile, MentoringRequest, Offer, CareerOutcome.

## 16-week curriculum + STAR rubric (Oct 7 2026)
Source: `docs/system/16-Week Interview Prep Curriculum.pdf`. Prototype tabs: Curriculum, STAR rubric (`cxoStar` emits the feedback contract).
- 16 modules (orientation → read the opportunity → inventory → STAR → individual action → results → résumé + evidence → mock I → story range → research → discipline-specific → follow-ups → mock II → format/logistics → final rehearsal → capstone), each learn → select → practice → inspect → retry → reflect → act. Deadline mode jumps to relevant weeks without marking the curriculum complete.
- Deliverables are targets, not readiness thresholds.
- Practice context preview shows exactly what the AI receives; never grades, accommodations, unrelated coursework, messages or institutional records.
- Voice: transcript → student correction → evaluate corrected text; flag if feedback depends on incomplete transcription.
- STAR rubric v1: situation 10, task 10, action 30, result 20, relevance 15, reflection 10, clarity 5; 0–4 anchors; 0 ≠ “couldn’t evaluate”. Contract fields: rubric_version, assessment_status provisional, dimensions[{dimension, score, supporting_quote, observation, suggested_retry, certainty}], claim_status, verification_status, student_review_required, human_review_required. Certainty isn’t a calibrated probability.
- Session states: draft, context approved, ready, in progress, transcript review, feedback available, retry, completed, archived/deletion requested, paused, interrupted, failed, review requested.
- Grading (only with institution policy + instructor): practice 25, story bank 20, résumé/portfolio 20, mocks 20, final packet 15. No points for offers, prestige, private disclosures or video. Humans own official grades, integrity, contested evaluations, accommodations, specialist judgments.
- Activation: compare with specialist ratings per dimension, test language variation and accessibility, publish appeal path. Tool registry per institution; no scraping vendor sessions.

## Vendor tools + interest-to-opportunity recommendations (Oct 7 2026)
Source: `docs/system/16-Week Syllabus - Vendor Steps and Recommendations.pdf`. Prototype: Interview Studio → Career tools; `#/student/discover` (`Discover.jsx`).
- Big Interview weekly mapping + Answer Builder/practice/assignment steps; Handshake milestones (wk 2, 6, 8, 10, 12, 13, 15) with real status (pending link, scheduling off, type unavailable, no times) and fallbacks; never mark incomplete for school capacity. No vendor data import without contract + verified integration; delivery metrics excluded from STAR grades.
- Weekly 10-point rubric; revised grade weights 30/20/15/20/15.
- Discover: optional inputs (interests, goals, style, hours, budget, kinds); authorized sources with owner + date; eligibility / relevance / feasibility / exploration kept separate; unknown eligibility = “check this”; visible editable weights (interest, goal, style, time, cost, freshness, burden); no prestige/price/popularity boosts; diversify with adjacent options; never infer protected traits; class cards show prerequisite, degree relevance, sections, conflicts; save / compare / not interested / ask organizer; joining/enrolling via owner workflows only. Practice weakness → STAR retry, not “join a club”.

## CS track rubric + technical modules (Oct 7 2026)
Source: `docs/system/CS Track STAR Rubric and Technical Modules.pdf`. Prototype: Interview Studio → CS track. 4-dimension rubric: situation depth 20, task ownership 25, action specificity 35, result quality 20; 0–4 anchors; score = Σ w·s/4 (all 3s = 75); show all four. Action verbs credited by the concrete work, not density. Results: supported measurement/qualitative full credit; unsupported metrics not rewarded; honest failures can score high; claim verification separate. Weeks 1–4 labs (pair-sum, frequency counting, balanced delimiters, debugging) with clarify → approach → implement → test → complexity → reflect; isolated runner in production. Weekly table pairs behavioral + technical strands with Big Interview (A–E are Semester labels) and Handshake milestones.

## Grading log (Oct 7 2026)
User files in `docs/system/`: `semester_cs_star_grading_dashboard.xlsx` (Read Me, Rubric, STAR Grades, Weekly Tracker, Dashboard, Sources), `star_rubric_criteria.csv`, `star_grading_template.csv`. Prototype: CS track → Grading log (16 weeks, template columns, 0–4 validation, weighted only when complete, reviewer / review state / claim status, Approved only for coach or instructor, CSV export with the template headers). Production stores grading records server-side with reviewer identity and audit.

## Evidence submission + teacher grading help (Oct 7 2026)
Source: `docs/system/STAR Grading Spreadsheet and Evidence Submission.pdf`. Submit the real Big Interview assignment; share links only when External Sharing is enabled (sensitive; Make Private revokes); no downloads. Handshake routes: appointment (office instructions), My Documents (≤1 MB, upload ≠ submitted), real Experience attachments only, staff notes are staff-side. Evidence packet fields listed in prototype. Teacher assist: AI-provisional per-dimension scores with quotes, flags, draft feedback, section consistency, queued retries; teacher sets final scores; dashboard averages final-approved only.
