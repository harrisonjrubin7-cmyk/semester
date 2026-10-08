# Shared brand and token strategy

Status: proposed. One semantic system for the public site, pilot/sales pages, Trust
Center, the app and the operations console, and (where practical) email and PDF.

## 1. What exists

Tokens are **CSS-first**: per-ground primitives written on `:root` by
`lib/look.ts::tokensFor`; fixed scales in `styles/app.css`; semantic and a minimal component
layer in `styles/tokens.css`; a generated `design-tokens/semester.tokens.json` for
Figma/native parity, with a drift test (`lib/tokenexport.test.ts`). `docs/DESIGN-TOKEN-ARCHITECTURE.md`
states that a `tokens/primitive|semantic|component/` file tree was deliberately **not**
built. `company-site/site.css` hand-copies a handful of values and is tied to the app by
tests (`companysitebrand.test.ts`: six `--brand-*` names in both; `--serif:'Cinzel'`,
`--sans:'Barlow'`, `--brass:#d8c79a`; fonts byte-identical).

## 2. The direction in the brief versus the brand that exists

The brief asks for indigo/blue-violet as the primary action colour. The established public
identity (BRAND-PLATFORM §2.2, Tier A; 1 October brand alignment) is **Graphite
`#16181C` with Brass `#D8C79A`** and Cinzel/Barlow, and the same brief says not to create a
disconnected identity. These conflict. Indigo is not absent: `ink` is one of the app's 11
accents. **Recommendation: keep Graphite/Brass as the public identity and treat indigo as
an available accent, not a replacement.** Changing the public identity is a brand decision
that touches `BRAND-PLATFORM.md`, `companysitebrand.test.ts` and every screenshot; it is the
owner's call and is listed as an open decision (backlog D-1). Nothing in this phase changes colours.

The rest of the brief's visual direction is already how the repository works: calm neutral
surfaces, status colours only for status (`--status-*`), real product screens as proof, no
confetti, visible focus (`--focus-color`, 2 px, offset 2 px), reduced motion zeroing the
`--motion-*` tokens, one type hierarchy across product and marketing.

## 3. Layer mapping

| Layer (brief) | Where it lives today | Gap |
| --- | --- | --- |
| Primitive | `tokensFor` output (`--app-*` per ground), `app.css` `--type-*`, `--sp-*`, `--lift-*`, `--ease`, `--fast` | none structural |
| Semantic | `tokens.css`: `--surface-*`, `--text-*`, `--border-*`, `--action-*`, `--status-*`, `--focus-*`, `--target-*`, `--layer-*`, `--elevation-*`, `--shape-*` | no `inverse`/`disabled` pair audited for marketing surfaces |
| Component | `tokens.css`: `--card-*`, `--bar-*`, `--sheet-*` only. Policy: "added when a second component needs the same decision" | **marketing now is that second consumer**: button, form input, badge, nav, alert, CTA, table |
| Marketing expression | none | hero, pilot, resource, proof and trust surfaces |
| Theme | 13 grounds, 11 accents, device match, `prefers-contrast: more`, forced-colors | company-site has only dark |

## 4. Plan

1. **Do not create a parallel source of truth.** Add `app/src/design-tokens/*.ts` as a
   **typed read layer** that re-exports names and values from `look.ts`/`tokens.css`
   (`colors`, `typography`, `spacing`, `elevation`, `motion`, `breakpoints`, `semantic`,
   `components`), and a test that fails if a name drifts from the CSS or from
   `semester.tokens.json`. These files exist so TypeScript components reference tokens by
   typed key, and so the `semantic.ts`/`components.ts` structure the brief asks for exists,
   without a second place to edit a hex value.
2. Add the **marketing expression** tokens in `tokens.css` as aliases of semantic tokens
   (`--mk-hero-surface`, `--mk-pilot-surface`, `--mk-proof-surface`, `--mk-trust-surface`,
   `--mk-resource-surface`), each measured against **every surface it can sit on**
   (CLAUDE.md: both contrast rungs have been wrong by measuring only the flattering
   surface). Extend `lib/contrast.test.ts` rather than adding a new method.
3. Add the missing **component** tokens (button, input, badge, nav, alert, CTA, table) when
   the first marketing component needs them. Each is an alias, never a literal
   (`tokens.test.ts` forbids colour literals in `tokens.css`).
4. **Make company-site consume the same file.** Replace its hand-copied `:root` with a
   generated stylesheet from the same exporter, so `companysitebrand.test.ts`'s byte-equality
   idea extends from fonts to colour. If the public site moves to `app/src/site` (IA §4) this
   is automatic, because it already uses the app's tokens.
5. Add a **light and a high-contrast public theme** (`prefers-color-scheme`,
   `prefers-contrast`, `forced-colors`). The app already does; the public site does not.
6. Email/PDF: export the same JSON to an inline-style generator later; out of scope now.

## 5. Rules for new marketing, sales and Trust Center components

Semantic tokens only; no hard-coded colour, font-size, spacing or radius; status colours
only for status and never alone (icon or text too); every state in the validation table
(idle, focused, valid, invalid, submitting, server error, success, disabled) is styled by
tokens; 24 px minimum target (`--target-min`), 44 px for primary; focus ring never clipped
and never covered (`--focus-clear-top/bottom`); motion through `--duration-*`/`--ease-*`
only, so reduced motion applies automatically.

## 6. What a `design-tokens/` TS layer must not do

Define a value that is also in CSS; export a colour that bypasses `tokensFor`; be edited by hand when
the JSON is regenerated. A test enforces the first and third.
