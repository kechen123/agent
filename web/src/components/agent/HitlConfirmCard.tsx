import { useState } from "react";
import type { AgentActions } from "../../app/agentActions";

export function HitlConfirmCard({ actions }: { actions: AgentActions }) {
  const [mode, setMode] = useState<"idle" | "modify">("idle");
  const [note, setNote] = useState("");

  if (mode === "modify") {
    return (
      <div className="mb-3 rounded-[20px] border border-amber-200 bg-amber-50/70 p-4 shadow-sm shadow-amber-100/60">
        <div className="mb-3 text-sm font-semibold text-neutral-900">请输入修改意见</div>
        <textarea
          className="mb-3 w-full resize-none rounded-2xl border border-neutral-200 bg-white p-3 text-sm leading-6 text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例如：把第二步改成先检查当前文件结构。"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="h-9 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-medium text-white shadow-sm shadow-indigo-200 transition hover:-translate-y-0.5 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            onClick={() => actions.resume("modify", note)}
          >
            提交修改
          </button>
          <button
            type="button"
            className="h-9 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
            onClick={() => setMode("idle")}
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-[20px] border border-amber-200 bg-amber-50/70 p-4 shadow-sm shadow-amber-100/60">
      <div className="mb-3">
        <div className="text-sm font-semibold text-neutral-900">是否执行该计划？</div>
        <div className="mt-1 text-xs leading-5 text-neutral-600">确认后 Agent 将按上方步骤继续执行。</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="h-9 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-medium text-white shadow-sm shadow-indigo-200 transition hover:-translate-y-0.5 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
          onClick={() => actions.resume("confirm")}
        >
          确认执行
        </button>
        <button
          type="button"
          className="h-9 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
          onClick={() => setMode("modify")}
        >
          修改计划
        </button>
        <button
          type="button"
          className="h-9 rounded-xl px-4 text-sm font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
          onClick={() => actions.resume("reject")}
        >
          取消任务
        </button>
      </div>
    </div>
  );
}
