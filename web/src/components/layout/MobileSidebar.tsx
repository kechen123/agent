import { useEffect } from "react";
import { Sidebar } from "./Sidebar";

interface MobileSidebarProps {
  open: boolean;
  threads: { id: string; title: string }[];
  currentThreadId: string;
  activeSurface: "chat" | "knowledge";
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
  enabledSkillsCount: number;
  onOpenSkills: () => void;
  onOpenKnowledge: () => void;
  knowledgeCount: number | null;
  user: { email: string; name: string | null };
  onLogout: () => void;
}

export function MobileSidebar({
  open,
  threads,
  currentThreadId,
  activeSurface,
  onSelect,
  onNew,
  onClose,
  enabledSkillsCount,
  onOpenSkills,
  onOpenKnowledge,
  knowledgeCount,
  user,
  onLogout,
}: MobileSidebarProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="导航菜单">
      <button
        type="button"
        aria-label="关闭导航菜单"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 left-0 flex w-[min(82vw,300px)] max-w-full flex-col bg-[#171717] shadow-2xl">
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <span className="text-sm font-semibold text-white">导航</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <Sidebar
            className="flex h-full w-full pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
            threads={threads}
            currentThreadId={currentThreadId}
            activeSurface={activeSurface}
            onSelect={onSelect}
            onNew={onNew}
            onAfterSelect={onClose}
            enabledSkillsCount={enabledSkillsCount}
            onOpenSkills={onOpenSkills}
            onOpenKnowledge={onOpenKnowledge}
            knowledgeCount={knowledgeCount}
            user={user}
            onLogout={onLogout}
          />
        </div>
      </div>
    </div>
  );
}
