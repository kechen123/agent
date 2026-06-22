import { useEffect } from "react";
import { Sidebar } from "./Sidebar";

interface MobileSidebarProps {
  open: boolean;
  threads: { id: string; title: string }[];
  currentThreadId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}

export function MobileSidebar({
  open,
  threads,
  currentThreadId,
  onSelect,
  onNew,
  onClose,
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

  const handleNew = () => {
    onNew();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="会话列表">
      <button
        type="button"
        aria-label="关闭会话列表"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 left-0 flex w-[min(82vw,300px)] max-w-full flex-col bg-[#f3f3f3] shadow-xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 px-4">
          <span className="text-sm font-semibold text-neutral-950">会话</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400/30"
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        <Sidebar
          className="flex w-full border-r-0"
          threads={threads}
          currentThreadId={currentThreadId}
          onSelect={onSelect}
          onNew={handleNew}
          onAfterSelect={onClose}
        />
      </div>
    </div>
  );
}
