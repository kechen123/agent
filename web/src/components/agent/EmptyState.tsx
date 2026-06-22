const SUGGESTIONS = [
  "帮我规划一个小功能的实现步骤",
  "解释这个项目的前端结构",
  "给我一个需要工具调用的示例任务",
  "演示一次需要确认的计划流程",
];

interface EmptyStateProps {
  onPickSuggestion: (text: string) => void;
}

export function EmptyState({ onPickSuggestion }: EmptyStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-[800px] flex-1 flex-col items-center justify-center px-1 py-10 text-center">
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
        有什么可以帮忙的？
      </h2>
      <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPickSuggestion(suggestion)}
            className="min-w-0 rounded-2xl bg-neutral-100 px-4 py-3 text-left text-sm leading-5 text-neutral-700 transition hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-300"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
