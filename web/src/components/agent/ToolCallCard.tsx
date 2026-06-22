import { useState } from "react";
import type { ToolCallInfo } from "../../types/agent-ui";

const STATUS_LABEL: Record<ToolCallInfo["status"], string> = {
  running: "执行中",
  done: "已完成",
  error: "失败",
};

const STATUS_DOT: Record<ToolCallInfo["status"], string> = {
  running: "bg-neutral-400 animate-pulse",
  done: "bg-emerald-500",
  error: "bg-red-500",
};

function formatValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function ToolCallItem({ call }: { call: ToolCallInfo }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white/70">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[call.status]}`} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-neutral-800">{call.toolName}</span>
        <span className="text-[11px] text-neutral-400">{STATUS_LABEL[call.status]}</span>
        <span className="text-[11px] text-neutral-400">{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-neutral-100 bg-neutral-50/70 px-3 py-3 text-xs">
          {call.input !== undefined && (
            <div className="min-w-0">
              <div className="mb-1 font-medium text-neutral-500">参数</div>
              <pre className="max-h-56 max-w-full overflow-auto rounded-xl bg-white p-3 font-mono text-[11px] leading-5 text-neutral-700 ring-1 ring-neutral-200">
                {formatValue(call.input)}
              </pre>
            </div>
          )}
          {call.output !== undefined && (
            <div className="min-w-0">
              <div className="mb-1 font-medium text-neutral-500">结果</div>
              <pre className="max-h-56 max-w-full overflow-auto rounded-xl bg-white p-3 font-mono text-[11px] leading-5 text-neutral-700 ring-1 ring-neutral-200">
                {formatValue(call.output)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ToolCallCard({ calls }: { calls: ToolCallInfo[] }) {
  const [open, setOpen] = useState(false);
  if (calls.length === 0) return null;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/50 text-xs text-neutral-600">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300"
      >
        <span className="font-medium text-neutral-700">工具调用 · {calls.length} 次</span>
        <span className="text-neutral-400">{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-neutral-100 p-2">
          {calls.map((call) => (
            <ToolCallItem key={call.id} call={call} />
          ))}
        </div>
      )}
    </div>
  );
}
