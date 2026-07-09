# Extension Design Contract

Status: interim draft contract. This does not approve the current side-panel UI.
The extension workbench is the temporary source of truth until these primitives
move to Storybook.

Surface: self-hosted/cloud Chrome extension side panel in `extension/popup.html`,
`extension/popup.css`, and `extension/popup.js`.

## Purpose

This file names the extension primitives that must stay stable once approved.
It is an interim contract until Transcriber has one code-owned design-system
source of truth.

Once the canonical code source exists, that source should own tokens,
primitives, and motion. This file should then become extension-specific notes
and state coverage, not the primary source of truth.

Current interim source:

- `design-system/tokens/` for shared color, typography, spacing, radius, and
  motion tokens.
- `extension/foundations.css` for extension compatibility mappings.
- `extension/motion.css` for extension compatibility motion imports.
- `extension/ui-icons.js` for icon primitives.
- `extension-workbench/` for state fixtures and approval coverage.
- `extension/popup.css` for current implementation selectors.

## Before Editing

Read these files first:

- `AGENTS.md`
- `docs/VISUAL-RULES.md`
- `../../design/DESIGN-GOVERNANCE.md`
- `../../youtube-transcriber-cloud/DESIGN.md` when matching cloud surfaces
- `extension/popup.html`
- `extension/popup.css`
- `extension/popup.js`

## Current Status

The extension has useful implementation primitives, but the visual state is not
yet approved. Treat current CSS as inventory and behavior evidence, not the
final source of truth.

The intended future source of truth is code, not Figma, Paper, screenshots, or
this Markdown file.

Known drift risks:

- List row geometry and action placement changing across generations.
- Settings rows mixing radio, checkbox, segmented control, toggle, and menu
  treatments without a shared contract.
- Motion timings living only in CSS comments.
- Extension CSS variables using local hex/rgba values while cloud/local docs use
  token names and HSL conventions.
- Borders and edge treatment varying between extension, local app, and cloud.

## Token Roles

Extension CSS currently defines:

- `--bg`
- `--panel`
- `--panel-2`
- `--border`
- `--border-hover`
- `--text`
- `--muted`
- `--muted-2`
- `--muted-3`
- `--error`
- `--accent`
- `--success`

Interim contract rule:

- Use these token roles when editing extension CSS.
- Do not add one-off colors for new primitives.
- If a one-off value is necessary, add it as a named token and document why.
- Token alignment comes from `design-system/tokens/`, with extension CSS
  variables mapped from it.

## Primitive Inventory

| Primitive | Current selectors | Contract status |
| --- | --- | --- |
| Side-panel shell | `.popup`, `.state`, `.panel-footer` | Inventory only |
| Primary action button | `.btn-transcribe` | Inventory only |
| Queue card | `.queue-card`, `.queue-card-row`, `.status-dot`, `.progress-track`, `.progress-fill` | Inventory only |
| Recent list section | `.recent-section`, `.recent-list` | Needs approval |
| Recent list row | `.recent-item-wrap`, `.recent-item`, `.recent-item-content`, `.recent-text`, `.recent-title`, `.recent-meta` | Needs approval |
| Just-completed row signal | `.recent-item-new`, `.recent-tick`, `.recent-arrow` | Needs motion approval |
| Processing row action | `.recent-item-processing`, `.recent-clear-processing` | Needs approval |
| Inline transcript drawer | `.recent-transcript`, `.recent-transcript-inner`, `.transcript-*` | Needs motion approval |
| Native summary card | `.native-summary-card`, `.native-summary-*` | Needs approval |
| Summarize action | `.recent-summarize`, `.recent-summarize-btn`, `.recent-summarize-menu` | Needs approval |
| Row actions menu | `.row-actions`, `.row-actions-btn`, `.row-actions-menu` | Needs approval |
| Settings panel | `.settings-panel`, `.settings-row`, `.settings-action`, `.settings-advanced` | Needs approval |
| Settings radio | `.settings-radio`, `.settings-radio-dot`, `.settings-radio-text` | Needs approval |
| Provider picker | `.settings-action-provider`, `.provider-picker-*` | Needs approval |
| Connector toggle | `.destinations-toggle`, `.destinations-toggle-thumb` | Mirrors web toggle; verify before approval |
| Footer nav | `.footer-nav`, `.footer-nav-btn` | Needs approval |
| Setup wall | `.setup-wall-*` | Out of first-pass scope unless it shares settings primitives |

## Recent List Contract Draft

An approved recent row must define:

- Outer row height range and padding.
- Title and metadata typography.
- Left adornment behavior for new/processing states.
- Placement and reveal behavior for row actions and summarize action.
- Long-title truncation.
- Hover, focus-visible, active, disabled/processing, clearing, and just-completed
  states.
- Empty, loading skeleton, 1-row, many-row, and scroll states.
- Whether clicking the row opens an inline drawer or navigates.
- Menu layering rules so menus escape scroll clipping without covering the wrong
  row.

Do not change list row anatomy or action placement without updating this
section and approved captures.

## Settings Contract Draft

An approved settings surface must define:

- Section label typography and spacing.
- Divider/edge treatment between sections.
- Row anatomy for label, helper text, control, and trailing status.
- Radio row anatomy.
- Checkbox/toggle row anatomy.
- Segmented control anatomy for Cloud/Self-hosted mode.
- Provider picker anatomy, menu placement, and selected state.
- Loading skeleton footprint.
- Empty/unavailable connector state.
- Advanced disclosure treatment.

Settings controls must preserve keyboard focus and visible focus states.

## Motion Contract Draft

Current motion inventory:

- Recent skeleton shimmer: `1.4s ease-in-out`.
- Inline transcript collapse: `0.28s cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Inline transcript expand: `0.42s cubic-bezier(0.34, 1.56, 0.3, 1)` plus
  opacity `0.65s ease-out`.
- Transcript spinner: `0.8s linear`.
- Recent just-completed tick/arrow fade: `1.4s`.
- Recent new-row background fade: `1.8s`.
- Menu hover transitions: roughly `0.12s`.
- Footer/settings hover transitions: roughly `0.15s`.

Contract rule:

- Do not change these timings casually.
- If motion changes, name the reason and update this contract.
- Respect reduced-motion behavior if added to the extension harness.

The extension timings lead. The web app should copy or map to these motion
tokens after extension interactions are approved.

## Icon Rule

Never create a custom version of a canonical brand icon or a design-system icon.
All extension icons must come from `extension/ui-icons.js` or an approved brand
asset file. If an icon is missing, add it to the canonical source first, then
consume it in the popup, workbench, and future Storybook stories.

## Reference Captures To Create After Approval

Store future captures under a predictable folder, for example:

```text
transcriber-local/docs/visual-regression/extension/
```

Suggested states:

- `recent-empty`
- `recent-many`
- `recent-long-title`
- `recent-processing`
- `recent-just-completed`
- `recent-expanded-transcript`
- `recent-native-summary`
- `recent-row-actions-menu`
- `recent-summarize-provider-menu`
- `settings-default`
- `settings-loading`
- `settings-connectors-connected`
- `settings-self-hosted-advanced`

Each capture should be marked `approved`, `exploratory`, or `rejected`.

## Workbench Requirement

Before screenshot regression, add a local harness that can render extension
states without a live Chrome extension session. Preferred port:

```text
localhost:19721
```

The harness should use fixture data for recent transcripts, processing rows,
settings state, provider menus, connector rows, and error/loading states.

Paper prototypes should consume this same primitive vocabulary. Paper output is
not canonical until the code-owned design system is updated.

Future Storybook stories should preserve the same state names and fixture shapes
from `extension-workbench/`.

## Agent Rule

If a request touches `extension/popup.css`, `extension/popup.html`, or
side-panel rendering in `extension/popup.js`, classify the work before editing:

- `behavior-only`
- `copy-only`
- `state coverage`
- `approved primitive reuse`
- `primitive design change`

Only the last category should change the canonical design-system source once it
exists. Until then, update this interim contract and approved captures.
