# Open-Source Inventory

| Control | Value |
| --- | --- |
| Status | **CONTROLLED DIRECT INVENTORY — TRANSITIVE SBOM/LICENSE REVIEW INCOMPLETE** |
| Owner | Harrison Rubin — engineering supply-chain primary; backup reviewer and qualified license counsel unassigned |
| Evidence date | 2026-10-03 at repository revision `62d37c2f` |
| Machine sources | `app/package.json`, the root `package.json` and `package-lock.json` (npm workspace root), workflow action revisions and repository license files |

## Direct runtime packages

| Package | Declared version | Use | Review state |
| --- | --- | --- | --- |
| `@supabase/supabase-js` | `^2.117.2` | authentication/database/function client | version locked transitively; license/security/current artifact review required |
| `fflate` | `^0.8.3` | compression/archive handling | review required |
| `leaflet` / `@types/leaflet` | `^1.9.4` / `^1.9.22` | maps and TypeScript definitions | review required; map/provider assets reviewed separately |
| `mermaid` | `^12.0.0` | diagram rendering | dynamically loaded; transitive and content-safety review required |
| `openai` | `7.23.0` | server/provider client | exact direct version; provider/data terms separate from software license |
| `pdfjs-dist` | `^6.3.289` | local PDF parsing/rendering | high-risk parser; security/license review required |
| `react` / `react-dom` | `^19.3.0` | application interface/runtime | review required |

## Direct development packages

`@types/node`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `axe-core`, `jsdom`, `jsqr`, `oxlint`, `qrcode-generator`, `typescript`, `vite`, and `vitest` are declared development dependencies. Their shipped/not-shipped status must be confirmed against the production artifact rather than inferred from the manifest.

## Required inventory process

Generate an exact-SHA SBOM from the clean lockfile install; include direct/transitive versions, resolved source/integrity, license expression/text, runtime/build/test scope, artifact inclusion, maintainer/provenance, known advisory/reachability and owner/decision. Inventory pinned GitHub Actions, vendored fonts/media/code and generated bundles separately. Re-run on lock/action/vendor changes and every release candidate.

## Evidence state

**Code/config evidence.** Direct manifests, a committed lockfile, pinned workflow-action revisions and clean-install CI provide reproducibility inputs.

**Operational evidence.** No current reviewed full transitive SBOM, license-notice determination, artifact composition, advisory reachability or counsel approval is filed for the release candidate.

**Missing test/proof.** Generate and sign the exact-SHA SBOM/license report, reconcile transitive/advisory/artifact findings, publish required notices and obtain security/counsel approval for exceptions.

## Claim ceiling

Semester may list these direct declared packages and say the lockfile fixes resolved versions for a clean install.

## Prohibited claims

Do not claim this is a complete SBOM, that all packages are shipped, vulnerability-free or license-compliant, or that notices are complete until the missing review is filed.
