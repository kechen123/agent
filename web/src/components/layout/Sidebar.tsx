interface SidebarProps {
  threads: { id: string; title: string }[];
  currentThreadId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  className?: string;
  onAfterSelect?: () => void;
}

export function Sidebar({
  threads,
  currentThreadId,
  onSelect,
  onNew,
  className = "",
  onAfterSelect,
}: SidebarProps) {
  const handleSelect = (id: string) => {
    onSelect(id);
    onAfterSelect?.();
  };

  return (
    <aside
      className={`h-full w-[260px] shrink-0 flex-col border-r border-neutral-200 bg-[#f3f3f3] px-3 py-3 ${className}`}
    >
      <div className="flex h-12 items-center px-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-neutral-950">Agent Runtime</div>
          <div className="truncate text-xs text-neutral-500">Chat workbench</div>
        </div>
      </div>

      <button
        type="button"
        onClick={onNew}
        className="mb-3 flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-400/30"
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
                  ? "bg-white font-medium text-neutral-950 shadow-sm shadow-neutral-200"
                  : "text-neutral-600 hover:bg-white/70 hover:text-neutral-950"
              }`}
            >
              <span className="block truncate">{thread.title || "新会话"}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
