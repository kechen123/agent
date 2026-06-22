import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { UiMessage } from "../../hooks/useAgentRuntime";
import { useAgentActions } from "../../app/agentActions";
import { AgentWorkDetails } from "./AgentWorkDetails";
import { HitlConfirmCard } from "./HitlConfirmCard";

interface AssistantMessageProps {
  message: UiMessage;
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  const actions = useAgentActions();
  const meta = message.metadata;
  const waitingForConfirm = Boolean(meta.waitingForConfirm && meta.plan);
  const failed = meta.streamStatus === "error";
  const cancelled = meta.streamStatus === "cancelled";
  const completedWithoutContent =
    meta.streamStatus === "completed" && !message.content;

  return (
    <div className="flex w-full justify-start">
      <article className="min-w-0 flex-1 text-[15px] leading-7 text-neutral-800">
        <AgentWorkDetails metadata={meta} />
        {message.content ? (
          <div className="markdown-body text-[15px] text-neutral-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        ) : failed ? (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            本次运行失败，请展开上方执行过程查看具体原因。
          </p>
        ) : cancelled ? (
          <p className="text-sm text-neutral-500">已停止生成。</p>
        ) : completedWithoutContent ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            运行已结束，但没有生成最终回复。
          </p>
        ) : waitingForConfirm ? null : (
          <p className="flex items-center gap-2 text-sm text-neutral-400" aria-live="polite">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400 [animation-delay:300ms]" />
            </span>
            正在处理
          </p>
        )}
        {waitingForConfirm ? <HitlConfirmCard actions={actions} /> : null}
      </article>
    </div>
  );
}
