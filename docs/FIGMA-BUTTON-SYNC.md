# Figma Button Sync

Status: handoff spec for rebuilding Figma button components from code.

The extension code is the source of truth for button primitives. Figma button
components must be copied from these primitives 1:1, then bound to Figma
variables and text styles. Do not use the current Figma button-state artboards as
canonical.

When updating the Figma artboard, first create or repair the component set from
the live CSS selectors below. Then replace loose artboard buttons with instances
of those components. Do not tune the artboard by eye before the component exists.

## Source Files

- `design-system/tokens/`
- `extension/popup.css`
- `extension/foundations.css`
- `extension/motion.css`
- `extension/ui-icons.js`
- `extension-workbench/`

## Figma Target

Create or update local Figma components:

- `Button/Primary`
- `Button/Retry`
- `Button/Upgrade`
- `Button/Queue`
- `Button/Icon`
- `SegmentedControl/Mode`

Every component must use:

- Local Figma color variables mapped from `design-system/tokens/colors.css`.
- Local Figma text styles mapped from `docs/DESIGN-FOUNDATIONS.md`.
- Canonical icons only. Do not redraw library, settings, summarize, overflow,
  provider, or brand icons.

## Button Primitive Map

| Figma component | Code selector | Required states |
| --- | --- | --- |
| `Button/Primary` | `.btn-transcribe` | default, hover, active, focus-visible, disabled/loading |
| `Button/Retry` | `.btn-retry` | default, hover, focus-visible |
| `Button/Upgrade` | `.btn-retry.btn-upgrade` | default, hover, focus-visible |
| `Button/Queue` | `.btn-queue` | default, hover, focus-visible |
| `Button/Icon` | `.recent-summarize-btn`, `.row-actions-btn`, `.footer-nav-btn` | default, hover, focus-visible, active/selected where applicable |
| `SegmentedControl/Mode` | `.settings-mode-btn` | inactive, inactive-hover, active, active-focus-visible |

## Current Code Values

`Button/Primary`:

- Width: fills container.
- Height: `40px`.
- Radius: `10px`.
- Border: `1px solid rgba(255, 255, 255, 0.20)`.
- Background: `rgba(255, 255, 255, 0.15)`.
- Hover background: `rgba(255, 255, 255, 0.22)`.
- Active background: `rgba(255, 255, 255, 0.12)`.
- Focus ring: `0 0 0 2px rgba(255, 255, 255, 0.20)`.
- Text: `14px`, weight `500`.

`Button/Icon` for recent row actions:

- Size: `26px` by `26px`.
- Radius: `6px`.
- Background: transparent.
- Hover background: `rgba(255, 255, 255, 0.08)`.
- Text/icon color: `rgba(255, 255, 255, 0.55)`.
- Hover color: `rgba(255, 255, 255, 0.9)`.
- Focus ring: `0 0 0 2px rgba(255, 255, 255, 0.18)`.

`SegmentedControl/Mode`:

- Button padding: `4px 12px`.
- Button radius: `5px`.
- Button text: `12px`, weight `500`.
- Inactive color: `--muted-3`.
- Hover color: `--muted`.
- Active background: `rgba(255, 255, 255, 0.08)`.
- Active border: `--accent`.
- Active color: `--text`.
- Focus ring: `0 0 0 2px rgba(255, 255, 255, 0.18)`.

## Acceptance Rules

- Figma components must be components/component sets, not loose frames.
- Figma button variants must be named by state, for example
  `State=Default`, `State=Hover`, `State=Focus`, `State=Active`,
  `State=Disabled`.
- Any visible mismatch between Figma and `extension-workbench/` means Figma
  changes, not the code primitive, unless the extension primitive is explicitly
  rejected in review.
- No button state is approved until it appears in the workbench and the matching
  Figma component.
