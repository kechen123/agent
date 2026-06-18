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
          <div className="markdown-body text-sm text-neutral-800">
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
}
