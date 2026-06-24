import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

export type KnowledgeMode = "auto" | "chat" | "rag";

export interface ComposerHandle {
  focus: () => void;
}

interface ComposerProps {
  value: string;
  isRunning: boolean;
  knowledgeMode: KnowledgeMode;
  onKnowledgeModeChange: (mode: KnowledgeMode) => void;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  mode?: "bottom" | "center";
}

const QUICK_ACTIONS = [
  {
    value: "总结一下我知识库里的核心配置和注意事项",
    label: "总结知识库",
    description: "自动检索已入库资料并汇总重点",
  },
  {
    value: "帮我制定一个三步执行计划：",
    label: "制定计划",
    description: "拆成可确认、可执行的步骤",
  },
  {
    value: "查询北京天气",
    label: "调用工具",
    description: "演示工具调用与结果汇总",
  },
];

const MODE_OPTIONS: Array<{
  value: KnowledgeMode;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: "auto",
    label: "自动参考知识库",
    shortLabel: "自动",
    description: "先轻量检索，命中相关资料后再引用。",
  },
  {
    value: "rag",
    label: "只用知识库",
    shortLabel: "只用知识库",
    description: "强制基于知识库回答，没找到就明确说明。",
  },
  {
    value: "chat",
    label: "关闭知识库",
    shortLabel: "关闭",
    description: "普通对话，不触发知识库检索。",
  },
];

const MODE_LABEL: Record<KnowledgeMode, string> = {
  auto: "自动",
  rag: "只用知识库",
  chat: "知识库关闭",
};

const MODE_HINT: Record<KnowledgeMode, string> = {
  auto: "需要时自动参考知识库",
  rag: "本次只从知识库回答",
  chat: "本次不查知识库",
};

function isRagCommandOnly(value: string): boolean {
  return value.trim().toLowerCase() === "/rag";
}

function normalizeCommandDraft(value: string): string {
  const trimmed = value.trimStart();
  const match = /^\/rag(?:\s+|$)/i.exec(trimmed);
  if (!match) return value;
  return trimmed.slice(match[0].length);
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  {
    value,
    isRunning,
    knowledgeMode,
    onKnowledgeModeChange,
    onChange,
    onSend,
    onCancel,
    mode = "bottom",
  },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const showQuickActions = focused && value === "" && !isRunning && !modeMenuOpen;
  const canSend = Boolean(value.trim()) && !isRunning && !isRagCommandOnly(value);

  const helperText = useMemo(() => {
    if (isRunning) return "正在生成，点击停止按钮可中断";
    if (value.trimStart().toLowerCase().startsWith("/rag")) {
      return "已识别为只用知识库";
    }
    return MODE_HINT[knowledgeMode];
  }, [isRunning, knowledgeMode, value]);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, 180);
    textarea.style.height = `${Math.max(nextHeight, 56)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 180 ? "auto" : "hidden";
  }, [value]);

  useEffect(() => {
    if (!modeMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      setModeMenuOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [modeMenuOpen]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend) return;
    onSend();
  };

  const handlePickValue = (nextValue: string) => {
    onChange(nextValue);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleModeChange = (nextMode: KnowledgeMode) => {
    onKnowledgeModeChange(nextMode);
    setModeMenuOpen(false);

    if (nextMode === "rag") {
      onChange(normalizeCommandDraft(value));
    }
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const shellClass =
    mode === "center"
      ? "w-full px-3 sm:px-6"
      : "shrink-0 bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 sm:px-6";
  const menuPositionClass =
    mode === "center"
      ? "top-[calc(100%+0.5rem)]"
      : "bottom-[calc(100%+0.5rem)]";

  return (
    <form onSubmit={handleSubmit} className={shellClass}>
      <div className="relative mx-auto w-full max-w-[800px]">
        {showQuickActions && (
          <div className="mb-3 flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handlePickValue(action.value)}
                className="group rounded-full bg-[#f5f2ec] px-3 py-2 text-left text-xs font-medium text-neutral-700 transition hover:-translate-y-0.5 hover:bg-neutral-950 hover:text-white focus:outline-none focus:ring-2 focus:ring-neutral-300"
                title={action.description}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-[28px] bg-white p-2 shadow-[0_12px_48px_rgba(15,23,42,0.13)] transition focus-within:shadow-[0_16px_60px_rgba(15,23,42,0.18)]">
          <textarea
            ref={textareaRef}
            value={value}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={
              knowledgeMode === "chat"
                ? "输入消息……"
                : "直接提问，需要时会自动参考知识库"
            }
            className="max-h-44 min-h-14 w-full resize-none bg-transparent px-3 py-3 text-[15px] leading-6 text-neutral-950 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-400 sm:px-4"
            disabled={isRunning}
            rows={1}
          />

          <div className="flex items-center justify-between gap-2 px-1 pb-1 sm:px-2">
            <div ref={menuRef} className="relative flex min-w-0 items-center gap-2">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setModeMenuOpen((open) => !open)}
                disabled={isRunning}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-[#f5f2ec] px-3 text-xs font-medium text-neutral-800 transition hover:bg-[#eee9df] focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-60"
                aria-haspopup="menu"
                aria-expanded={modeMenuOpen}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{MODE_LABEL[knowledgeMode]}</span>
                <span className="text-[10px] text-neutral-500">⌄</span>
              </button>

              <span className="hidden truncate text-xs text-neutral-400 sm:block">{helperText}</span>

              {modeMenuOpen && (
                <div className={`absolute left-0 z-20 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-[20px] bg-white p-1 shadow-[0_18px_55px_rgba(15,23,42,0.16)] ${menuPositionClass}`}>
                  <div className="px-3 pb-1 pt-1.5 text-[11px] font-medium text-neutral-400">
                    知识库模式
                  </div>
                  {MODE_OPTIONS.map((option) => {
                    const active = option.value === knowledgeMode;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleModeChange(option.value)}
                        className={`flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-neutral-300 ${
                          active ? "bg-[#f5f2ec]" : "hover:bg-neutral-50"
                        }`}
                        role="menuitemradio"
                        aria-checked={active}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                            active
                              ? "bg-neutral-950 text-white"
                              : "bg-neutral-100 text-transparent"
                          }`}
                        >
                          {active ? "✓" : ""}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-medium text-neutral-950">
                            {option.label}
                            {option.value === "auto" && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                推荐
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs leading-4 text-neutral-500">
                            {option.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {isRunning ? (
              <button
                type="button"
                onClick={onCancel}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-300"
                aria-label="停止生成"
              >
                <span className="h-3 w-3 rounded-sm bg-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-lg leading-none text-white transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
                aria-label="发送消息"
              >
                ↑
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
});
