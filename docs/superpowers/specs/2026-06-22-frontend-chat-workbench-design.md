# Frontend Chat Workbench Design

Date: 2026-06-22

## Scope

Optimize only the frontend under `web/` so the current demo-style interface becomes a restrained ChatGPT-like chat workbench while preserving the existing runtime behavior.

In scope:

- `web/src/app/AssistantApp.tsx`
- `web/src/components/layout/Sidebar.tsx`
- `web/src/components/agent/ChatView.tsx`
- `web/src/components/agent/AssistantMessage.tsx`
- `web/src/components/agent/AgentTimeline.tsx`
- `web/src/components/agent/PlanCard.tsx`
- `web/src/components/agent/HitlConfirmCard.tsx`
- `web/src/components/agent/ToolCallCard.tsx`
- `web/src/index.css`
- New frontend-only components as needed, especially `MobileSidebar.tsx`, `EmptyState.tsx`, and `Composer.tsx`.

Out of scope:

- Backend files under root `src/`.
- The `AgentStreamEvent` protocol.
- Agent planning, routing, execution, tool, and HITL business logic.
- Migration to `@assistant-ui/react`.
- Broad refactoring of `useAgentRuntime`.

## Chosen Approach

Use a targeted componentized frontend cleanup rather than a full runtime rewrite.

The implementation will preserve the current self-built Chat UI and extract only the UI pieces that need stronger behavior boundaries:

- `MobileSidebar` for mobile drawer behavior.
- `EmptyState` for the welcome prompt and suggestion chips.
- `Composer` for autosizing input, send/stop states, and focus behavior.

Existing Agent-specific components will be updated in place to reduce visual weight and improve state handling.

This approach minimizes regression risk because it does not change the runtime hook, backend routes, SSE shape, or Agent decision flow.

## Responsive Workbench Shell

### Desktop

For widths at or above `768px`:

- Keep a left sidebar of about `260px`.
- Use a three-part main area: top bar, scrollable conversation, bottom composer.
- Center conversation content with a maximum reading width of roughly `760-800px`.
- Use a neutral gray visual system with minimal shadows, gradients, and oversized rounded corners.
- Top bar should be quiet and functional: current conversation title and necessary actions only.
- Remove thread ID, duplicate online indicators, and other debug-like metadata from the primary UI.

### Mobile

For widths below `768px`:

- Hide the desktop sidebar.
- Show a menu button in the top bar.
- Open the conversation list in a mobile drawer.
- Ensure `390x844` has no horizontal page scroll, no single-character text wrapping, and no clipped composer.
- Use `min-w-0`, `overflow-x-hidden`, responsive padding, and internal scrolling for wide content such as code blocks or JSON.

### Mobile Drawer Rules

The mobile drawer must:

- Lock page/background scrolling while open.
- Close when the user clicks the overlay.
- Close when the user clicks the close button.
- Close after the user selects a conversation.
- Close on `Esc`.
- Keep the drawer conversation list scrollable without allowing scroll-through to the page beneath.

## Conversation Layout

Assistant messages should no longer sit inside a large white card. They should read as content directly on the page background.

User messages should:

- Align to the right.
- Use a light gray bubble instead of a pure black large bubble.
- Use a responsive max width so narrow screens do not force single-character wrapping.
- Preserve whitespace where appropriate without expanding page width.

Assistant markdown should:

- Wrap long text safely using `overflow-wrap`/`word-break` safeguards.
- Keep code blocks and tables from widening the page; they should scroll internally when needed.
- Use restrained typography and spacing.

## Empty State

When a thread has no messages:

- Remove the central bordered card.
- Show a simple title: `有什么可以帮忙的？`
- Show 3-4 compact suggestion prompts.
- Clicking a suggestion fills the composer instead of sending immediately.
- After filling the composer, focus the composer so the user can edit and press Enter.
- Keep the composer as the primary visual entry point.

## Composer

The composer should live in the normal page layout, not in absolute/fixed positioning. It should be the bottom flex/sticky region of the chat shell so mobile dynamic viewport and soft keyboard behavior are less likely to clip it.

Behavior:

- Textarea grows with content.
- Textarea has a reasonable maximum height, around `160px`, then scrolls internally.
- `Enter` sends.
- `Shift+Enter` inserts a newline.
- Empty or whitespace-only messages cannot be sent.
- While not running, show a clear send button with focus and disabled states.
- While running, show a circular stop button that calls the existing cancel handler.
- Preserve existing cancellation capability.
- Use `safe-area-inset-bottom` padding so mobile bottom safe areas do not hide the composer.

## Scroll Behavior

Conversation scrolling should be reliable without fighting the user.

Rules:

- Track whether the user is near the bottom of the scroll container.
- Treat distance from bottom `<= 120px` as still at bottom.
- After sending or receiving updates, auto-scroll only when the user is at or near the bottom.
- During streaming, preserve the user's choice if they scroll upward.
- When the user is away from the bottom and new content arrives, show a lightweight `回到底部` button.
- Clicking `回到底部` scrolls to the latest message and returns the view to auto-follow mode.

## Agent Execution Process

`AgentTimeline` should be compact by default.

Collapsed summary examples:

- Running: `正在规划…` or `正在执行工具…`
- Complete: `已完成 2 个步骤`
- Error: a concise failure summary

Behavior:

- Click the summary row to expand or collapse the full event list.
- If there is a currently running step and the user has not manually changed the fold state for this message, auto-expand so the running step is visible.
- After all events complete, auto-collapse if the user has not manually changed the fold state for this message.
- Once the user manually expands or collapses the timeline for a message, respect that choice for that message and do not repeatedly auto-toggle as events update.
- For normal chat routes, router/internal analysis should remain visually low-priority and must not overpower the final assistant answer.

The expanded list should use small text, subtle separators, and light status indicators rather than large nested cards.

## Tool Calls

`ToolCallCard` remains available but should be quiet by default.

- Show a compact summary such as `工具调用 · 2 次`.
- Individual tool calls are collapsed by default.
- Users can expand each call to inspect parameters and results.
- Parameter/result blocks must scroll internally and must not widen the mobile viewport.
- Running, completed, and error states should be clear but visually understated.

## Plan and HITL

### PlanCard

`PlanCard` should align with the same reading width as assistant content.

- Avoid multi-layer nested cards.
- Present the plan as a structured content block.
- Show `执行计划`, the goal, and a clean step list.
- Use light border/background treatment with minimal shadow.

### HITL Confirmation

When `waitingForConfirm=true`:

- Show a clear `需要你的确认` state near the plan bottom.
- Do not show `正在思考…`, because the system is waiting for the user rather than generating.
- Keep actions close to the plan.

Action hierarchy:

1. `确认执行` is the primary button.
2. `修改计划` is the secondary button.
3. `取消任务` is a low-emphasis dangerous action.

Submission behavior:

- After any HITL action is submitted, immediately disable all related buttons and show a processing state to prevent duplicate `resume()` calls.
- The local pending state must not depend on new SSE protocol fields. It should be reconciled from existing frontend/runtime state.
- When the submitted resume request transitions the thread back into running state, keep the HITL controls disabled while `isRunning` is true.
- When the request/stream finishes and the message is no longer `waitingForConfirm`, the HITL controls naturally disappear with the completed state.
- If the request fails, is cancelled, or the stream ends while the same message is still `waitingForConfirm`, clear the local pending state and re-enable the buttons so the user can retry.
- Modify mode should explain that the user can tell the Agent how to adjust the plan.
- Modify submission is disabled when the note is empty or whitespace-only, or while local pending/`isRunning` indicates a submission is in progress.
- Valid modify submission calls the existing `resume("modify", note)` behavior.
- Confirmation and rejection continue to call the existing `resume("confirm")` and `resume("reject")` behavior.

## Component Boundaries

### `AssistantApp`

Owns app-level composition only:

- Runtime hook usage.
- Desktop sidebar rendering.
- Mobile drawer state.
- Passing thread data and action handlers to `ChatView`.

It should not contain low-level composer or message rendering logic.

### `Sidebar`

Renders reusable conversation navigation content:

- New conversation button.
- Thread list.
- Active thread styling.

It may receive an optional callback such as `onAfterSelect` or rely on the parent mobile wrapper to close after selection. It should avoid debug footer content such as local thread IDs or duplicate online status.

### `MobileSidebar`

Owns mobile drawer behavior:

- Open/closed presentation.
- Overlay.
- Close button.
- Escape key handling.
- Scroll lock.
- Closing after selecting a thread.

It should reuse the same thread data and callbacks as the desktop sidebar.

### `ChatView`

Owns chat layout and scroll behavior:

- Top bar.
- Conversation scroll container.
- Empty state.
- Message list.
- Bottom composer placement.
- Near-bottom detection and `回到底部` button.

It passes suggestion-fill behavior to `EmptyState` and composer control/focus behavior to `Composer`.

### `Composer`

Owns input mechanics:

- Draft state interaction supplied by `ChatView`.
- Autosizing textarea.
- Enter/Shift+Enter behavior.
- Send button disabled state.
- Running stop button.
- Focus method exposed via `ref` or a passed focus callback.

### `EmptyState`

Owns welcome content and suggestions:

- Title.
- Compact suggestion chips.
- On click, calls a parent handler that fills and focuses the composer.

### `AssistantMessage`

Composes message metadata and final content:

- Timeline.
- Tool calls.
- Plan.
- HITL confirm controls.
- Markdown output.
- Suppresses `正在思考…` whenever `metadata.waitingForConfirm` is true.

### `AgentTimeline`, `ToolCallCard`, `PlanCard`, `HitlConfirmCard`

These components own their local presentation and fold/submission states only. They must not change backend protocols or runtime state shape.

## Data Flow

The existing runtime flow remains unchanged:

1. `useAgentRuntime()` provides threads, current thread, send, resume, cancel, and running state.
2. `AssistantApp` passes the current thread and actions into the frontend shell.
3. `ChatView` renders messages and owns UI-only scroll/composer state.
4. `AssistantMessage` reads existing `UiMessage.metadata` and renders Agent UI affordances.
5. HITL controls call the existing `resume()` action with the same decisions and optional modify note.
6. The composer calls the existing `sendMessage()` and `cancel()` handlers.

No new API contracts are introduced.

## Error and Edge Handling

- Empty messages are not sent.
- Empty modify-plan notes are not submitted.
- Duplicate HITL submissions are prevented by immediate local pending state.
- Long markdown, tables, code blocks, tool inputs, and tool outputs must not create horizontal page scroll.
- Mobile drawer closes predictably on overlay, close button, thread select, and Escape.
- If a tool call or event has error status, the UI shows a subdued but clear error indicator.
- If an assistant message has no content because it is waiting for confirmation, it shows HITL controls instead of a loading/thinking indicator.

## Validation Plan

Automated checks:

- Run `pnpm --dir web typecheck`.
- Run `pnpm --dir web build`.

Manual checks:

- Desktop `1280x720` layout: sidebar visible, conversation centered, top bar simplified, composer usable.
- Mobile `390x844` layout: no horizontal scroll, no text squeezed into single-character wrapping, drawer works, composer not clipped.
- Empty state: simple welcome title, suggestions fill and focus composer.
- Normal chat: final assistant answer has priority; internal route/timeline UI remains compact.
- Streaming: output updates, near-bottom auto-scroll works, user scroll-up is respected, `回到底部` appears when appropriate.
- Stop generation: running state shows circular stop button and cancel remains functional.
- Plan confirmation: plan appears at reading width, `需要你的确认` is clear, `正在思考…` is absent.
- Confirm execution: primary button submits once and disables while processing.
- Modify plan: textarea validates non-empty content, submit disables while processing, existing `resume("modify", note)` path is used.
- Cancel task: low-emphasis danger action submits once and disables while processing.

## Expected Modified Files

Likely modified:

- `web/src/app/AssistantApp.tsx`
- `web/src/components/layout/Sidebar.tsx`
- `web/src/components/agent/ChatView.tsx`
- `web/src/components/agent/AssistantMessage.tsx`
- `web/src/components/agent/AgentTimeline.tsx`
- `web/src/components/agent/PlanCard.tsx`
- `web/src/components/agent/HitlConfirmCard.tsx`
- `web/src/components/agent/ToolCallCard.tsx`
- `web/src/index.css`

Likely added:

- `web/src/components/layout/MobileSidebar.tsx`
- `web/src/components/agent/EmptyState.tsx`
- `web/src/components/agent/Composer.tsx`

No backend files should be modified.
