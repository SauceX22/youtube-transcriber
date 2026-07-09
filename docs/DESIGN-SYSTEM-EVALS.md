# Design System Evals

Status: required review gate for prototypes, workbench states, Storybook stories,
and Figma-to-code work.

The goal is to let people prototype quickly without creating a parallel
Transcriber UI language. Prototypes can explore composition and workflow, but
they must grade themselves before they move toward production.

## Required Prompts

Every design-system review must answer these two prompts:

1. Have you deviated from the design system?
2. What are you least confident in right now?

Short answers are fine, but vague answers are not. Name the exact primitive,
state, token, file, frame, or interaction that is uncertain.

## Expected Output

Use this format in PRs, prototype handoffs, and Storybook/workbench reviews:

```md
## Design-System Eval

### Have you deviated from the design system?

- Answer:
- Evidence:
- Files / frames:

### What are you least confident in right now?

- Answer:
- Why:
- Needed follow-up:
```

## What Counts As Deviation

- New colors outside the shared token map.
- New typography roles or manually matched text instead of named styles.
- Hand-drawn or approximated canonical icons.
- Button, checkbox, radio, toggle, menu, input, or provider-picker states that
  do not come from approved primitives.
- Motion that does not use the extension/design-system motion tokens.
- Figma frames that look right but are not backed by variables, text styles, or
  components.
- Workbench fixtures that do not match live extension DOM or behavior.
- Storybook stories that use decorative placeholder markup instead of real
  imports/components.

## Review Gate

If either prompt exposes a real gap, create a follow-up task or fix it before
calling the work production-ready. Real gaps should become tickets, docs, or
code changes. They should not remain in chat.

## Source-Of-Truth Reminder

Current order:

1. Live extension code for extension primitives and behavior.
2. Shared design-system tokens and primitives as they are extracted.
3. Workbench once it reproduces live code exactly.
4. Storybook once it renders real shared primitives.
5. Figma once it uses real variables, text styles, and component sets.

