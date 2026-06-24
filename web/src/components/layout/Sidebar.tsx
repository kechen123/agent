interface SidebarProps {
  threads: { id: string; title: string }[];
  currentThreadId: string;
  activeSurface: "chat" | "knowledge";
  onSelect: (id: string) => void;
  onNew: () => void;
  className?: string;
  onAfterSelect?: () => void;
  enabledSkillsCount: number;
  onOpenSkills: () => void;
  onOpenKnowledge: () => void;
  knowledgeCount: number | null;
  user: { email: string; name: string | null };
  onLogout: () => void;
}

export function Sidebar({
  threads,
  currentThreadId,
  activeSurface,
  onSelect,
  onNew,
  className = "",
  onAfterSelect,
  enabledSkillsCount,
  onOpenSkills,
  onOpenKnowledge,
  knowledgeCount,
  user,
  onLogout,
}: SidebarProps) {
  const handleSelect = (id: string) => {
    onSelect(id);
    onAfterSelect?.();
  };

  const handleNew = () => {
    onNew();
    onAfterSelect?.();
  };

  const handleOpenKnowledge = () => {
    onOpenKnowledge();
    onAfterSelect?.();
  };

  const handleOpenSkills = () => {
    onOpenSkills();
    onAfterSelect?.();
  };

  return (
    <aside
      className={`box-border h-full w-[260px] shrink-0 flex-col bg-[#171717] px-3 py-3 text-white ${className}`}
    >
      <div className="flex h-12 shrink-0 items-center px-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">Agent Runtime</div>
          <div className="truncate text-xs text-neutral-400">Chat workbench</div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleNew}
        className="mb-3 flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-neutral-800 px-3 text-sm font-medium text-white transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-white/20"
      >
        <span className="text-base leading-none">＋</span>
        新建会话
      </button>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {threads.map((thread) => {
          const active = activeSurface === "chat" && thread.id === currentThreadId;
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

      <div className="mt-3 shrink-0 space-y-2 pt-3">
        <button
          type="button"
          onClick={handleOpenKnowledge}
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-white/20 ${
            activeSurface === "knowledge"
              ? "bg-neutral-700 font-medium text-white"
              : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
          }`}
        >
          <span>知识库</span>
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
            {knowledgeCount ?? "…"}
          </span>
        </button>
        <button
          type="button"
          onClick={handleOpenSkills}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm text-neutral-300 transition hover:bg-neutral-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
        >
          <span>Skills</span>
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
            {enabledSkillsCount}
          </span>
        </button>
        <div className="rounded-xl bg-neutral-900 px-3 py-2.5">
          <div className="truncate text-sm font-medium text-white">{user.name || user.email}</div>
          <div className="truncate text-xs text-neutral-500">{user.email}</div>
          <button
            type="button"
            onClick={onLogout}
            className="mt-2 text-xs font-medium text-neutral-400 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            退出登录
          </button>
        </div>
      </div>
    </aside>
  );
}
