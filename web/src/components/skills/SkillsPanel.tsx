import type { SkillSummary } from "../../types/skills";

interface SkillsPanelProps {
  open: boolean;
  skills: SkillSummary[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

const sourceLabel: Record<SkillSummary["source"], string> = {
  builtin: "内置 Skill",
  project: "项目 Skill",
};

export function SkillsPanel({
  open,
  skills,
  isLoading,
  error,
  onClose,
  onRefresh,
}: SkillsPanelProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="关闭 Skills 面板"
        onClick={onClose}
      />
      <section className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl sm:rounded-l-3xl">
        <header className="flex items-start justify-between gap-4 px-5 py-5">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">Skills</h2>
            <p className="mt-1 text-sm text-neutral-500">当前项目已注册的 Skill，仅用于查看。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-300"
            aria-label="关闭"
          >
            ×
          </button>
        </header>

        <div className="flex items-center justify-between px-5 pb-3">
          <div className="text-sm text-neutral-500">
            已启用 {skills.filter((skill) => skill.enabled).length} 个 Skills
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-full bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? "刷新中" : "刷新"}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {error && (
            <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!error && isLoading && skills.length === 0 && (
            <div className="rounded-3xl bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
              正在加载 Skills…
            </div>
          )}

          {!isLoading && skills.length === 0 && (
            <div className="rounded-3xl bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
              当前没有可用 Skill
            </div>
          )}

          {skills.length > 0 && (
            <div className="space-y-3">
              {skills.map((skill) => (
                <article key={skill.name} className="rounded-3xl bg-neutral-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-neutral-950">{skill.name}</h3>
                      <p className="mt-1 line-clamp-3 text-sm leading-5 text-neutral-600">
                        {skill.description}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                        skill.enabled ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-500"
                      }`}
                    >
                      {skill.enabled ? "已启用" : "未启用"}
                    </span>
                  </div>
                  <div className="mt-3 text-xs font-medium text-neutral-500">{sourceLabel[skill.source]}</div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
