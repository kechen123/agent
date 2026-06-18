import { useState } from "react";
import type { AgentActions } from "../../app/agentActions";

export function HitlConfirmCard({ actions }: { actions: AgentActions }) {
  const [mode, setMode] = useState<"idle" | "modify">("idle");
  const [note, setNote] = useState("");

  if (mode === "modify") {
    return (
      <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
        <div className="mb-2 text-sm font-medium text-neutral-800">请输入修改意见：</div>
        <textarea
          className="mb-2 w-full rounded border border-neutral-300 p-2 text-sm outline-none focus:border-amber-400"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例如：把第二步改成…"
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded bg-amber-500 px-3 py-1 text-sm text-white hover:bg-amber-600"
            onClick={() => actions.resume("modify", note)}
          >
            提交修改
          </button>
          <button
            type="button"
            className="rounded border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100"
            onClick={() => setMode("idle")}
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <div className="mb-2 text-sm font-medium text-neutral-800">是否执行该计划？</div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-emerald-500 px-3 py-1 text-sm text-white hover:bg-emerald-600"
          onClick={() => actions.resume("confirm")}
        >
          确认执行
        </button>
        <button
          type="button"
          className="rounded bg-amber-500 px-3 py-1 text-sm text-white hover:bg-amber-600"
          onClick={() => setMode("modify")}
        >
          修改计划
        </button>
        <button
          type="button"
          className="rounded border border-neutral-300 px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-100"
          onClick={() => actions.resume("reject")}
        >
          取消任务
        </button>
      </div>
    </div>
  );
}
