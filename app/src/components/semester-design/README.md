# Semester archive component layer

This directory integrates the component source supplied in **The Main Semester design system (2) copy 4.zip** (SHA-256 `12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086`).

The archive is reference input, not an authority over application behavior. The production authorities remain:

- appearance and semantic roles: `src/lib/look.ts` and `src/styles/tokens.css`;
- routes and navigation: `src/lib/route.ts`, `src/screens.tsx`, and `src/lib/nav.ts`;
- permissions and institutional facts: server capabilities, RLS, audit, and authoritative payloads.

Use components through `index.ts` and render them inside `SemesterDesignSurface`. The surface is a CSS containment boundary; it maps archive role names to the current semantic tokens and prevents same-named archive selectors from changing existing Semester screens.

The copied `.d.ts` files are the public contracts. Source prompts and archive instructions are intentionally excluded. HTML component cards remain as visual reference only and are not executed.
