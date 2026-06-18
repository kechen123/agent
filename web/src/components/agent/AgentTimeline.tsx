import type { AgentUIEvent } from "../../types/agent-ui";

const STATUS_LABEL: Record<AgentUIEvent["status"], string> = {
  running: "执行中",
  done: "已完成",
  error: "失败",
};

const STATUS_DOT: Record<AgentUIEvent["status"], string> = {
  running: "border-indigo-200 bg-white text-indigo-500",
  done: "border-emerald-100 bg-emerald-50 text-emerald-600",
  error: "border-red-100 bg-red-50 text-red-600",
};

function StatusIcon({ status }: { status: AgentUIEvent["status"] }) {
  if (status === "running") {
    return <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-500" />;
  }

  if (status === "error") {
    return <span className="text-xs font-semibold">!</span>;
  }

  return <span className="text-xs font-semibold">✓</span>;
}

export function AgentTimeline({ events }: { events: AgentUIEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="mb-3 rounded-[18px] border border-neutral-200 bg-white p-3 shadow-sm shadow-neutral-200/60">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-neutral-900">执行过程</div>
        <div className="text-[11px] text-neutral-400">{events.length} 个事件</div>
      </div>
      <ol className="space-y-2">
        {events.map((ev) => (
          <li key={ev.id} className="flex items-start gap-3 rounded-2xl px-1 py-1.5">
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${STATUS_DOT[ev.status]}`}>
              <StatusIcon status={ev.status} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-neutral-900">{ev.title}</span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                  {STATUS_LABEL[ev.status]}
                </span>
              </div>
              {ev.description && <p className="mt-0.5 truncate text-xs leading-5 text-neutral-500">{ev.description}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
