# Semester design-system guide

## Principles

Semester is a calm academic workspace, not a dashboard theme. Preserve the
existing near-black, graphite, silver, and brass system; the serif/condensed
type pairing; course-derived accents; restrained elevation; and direct,
source-aware language. Add capability through shared primitives instead of
introducing a second visual vocabulary.

1. **Action before inventory.** Lead with the next safe action, then context.
2. **One source of truth, visibly named.** Imported, official, student-entered,
   estimated, and AI-derived information must remain distinguishable.
3. **Calm density.** Compact does not mean cramped; supporting detail may fold,
   primary actions may not disappear.
4. **Progressive disclosure.** The five canonical destinations are the spine;
   specialist tools open in context.
5. **Failure is a designed state.** Preserve work, explain what is stale or
   unavailable, and offer the official or human route.

## Foundations

### Color and material

Use semantic variables from the existing token layer for background, surface,
text, border, action, course accent, success, warning, and danger. Do not add a
hex value in a component when an equivalent semantic token exists. Brass is a
focus and action signal, not decoration. Course colors identify course context;
they do not encode success or error.

### Typography

- Serif display: major product/page statements and selected editorial moments.
- Condensed heading: navigation, compact headings, control labels, and dense cards.
- Sans: body copy, forms, data, and operational text.
- Mono: short identifiers, timestamps, and source metadata only.

Use one H1 for the active page. Heading levels describe structure, not visual
size. Keep body measures near 58–72 characters on wide screens.

### Spacing, shape, and elevation

Use the existing 4px-derived spacing scale. Prefer flow spacing and shared page
padding tokens over route-specific margins. Use the established corner setting
and sparse shadows. A border plus surface change should usually be enough; avoid
nested card-on-card treatments.

## Components

### Page and SettingsPage

Use `Page` for ordinary content routes and `SettingsPage` for settings children.
Supply one purpose, one primary action, and optional secondary actions. A screen
may use a specialized frame when it is genuinely a conversation, full editor,
quiz, map, or immersive session, but it still owes the shell landmarks, focus,
state, and responsive contracts.

### Actions

- Use the shared button/action components for intent, size, loading, and disabled states.
- One visually dominant action per decision region.
- Icon-only controls require an accessible name and the `.tap` expansion where
  their visual glyph is smaller than the required hit region.
- Destructive actions state the object, consequence, and recovery path.

### Forms

- Persistent visible label; placeholder is an example, never the only label.
- Field message is associated programmatically and survives validation changes.
- Use native input semantics where possible; do not imitate a select with a menu.
- At compact widths, fields stack. At wider widths, pair only fields that users
  naturally compare or complete together.
- Credentials and institutional setup show storage/scope and never imply activation.

### Navigation

Keep Today, My Path, Search, Plan, and Me as the canonical destinations. Use the
seven task areas in launchers and directories. Do not add a sixth global product
for a specialist feature. Back returns to the meaningful parent, not simply the
last incidental UI state.

### Feedback and trust

Use shared Loading, Empty, Error, Success, Progress, and Permission states. Empty
states say why the list is empty and offer a relevant action. Errors preserve
input and separate retryable failure from permission or configuration. Source
badges use the controlled vocabulary: institution verified, imported, student
entered, estimated, AI-derived, and needs review.

### Overlays

Popover, dialog, drawer, and bottom sheet behavior must share focus management,
Escape/Close behavior, outside dismissal, viewport containment, and focus return.
Triggers report `aria-expanded`, popup type, and a stable controlled id once the
controlled element exists. Do not portal content out of an otherwise empty
native disclosure.

### Lists, tables, and cards

Use a list when the dominant task is scanning or acting on rows. Use a table only
when comparing columns. On compact screens, preserve row identity and the first
action; allow the table region—not the document—to scroll horizontally. Cards
group a decision or object, not every paragraph.

## Accessibility contract

- One `main` and one visible H1 per active route.
- Skip link reaches the active main content.
- Keyboard order follows reading order; focus never lands under a sticky region.
- Visible focus uses the existing brass token and remains visible in forced colors.
- Pointer targets are 44px for primary touch controls. The project permits tested
  WCAG 2.2 AA 24px exceptions inside crowded composite controls where expansion
  would overlap neighbors; those exceptions require keyboard parity and a test.
- State is not communicated by color alone.
- Motion respects `prefers-reduced-motion`; no essential meaning depends on motion.
- At 400% zoom/reflow, primary tasks remain available without two-dimensional
  document scrolling.

## Content standards

Use student language: “what is next,” “where this came from,” and “who decides.”
Avoid claiming that Semester is the official gradebook, registrar, payment
system, or care provider. Company copy must distinguish built product, local
demo data, planned pricing, controlled pilots, approvals, and live operation.

## Contribution checklist

1. Place the route under an existing canonical destination and task area.
2. Add or update exhaustive route governance and document-title metadata.
3. Reuse a shared frame, state, action, form, and overlay primitive where applicable.
4. Define compact behavior before adding wide-screen density.
5. Verify keyboard, focus, names, landmarks, reduced motion, forced colors, and reflow.
6. Label provenance and permission boundaries.
7. Add behavior tests for any exception or new interaction pattern.
