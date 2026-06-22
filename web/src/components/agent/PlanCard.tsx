import type { Plan } from "../../types/agent-ui";

export function PlanCard({ plan }: { plan: Plan }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white/70 p-4">
      <div className="mb-3">
        <div className="text-xs font-semibold text-neutral-500">执行计划</div>
        <div className="mt-1 break-words text-sm font-medium leading-6 text-neutral-900">{plan.goal}</div>
      </div>
      <ol className="space-y-2">
        {plan.steps.map((step) => (
          <li key={step.id} className="flex min-w-0 items-start gap-3 text-sm leading-6 text-neutral-700">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-600 ring-1 ring-neutral-200">
              {step.id}
            </span>
            <span className="min-w-0 break-words">{step.task}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
