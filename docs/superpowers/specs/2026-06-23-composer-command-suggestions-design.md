# Composer Command Suggestions Design

## Goal

Optimize the chat composer suggestion popup so it appears only when useful:

- When the textarea is focused and empty, show all quick suggestions.
- When the user types `/`, show only slash commands.
- When the user types normal text, hide the popup.
- Do not show suggestions continuously when the input is not focused.

## Current Behavior

`web/src/components/agent/Composer.tsx` currently shows the same `COMMANDS` popup whenever the composer value is empty or exactly `/`:

```ts
const showCommands = !isRunning && (value === "" || value === "/");
```

This makes quick suggestions visible even before the input is focused, and it does not distinguish quick suggestions from slash commands.

## Chosen Approach

Use focus-aware, input-aware popup behavior.

### States

The composer should track whether the textarea is focused.

- `focused = false`: hide suggestions.
- `focused = true`, `value === ""`: show all quick suggestions.
- `focused = true`, `value.trimStart().startsWith("/")`: show slash-command suggestions only.
- `focused = true`, other input: hide suggestions.
- `isRunning = true`: hide suggestions regardless of focus or value.

### Suggestion Sets

Keep the existing command data structure, but derive two lists:

- `quickSuggestions`: all entries in `COMMANDS`.
- `slashCommands`: entries whose `value` starts with `/`.

Current slash commands will be:

- `/rag `
- `/rag 这个项目有哪些功能？`

Non-slash quick suggestions such as plan/weather examples appear only in the empty-focused state.

## Interaction Details

- Focusing the textarea with an empty value opens the quick suggestions popup.
- Typing `/` switches the popup to slash-command-only mode.
- Typing regular text closes the popup.
- Selecting a suggestion fills the composer value and keeps focus in the textarea.
- Suggestion buttons should use `onMouseDown` with `event.preventDefault()` so the textarea does not blur before the click is handled.
- The existing send behavior remains unchanged: empty values cannot send, and bare `/rag` cannot send.

## Component Scope

Only `web/src/components/agent/Composer.tsx` needs to change.

No backend, SSE, auth, thread state, or chat runtime changes are required.

## Testing

Manual checks:

1. Open a new chat and focus the composer. All quick suggestions appear.
2. Blur the composer. Suggestions disappear.
3. Focus the composer and type `/`. Only slash commands appear.
4. Type normal text such as `你好`. Suggestions disappear.
5. Click `/rag`. The composer fills with `/rag ` and remains focused.
6. While an agent response is running, suggestions do not appear.

Type check:

- Run `cd web && pnpm typecheck` after implementation.

## Out of Scope

- Keyboard navigation within the popup.
- Fuzzy filtering of slash commands.
- Persisting or customizing suggestions.
- Changing the visual style of the popup.
