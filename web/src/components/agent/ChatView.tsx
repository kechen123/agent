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
