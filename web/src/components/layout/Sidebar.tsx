interface SidebarProps {
  threads: { id: string; title: string }[];
  currentThreadId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function Sidebar({ threads, currentThreadId, onSelect, onNew }: SidebarProps) {
  return (
    <aside className="flex h-screen w-[260px] shrink-0 flex-col border-r border-neutral-200/80 bg-[#f4f4f5] px-3 py-4">
      <div className="px-2 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-semibold text-white shadow-sm shadow-indigo-200">
            AR
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-neutral-950">Agent Runtime</div>
            <div className="truncate text-xs text-neutral-500">LangGraph Agent Workspace</div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onNew}
        className="mb-4 flex h-11 items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-medium text-white shadow-sm shadow-neutral-300 transition hover:-translate-y-0.5 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
      >
        <span className="text-base leading-none">＋</span>
        新建会话
      </button>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {threads.map((t) => {
          const active = t.id === currentThreadId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={`group w-full rounded-2xl border px-3 py-3 text-left transition ${
                active
                  ? "border-white bg-white text-neutral-950 shadow-sm shadow-neutral-200"
                  : "border-transparent text-neutral-600 hover:bg-white/70 hover:text-neutral-950"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${active ? "bg-indigo-500" : "bg-neutral-300"}`} />
                <span className="truncate text-sm font-medium">{t.title || "新会话"}</span>
              </div>
              <div className="mt-1 truncate pl-4 text-xs text-neutral-400">本地线程 · {t.id}</div>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 rounded-2xl border border-white/80 bg-white/70 p-3 shadow-sm shadow-neutral-200/70">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-neutral-900">Local Agent</div>
            <div className="mt-0.5 text-xs text-neutral-500">Running</div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            在线
          </div>
        </div>
      </div>
    </aside>
  );
}
