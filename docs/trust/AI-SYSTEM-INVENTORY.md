# AI System Inventory

| Control | Value |
| --- | --- |
| Status | **CONTROLLED BASELINE — REPOSITORY-INFERRED; DEPLOYMENT RECONCILIATION REQUIRED** |
| Owner | Harrison Rubin, AI Governance/Product/Security primary; backup `UNASSIGNED` |
| Evidence date | 2026-10-03 at repository revision `8fc5fd56` |
| Review cadence | Before activation; monthly while active; on any provider/model/purpose/data/tool change |

## Inventory rule

Every AI capability must have a unique entry before use. The record must name the feature and owner; intended and prohibited uses; user population; decision impact; provider, model/version, region and account owner; input, output, retrieval sources and metadata; retention/training terms; tools and writes; human oversight and non-AI alternative; risk tier; evaluation version/results; release approval; monitoring; kill switch; incident route; and retirement state. Unknown is a blocking value, not permission.

## Repository-observed system families

| ID | System family | Current repository evidence | Data / action boundary | Readiness and missing proof |
| --- | --- | --- | --- | --- |
| AI-01 | Student-facing Ask Semester / toolkit assistance | `app/src/ai/`, assistant/model configuration, prompt and structural injection tests | user-selected text and local context; proposed actions require user control; some paths may use Semester, student or institution credentials | **CONDITIONAL / not customer-approved.** Exact active routes, provider accounts, models/versions, regions, retention/training terms, notices, evaluation results and production monitoring are not reconciled here. |
| AI-02 | Institutional intelligence gateway | `app/server/institution/intelligence.ts`, `app/server/institution/intelligence-repository.ts`, `app/server/institution/providers/openai.ts`, gateway tests | tenant-scoped identity/policy, approved sources, structured answers and prepare/confirm/readback action design | **IMPLEMENTED_NOT_PRODUCTION_APPROVED.** No named institution approval, populated target policy, executed provider terms, complete target test or operated monitoring record. |
| AI-03 | Document extraction and study-content generation | extraction/toolkit modules and `app/src/lib/extractaccuracy.test.ts` | content supplied or selected by a user; extraction corpus tests only a limited function | **PARTIAL.** One labelled extraction corpus is not a complete feature evaluation, fairness review, accessibility proof or deployment acceptance. |
| AI-04 | Deterministic recommendation/ranking helpers that may be presented near AI experiences | governance/recommendation modules and planned evaluation harness | recommendations remain suggestions; no authority for high-impact or institutional decisions | **INVENTORY REVIEW REQUIRED.** Identify each algorithm, inputs, affected users, explanation, override, outcome and whether it is actually AI before activation. |

This is a family-level baseline, not a deployed-asset census. Each separately configured model, provider route, retrieval collection, prompt/tool set or materially different purpose requires a child entry and approval.

## Provider and model reconciliation

The [subprocessor register](../SUBPROCESSORS.md) identifies Anthropic paths using Semester or student credentials and an institution-directed OpenAI path. [`PROVIDER-TERMS.md`](PROVIDER-TERMS.md) records published terms and explicitly says none is signed. Model names in code are configuration facts, not proof of the model/version actually serving a target environment. Student-directed providers operate under the student's agreement and must be disclosed distinctly from Semester-controlled or institution-directed processing.

## Evidence state

**Code/config evidence.** Source files above, `app/src/lib/trust/subprocessors.ts`, `ai_policy`, `approved_source`, `feature_kill_switch`, gateway audit code and associated tests establish partial repository controls.

**Operational evidence.** A dated kill-switch exercise exists for a limited path. There is no complete export reconciling every live environment, provider account, model/version, region, prompt, retrieval source, tool permission, usage volume or owner.

**Missing test/proof.** Obtain target configuration exports; assign people to owner seats; enumerate every active route and prompt/tool version; link data flows, evaluations, approvals, notices, monitoring dashboards and incident owners; verify disablement and retirement; have the customer accept its scope.

## Claim ceiling

Semester may say it maintains a controlled, repository-derived AI system inventory baseline and identifies distinct provider-control models. The listed families may be described only with their recorded status and date.

## Prohibited claims

Do not call this a complete production inventory, software bill of materials, customer-approved register or proof of no shadow AI. Do not claim a provider/model is active, approved, non-training, zero-retention, region-bound or independently assessed without target evidence.
