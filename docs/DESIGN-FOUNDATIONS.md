# Transcriber Design Foundations

Status: interim code-owned foundations for the extension workbench and Chrome
extension side panel. This file should move into the future Storybook/design
system package when that exists.

The versioned source lives inside the `transcriber-local` repo. The parent
Transcriber folder is local coordination only and is not the canonical git
source.

## Existing Design Docs Checked

- `../design/DESIGN-GOVERNANCE.md`
- `../design/DESIGN-AGENT-RULESET.md`
- `../youtube-transcriber-cloud/DESIGN.md`
- `docs/VISUAL-RULES.md`
- `docs/EXTENSION-DESIGN-CONTRACT.md`
- `docs/DESIGN-SYSTEM-EVALS.md`
- `extension-workbench/README.md`
- Figma `Transcriber`, typography node `88:153`
- Figma `Transcriber`, color palette node `88:71`
- Figma `Transcriber`, extension sandbox node `343:26`

The cloud `DESIGN.md` is the strongest existing product-level reference. The
Figma typography, color palette, and extension sandbox nodes are useful visual
references, but they must become real local Figma text styles, color variables,
and approved components before Figma can be treated as a design-system source of
truth. Current Figma button states are not approved and should be treated as
rejected/reference-only. This file narrows those rules for the extension side
panel and workbench.

## Source Order

1. Live extension code in `extension/popup.html`, `extension/popup.css`, and
   `extension/popup.js` owns current canonical behavior and visual primitives.
2. `design-system/tokens/` owns shared `--ds-*` foundation tokens.
3. `extension/foundations.css` maps shared tokens to extension compatibility
   variables such as `--bg`, `--panel`, and `--text`.
4. `app/globals.css` maps shared tokens to web/Tailwind compatibility variables
   such as HSL triplets for `hsl(var(...))`.
5. `design-system/tokens/motion.css` owns shared motion tokens.
6. `extension/ui-icons.js` and approved brand assets own icons.
7. `extension-workbench/` owns interim state coverage only after it matches live
   extension code exactly.
8. Figma owns visual exploration only until its typography, color, spacing,
   button, and component choices are backed by named styles, variables, and
   approved components.

Do not create a competing typography, color, spacing, icon, or motion rule in a
feature file.

## Figma Versioning

Do not overwrite older Figma artboards when promoting a design-system pass.
Duplicate the relevant frame or section, rename the original as legacy/reference,
and give the new section a dated canonical/WIP name.

Current extension sections:

- `Extension Sandbox - Legacy reference pre-token-binding`: historical reference.
- `Extension Sandbox - Canonical WIP 2026-06-23`: current token-bound extension
  sandbox.

Only the dated canonical/WIP section should be treated as leading. Older
artboards remain evidence, not source of truth.

## Required Eval

Before moving a prototype, workbench state, Storybook story, or Figma design
toward production, answer:

1. Have you deviated from the design system?
2. What are you least confident in right now?

Use `docs/DESIGN-SYSTEM-EVALS.md` for the full review format.

## Product Character

Transcriber is a quiet work tool. It should feel dark, restrained, practical,
and close to the transcript workflow. It should not feel like a generic AI SaaS
surface, a decorative dashboard, or a marketing page.

## Color Rules

Use shared roles from `design-system/tokens/colors.css`, mapped into extension
roles by `extension/foundations.css`:

- `--bg`: side-panel background.
- `--panel`: primary raised surface.
- `--panel-2`: secondary settings/panel surface.
- `--text`: primary text.
- `--muted`, `--muted-2`, `--muted-3`: descending text emphasis.
- `--accent`: selected states and small signals only.
- `--destructive`: destructive action fill or selected destructive affordance.
- `--error`: error text and retry surfaces.
- `--border`, `--border-hover`: current extension edge roles.
- `--white-5`, `--white-10`, `--white-15`, `--white-20`, `--white-60`,
  `--white-80`, `--white-90`: alpha utility roles.

Figma variable target:

- Collection: `Transcriber / Color`
- Variables: `bg`, `panel`, `panel-2`, `border`, `text`, `muted`, `muted-2`,
  `muted-3`, `accent`, `destructive`, `error`, `white/5`, `white/10`,
  `white/15`, `white/20`, `white/60`, `white/80`, `white/90`
- Every palette swatch in Figma must be bound to the matching variable. A swatch
  with a matching label but an unbound fill is documentation, not a token.

Creation script: `docs/figma/create-transcriber-color-variables.use_figma.js`.
Run it with Figma `use_figma` against the Transcriber file before updating
production-facing artboards.

Rules:

- Do not add one-off hex or rgba values for new primitives.
- The app and extension use the same palette. If the app needs HSL for
  Tailwind, map to the companion `--ds-color-*-hsl` token instead of defining a
  new color value.
- If a new visual role is needed, add it to `design-system/tokens/` first, then
  map it in the relevant surface adapter.
- Use accent sparingly. It is for selected controls, small highlights, and state
  confirmation, not large CTA fills.
- Do not introduce purple/blue gradients, decorative blobs, or unrelated palette
  families.
- Do not approximate brand colors. Use canonical icon/brand assets.

## Typography Rules

Use `--font-sans` for UI text and `--font-mono` only for technical strings,
timestamps, IDs, or transcript-adjacent metadata.

Type roles:

- Heading: `--text-heading-size`, semibold.
- Panel title: `--text-panel-title-size`, semibold, two lines max.
- List title: `--text-list-title-size`, medium.
- Body: `--text-body-size`, regular.
- Row title: `--text-row-title-size`, medium.
- Captions/help text: `--text-caption-size`.
- Section labels: `--text-label-size`, uppercase, letter-spaced.
- Micro labels: `--text-micro-size`, uppercase, letter-spaced where needed.

Figma text-style target:

- `Type/Heading`: Geist Sans, 22px, SemiBold.
- `Type/List title`: Geist Sans, 16px, Medium.
- `Type/Panel title`: Geist Sans, 15px, SemiBold.
- `Type/Body`: Geist Sans, 14px, Regular.
- `Type/Button`: Geist Sans, 14px, Medium.
- `Type/Button SM + Meta`: Geist Sans, 12px, Medium.
- `Type/Status label`: Geist Sans, 11px, Medium, uppercase usage.
- `Type/Micro label`: Geist Sans, 10px, Medium, uppercase usage.
- `Type/Timestamp`: Geist Mono, 12px, Regular.

Every text node in production-facing Figma frames should use one of these text
styles. Manually matching the same font, size, and weight is still drift.

Creation script: `docs/figma/create-transcriber-text-styles.use_figma.js`.
Run it with Figma `use_figma` against the Transcriber file before updating
production-facing artboards.

Rules:

- Letter spacing is `0` for normal text. Only uppercase section labels may use
  positive letter spacing.
- Do not use oversized hero type inside the extension. The side panel is an
  operational surface.
- Keep visible copy short and concrete. Do not describe how the UI works inside
  the UI unless the user must act on it.
- Long titles must truncate without pushing actions out of row bounds.

## Spacing And Layout Rules

Use `--space-*` roles before adding new values:

- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 24px

Rules:

- Preserve the current panel rhythm: current-video action first, recent/history
  below, footer persistent.
- First-time Recent states must still show the current video and
  `Transcribe & Summarize` above the empty history area.
- Settings must show action, provider, connectors, and advanced controls as one
  settings surface, not unrelated cards.
- Do not nest cards inside cards. Use sections, rows, menus, or drawers.
- Fixed-format controls need stable dimensions so hover/focus/content does not
  shift layout.

## Radius And Edge Rules

Use radius roles from `design-system/tokens/radius.css`:

- `--radius-sm`: tiny controls.
- `--radius-md`: buttons, toggles, icon buttons.
- `--radius-lg`: menus and compact panels.
- `--radius-xl`: settings panel and large contained surfaces.
- `--radius-full`: pills and circular controls.

Rules:

- Keep radii restrained. The extension should not drift into soft blob/card UI.
- Edge treatment must be consistent for the same primitive. If row/menu/settings
  edges change, update the primitive contract and workbench state.

## Icon Rules

Icons are design-system primitives.

- Extension UI icons must come from `extension/ui-icons.js`.
- Brand icons must come from approved assets under `extension/icons/` or the
  canonical icon source.
- Never hand-draw, simplify, paste, or approximate canonical brand icons or
  design-system icons in workbench fixtures.
- If an icon is missing, add it to the canonical source first, then consume it.

## Motion Rules

Motion comes from `design-system/tokens/motion.css`. The extension leads; web
app motion should copy or map to these tokens after approval.

Required process states:

- Transcribe initiated: processing queue card, pulsing dot, progress text, and
  progress bar.
- Native summary initiated: same processing primitive with `Writing summary...`.
- Error: retryable error state using the real error primitive.

Rules:

- Motion must have a job: feedback, orientation, continuity, or state
  confirmation.
- Frequent interactions stay subtle and fast.
- Menus open only from their real trigger. Do not show row/action menus by
  default unless the state is explicitly named as an open-menu state.
- Prefer transform and opacity. Avoid large-surface paint/layout animation.
- Respect reduced-motion behavior from `design-system/tokens/motion.css`.

## Component State Coverage

Before approving a primitive, the workbench or future Storybook must show:

- Default
- Hover
- Focus-visible
- Active/pressed
- Disabled or unavailable
- Loading/processing
- Error
- Empty state where relevant
- Mature/high-density content where relevant

Current required extension surfaces:

- Ready first video.
- Transcribing after click.
- Writing summary.
- Error retry.
- Recent empty, many, long title, processing, just-completed.
- Native summary drawer.
- External handoff drawer.
- Row overflow menu opened by the three-dots button.
- Summarize provider menu opened by the summarize button.
- Settings with provider picker, connectors, Obsidian vault input, More, and
  Cloud/Self-hosted Advanced.

## Storybook Migration

When Storybook is introduced, migrate these foundations first:

- Color roles
- Typography roles
- Spacing and layout rhythm
- Radius and edge roles
- Icon source
- Motion tokens
- Primitive state coverage

Stories should preserve the current workbench state names and fixture shapes so
existing review language carries over.
