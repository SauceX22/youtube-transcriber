# Transcriber Design System

Status: shared design-system scaffold in the `transcriber-local` repo. This is
the target home for tokens, primitives, components, surface adapters, and future
Storybook stories.

The live extension remains canonical for extension behavior while extraction is
in progress. Shared files should be introduced gradually and verified against
the extension, web app, workbench, Figma, and future Storybook stories.

## Repo Boundary

The Transcriber root folder is a local coordination workspace and is not the
canonical git source. Versioned design-system code must live inside real repo
worktrees, starting here in `transcriber-local/design-system/`.

When the cloud repo consumes this system, copy or sync this directory into the
cloud repo until a package/submodule is worth the overhead. The cloud and local
apps may have different product surfaces, but they should not maintain separate
foundation token sets.

## Structure

- `tokens/`: canonical `--ds-*` values for color, typography, spacing, radius,
  and motion.
- `primitives/`: reusable low-level UI styles such as buttons, checkboxes,
  toggles, segmented controls, menus, inputs, and icon buttons.
- `components/`: composed product patterns such as provider picker, queue card,
  recent row, settings section, and summary card.
- `surfaces/`: adapters for extension, app, marketing, and Storybook surfaces.
- `stories/`: future Storybook stories that render real primitives/components.

## Source Rule

Shared tokens use the `--ds-*` namespace. Product surfaces may map these tokens
into local variables when necessary, for example the extension maps
`--ds-color-bg` to `--bg`, while the web app can keep HSL-valued app variables
for Tailwind compatibility.

Colors are still one system. When a surface needs a different CSS format, use a
format-specific companion token from `tokens/colors.css`, such as
`--ds-color-bg` for normal CSS color values and `--ds-color-bg-hsl` for
`hsl(var(...))` Tailwind usage.

Do not create new canonical colors, typography roles, icons, spacing, radius, or
motion values inside a surface file. Add them here first, then map them.

## Surface Separation

- Extension and local app surfaces can add self-hosted server controls and
  extension-specific state coverage.
- Cloud app surfaces can add auth, billing, hosted-product flows, and marketing
  composition.
- Marketing pages may have distinct layout and copy patterns, but their colors,
  typography, spacing, radius, icon, and motion foundations still come from
  shared tokens unless a new token is explicitly added here.
