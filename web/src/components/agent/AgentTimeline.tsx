import { useEffect, useMemo, useState } from "react";
import type { AgentUIEvent } from "../../types/agent-ui";

const STATUS_LABEL: Record<AgentUIEvent["status"], string> = {
  running: "执行中",
  done: "已完成",
  error: "失败",
};

const STATUS_DOT: Record<AgentUIEvent["status"], string> = {
  running: "bg-neutral-400 animate-pulse",
  done: "bg-emerald-500",
  error: "bg-red-500",
};

function getSummary(events: AgentUIEvent[]) {
  const running = events.find((event) => event.status === "running");
  const failed = events.find((event) => event.status === "error");

  if (running) return running.title.startsWith("任务") ? "正在规划…" : `${running.title}…`;
  if (failed) return failed.description ? `执行失败：${failed.description}` : "执行失败";

  const visibleDone = events.filter((event) => event.status === "done" && !event.type.startsWith("router"));
  const count = visibleDone.length || events.filter((event) => event.status === "done").length;
  return `已完成 ${count} 个步骤`;
}

export function AgentTimeline({ events }: { events: AgentUIEvent[] }) {
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const hasRunning = events.some((event) => event.status === "running");
  const summary = useMemo(() => getSummary(events), [events]);

  useEffect(() => {
    if (manualOpen !== null) return;
    setOpen(hasRunning);
  }, [hasRunning, manualOpen]);

  if (events.length === 0) return null;

  const handleToggle = () => {
    setOpen((current) => {
      const next = !current;
      setManualOpen(next);
      return next;
    });
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/60 text-xs text-neutral-600">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${hasRunning ? STATUS_DOT.running : "bg-neutral-300"}`} />
        <span className="min-w-0 flex-1 truncate font-medium text-neutral-700">{summary}</span>
        <span className="text-neutral-400">{open ? "收起" : "展开"}</span>
      </button>

      {open && (
        <ol className="divide-y divide-neutral-100 border-t border-neutral-100">
          {events.map((event) => (
            <li key={event.id} className="flex min-w-0 items-start gap-2 px-3 py-2">
              <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[event.status]}`} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-medium text-neutral-800">{event.title}</span>
                  <span className="text-[11px] text-neutral-400">{STATUS_LABEL[event.status]}</span>
                </div>
                {event.description && (
                  <p className="mt-0.5 break-words text-[11px] leading-5 text-neutral-500">{event.description}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
