# Primitives

Status: extraction target. Primitives are reusable low-level controls that
should be shared by the extension, local app, cloud app, Figma, and future
Storybook stories.

Initial extraction order:

1. Icon button
2. Primary/text button
3. Checkbox
4. Toggle
5. Segmented control
6. Menu item
7. Input
8. Spinner and progress feedback

Do not create a primitive here by approximating an artboard. Extract from the
live extension or approved shared component code, then wire Storybook and Figma
to that same primitive.
