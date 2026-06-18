import { useState } from "react";
import type { ToolCallInfo } from "../../types/agent-ui";

const STATUS_LABEL: Record<ToolCallInfo["status"], string> = {
  running: "执行中",
  done: "已完成",
  error: "失败",
};

const STATUS_DOT: Record<ToolCallInfo["status"], string> = {
  running: "bg-indigo-400 animate-pulse",
  done: "bg-emerald-500",
  error: "bg-red-500",
};

function ToolCallItem({ call }: { call: ToolCallInfo }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm shadow-neutral-200/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-neutral-50"
      >
        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[call.status]}`} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-neutral-800">{call.toolName}</span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
          {STATUS_LABEL[call.status]}
        </span>
        <span className="text-xs text-neutral-400">{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-neutral-100 bg-neutral-50/70 px-3 py-3 text-xs">
          {call.input !== undefined && (
            <div>
              <div className="mb-1 font-medium text-neutral-500">参数</div>
              <pre className="max-h-56 overflow-auto rounded-2xl bg-white p-3 font-mono text-[11px] leading-5 text-neutral-700 ring-1 ring-neutral-200">
                {JSON.stringify(call.input, null, 2)}
              </pre>
            </div>
          )}
          {call.output !== undefined && (
            <div>
              <div className="mb-1 font-medium text-neutral-500">结果</div>
              <pre className="max-h-56 overflow-auto rounded-2xl bg-white p-3 font-mono text-[11px] leading-5 text-neutral-700 ring-1 ring-neutral-200">
                {typeof call.output === "string" ? call.output : JSON.stringify(call.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ToolCallCard({ calls }: { calls: ToolCallInfo[] }) {
  if (calls.length === 0) return null;
  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-neutral-900">工具调用</span>
        <span className="text-neutral-400">{calls.length} 次</span>
      </div>
      {calls.map((c) => (
        <ToolCallItem key={c.id} call={c} />
      ))}
    </div>
  );
}
