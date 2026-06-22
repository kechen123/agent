# Frontend Chat Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing `web/` demo UI into a restrained ChatGPT-like chat workbench while preserving execution process, plans, tool calls, HITL, and all existing backend/SSE behavior.

**Architecture:** Keep the current self-built React chat UI and add focused frontend-only components for the mobile drawer, empty state, and composer. Update existing Agent presentation components in place so runtime data flow stays unchanged and UI state remains local to UI components.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, `react-markdown`, `remark-gfm`, existing `useAgentRuntime` hook and `AgentStreamEvent` mirror types.

---

## Scope and Guardrails

Do not modify any root `src/` backend files. Do not change `web/src/types/agent-ui.ts` event shapes. Do not migrate to `@assistant-ui/react`. Do not refactor `useAgentRuntime` beyond what is strictly needed to pass existing props; this plan does not require changing that hook.

The repository currently has an unrelated untracked `AGENTS.md`; do not add it to commits made for this work.

## File Structure

Create:

- `web/src/components/layout/MobileSidebar.tsx` — mobile drawer shell, scroll lock, overlay close, close button, Esc close, close-on-thread-select.
- `web/src/components/agent/EmptyState.tsx` — welcome heading and suggestion chips that fill and focus the composer.
- `web/src/components/agent/Composer.tsx` — autosizing textarea, Enter/Shift+Enter handling, send/stop buttons, focus handle.

Modify:

- `web/src/app/agentActions.ts` — add `isRunning` to the existing context so HITL controls can reconcile local pending state without new SSE fields.
- `web/src/app/AssistantApp.tsx` — own shell-level mobile drawer state and pass simplified title/menu props to `ChatView`.
- `web/src/components/layout/Sidebar.tsx` — make sidebar reusable for desktop and mobile drawer, remove debug footer/thread ID.
- `web/src/components/agent/ChatView.tsx` — top bar, centered conversation width, empty state, composer integration, near-bottom scrolling, `回到底部` button.
- `web/src/components/agent/AssistantMessage.tsx` — remove large assistant card, suppress thinking while waiting for HITL.
- `web/src/components/agent/AgentTimeline.tsx` — default collapsed summary, auto expand/collapse until user manually toggles.
- `web/src/components/agent/ToolCallCard.tsx` — compact default, internally scrollable parameter/result blocks.
- `web/src/components/agent/PlanCard.tsx` — plan as a light structured content block.
- `web/src/components/agent/HitlConfirmCard.tsx` — pending state, retry recovery, disabled states, button hierarchy.
- `web/src/index.css` — horizontal overflow guards, markdown wrapping, neutral visual polish, dynamic viewport support.

---

### Task 1: Baseline Checks and HITL Action Context

**Files:**
- Modify: `web/src/app/agentActions.ts`
- Modify: `web/src/app/AssistantApp.tsx`

- [ ] **Step 1: Capture current frontend baseline**

Run:

```bash
pnpm --dir web typecheck
pnpm --dir web build
```

Expected: both commands complete successfully before UI changes. If either fails, record the failure output in the implementation notes before changing files.

- [ ] **Step 2: Extend the HITL action context with running state**

Replace `web/src/app/agentActions.ts` with:

```ts
import { createContext, useContext } from "react";
import type { HitlAction } from "../types/agent-ui";

export interface AgentActions {
  resume: (action: HitlAction, message?: string) => void;
  isRunning: boolean;
}

export const AgentActionsContext = createContext<AgentActions | null>(null);

export function useAgentActions(): AgentActions {
  const ctx = useContext(AgentActionsContext);
  if (!ctx) throw new Error("useAgentActions must be used within AgentActionsContext");
  return ctx;
}
```

This is frontend-only state wiring. It does not change any SSE protocol or backend request shape.

- [ ] **Step 3: Wire `isRunning` through the app context and prepare mobile shell state**

Replace `web/src/app/AssistantApp.tsx` with:

```tsx
import { useState } from "react";
import { useAgentRuntime } from "../hooks/useAgentRuntime";
import { ChatView } from "../components/agent/ChatView";
import { Sidebar } from "../components/layout/Sidebar";
import { MobileSidebar } from "../components/layout/MobileSidebar";
import { AgentActionsContext, type AgentActions } from "./agentActions";

export function AssistantApp() {
  const {
    threads,
    currentThread,
    currentThreadId,
    setCurrentThreadId,
    newThread,
    sendMessage,
    resume,
    cancel,
    isRunning,
  } = useAgentRuntime();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const actions: AgentActions = { resume, isRunning };

  const handleSelectThread = (threadId: string) => {
    setCurrentThreadId(threadId);
  };

  const handleNewThread = () => {
    newThread();
  };

  return (
    <AgentActionsContext.Provider value={actions}>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-[#f7f7f8] text-neutral-950">
        <Sidebar
          className="hidden md:flex"
          threads={threads}
          currentThreadId={currentThreadId}
          onSelect={handleSelectThread}
          onNew={handleNewThread}
        />
        <MobileSidebar
          open={mobileSidebarOpen}
          threads={threads}
          currentThreadId={currentThreadId}
          onSelect={handleSelectThread}
          onNew={handleNewThread}
          onClose={() => setMobileSidebarOpen(false)}
        />
        <main className="min-w-0 flex-1">
          <ChatView
            title={currentThread.title || "新会话"}
            messages={currentThread.messages}
            isRunning={isRunning}
            onOpenMenu={() => setMobileSidebarOpen(true)}
            onNewThread={handleNewThread}
            onSend={sendMessage}
            onCancel={cancel}
          />
        </main>
      </div>
    </AgentActionsContext.Provider>
  );
}
```

- [ ] **Step 4: Run typecheck and observe the expected missing component/type errors**

Run:

```bash
pnpm --dir web typecheck
```

Expected: FAIL because `MobileSidebar` does not exist yet and `ChatView` props have not been updated yet. This confirms Task 1 introduced the planned integration points.

- [ ] **Step 5: Commit Task 1 changes after Task 2 makes typecheck pass**

Do not commit this task while typecheck is failing. Commit Task 1 together with Task 2 after the shell components exist:

```bash
git -C E:/code/agent/agent4 add web/src/app/agentActions.ts web/src/app/AssistantApp.tsx
git -C E:/code/agent/agent4 commit -m "feat(web): wire chat workbench shell state"
```

Expected: commit includes only the two listed files when run after Task 2 typecheck passes.

---

### Task 2: Desktop Sidebar and Mobile Drawer

**Files:**
- Create: `web/src/components/layout/MobileSidebar.tsx`
- Modify: `web/src/components/layout/Sidebar.tsx`
- Commit together with Task 1 app shell files.

- [ ] **Step 1: Refactor the sidebar into a reusable navigation panel**

Replace `web/src/components/layout/Sidebar.tsx` with:

```tsx
interface SidebarProps {
  threads: { id: string; title: string }[];
  currentThreadId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  className?: string;
  onAfterSelect?: () => void;
}

export function Sidebar({
  threads,
  currentThreadId,
  onSelect,
  onNew,
  className = "",
  onAfterSelect,
}: SidebarProps) {
  const handleSelect = (id: string) => {
    onSelect(id);
    onAfterSelect?.();
  };

  return (
    <aside
      className={`h-full w-[260px] shrink-0 flex-col border-r border-neutral-200 bg-[#f3f3f3] px-3 py-3 ${className}`}
    >
      <div className="flex h-12 items-center px-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-neutral-950">Agent Runtime</div>
          <div className="truncate text-xs text-neutral-500">Chat workbench</div>
        </div>
      </div>

      <button
        type="button"
        onClick={onNew}
        className="mb-3 flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-400/30"
      >
        <span className="text-base leading-none">＋</span>
        新建会话
      </button>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {threads.map((thread) => {
          const active = thread.id === currentThreadId;
          return (
            <button
              key={thread.id}
              type="button"
              onClick={() => handleSelect(thread.id)}
              className={`group w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                active
                  ? "bg-white font-medium text-neutral-950 shadow-sm shadow-neutral-200"
                  : "text-neutral-600 hover:bg-white/70 hover:text-neutral-950"
              }`}
            >
              <span className="block truncate">{thread.title || "新会话"}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Add the mobile sidebar drawer**

Create `web/src/components/layout/MobileSidebar.tsx` with:

```tsx
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";

interface MobileSidebarProps {
  open: boolean;
  threads: { id: string; title: string }[];
  currentThreadId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}

export function MobileSidebar({
  open,
  threads,
  currentThreadId,
  onSelect,
  onNew,
  onClose,
}: MobileSidebarProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleNew = () => {
    onNew();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="会话列表">
      <button
        type="button"
        aria-label="关闭会话列表"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 left-0 flex w-[min(82vw,300px)] max-w-full flex-col bg-[#f3f3f3] shadow-xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 px-4">
          <span className="text-sm font-semibold text-neutral-950">会话</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400/30"
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        <Sidebar
          className="flex w-full border-r-0"
          threads={threads}
          currentThreadId={currentThreadId}
          onSelect={onSelect}
          onNew={handleNew}
          onAfterSelect={onClose}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck and fix only shell-related type errors**

Run:

```bash
pnpm --dir web typecheck
```

Expected: FAIL still likely because `ChatView` props have not been updated. Any errors related to `Sidebar` or `MobileSidebar` should be resolved before moving on.

- [ ] **Step 4: Commit Task 1 and Task 2 shell files after Task 3 updates `ChatView` props**

After Task 3 makes typecheck pass, run:

```bash
git -C E:/code/agent/agent4 add web/src/app/agentActions.ts web/src/app/AssistantApp.tsx web/src/components/layout/Sidebar.tsx web/src/components/layout/MobileSidebar.tsx
git -C E:/code/agent/agent4 commit -m "feat(web): add responsive workbench shell"
```

Expected: commit includes only app shell and layout files.

---

### Task 3: Empty State, Composer, and Chat Scroll Behavior

**Files:**
- Create: `web/src/components/agent/Composer.tsx`
- Create: `web/src/components/agent/EmptyState.tsx`
- Modify: `web/src/components/agent/ChatView.tsx`

- [ ] **Step 1: Add the autosizing composer component**

Create `web/src/components/agent/Composer.tsx` with:

```tsx
import { FormEvent, forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface ComposerHandle {
  focus: () => void;
}

interface ComposerProps {
  value: string;
  isRunning: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { value, isRunning, onChange, onSend, onCancel },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, 160);
    textarea.style.height = `${Math.max(nextHeight, 48)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 160 ? "auto" : "hidden";
  }, [value]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.trim() || isRunning) return;
    onSend();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 border-t border-transparent bg-[#f7f7f8] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-[800px] items-end gap-2 rounded-2xl border border-neutral-300 bg-white p-2 shadow-sm transition focus-within:border-neutral-500 focus-within:ring-2 focus-within:ring-neutral-200">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="输入消息，按 Enter 发送，Shift + Enter 换行"
          className="max-h-40 min-h-12 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-3 text-sm leading-6 text-neutral-900 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-400"
          disabled={isRunning}
          rows={1}
        />
        {isRunning ? (
          <button
            type="button"
            onClick={onCancel}
            className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="停止生成"
          >
            <span className="h-3 w-3 rounded-sm bg-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
            aria-label="发送消息"
          >
            ↑
          </button>
        )}
      </div>
    </form>
  );
});
```

- [ ] **Step 2: Add the compact empty state component**

Create `web/src/components/agent/EmptyState.tsx` with:

```tsx
const SUGGESTIONS = [
  "帮我规划一个小功能的实现步骤",
  "解释这个项目的前端结构",
  "给我一个需要工具调用的示例任务",
  "演示一次需要确认的计划流程",
];

interface EmptyStateProps {
  onPickSuggestion: (text: string) => void;
}

export function EmptyState({ onPickSuggestion }: EmptyStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-[800px] flex-1 flex-col items-center justify-center px-1 py-10 text-center">
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
        有什么可以帮忙的？
      </h2>
      <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPickSuggestion(suggestion)}
            className="min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm leading-5 text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace `ChatView` with shell, scroll, empty state, and composer integration**

Replace `web/src/components/agent/ChatView.tsx` with:

```tsx
import { useEffect, useRef, useState } from "react";
import type { UiMessage } from "../../hooks/useAgentRuntime";
import { AssistantMessage } from "./AssistantMessage";
import { Composer, type ComposerHandle } from "./Composer";
import { EmptyState } from "./EmptyState";

interface ChatViewProps {
  title: string;
  messages: UiMessage[];
  isRunning: boolean;
  onOpenMenu: () => void;
  onNewThread: () => void;
  onSend: (message: string) => void;
  onCancel: () => void;
}

const BOTTOM_THRESHOLD = 120;

export function ChatView({
  title,
  messages,
  isRunning,
  onOpenMenu,
  onNewThread,
  onSend,
  onCancel,
}: ChatViewProps) {
  const [draft, setDraft] = useState("");
  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<ComposerHandle | null>(null);
  const followOutputRef = useRef(true);

  const updateNearBottom = () => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    const near = distance <= BOTTOM_THRESHOLD;
    followOutputRef.current = near;
    setIsNearBottom(near);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
    followOutputRef.current = true;
    setIsNearBottom(true);
  };

  useEffect(() => {
    if (followOutputRef.current) {
      scrollToBottom("smooth");
    }
  }, [messages]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || isRunning) return;
    followOutputRef.current = true;
    onSend(text);
    setDraft("");
    requestAnimationFrame(() => scrollToBottom("smooth"));
  };

  const handlePickSuggestion = (text: string) => {
    setDraft(text);
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  return (
    <section className="flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-[#f7f7f8]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200/80 bg-[#f7f7f8]/95 px-3 backdrop-blur sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-300 md:hidden"
            aria-label="打开会话列表"
          >
            ☰
          </button>
          <h1 className="truncate text-sm font-semibold text-neutral-950 sm:text-base">{title || "新会话"}</h1>
        </div>
        <button
          type="button"
          onClick={onNewThread}
          className="hidden h-9 rounded-full px-3 text-sm font-medium text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-300 sm:inline-flex sm:items-center"
        >
          新建会话
        </button>
      </header>

      <div ref={scrollRef} onScroll={updateNearBottom} className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto flex min-h-full w-full max-w-[800px] flex-col gap-5 px-3 py-6 sm:px-6">
          {messages.length === 0 ? (
            <EmptyState onPickSuggestion={handlePickSuggestion} />
          ) : (
            messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex w-full justify-end">
                  <div className="max-w-[min(78%,34rem)] whitespace-pre-wrap break-words rounded-3xl bg-neutral-200 px-4 py-2.5 text-sm leading-6 text-neutral-900 sm:max-w-[72%]">
                    {message.content}
                  </div>
                </div>
              ) : (
                <AssistantMessage key={message.id} message={message} />
              ),
            )
          )}
          <div ref={bottomRef} />
        </div>

        {!isNearBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="sticky bottom-3 left-1/2 z-10 mx-auto mb-3 flex -translate-x-0 items-center rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300"
          >
            回到底部
          </button>
        )}
      </div>

      <Composer
        ref={composerRef}
        value={draft}
        isRunning={isRunning}
        onChange={setDraft}
        onSend={handleSend}
        onCancel={onCancel}
      />
    </section>
  );
}
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm --dir web typecheck
```

Expected: PASS. If it fails, fix only errors introduced by `ChatView`, `Composer`, `EmptyState`, `Sidebar`, `MobileSidebar`, or `AssistantApp` before continuing.

- [ ] **Step 5: Commit shell, sidebar, composer, empty state, and scroll behavior**

Run:

```bash
git -C E:/code/agent/agent4 add web/src/app/agentActions.ts web/src/app/AssistantApp.tsx web/src/components/layout/Sidebar.tsx web/src/components/layout/MobileSidebar.tsx web/src/components/agent/ChatView.tsx web/src/components/agent/Composer.tsx web/src/components/agent/EmptyState.tsx
git -C E:/code/agent/agent4 commit -m "feat(web): add responsive chat workbench layout"
```

Expected: commit succeeds and does not include root `src/` files or `AGENTS.md`.

---

### Task 4: Assistant Message, Timeline, Tools, Plan, and HITL States

**Files:**
- Modify: `web/src/components/agent/AssistantMessage.tsx`
- Modify: `web/src/components/agent/AgentTimeline.tsx`
- Modify: `web/src/components/agent/ToolCallCard.tsx`
- Modify: `web/src/components/agent/PlanCard.tsx`
- Modify: `web/src/components/agent/HitlConfirmCard.tsx`

- [ ] **Step 1: Remove the assistant mega-card and suppress thinking during HITL**

Replace `web/src/components/agent/AssistantMessage.tsx` with:

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { UiMessage } from "../../hooks/useAgentRuntime";
import { useAgentActions } from "../../app/agentActions";
import { AgentTimeline } from "./AgentTimeline";
import { HitlConfirmCard } from "./HitlConfirmCard";
import { PlanCard } from "./PlanCard";
import { ToolCallCard } from "./ToolCallCard";

interface AssistantMessageProps {
  message: UiMessage;
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  const actions = useAgentActions();
  const meta = message.metadata;
  const waitingForConfirm = Boolean(meta.waitingForConfirm && meta.plan);

  return (
    <div className="flex w-full justify-start">
      <div className="min-w-0 flex-1 space-y-3 text-sm leading-7 text-neutral-800">
        <AgentTimeline events={meta.events ?? []} />
        {meta.plan && <PlanCard plan={meta.plan} />}
        {waitingForConfirm && <HitlConfirmCard actions={actions} />}
        <ToolCallCard calls={meta.toolCalls ?? []} />
        {message.content ? (
          <div className="markdown-body text-sm text-neutral-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        ) : waitingForConfirm ? null : (
          <p className="flex items-center gap-2 text-sm text-neutral-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400" />
            正在思考…
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace timeline with collapsed summary and manual override behavior**

Replace `web/src/components/agent/AgentTimeline.tsx` with:

```tsx
import { useEffect, useMemo, useState } from "react";
import type { AgentUIEvent } from "../../types/agent-ui";

const STATUS_LABEL: Record<AgentUIEvent["status"], string> = {
  running: "执行中",
  done: "已完成",
  error: "失败",
};

const STATUS_DOT: Record<AgentUIEvent["status"], string> = {
  running: "bg-neutral-400 animate-pulse",
  done: "bg-emerald-500",
  error: "bg-red-500",
};

function getSummary(events: AgentUIEvent[]) {
  const running = events.find((event) => event.status === "running");
  const failed = events.find((event) => event.status === "error");

  if (running) return running.title.startsWith("任务") ? "正在规划…" : `${running.title}…`;
  if (failed) return failed.description ? `执行失败：${failed.description}` : "执行失败";

  const visibleDone = events.filter((event) => event.status === "done" && !event.type.startsWith("router"));
  const count = visibleDone.length || events.filter((event) => event.status === "done").length;
  return `已完成 ${count} 个步骤`;
}

export function AgentTimeline({ events }: { events: AgentUIEvent[] }) {
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const hasRunning = events.some((event) => event.status === "running");
  const summary = useMemo(() => getSummary(events), [events]);

  useEffect(() => {
    if (manualOpen !== null) return;
    setOpen(hasRunning);
  }, [hasRunning, manualOpen]);

  if (events.length === 0) return null;

  const handleToggle = () => {
    setOpen((current) => {
      const next = !current;
      setManualOpen(next);
      return next;
    });
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/60 text-xs text-neutral-600">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${hasRunning ? STATUS_DOT.running : "bg-neutral-300"}`} />
        <span className="min-w-0 flex-1 truncate font-medium text-neutral-700">{summary}</span>
        <span className="text-neutral-400">{open ? "收起" : "展开"}</span>
      </button>

      {open && (
        <ol className="divide-y divide-neutral-100 border-t border-neutral-100">
          {events.map((event) => (
            <li key={event.id} className="flex min-w-0 items-start gap-2 px-3 py-2">
              <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[event.status]}`} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-medium text-neutral-800">{event.title}</span>
                  <span className="text-[11px] text-neutral-400">{STATUS_LABEL[event.status]}</span>
                </div>
                {event.description && (
                  <p className="mt-0.5 break-words text-[11px] leading-5 text-neutral-500">{event.description}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Make tool calls compact and internally scrollable**

Replace `web/src/components/agent/ToolCallCard.tsx` with:

```tsx
import { useState } from "react";
import type { ToolCallInfo } from "../../types/agent-ui";

const STATUS_LABEL: Record<ToolCallInfo["status"], string> = {
  running: "执行中",
  done: "已完成",
  error: "失败",
};

const STATUS_DOT: Record<ToolCallInfo["status"], string> = {
  running: "bg-neutral-400 animate-pulse",
  done: "bg-emerald-500",
  error: "bg-red-500",
};

function formatValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function ToolCallItem({ call }: { call: ToolCallInfo }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white/70">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[call.status]}`} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-neutral-800">{call.toolName}</span>
        <span className="text-[11px] text-neutral-400">{STATUS_LABEL[call.status]}</span>
        <span className="text-[11px] text-neutral-400">{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-neutral-100 bg-neutral-50/70 px-3 py-3 text-xs">
          {call.input !== undefined && (
            <div className="min-w-0">
              <div className="mb-1 font-medium text-neutral-500">参数</div>
              <pre className="max-h-56 max-w-full overflow-auto rounded-xl bg-white p-3 font-mono text-[11px] leading-5 text-neutral-700 ring-1 ring-neutral-200">
                {formatValue(call.input)}
              </pre>
            </div>
          )}
          {call.output !== undefined && (
            <div className="min-w-0">
              <div className="mb-1 font-medium text-neutral-500">结果</div>
              <pre className="max-h-56 max-w-full overflow-auto rounded-xl bg-white p-3 font-mono text-[11px] leading-5 text-neutral-700 ring-1 ring-neutral-200">
                {formatValue(call.output)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ToolCallCard({ calls }: { calls: ToolCallInfo[] }) {
  const [open, setOpen] = useState(false);
  if (calls.length === 0) return null;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/50 text-xs text-neutral-600">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300"
      >
        <span className="font-medium text-neutral-700">工具调用 · {calls.length} 次</span>
        <span className="text-neutral-400">{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-neutral-100 p-2">
          {calls.map((call) => (
            <ToolCallItem key={call.id} call={call} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Restyle the plan as a structured content block**

Replace `web/src/components/agent/PlanCard.tsx` with:

```tsx
import type { Plan } from "../../types/agent-ui";

export function PlanCard({ plan }: { plan: Plan }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white/70 p-4">
      <div className="mb-3">
        <div className="text-xs font-semibold text-neutral-500">执行计划</div>
        <div className="mt-1 break-words text-sm font-medium leading-6 text-neutral-900">{plan.goal}</div>
      </div>
      <ol className="space-y-2">
        {plan.steps.map((step) => (
          <li key={step.id} className="flex min-w-0 items-start gap-3 text-sm leading-6 text-neutral-700">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-600 ring-1 ring-neutral-200">
              {step.id}
            </span>
            <span className="min-w-0 break-words">{step.task}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 5: Add HITL pending, retry recovery, and button hierarchy**

Replace `web/src/components/agent/HitlConfirmCard.tsx` with:

```tsx
import { useEffect, useState } from "react";
import type { AgentActions } from "../../app/agentActions";

type Mode = "idle" | "modify";
type PendingAction = "confirm" | "reject" | "modify" | null;

export function HitlConfirmCard({ actions }: { actions: AgentActions }) {
  const [mode, setMode] = useState<Mode>("idle");
  const [note, setNote] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [sawRunning, setSawRunning] = useState(false);

  const disabled = Boolean(pendingAction) || actions.isRunning;
  const canSubmitModify = note.trim().length > 0 && !disabled;

  useEffect(() => {
    if (!pendingAction) {
      setSawRunning(false);
      return;
    }

    if (actions.isRunning) {
      setSawRunning(true);
      return;
    }

    if (sawRunning) {
      setPendingAction(null);
      setSawRunning(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setPendingAction(null);
      setSawRunning(false);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [actions.isRunning, pendingAction, sawRunning]);

  const submitConfirm = () => {
    if (disabled) return;
    setPendingAction("confirm");
    actions.resume("confirm");
  };

  const submitReject = () => {
    if (disabled) return;
    setPendingAction("reject");
    actions.resume("reject");
  };

  const submitModify = () => {
    const message = note.trim();
    if (!message || disabled) return;
    setPendingAction("modify");
    actions.resume("modify", message);
  };

  if (mode === "modify") {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
        <div className="mb-3">
          <div className="text-sm font-semibold text-neutral-950">需要你的确认</div>
          <p className="mt-1 text-xs leading-5 text-neutral-600">告诉 Agent 你希望如何调整计划。</p>
        </div>
        <textarea
          className="mb-3 max-h-40 min-h-24 w-full resize-y rounded-xl border border-neutral-300 bg-white p-3 text-sm leading-6 text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="例如：把第二步改成先检查当前文件结构。"
          disabled={disabled}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="h-9 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-300"
            onClick={submitModify}
            disabled={!canSubmitModify}
          >
            {pendingAction === "modify" ? "提交中…" : "提交修改"}
          </button>
          <button
            type="button"
            className="h-9 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setMode("idle")}
            disabled={disabled}
          >
            返回
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-neutral-950">需要你的确认</div>
        <p className="mt-1 text-xs leading-5 text-neutral-600">确认后 Agent 将按上方计划继续执行。</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="h-9 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-300"
          onClick={submitConfirm}
          disabled={disabled}
        >
          {pendingAction === "confirm" ? "执行中…" : "确认执行"}
        </button>
        <button
          type="button"
          className="h-9 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => setMode("modify")}
          disabled={disabled}
        >
          修改计划
        </button>
        <button
          type="button"
          className="h-9 rounded-xl px-3 text-sm font-medium text-red-600 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={submitReject}
          disabled={disabled}
        >
          {pendingAction === "reject" ? "取消中…" : "取消任务"}
        </button>
      </div>
    </section>
  );
}
```

This local pending logic uses only existing `actions.isRunning` plus component mount/unmount behavior. If a request fails or returns to a still-waiting state, buttons re-enable for retry.

- [ ] **Step 6: Run typecheck**

Run:

```bash
pnpm --dir web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Agent presentation and HITL updates**

Run:

```bash
git -C E:/code/agent/agent4 add web/src/components/agent/AssistantMessage.tsx web/src/components/agent/AgentTimeline.tsx web/src/components/agent/ToolCallCard.tsx web/src/components/agent/PlanCard.tsx web/src/components/agent/HitlConfirmCard.tsx
git -C E:/code/agent/agent4 commit -m "feat(web): compact agent process and hitl UI"
```

Expected: commit succeeds and includes only Agent UI component files.

---

### Task 5: Global CSS Guards and Final Validation

**Files:**
- Modify: `web/src/index.css`
- Test: browser at `http://localhost:5173/`

- [ ] **Step 1: Replace global CSS with neutral styling and overflow guards**

Replace `web/src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html,
body,
#root {
  height: 100%;
}

html {
  overflow: hidden;
}

body {
  margin: 0;
  overflow: hidden;
  background: #f7f7f8;
  color: #111827;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

button,
textarea,
input {
  font: inherit;
}

.markdown-body {
  min-width: 0;
  line-height: 1.75;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.markdown-body > :first-child {
  margin-top: 0;
}

.markdown-body > :last-child {
  margin-bottom: 0;
}

.markdown-body p {
  margin: 0.75rem 0;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4 {
  margin: 1.25rem 0 0.5rem;
  color: #0a0a0a;
  font-weight: 650;
  line-height: 1.35;
}

.markdown-body h1 {
  font-size: 1.35rem;
}

.markdown-body h2 {
  font-size: 1.15rem;
}

.markdown-body h3,
.markdown-body h4 {
  font-size: 1rem;
}

.markdown-body ul,
.markdown-body ol {
  margin: 0.75rem 0;
  padding-left: 1.25rem;
}

.markdown-body li {
  margin: 0.35rem 0;
}

.markdown-body blockquote {
  margin: 1rem 0;
  border-left: 3px solid #d4d4d8;
  border-radius: 0 0.75rem 0.75rem 0;
  background: rgba(244, 244, 245, 0.75);
  padding: 0.5rem 1rem;
  color: #525252;
}

.markdown-body a {
  color: #2563eb;
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body strong {
  color: #111827;
  font-weight: 650;
}

.markdown-body code {
  border-radius: 0.45rem;
  background: #f4f4f5;
  padding: 0.15rem 0.4rem;
  color: #27272a;
  font-size: 0.88em;
}

.markdown-body pre {
  max-width: 100%;
  margin: 1rem 0;
  overflow-x: auto;
  border-radius: 0.875rem;
  background: #18181b;
  padding: 1rem;
  color: #f4f4f5;
  overflow-wrap: normal;
  word-break: normal;
}

.markdown-body pre code {
  background: transparent;
  padding: 0;
  color: inherit;
  white-space: pre;
}

.markdown-body table {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: 0.875rem;
}

.markdown-body th,
.markdown-body td {
  border: 1px solid #e5e7eb;
  padding: 0.5rem 0.75rem;
  white-space: nowrap;
}

.markdown-body th {
  background: #f4f4f5;
  color: #111827;
  font-weight: 600;
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #d4d4d8;
  border: 3px solid transparent;
  border-radius: 999px;
  background-clip: content-box;
}

::-webkit-scrollbar-thumb:hover {
  background: #a1a1aa;
  border: 3px solid transparent;
  background-clip: content-box;
}
```

- [ ] **Step 2: Run typecheck and build**

Run:

```bash
pnpm --dir web typecheck
pnpm --dir web build
```

Expected: both commands PASS.

- [ ] **Step 3: Commit CSS and build-readiness changes**

Run:

```bash
git -C E:/code/agent/agent4 add web/src/index.css
git -C E:/code/agent/agent4 commit -m "style(web): polish chat workbench visuals"
```

Expected: commit succeeds and includes only `web/src/index.css`.

- [ ] **Step 4: Desktop manual validation at 1280x720**

With the user's existing local services open at `http://localhost:5173/`, validate:

1. Set viewport to `1280x720`.
2. Desktop sidebar is visible and about `260px` wide.
3. Top bar shows the conversation title and necessary actions only.
4. Assistant messages render without a giant white outer card.
5. User messages are light gray bubbles.
6. Conversation content is centered and close to `760-800px` wide.
7. Composer sits in the bottom layout region and is not absolute-positioned over content.

Expected: all seven observations are true.

- [ ] **Step 5: Mobile manual validation at 390x844**

Set viewport to `390x844` and validate:

1. No horizontal page scrollbar appears.
2. Text does not wrap into single-character columns.
3. Composer is visible and not clipped.
4. Menu button opens the mobile drawer.
5. Drawer locks background scroll.
6. Overlay click closes drawer.
7. Close button closes drawer.
8. Selecting a thread closes drawer.
9. Pressing `Esc` closes drawer.

Expected: all nine observations are true.

- [ ] **Step 6: Interaction validation**

Validate these flows against the running app:

1. Empty state shows `有什么可以帮忙的？` and four compact suggestions.
2. Clicking a suggestion fills the composer and focuses it without sending.
3. `Enter` sends; `Shift+Enter` inserts a newline.
4. During streaming, the stop button is circular and calls cancel.
5. If the user stays within `120px` of the bottom, streaming auto-scrolls.
6. If the user scrolls upward during streaming, the view does not force-scroll to the bottom.
7. When away from bottom, `回到底部` appears and scrolls to the latest message when clicked.
8. Agent timeline is collapsed by default after completion.
9. Running timeline auto-expands unless the user has manually toggled it.
10. Manual timeline expand/collapse is respected as events update for the same message.
11. Tool calls are collapsed by default and can expand to show internally scrollable parameters/results.
12. Plan confirmation shows `需要你的确认` and does not show `正在思考…` while waiting.
13. `确认执行`, `修改计划`, and `取消任务` disable immediately after click and show processing text.
14. Empty modify-plan text cannot submit.
15. If a resume request fails or returns to the same waiting confirmation state, HITL buttons re-enable for retry without changing SSE protocol.

Expected: all fifteen observations are true.

- [ ] **Step 7: Final repository status check**

Run:

```bash
git -C E:/code/agent/agent4 status --short
```

Expected: no modified `web/` files remain. It is acceptable if the unrelated untracked `AGENTS.md` is still listed; do not add it unless the user separately asks.

---

## Self-Review Checklist

Spec coverage:

- Responsive desktop/mobile shell: Tasks 2 and 3.
- Mobile drawer scroll lock, overlay, close button, select close, Esc: Task 2.
- ChatGPT-like neutral layout, centered width, simplified top bar: Tasks 2, 3, and 5.
- Empty state suggestions that fill and focus composer: Task 3.
- Autosizing composer, Enter/Shift+Enter, stop button, focus/disabled/loading states: Task 3.
- Near-bottom threshold, streaming scroll preservation, `回到底部`: Task 3 and Task 5 manual validation.
- Compact timeline with auto behavior and manual override: Task 4.
- Compact tool calls with collapsible parameter/result details: Task 4.
- PlanCard same reading width and lighter styling: Task 4.
- HITL confirmation hierarchy, no thinking indicator, disabled pending, retry recovery without SSE changes: Task 4.
- Typecheck/build/manual validation: Task 5.

Placeholder scan: this plan contains no unfinished placeholder markers or incomplete code markers.

Type consistency:

- `AgentActions` includes `resume` and `isRunning`; `AssistantApp` provides both; `HitlConfirmCard` consumes both.
- `ChatView` receives `title`, `messages`, `isRunning`, `onOpenMenu`, `onNewThread`, `onSend`, and `onCancel`; `AssistantApp` passes all of them.
- `Composer` exposes `ComposerHandle.focus`; `ChatView` uses that handle after suggestion selection.
- `MobileSidebar` uses `Sidebar` with `onAfterSelect`; `Sidebar` defines that optional prop.
