# Extension Workbench

Status: interim review harness for the Transcriber extension UI.
Current fidelity: catching up to the live extension, not yet exact.

This workbench renders approved and candidate extension states with fixture data.
It exists before Storybook so the plain HTML/CSS/JS side panel can be cleaned up
without needing Chrome storage, YouTube navigation, auth, or live transcription.
The live extension code remains canonical while this harness has unresolved
visual, spacing, animation, or state bugs.

The goal is exact reproduction of the extension UI. The first pass intentionally
uses static fixture markup plus the real extension CSS. The next pass should
remove hand-authored approximations by rendering each state from the same DOM
builder functions used by `extension/popup.js`. Figma and future Storybook
components should be generated from these same primitives, not from approximate
artboards.

Run it from the repo root:

```bash
npm run workbench:ext
```

Then open:

```text
http://127.0.0.1:19721/extension-workbench/
```

## Source Order

1. `design-system/tokens/` owns shared color, typography, spacing, radius, and
   motion tokens.
2. `extension/foundations.css` maps shared tokens into extension compatibility
   variables.
3. `extension/motion.css` re-exports shared motion tokens for extension
   compatibility.
4. `extension/ui-icons.js` owns extension icon primitives.
5. `extension/popup.css` owns current implementation primitives.
6. `extension/popup.js` owns live state DOM anatomy until primitives are
   extracted.
7. `extension-workbench/index.html` owns fixture state coverage.
8. Future Storybook stories should reuse these state names and fixture shapes.

## Product Variants

The workbench must show both extension variants until the product decision is
fully settled:

- Native summary extension: summary generation and summary card live inside the
  side panel.
- External handoff extension: no in-panel summary card; Claude and ChatGPT are
  external handoff destinations.

Both variants must use the same foundations: typography, spacing, icons, motion,
row anatomy, menus, and footer primitives. Variant differences should be visible
as composition choices, not separate design systems.

Each variant must also show two user-maturity cohorts:

- First-time user: empty or light account, first video, default settings.
- Mature library user: many prior transcripts, long titles, processing rows,
  menus, configured settings, and dense history.

States should be reviewed across both axes before approval:

```text
product variant x user maturity x UI state
```

Process states are part of that coverage. The workbench must show the real
post-click flow for `Transcribe & Summarize`: immediate processing feedback,
progress text/bar animation, native summary writing, cancel affordance, and
retryable error state.

## Review Eval

Before a workbench state is treated as production-ready, answer the design-system
eval from `docs/DESIGN-SYSTEM-EVALS.md`:

1. Have you deviated from the design system?
2. What are you least confident in right now?

Any real gap should become a fix or a tracked follow-up, not an unspoken caveat.

## Exactness Rules

- Workbench markup should match the live DOM from `extension/popup.js`.
- Workbench icons must use `extension/ui-icons.js`, never hand-drawn,
  approximated, pasted, or substitute glyph icons.
- Never create a custom version of a canonical brand icon or a design-system
  icon. Add it to the canonical icon source first, then consume it from there.
- Workbench menus may be statically positioned for comparison, but their inner
  anatomy must match live menus.
- Workbench motion must come from `extension/motion.css`, which imports the
  shared motion tokens.
- If a fixture intentionally differs from the live extension, label it as a
  candidate design, not an approved reproduction.

## Storybook Migration

When the primitives are stable, migrate this workbench into Storybook as an
atomic design system:

Foundations:

- Typography
- Spacing
- Grid and layout
- Color and edge tokens
- Icon set
- Motion and animation framework

Atoms:

- Icon button
- Text button
- Radio
- Checkbox
- Toggle
- Segmented mode toggle, including default, selected, hover, focus, and click
  transitions
- Menu item
- Section label
- Status dot
- Spinner

Composed components:

- `RecentList.stories`
- `RecentRow.stories`
- `TranscriptDrawer.stories`
- `NativeSummaryCard.stories`
- `SettingsPanel.stories`
- `ProviderMenu.stories`
- `FooterNav.stories`

Until then, source-of-truth order is:

1. Live extension code in `extension/popup.html`, `extension/popup.css`, and
   `extension/popup.js`.
2. Shared `design-system/` tokens and primitives as they are extracted.
3. `extension-workbench/` once it reproduces that live code exactly.
4. Figma after it is rebuilt from real variables, text styles, and component
   sets copied from code.
5. Screenshots and Paper prototypes as evidence only.

Figma artboards must be versioned when promoted. Do not overwrite old extension
artboards in place; duplicate them into a dated canonical/WIP section and label
the old section as legacy/reference.
