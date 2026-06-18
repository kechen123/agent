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
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm ring-1 ring-neutral-200">
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
          <div className="prose prose-sm max-w-none text-neutral-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-neutral-400">正在思考…</p>
        )}
      </div>
    </div>
  );
}
