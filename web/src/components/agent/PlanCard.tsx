import type { Plan } from "../../types/agent-ui";

export function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div className="mb-3 overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-sm shadow-neutral-200/60">
      <div className="border-l-4 border-indigo-400 px-4 py-3">
        <div className="mb-1 text-xs font-semibold text-indigo-600">执行计划</div>
        <div className="text-sm font-medium leading-6 text-neutral-900">{plan.goal}</div>
      </div>
      <ol className="divide-y divide-neutral-100 px-4 pb-3">
        {plan.steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3 py-3 text-sm text-neutral-700">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600 ring-1 ring-indigo-100">
              {step.id}
            </span>
            <span className="min-w-0 leading-6">{step.task}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
