import { FormEvent, useEffect, useRef, useState } from "react";
import type { UiMessage } from "../../hooks/useAgentRuntime";
import { AssistantMessage } from "./AssistantMessage";

interface ChatViewProps {
  messages: UiMessage[];
  isRunning: boolean;
  onSend: (message: string) => void;
  onCancel: () => void;
}

export function ChatView({ messages, isRunning, onSend, onCancel }: ChatViewProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

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
    <section className="flex h-full flex-col bg-neutral-50">
      <div className="border-b border-neutral-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-neutral-900">Agent Runtime</h1>
        <p className="text-sm text-neutral-500">
          当前临时使用自研 Chat UI 跑通 SSE；TODO：后续替换为 assistant-ui 标准 Runtime。
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.length === 0 && (
          <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
            <h2 className="text-xl font-semibold text-neutral-900">开始一个新任务</h2>
            <p className="mt-2 text-sm text-neutral-500">
              输入消息后，前端会通过 POST /chat 打开 SSE 流并展示 AgentTimeline、PlanCard、ToolCallCard 与 HITL 确认卡片。
            </p>
          </div>
        )}

        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="flex w-full justify-end">
              <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-neutral-900 px-4 py-3 text-sm text-white shadow-sm">
                {message.content}
              </div>
            </div>
          ) : (
            <AssistantMessage key={message.id} message={message} />
          ),
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-neutral-200 bg-white p-4">
        <div className="mx-auto flex max-w-4xl gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="输入消息，按 Enter 发送，Shift+Enter 换行"
            className="min-h-12 flex-1 resize-none rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-900"
            disabled={isRunning}
          />
          {isRunning ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              停止
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              className="rounded-xl bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              发送
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
