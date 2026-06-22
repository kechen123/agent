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

  return (
    <div className="flex w-full justify-start">
      <article className="min-w-0 flex-1 text-[15px] leading-7 text-neutral-800">
        <AgentWorkDetails metadata={meta} />
        {message.content ? (
          <div className="markdown-body text-[15px] text-neutral-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
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
        {waitingForConfirm && <HitlConfirmCard actions={actions} />}
      </article>
    </div>
  );
}
