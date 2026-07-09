# Surfaces

Status: adapter layer.

Surface files map shared design-system tokens and primitives into the variable
shape required by a runtime.

Expected adapters:

- `extension.css`: Chrome extension compatibility roles such as `--bg`,
  `--panel`, and `--text`.
- `app.css`: Next/Tailwind compatibility roles such as HSL triplets for
  `hsl(var(...))`.
- `marketing.css`: cloud marketing composition rules that still consume shared
  foundations.
- `storybook.css`: Storybook preview globals and fixture-only helpers.

Surface adapters are allowed to translate format. They are not allowed to invent
a second design system.
