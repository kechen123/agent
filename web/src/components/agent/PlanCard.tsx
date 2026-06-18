import type { Plan } from "../../types/agent-ui";

export function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div className="mb-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-500">
        执行计划
      </div>
      <div className="mb-2 text-sm font-medium text-neutral-800">{plan.goal}</div>
      <ol className="space-y-1">
        {plan.steps.map((step) => (
          <li key={step.id} className="flex items-start gap-2 text-sm text-neutral-700">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs text-white">
              {step.id}
            </span>
            <span>{step.task}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
