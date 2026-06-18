# Agent Chat UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing React/Vite Agent Chat frontend into a polished, modern, light-themed AI product UI without changing backend logic, SSE event types, or runtime behavior.

**Architecture:** Keep the current component structure and `useAgentRuntime` data flow intact. Apply UI-only changes through TailwindCSS class names, small presentational helpers, improved Chinese copy, and minor markup adjustments inside existing components. Validate with frontend TypeScript typecheck and Vite startup.

**Tech Stack:** React 18, TypeScript, Vite, TailwindCSS, react-markdown, remark-gfm, pnpm.

---

## File Structure

- Modify `web/src/app/AssistantApp.tsx`
  - Responsibility: application shell layout and passing the current thread id to the chat view for header display.
- Modify `web/src/components/layout/Sidebar.tsx`
  - Responsibility: product sidebar, session list, new-session button, local status block.
- Modify `web/src/components/agent/ChatView.tsx`
  - Responsibility: chat header, centered message scroll area, user message bubble, bottom input composer.
- Modify `web/src/components/agent/AssistantMessage.tsx`
  - Responsibility: assistant message container and markdown styling.
- Modify `web/src/components/agent/AgentTimeline.tsx`
  - Responsibility: compact execution timeline card.
- Modify `web/src/components/agent/PlanCard.tsx`
  - Responsibility: refined execution-plan card.
- Modify `web/src/components/agent/HitlConfirmCard.tsx`
  - Responsibility: refined HITL confirmation and modification UI.
- Modify `web/src/components/agent/ToolCallCard.tsx`
  - Responsibility: collapsed tool-call summaries and readable JSON disclosure.
- Modify `web/src/index.css`
  - Responsibility: global height, body background, font smoothing, scrollbar polish.
- Modify `README.md` and `CLAUDE.md`
  - Responsibility: update frontend UI status in Chinese; do not change backend instructions.

No new dependencies. No backend files under `src/` should change.

---

### Task 1: Application Shell and Chat Header Data

**Files:**
- Modify: `web/src/app/AssistantApp.tsx`
- Modify: `web/src/components/agent/ChatView.tsx`

- [ ] **Step 1: Update `ChatViewProps` to accept `threadId`**

In `web/src/components/agent/ChatView.tsx`, change the props interface from:

```ts
interface ChatViewProps {
  messages: UiMessage[];
  isRunning: boolean;
  onSend: (message: string) => void;
  onCancel: () => void;
}
```

to:

```ts
interface ChatViewProps {
  messages: UiMessage[];
  isRunning: boolean;
  threadId: string;
  onSend: (message: string) => void;
  onCancel: () => void;
}
```

Then change the function signature to:

```ts
export function ChatView({ messages, isRunning, threadId, onSend, onCancel }: ChatViewProps) {
```

- [ ] **Step 2: Pass `currentThreadId` from `AssistantApp`**

In `web/src/app/AssistantApp.tsx`, replace the root layout and `ChatView` usage with:

```tsx
return (
  <AgentActionsContext.Provider value={actions}>
    <div className="flex h-screen w-full overflow-hidden bg-[#f7f7f8] text-neutral-950">
      <Sidebar
        threads={threads}
        currentThreadId={currentThreadId}
        onSelect={setCurrentThreadId}
        onNew={newThread}
      />
      <main className="min-w-0 flex-1">
        <ChatView
          messages={currentThread.messages}
          isRunning={isRunning}
          threadId={currentThreadId}
          onSend={sendMessage}
          onCancel={cancel}
        />
      </main>
    </div>
  </AgentActionsContext.Provider>
);
```

- [ ] **Step 3: Add a short thread id helper in `ChatView`**

Inside `ChatView`, after refs/state declarations, add:

```ts
const shortThreadId = threadId.length > 8 ? threadId.slice(-8) : threadId;
```

- [ ] **Step 4: Run frontend typecheck**

Run:

```bash
cd web && pnpm typecheck
```

Expected: `tsc --noEmit` completes successfully.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/AssistantApp.tsx web/src/components/agent/ChatView.tsx
git commit -m "style: refine app shell layout"
```

---

### Task 2: Sidebar Product Polish

**Files:**
- Modify: `web/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Replace the sidebar markup**

Replace the current `return` body in `Sidebar` with:

```tsx
return (
  <aside className="flex h-screen w-[260px] shrink-0 flex-col border-r border-neutral-200/80 bg-[#f4f4f5] px-3 py-4">
    <div className="px-2 pb-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-semibold text-white shadow-sm shadow-indigo-200">
          AR
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-neutral-950">Agent Runtime</div>
          <div className="truncate text-xs text-neutral-500">LangGraph Agent Workspace</div>
        </div>
      </div>
    </div>

    <button
      type="button"
      onClick={onNew}
      className="mb-4 flex h-11 items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-medium text-white shadow-sm shadow-neutral-300 transition hover:-translate-y-0.5 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
    >
      <span className="text-base leading-none">＋</span>
      新建会话
    </button>

    <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
      {threads.map((t) => {
        const active = t.id === currentThreadId;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={`group w-full rounded-2xl border px-3 py-3 text-left transition ${
              active
                ? "border-white bg-white text-neutral-950 shadow-sm shadow-neutral-200"
                : "border-transparent text-neutral-600 hover:bg-white/70 hover:text-neutral-950"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${active ? "bg-indigo-500" : "bg-neutral-300"}`} />
              <span className="truncate text-sm font-medium">{t.title || "新会话"}</span>
            </div>
            <div className="mt-1 truncate pl-4 text-xs text-neutral-400">本地线程 · {t.id}</div>
          </button>
        );
      })}
    </nav>

    <div className="mt-4 rounded-2xl border border-white/80 bg-white/70 p-3 shadow-sm shadow-neutral-200/70">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-neutral-900">Local Agent</div>
          <div className="mt-0.5 text-xs text-neutral-500">Running</div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          在线
        </div>
      </div>
    </div>
  </aside>
);
```

- [ ] **Step 2: Run frontend typecheck**

Run:

```bash
cd web && pnpm typecheck
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/layout/Sidebar.tsx
git commit -m "style: polish chat sidebar"
```

---

### Task 3: Chat Layout, Header, and Composer

**Files:**
- Modify: `web/src/components/agent/ChatView.tsx`

- [ ] **Step 1: Replace the main `return` layout**

Replace the existing `return` in `ChatView` with this structure, keeping the existing `handleSubmit`, `draft`, `bottomRef`, and keyboard behavior:

```tsx
return (
  <section className="flex h-screen min-w-0 flex-col bg-[#f7f7f8]">
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200/80 bg-white/80 px-6 backdrop-blur">
      <div>
        <h1 className="text-base font-semibold text-neutral-950">Agent Runtime</h1>
        <p className="mt-0.5 text-xs text-neutral-500">LangGraph · Tool Calling · HITL</p>
      </div>
      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 ring-1 ring-emerald-100">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          在线
        </span>
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-mono text-[11px] text-neutral-500">
          thread · {shortThreadId}
        </span>
      </div>
    </header>

    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6 pb-40">
        {messages.length === 0 && (
          <div className="mx-auto mt-16 max-w-2xl rounded-[28px] border border-neutral-200 bg-white/85 p-10 text-center shadow-sm shadow-neutral-200/70">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-semibold text-white shadow-sm shadow-indigo-200">
              AR
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">开始一个新任务</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-500">
              输入你的目标，Agent Runtime 会展示路由、规划、工具调用和人工确认过程。
            </p>
          </div>
        )}

        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="flex w-full justify-end">
              <div className="max-w-[72%] whitespace-pre-wrap rounded-[22px] rounded-br-md bg-neutral-950 px-4 py-3 text-sm leading-6 text-white shadow-sm shadow-neutral-300">
                {message.content}
              </div>
            </div>
          ) : (
            <AssistantMessage key={message.id} message={message} />
          ),
        )}
        <div ref={bottomRef} />
      </div>
    </div>

    <form onSubmit={handleSubmit} className="shrink-0 border-t border-transparent bg-gradient-to-t from-[#f7f7f8] via-[#f7f7f8] to-[#f7f7f8]/0 px-6 pb-5 pt-3">
      <div className="mx-auto flex max-w-[880px] items-end gap-3 rounded-[24px] border border-neutral-200 bg-white p-2 shadow-lg shadow-neutral-200/70 transition-within focus-within:border-indigo-300 focus-within:shadow-indigo-100/80">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="输入消息，按 Enter 发送，Shift + Enter 换行"
          className="max-h-40 min-h-12 flex-1 resize-none border-0 bg-transparent px-3 py-3 text-sm leading-6 text-neutral-900 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-400"
          disabled={isRunning}
          rows={1}
        />
        {isRunning ? (
          <button
            type="button"
            onClick={onCancel}
            className="mb-1 h-10 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
          >
            停止
          </button>
        ) : (
          <button
            type="submit"
            disabled={!draft.trim()}
            className="mb-1 h-10 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-medium text-white shadow-sm shadow-indigo-200 transition hover:-translate-y-0.5 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
          >
            发送
          </button>
        )}
      </div>
    </form>
  </section>
);
```

- [ ] **Step 2: Fix the invalid Tailwind class**

In the composer wrapper above, replace `transition-within` with `transition` if it was copied exactly:

```tsx
className="mx-auto flex max-w-[880px] items-end gap-3 rounded-[24px] border border-neutral-200 bg-white p-2 shadow-lg shadow-neutral-200/70 transition focus-within:border-indigo-300 focus-within:shadow-indigo-100/80"
```

- [ ] **Step 3: Run frontend typecheck**

Run:

```bash
cd web && pnpm typecheck
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/agent/ChatView.tsx
git commit -m "style: refine chat layout and composer"
```

---

### Task 4: Assistant Message and Markdown Polish

**Files:**
- Modify: `web/src/components/agent/AssistantMessage.tsx`

- [ ] **Step 1: Replace assistant message container classes**

Replace the current JSX returned by `AssistantMessage` with:

```tsx
return (
  <div className="flex w-full justify-start">
    <div className="w-full rounded-[24px] border border-neutral-200 bg-white/90 px-5 py-4 shadow-sm shadow-neutral-200/70">
      <AgentTimeline events={meta.events ?? []} />
      {meta.plan && !meta.waitingForConfirm && <PlanCard plan={meta.plan} />}
      <ToolCallCard calls={meta.toolCalls ?? []} />
      {meta.waitingForConfirm && meta.plan && (
        <>
          <PlanCard plan={meta.plan} />
          <HitlConfirmCard actions={actions} />
        </>
      )}
      {message.content ? (
        <div className="prose prose-sm max-w-none text-neutral-800 prose-headings:mb-2 prose-headings:mt-5 prose-headings:font-semibold prose-headings:text-neutral-950 prose-p:my-3 prose-p:leading-7 prose-a:text-indigo-600 prose-strong:text-neutral-950 prose-ul:my-3 prose-ol:my-3 prose-li:my-1.5 prose-blockquote:border-l-indigo-300 prose-blockquote:bg-indigo-50/40 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:text-neutral-600 prose-code:rounded-md prose-code:bg-neutral-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:text-neutral-800 prose-pre:rounded-2xl prose-pre:bg-neutral-950 prose-pre:p-4 prose-pre:text-neutral-100">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-neutral-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
          正在思考…
        </p>
      )}
    </div>
  </div>
);
```

- [ ] **Step 2: Run frontend typecheck**

Run:

```bash
cd web && pnpm typecheck
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/agent/AssistantMessage.tsx
git commit -m "style: polish assistant messages"
```

---

### Task 5: Agent Timeline Card

**Files:**
- Modify: `web/src/components/agent/AgentTimeline.tsx`

- [ ] **Step 1: Replace status label and icon helpers**

Use these constants near the top of the file:

```ts
const STATUS_LABEL: Record<AgentUIEvent["status"], string> = {
  running: "执行中",
  done: "已完成",
  error: "失败",
};

const STATUS_DOT: Record<AgentUIEvent["status"], string> = {
  running: "border-indigo-200 bg-white text-indigo-500",
  done: "border-emerald-100 bg-emerald-50 text-emerald-600",
  error: "border-red-100 bg-red-50 text-red-600",
};
```

- [ ] **Step 2: Add a small status icon renderer**

Add this function before `AgentTimeline`:

```tsx
function StatusIcon({ status }: { status: AgentUIEvent["status"] }) {
  if (status === "running") {
    return <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-500" />;
  }

  if (status === "error") {
    return <span className="text-xs font-semibold">!</span>;
  }

  return <span className="text-xs font-semibold">✓</span>;
}
```

- [ ] **Step 3: Replace the timeline JSX**

Replace the JSX inside `AgentTimeline` with:

```tsx
return (
  <div className="mb-3 rounded-[18px] border border-neutral-200 bg-white p-3 shadow-sm shadow-neutral-200/60">
    <div className="mb-2 flex items-center justify-between gap-3">
      <div className="text-xs font-semibold text-neutral-900">执行过程</div>
      <div className="text-[11px] text-neutral-400">{events.length} 个事件</div>
    </div>
    <ol className="space-y-2">
      {events.map((ev) => (
        <li key={ev.id} className="flex items-start gap-3 rounded-2xl px-1 py-1.5">
          <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${STATUS_DOT[ev.status]}`}>
            <StatusIcon status={ev.status} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-neutral-900">{ev.title}</span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                {STATUS_LABEL[ev.status]}
              </span>
            </div>
            {ev.description && <p className="mt-0.5 truncate text-xs leading-5 text-neutral-500">{ev.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  </div>
);
```

- [ ] **Step 4: Run frontend typecheck and commit**

```bash
cd web && pnpm typecheck
git add web/src/components/agent/AgentTimeline.tsx
git commit -m "style: refine agent timeline"
```

Expected: typecheck succeeds before commit.

---

### Task 6: Plan and HITL Cards

**Files:**
- Modify: `web/src/components/agent/PlanCard.tsx`
- Modify: `web/src/components/agent/HitlConfirmCard.tsx`

- [ ] **Step 1: Replace `PlanCard` JSX**

Use this return body in `PlanCard`:

```tsx
return (
  <div className="mb-3 overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-sm shadow-neutral-200/60">
    <div className="border-l-4 border-indigo-400 px-4 py-3">
      <div className="mb-1 text-xs font-semibold text-indigo-600">执行计划</div>
      <div className="text-sm font-medium leading-6 text-neutral-900">{plan.goal}</div>
    </div>
    <ol className="divide-y divide-neutral-100 px-4 pb-3">
      {plan.steps.map((step) => (
        <li key={step.id} className="flex items-start gap-3 py-3 text-sm text-neutral-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600 ring-1 ring-indigo-100">
            {step.id}
          </span>
          <span className="min-w-0 leading-6">{step.task}</span>
        </li>
      ))}
    </ol>
  </div>
);
```

- [ ] **Step 2: Replace idle mode `HitlConfirmCard` JSX**

Use this return body for idle mode:

```tsx
return (
  <div className="mb-3 rounded-[20px] border border-amber-200 bg-amber-50/70 p-4 shadow-sm shadow-amber-100/60">
    <div className="mb-3">
      <div className="text-sm font-semibold text-neutral-900">是否执行该计划？</div>
      <div className="mt-1 text-xs leading-5 text-neutral-600">确认后 Agent 将按上方步骤继续执行。</div>
    </div>
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="h-9 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-medium text-white shadow-sm shadow-indigo-200 transition hover:-translate-y-0.5 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
        onClick={() => actions.resume("confirm")}
      >
        确认执行
      </button>
      <button
        type="button"
        className="h-9 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
        onClick={() => setMode("modify")}
      >
        修改计划
      </button>
      <button
        type="button"
        className="h-9 rounded-xl px-4 text-sm font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
        onClick={() => actions.resume("reject")}
      >
        取消任务
      </button>
    </div>
  </div>
);
```

- [ ] **Step 3: Replace modify mode `HitlConfirmCard` JSX**

Use this return body when `mode === "modify"`:

```tsx
return (
  <div className="mb-3 rounded-[20px] border border-amber-200 bg-amber-50/70 p-4 shadow-sm shadow-amber-100/60">
    <div className="mb-3 text-sm font-semibold text-neutral-900">请输入修改意见</div>
    <textarea
      className="mb-3 w-full resize-none rounded-2xl border border-neutral-200 bg-white p-3 text-sm leading-6 text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
      rows={3}
      value={note}
      onChange={(e) => setNote(e.target.value)}
      placeholder="例如：把第二步改成先检查当前文件结构。"
    />
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="h-9 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-medium text-white shadow-sm shadow-indigo-200 transition hover:-translate-y-0.5 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
        onClick={() => actions.resume("modify", note)}
      >
        提交修改
      </button>
      <button
        type="button"
        className="h-9 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
        onClick={() => setMode("idle")}
      >
        返回
      </button>
    </div>
  </div>
);
```

- [ ] **Step 4: Run frontend typecheck and commit**

```bash
cd web && pnpm typecheck
git add web/src/components/agent/PlanCard.tsx web/src/components/agent/HitlConfirmCard.tsx
git commit -m "style: polish plan and hitl cards"
```

Expected: typecheck succeeds before commit.

---

### Task 7: Tool Call Card

**Files:**
- Modify: `web/src/components/agent/ToolCallCard.tsx`

- [ ] **Step 1: Add status helpers**

Near the top of `ToolCallCard.tsx`, add:

```ts
const STATUS_LABEL: Record<ToolCallInfo["status"], string> = {
  running: "执行中",
  done: "已完成",
  error: "失败",
};

const STATUS_DOT: Record<ToolCallInfo["status"], string> = {
  running: "bg-indigo-400 animate-pulse",
  done: "bg-emerald-500",
  error: "bg-red-500",
};
```

- [ ] **Step 2: Replace `ToolCallItem` JSX**

Replace the current `return` in `ToolCallItem` with:

```tsx
return (
  <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm shadow-neutral-200/50">
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-neutral-50"
    >
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[call.status]}`} />
      <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-neutral-800">{call.toolName}</span>
      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
        {STATUS_LABEL[call.status]}
      </span>
      <span className="text-xs text-neutral-400">{open ? "收起" : "展开"}</span>
    </button>
    {open && (
      <div className="space-y-3 border-t border-neutral-100 bg-neutral-50/70 px-3 py-3 text-xs">
        {call.input !== undefined && (
          <div>
            <div className="mb-1 font-medium text-neutral-500">参数</div>
            <pre className="max-h-56 overflow-auto rounded-2xl bg-white p-3 font-mono text-[11px] leading-5 text-neutral-700 ring-1 ring-neutral-200">
              {JSON.stringify(call.input, null, 2)}
            </pre>
          </div>
        )}
        {call.output !== undefined && (
          <div>
            <div className="mb-1 font-medium text-neutral-500">结果</div>
            <pre className="max-h-56 overflow-auto rounded-2xl bg-white p-3 font-mono text-[11px] leading-5 text-neutral-700 ring-1 ring-neutral-200">
              {typeof call.output === "string" ? call.output : JSON.stringify(call.output, null, 2)}
            </pre>
          </div>
        )}
      </div>
    )}
  </div>
);
```

- [ ] **Step 3: Replace `ToolCallCard` wrapper JSX**

Use this return body:

```tsx
return (
  <div className="mb-3 space-y-2">
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="font-semibold text-neutral-900">工具调用</span>
      <span className="text-neutral-400">{calls.length} 次</span>
    </div>
    {calls.map((c) => (
      <ToolCallItem key={c.id} call={c} />
    ))}
  </div>
);
```

- [ ] **Step 4: Remove unused local variable**

Remove the old `const dot = ...` variable from `ToolCallItem`; the new JSX uses `STATUS_DOT`.

- [ ] **Step 5: Run frontend typecheck and commit**

```bash
cd web && pnpm typecheck
git add web/src/components/agent/ToolCallCard.tsx
git commit -m "style: refine tool call cards"
```

Expected: typecheck succeeds before commit.

---

### Task 8: Global CSS and Documentation Copy

**Files:**
- Modify: `web/src/index.css`
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update global CSS**

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

body {
  margin: 0;
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

- [ ] **Step 2: Update README frontend UI status**

In `README.md`, replace the `## assistant-ui 状态` section text with wording that says the current frontend uses a custom polished Chat UI while keeping `@assistant-ui/react` for future migration:

```md
## assistant-ui 状态

当前前端保留 `@assistant-ui/react` 依赖，但实际界面使用自研 Chat UI。界面已覆盖：

- 用户消息和 AI 流式回复
- 执行过程时间线
- 执行计划卡片
- 工具调用折叠卡片
- HITL 确认 / 修改 / 取消操作
- SSE 接收与消息元数据折叠

原因是当前安装的 assistant-ui `0.7.x` 中，`Thread` 的自定义消息 API 与原接入方式不兼容。后续替换回 assistant-ui 标准 Runtime 时，应先读取实际安装版本的类型定义再改代码。
```

- [ ] **Step 3: Update CLAUDE.md frontend UI wording**

In `CLAUDE.md`, replace phrasing that describes the UI as temporary/demo-like with wording that says the project currently uses a custom Chat UI and keeps assistant-ui as a future migration target. Preserve backend instructions and the non-monorepo warning.

Use this sentence where appropriate:

```md
前端当前使用自研 Chat UI 渲染消息、执行过程、计划、工具调用和 HITL 操作；`@assistant-ui/react` 依赖保留，后续替换回 assistant-ui 标准 Runtime 时，应先读取实际安装版本的类型定义再改代码。
```

- [ ] **Step 4: Run frontend typecheck and commit**

```bash
cd web && pnpm typecheck
git add web/src/index.css README.md CLAUDE.md
git commit -m "docs: update frontend UI status"
```

Expected: typecheck succeeds before commit.

---

### Task 9: Final Verification and Push

**Files:**
- Verify: all modified frontend and documentation files

- [ ] **Step 1: Run frontend typecheck**

Run:

```bash
cd web && pnpm typecheck
```

Expected: success.

- [ ] **Step 2: Start the frontend dev server**

Run:

```bash
cd web && pnpm dev
```

Expected: Vite starts and prints a local URL, usually `http://localhost:5173`.

If run through Claude Code in background, stop it after confirming startup.

- [ ] **Step 3: Confirm no backend or SSE protocol files changed**

Run:

```bash
git diff --name-only HEAD~8..HEAD
```

Expected changed paths are limited to docs, `CLAUDE.md`, `README.md`, and `web/src/app`, `web/src/components`, `web/src/index.css`. There should be no changes under backend `src/` except none.

- [ ] **Step 4: Push to GitHub**

Run:

```bash
git push
```

Expected: push succeeds. If no remote is configured, report that push was skipped because this repository has no GitHub remote.

- [ ] **Step 5: Final response**

Report:

1. 改了哪些组件。
2. 主要 UI 优化点。
3. 如何启动前端。
4. 是否通过 typecheck。
5. 是否已推送到 GitHub；如果没有，说明原因。

---

## Self-Review

- Spec coverage: plan includes layout, sidebar, header, user/AI messages, Markdown, AgentTimeline, PlanCard, HitlConfirmCard, ToolCallCard, input composer, Chinese docs, typecheck, dev startup, backend/SSE non-modification check, and push.
- Placeholder scan: no TBD/TODO placeholders remain; each implementation task names exact files and gives concrete code or commands.
- Type consistency: `threadId` is added to `ChatViewProps` and passed from `AssistantApp`; `AgentUIEvent["status"]` and `ToolCallInfo["status"]` match existing frontend types; no backend event fields are added.
