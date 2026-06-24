# Composer Command Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Composer suggestion popup focus-aware and input-aware: focused empty input shows all quick suggestions, `/` input shows only slash commands, normal text or blur hides it, and running state hides it.

**Architecture:** Keep the change isolated to `web/src/components/agent/Composer.tsx`. Add local focus state, derive the visible suggestion list from `value`, `focused`, and `isRunning`, and preserve the existing visual markup and send behavior.

**Tech Stack:** React, TypeScript, Vite frontend, TailwindCSS classes, existing self-managed Chat UI.

---

## File Structure

- Modify: `web/src/components/agent/Composer.tsx` — owns textarea focus state, suggestion list visibility, suggestion selection, and send/cancel controls.

No new files are required. There are currently no frontend test files in `web/src`, so this plan uses typecheck plus targeted manual verification.

---

## Task 1: Add focus-aware suggestion state

**Files:**
- Modify: `web/src/components/agent/Composer.tsx`

- [ ] **Step 1: Import `useState`**

Change the first import in `web/src/components/agent/Composer.tsx` from:

```ts
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
```

to:

```ts
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
```

- [ ] **Step 2: Replace the current `showCommands` boolean with focused state and derived suggestions**

Find this block near the top of the component body:

```ts
const textareaRef = useRef<HTMLTextAreaElement | null>(null);
const showCommands = !isRunning && (value === "" || value === "/");
```

Replace it with:

```ts
const textareaRef = useRef<HTMLTextAreaElement | null>(null);
const [focused, setFocused] = useState(false);
const trimmedStartValue = value.trimStart();
const visibleCommands = !focused || isRunning
  ? []
  : value === ""
    ? COMMANDS
    : trimmedStartValue.startsWith("/")
      ? COMMANDS.filter((command) => command.value.startsWith("/"))
      : [];
const showCommands = visibleCommands.length > 0;
```

This implements the state table from the design:

- Not focused: no suggestions.
- Running: no suggestions.
- Focused and empty: all `COMMANDS`.
- Focused and slash input: only commands whose `value` starts with `/`.
- Focused and normal text: no suggestions.

- [ ] **Step 3: Render `visibleCommands` instead of all `COMMANDS`**

Find this JSX:

```tsx
{COMMANDS.map((command) => (
```

Replace it with:

```tsx
{visibleCommands.map((command) => (
```

- [ ] **Step 4: Add focus and blur handlers to the textarea**

Find the textarea props:

```tsx
<textarea
  ref={textareaRef}
  value={value}
  onChange={(event) => onChange(event.target.value)}
```

Change them to:

```tsx
<textarea
  ref={textareaRef}
  value={value}
  onFocus={() => setFocused(true)}
  onBlur={() => setFocused(false)}
  onChange={(event) => onChange(event.target.value)}
```

- [ ] **Step 5: Prevent suggestion clicks from blurring the textarea before selection**

Find the suggestion button JSX:

```tsx
<button
  key={command.value}
  type="button"
  onClick={() => handlePickCommand(command.value)}
  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-200"
>
```

Replace it with:

```tsx
<button
  key={command.value}
  type="button"
  onMouseDown={(event) => event.preventDefault()}
  onClick={() => handlePickCommand(command.value)}
  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-200"
>
```

- [ ] **Step 6: Verify the edited component shape**

After the edits, the relevant top portion of `Composer` should look like this:

```tsx
export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { value, isRunning, onChange, onSend, onCancel, mode = "bottom" },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [focused, setFocused] = useState(false);
  const trimmedStartValue = value.trimStart();
  const visibleCommands = !focused || isRunning
    ? []
    : value === ""
      ? COMMANDS
      : trimmedStartValue.startsWith("/")
        ? COMMANDS.filter((command) => command.value.startsWith("/"))
        : [];
  const showCommands = visibleCommands.length > 0;

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));
```

And the suggestion rendering should use:

```tsx
{showCommands && (
  <div className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-20 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
    {visibleCommands.map((command) => (
      <button
        key={command.value}
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => handlePickCommand(command.value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-200"
      >
        <span className="font-medium text-neutral-950">{command.title}</span>
        <span className="truncate text-xs text-neutral-500">{command.description}</span>
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 7: Run frontend typecheck**

Run from the repository root:

```bash
cd web && pnpm typecheck
```

Expected: TypeScript exits successfully with no errors.

- [ ] **Step 8: Commit the Composer behavior change**

Run from the repository root:

```bash
git add web/src/components/agent/Composer.tsx
git commit -m "fix: refine composer command suggestions"
```

Expected: one commit containing only the Composer behavior change.

---

## Task 2: Manual behavior verification

**Files:**
- Verify: `web/src/components/agent/Composer.tsx`

- [ ] **Step 1: Start the frontend and backend if they are not already running**

Use the normal project commands in two terminals.

Backend from the repository root:

```bash
pnpm dev
```

Frontend from `web/`:

```bash
cd web
pnpm dev
```

Expected:

- Backend listens on the configured `PORT`.
- Frontend listens on `http://localhost:5173`.

- [ ] **Step 2: Verify focused empty input shows all quick suggestions**

Open the app, sign in if needed, and focus the composer while it is empty.

Expected popup entries:

```text
/rag
/rag 这个项目有哪些功能？
计划示例
工具示例
```

- [ ] **Step 3: Verify blur hides suggestions**

Click outside the composer.

Expected: the popup disappears.

- [ ] **Step 4: Verify slash input shows only slash commands**

Focus the composer and type:

```text
/
```

Expected popup entries:

```text
/rag
/rag 这个项目有哪些功能？
```

The following entries must not be visible:

```text
计划示例
工具示例
```

- [ ] **Step 5: Verify regular text hides suggestions**

Replace the composer value with:

```text
你好
```

Expected: no suggestion popup is visible.

- [ ] **Step 6: Verify clicking `/rag` fills the composer and keeps focus**

Clear the composer, focus it, click the `/rag` suggestion.

Expected:

```text
/rag 
```

The caret remains in the textarea after the trailing space, ready for typing the query.

- [ ] **Step 7: Verify running state hides suggestions**

Send a message that starts an agent response. While `isRunning` is true, focus the composer if possible.

Expected: no suggestion popup appears while the run is active.

- [ ] **Step 8: Commit manual verification note if a verification artifact is added**

No code or docs commit is required if manual verification passes and no file changed. If you add a verification note, commit only that note:

```bash
git add <verification-note-path>
git commit -m "docs: record composer suggestion verification"
```

---

## Self-Review

- Spec coverage: Task 1 implements focus-aware visibility, slash-only filtering, normal-text hiding, click selection focus preservation, and running-state hiding. Task 2 covers all manual checks from the design spec.
- Placeholder scan: No `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: The plan uses existing `COMMANDS`, `value`, `isRunning`, `handlePickCommand`, and textarea refs exactly as defined in `web/src/components/agent/Composer.tsx`.
