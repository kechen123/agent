import { FormEvent, useEffect, useRef, useState } from "react";
import type { UiMessage } from "../../hooks/useAgentRuntime";
import { AssistantMessage } from "./AssistantMessage";

interface ChatViewProps {
  messages: UiMessage[];
  isRunning: boolean;
  threadId: string;
  onSend: (message: string) => void;
  onCancel: () => void;
}

export function ChatView({ messages, isRunning, threadId, onSend, onCancel }: ChatViewProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const shortThreadId = threadId.length > 8 ? threadId.slice(-8) : threadId;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isRunning) return;
    onSend(text);
    setDraft("");
  };

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
        <div className="mx-auto flex max-w-[880px] items-end gap-3 rounded-[24px] border border-neutral-200 bg-white p-2 shadow-lg shadow-neutral-200/70 transition focus-within:border-indigo-300 focus-within:shadow-indigo-100/80">
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
}
