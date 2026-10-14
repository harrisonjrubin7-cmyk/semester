# Curriculum portal commit candidate
Additive synthetic preview; not a replacement for course-engine/workflow-lab. No production routing, database migration or learner execution endpoint.

Build: cd curriculum-portal && node build.mjs. Serve dist over HTTP. Test: python3 test_runner.py. Trusted local feedback: python3 grader.py --week 3 --submission starter.py --report result.json. Obtain starter from the portal. All 16 visible contracts are in curriculum.json. Stubs intentionally fail until completed.

CI runs controlled synthetic harness tests and static build only. It does not run learner submissions. The action pin is copied from the inspected existing course-engine workflow. Production-grade grading requires a separately approved isolated runner; no Docker execution was possible in the current environment.

Vercel preview plan: separate protected project in harrison22; rootDirectory curriculum-portal, framework null, installCommand empty, buildCommand node build.mjs, outputDirectory dist. Deploy the approved branch at its new exact commit SHA. Never modify the existing services project or promote this prototype to production. Commit and project/deployment actions need separate approvals.

This regenerated candidate is not byte-identical to the earlier downloadable pack. It preserves 16 weekly contracts, starter downloads, syllabus, architecture, feedback harness and CI checks. Complete console OpenAPI/PDF pack is not included. Week 3 explicitly uses the stricter revised contract.
