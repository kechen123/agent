import { FormEvent, forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface ComposerHandle {
  focus: () => void;
}

interface ComposerProps {
  value: string;
  isRunning: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { value, isRunning, onChange, onSend, onCancel },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, 160);
    textarea.style.height = `${Math.max(nextHeight, 48)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 160 ? "auto" : "hidden";
  }, [value]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.trim() || isRunning) return;
    onSend();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-[800px] items-end gap-2 rounded-3xl bg-[#f4f4f4] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition focus-within:bg-white focus-within:ring-2 focus-within:ring-neutral-200">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="输入消息，按 Enter 发送，Shift + Enter 换行"
          className="max-h-40 min-h-12 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-3 text-sm leading-6 text-neutral-900 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-400"
          disabled={isRunning}
          rows={1}
        />
        {isRunning ? (
          <button
            type="button"
            onClick={onCancel}
            className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="停止生成"
          >
            <span className="h-3 w-3 rounded-sm bg-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
            aria-label="发送消息"
          >
            ↑
          </button>
        )}
      </div>
    </form>
  );
});
