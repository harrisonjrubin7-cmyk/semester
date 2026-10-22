# AI model routing

_Semester design, intelligence, workflow and data system · 2026-10-05 · Source: uploads/expand further on brand identy algorthims workflow.pdf, reconciled with this design system (readme.md, tokens/, components/). Where they differ, this design system wins and the difference is listed._

> Semester should make an institutionally complex world feel personally clear.

Request → data classification → tenant provider policy → course AI policy → cost/latency → required capability (reasoning, research, writing, code, retrieval, summarization) → approved model/provider → fallback model or human hand-off.

**Router shows:** chosen provider/model and why, what context was shared, which sources were used, whether data was retained, cost impact, fallback behaviour. Student records are never sent to a provider (red-team tested). Code: semester-core/aigateway.ts.
