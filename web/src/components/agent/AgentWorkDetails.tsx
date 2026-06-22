import { useEffect, useMemo, useState } from "react";
import type { AgentMessageMetadata, AgentUIEvent } from "../../types/agent-ui";

const STATUS_DOT: Record<AgentUIEvent["status"], string> = {
  running: "bg-neutral-900 animate-pulse",
  done: "bg-emerald-500",
  error: "bg-red-500",
};

function summaryOf(metadata: AgentMessageMetadata): string {
  if (metadata.streamStatus === "error") return "执行遇到问题";
  if (metadata.waitingForConfirm) return "计划已就绪，等待确认";

  const runningTool = metadata.toolCalls.find((call) => call.status === "running");
  if (runningTool) return `正在使用 ${runningTool.toolName}`;

  const runningEvent = metadata.events.find((event) => event.status === "running");
  if (runningEvent) return runningEvent.title;

  const completedSteps = metadata.events.filter(
    (event) => event.type === "executor:end" && event.status === "done",
  ).length;
  if (completedSteps > 0) return `已完成 ${completedSteps} 个步骤`;

  if (metadata.toolCalls.length > 0) return `已完成 ${metadata.toolCalls.length} 次工具调用`;
  if (metadata.plan) return "计划已生成";
  return "已完成处理";
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AgentWorkDetails({ metadata }: { metadata: AgentMessageMetadata }) {
  const visibleEvents = metadata.events.filter(
    (event) =>
      !event.type.startsWith("router") &&
      !(metadata.plan && event.type.startsWith("planner")),
  );
  const hasWork =
    visibleEvents.length > 0 ||
    metadata.toolCalls.length > 0 ||
    Boolean(metadata.plan);
  const isActive =
    metadata.streamStatus === "streaming" ||
    Boolean(metadata.waitingForConfirm) ||
    metadata.events.some((event) => event.status === "running") ||
    metadata.toolCalls.some((call) => call.status === "running");
  const [open, setOpen] = useState(isActive);
  const [manuallyToggled, setManuallyToggled] = useState(false);
  const summary = useMemo(() => summaryOf(metadata), [metadata]);

  useEffect(() => {
    if (!manuallyToggled) setOpen(isActive);
  }, [isActive, manuallyToggled]);

  if (!hasWork) return null;

  return (
    <div className="mb-3 text-sm text-neutral-500">
      <button
        type="button"
        onClick={() => {
          setManuallyToggled(true);
          setOpen((value) => !value);
        }}
        className="group flex items-center gap-2 rounded-lg py-1 text-left transition hover:text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-200"
        aria-expanded={open}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            metadata.streamStatus === "error"
              ? "bg-red-500"
              : isActive
                ? "bg-neutral-900 animate-pulse"
                : "bg-emerald-500"
          }`}
        />
        <span className="font-medium">{summary}</span>
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="m6 8 4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
        </svg>
      </button>

      {open && (
        <div className="ml-3 mt-2 space-y-4 pl-2">
          {metadata.plan && (
            <section>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                执行计划
              </div>
              <ol className="max-h-56 space-y-2 overflow-y-auto pr-2">
                {metadata.plan.steps.map((step) => (
                  <li key={step.id} className="flex gap-3 text-sm leading-6 text-neutral-600">
                    <span className="w-4 shrink-0 text-right text-xs leading-6 text-neutral-400">
                      {step.id}
                    </span>
                    <span className="min-w-0 break-words">{step.task}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {metadata.events.length > 0 && (
            <section className="space-y-2">
            {visibleEvents.map((event) => (
                  <div key={event.id} className="flex min-w-0 items-start gap-3">
                    <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[event.status]}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-neutral-700">{event.title}</div>
                      {event.description && (
                        <div className="break-words text-xs leading-5 text-neutral-400">
                          {event.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </section>
          )}

          {metadata.toolCalls.length > 0 && (
            <section className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                工具调用
              </div>
              {metadata.toolCalls.map((call) => (
                <details key={call.id} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-neutral-600">
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT[call.status]}`} />
                    <span className="font-mono text-xs font-medium text-neutral-700">
                      {call.toolName}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {call.status === "running"
                        ? "执行中"
                        : call.status === "error"
                          ? "失败"
                          : "已完成"}
                    </span>
                  </summary>
                  <div className="mt-2 space-y-2 pl-4">
                    {call.input !== undefined && (
                      <pre className="max-h-52 overflow-auto rounded-xl bg-neutral-100 p-3 font-mono text-xs leading-5 text-neutral-600">
                        {formatValue(call.input)}
                      </pre>
                    )}
                    {call.output !== undefined && (
                      <pre className="max-h-52 overflow-auto rounded-xl bg-neutral-100 p-3 font-mono text-xs leading-5 text-neutral-600">
                        {formatValue(call.output)}
                      </pre>
                    )}
                  </div>
                </details>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
