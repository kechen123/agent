import { useEffect, useState } from "react";
import type { AgentActions } from "../../app/agentActions";

type Mode = "idle" | "modify";
type PendingAction = "confirm" | "reject" | "modify" | null;

export function HitlConfirmCard({ actions }: { actions: AgentActions }) {
  const [mode, setMode] = useState<Mode>("idle");
  const [note, setNote] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [sawRunning, setSawRunning] = useState(false);

  const disabled = Boolean(pendingAction) || actions.isRunning;
  const canSubmitModify = note.trim().length > 0 && !disabled;

  useEffect(() => {
    if (!pendingAction) {
      setSawRunning(false);
      return;
    }

    if (actions.isRunning) {
      setSawRunning(true);
      return;
    }

    if (sawRunning) {
      setPendingAction(null);
      setSawRunning(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setPendingAction(null);
      setSawRunning(false);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [actions.isRunning, pendingAction, sawRunning]);

  const submitConfirm = () => {
    if (disabled) return;
    setPendingAction("confirm");
    actions.resume("confirm");
  };

  const submitReject = () => {
    if (disabled) return;
    setPendingAction("reject");
    actions.resume("reject");
  };

  const submitModify = () => {
    const message = note.trim();
    if (!message || disabled) return;
    setPendingAction("modify");
    actions.resume("modify", message);
  };

  if (mode === "modify") {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
        <div className="mb-3">
          <div className="text-sm font-semibold text-neutral-950">需要你的确认</div>
          <p className="mt-1 text-xs leading-5 text-neutral-600">告诉 Agent 你希望如何调整计划。</p>
        </div>
        <textarea
          className="mb-3 max-h-40 min-h-24 w-full resize-y rounded-xl border border-neutral-300 bg-white p-3 text-sm leading-6 text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="例如：把第二步改成先检查当前文件结构。"
          disabled={disabled}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="h-9 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-300"
            onClick={submitModify}
            disabled={!canSubmitModify}
          >
            {pendingAction === "modify" ? "提交中…" : "提交修改"}
          </button>
          <button
            type="button"
            className="h-9 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setMode("idle")}
            disabled={disabled}
          >
            返回
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-neutral-950">需要你的确认</div>
        <p className="mt-1 text-xs leading-5 text-neutral-600">确认后 Agent 将按上方计划继续执行。</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="h-9 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-300"
          onClick={submitConfirm}
          disabled={disabled}
        >
          {pendingAction === "confirm" ? "执行中…" : "确认执行"}
        </button>
        <button
          type="button"
          className="h-9 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => setMode("modify")}
          disabled={disabled}
        >
          修改计划
        </button>
        <button
          type="button"
          className="h-9 rounded-xl px-3 text-sm font-medium text-red-600 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={submitReject}
          disabled={disabled}
        >
          {pendingAction === "reject" ? "取消中…" : "取消任务"}
        </button>
      </div>
    </section>
  );
}
