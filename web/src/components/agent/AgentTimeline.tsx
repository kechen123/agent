import type { AgentUIEvent } from "../../types/agent-ui";

const STATUS_STYLE: Record<AgentUIEvent["status"], string> = {
  running: "bg-amber-400 animate-pulse",
  done: "bg-emerald-500",
  error: "bg-red-500",
};

const STATUS_ICON: Record<AgentUIEvent["status"], string> = {
  running: "◌",
  done: "✓",
  error: "✕",
};

export function AgentTimeline({ events }: { events: AgentUIEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="mb-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Agent 执行过程
      </div>
      <ol className="space-y-1.5">
        {events.map((ev) => (
          <li key={ev.id} className="flex items-start gap-2 text-sm">
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] text-white ${STATUS_STYLE[ev.status]}`}
            >
              {STATUS_ICON[ev.status]}
            </span>
            <div className="min-w-0">
              <span className="font-medium text-neutral-800">{ev.title}</span>
              {ev.description && (
                <span className="ml-1 text-neutral-500">— {ev.description}</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
