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
