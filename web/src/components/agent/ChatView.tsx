import { useEffect, useRef, useState } from "react";
import type { UiMessage } from "../../hooks/useAgentRuntime";
import { AssistantMessage } from "./AssistantMessage";
import { Composer, type ComposerHandle, type KnowledgeMode } from "./Composer";

interface ChatViewProps {
  title: string;
  messages: UiMessage[];
  isRunning: boolean;
  onOpenMenu: () => void;
  onNewThread: () => void;
  onSend: (message: string, mode: KnowledgeMode) => void;
  onCancel: () => void;
  enabledSkillsCount: number;
  onOpenSkills: () => void;
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
  enabledSkillsCount,
  onOpenSkills,
}: ChatViewProps) {
  const [draft, setDraft] = useState("");
  const [knowledgeMode, setKnowledgeMode] = useState<KnowledgeMode>("auto");
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
    onSend(text, knowledgeMode);
    setDraft("");
    requestAnimationFrame(() => scrollToBottom("smooth"));
  };

  const isEmpty = messages.length === 0;

  return (
    <section className="flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-white">
      <header className="flex h-14 shrink-0 items-center justify-between bg-white/95 px-3 backdrop-blur sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-300 md:hidden"
            aria-label="打开导航菜单"
          >
            ☰
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-neutral-950 sm:text-base">{title || "新会话"}</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenSkills}
            className="hidden rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-300 sm:inline-flex"
          >
            {enabledSkillsCount} 个 Skills
          </button>
          <button
            type="button"
            onClick={onNewThread}
            className="hidden h-9 rounded-full px-3 text-sm font-medium text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-300 sm:inline-flex sm:items-center"
          >
            新建会话
          </button>
        </div>
      </header>

      <div ref={scrollRef} onScroll={updateNearBottom} className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {isEmpty ? (
          <div className="mx-auto flex min-h-full w-full max-w-[800px] flex-col items-center justify-center gap-6 px-3 py-8 sm:px-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
                今天想让 Agent 做什么？
              </h2>
              <p className="text-sm text-neutral-500">
                直接提问即可；默认会在需要时自动检索知识库，不必记住 /rag。
              </p>
            </div>
            <Composer
              ref={composerRef}
              value={draft}
              isRunning={isRunning}
              knowledgeMode={knowledgeMode}
              onKnowledgeModeChange={setKnowledgeMode}
              onChange={setDraft}
              onSend={handleSend}
              onCancel={onCancel}
              mode="center"
            />
          </div>
        ) : (
          <div className="mx-auto flex min-h-full w-full max-w-[800px] flex-col gap-8 px-3 py-8 sm:px-6">
            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex w-full justify-end">
                  <div className="max-w-[min(82%,36rem)] whitespace-pre-wrap break-words rounded-[22px] bg-[#f4f4f4] px-4 py-2.5 text-[15px] leading-6 text-neutral-900 sm:max-w-[72%]">
                    {message.content}
                  </div>
                </div>
              ) : (
                <AssistantMessage key={message.id} message={message} />
              ),
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {!isNearBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="sticky bottom-3 left-1/2 z-10 mx-auto mb-3 flex items-center rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-300"
          >
            回到底部
          </button>
        )}
      </div>

      {!isEmpty && (
        <Composer
          ref={composerRef}
          value={draft}
          isRunning={isRunning}
          knowledgeMode={knowledgeMode}
          onKnowledgeModeChange={setKnowledgeMode}
          onChange={setDraft}
          onSend={handleSend}
          onCancel={onCancel}
        />
      )}
    </section>
  );
}
