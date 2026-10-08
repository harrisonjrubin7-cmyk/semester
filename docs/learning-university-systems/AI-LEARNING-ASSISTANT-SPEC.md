# AI Learning Assistant Specification

The assistant supports Explain, Hint/Socratic, Practice, Review, and policy-permitted Draft. It must return: task performed, sources used, confidence/limitations, editable output, verification step, and human/official handoff when needed.

It must never determine grades, standing, enrollment, aid, accommodation, discipline, diagnosis, or eligibility. It must refuse source fabrication and assessed-work substitution. Course policy caps the available modes. The student chooses sources and can remove context, reject output, report an issue, and continue without AI.

Acceptance: grounded-answer tests, citation fidelity, unsafe-request tests, policy-cap tests, accessibility tests, latency/error/retry behavior, provider outage fallback, privacy logging, and model-change regression.

---

Evidence baseline: `origin/main` at `8ccf55af`, assessed 2026-10-03. “Implemented” means repository evidence, not institutional approval or observed production operation.
