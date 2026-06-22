interface SidebarProps {
  threads: { id: string; title: string }[];
  currentThreadId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  className?: string;
  onAfterSelect?: () => void;
  enabledSkillsCount: number;
  onOpenSkills: () => void;
}

export function Sidebar({
  threads,
  currentThreadId,
  onSelect,
  onNew,
  className = "",
  onAfterSelect,
  enabledSkillsCount,
  onOpenSkills,
}: SidebarProps) {
  const handleSelect = (id: string) => {
    onSelect(id);
    onAfterSelect?.();
  };

  return (
    <aside
      className={`h-full w-[260px] shrink-0 flex-col bg-[#171717] px-3 py-3 text-white ${className}`}
    >
      <div className="flex h-12 items-center px-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">Agent Runtime</div>
          <div className="truncate text-xs text-neutral-400">Chat workbench</div>
        </div>
      </div>

      <button
        type="button"
        onClick={onNew}
        className="mb-3 flex h-10 items-center justify-center gap-2 rounded-xl bg-neutral-800 px-3 text-sm font-medium text-white transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-white/20"
      >
        <span className="text-base leading-none">＋</span>
        新建会话
      </button>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {threads.map((thread) => {
          const active = thread.id === currentThreadId;
          return (
            <button
              key={thread.id}
              type="button"
              onClick={() => handleSelect(thread.id)}
              className={`group w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                active
                  ? "bg-neutral-700 font-medium text-white"
                  : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              <span className="block truncate">{thread.title || "新会话"}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-3 pt-3">
        <button
          type="button"
          onClick={onOpenSkills}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm text-neutral-300 transition hover:bg-neutral-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
        >
          <span>Skills</span>
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
            {enabledSkillsCount}
          </span>
        </button>
      </div>
    </aside>
  );
}
