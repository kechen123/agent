import { useState } from "react";
import type { ToolCallInfo } from "../../types/agent-ui";

function ToolCallItem({ call }: { call: ToolCallInfo }) {
  const [open, setOpen] = useState(false);
  const dot =
    call.status === "running" ? "bg-amber-400" : call.status === "error" ? "bg-red-500" : "bg-emerald-500";
  return (
    <div className="rounded-md border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-neutral-50"
      >
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="font-mono font-medium text-neutral-800">{call.toolName}</span>
        <span className="ml-auto text-xs text-neutral-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="space-y-1 border-t border-neutral-100 px-3 py-2 text-xs">
          {call.input !== undefined && (
            <div>
              <div className="text-neutral-400">参数</div>
              <pre className="overflow-x-auto rounded bg-neutral-50 p-2 text-neutral-700">
                {JSON.stringify(call.input, null, 2)}
              </pre>
            </div>
          )}
          {call.output !== undefined && (
            <div>
              <div className="text-neutral-400">结果</div>
              <pre className="overflow-x-auto rounded bg-neutral-50 p-2 text-neutral-700">
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
    <div className="mb-2 space-y-1.5">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">工具调用</div>
      {calls.map((c) => (
        <ToolCallItem key={c.id} call={c} />
      ))}
    </div>
  );
}
