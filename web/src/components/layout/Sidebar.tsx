interface SidebarProps {
  threads: { id: string; title: string }[];
  currentThreadId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function Sidebar({ threads, currentThreadId, onSelect, onNew }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 p-3">
        <button
          type="button"
          onClick={onNew}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          + 新建会话
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {threads.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={`mb-1 w-full truncate rounded-md px-3 py-2 text-left text-sm ${
              t.id === currentThreadId
                ? "bg-neutral-100 font-medium text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {t.title || "新会话"}
          </button>
        ))}
      </nav>
    </aside>
  );
}
