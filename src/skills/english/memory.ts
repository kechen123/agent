import {
  EmptyEnglishLearnerMemory,
  type EnglishLearnerMemory,
} from "./types";

/** 单条记忆最多保留的条目数，防止 prompt 上下文无限增长。 */
const MAX_MISTAKES = 20;
const MAX_PHRASES = 30;
const MAX_GOALS = 5;

/**
 * 内存版学习者记忆。
 *
 * MVP 不做持久化：进程重启后清空。
 * 通过 threadId 隔离不同会话；同一 thread 内的多轮对话共享同一份记忆。
 *
 * 后续要接 DB 时，只需把内部 Map 替换成数据库读写即可，方法签名保持不变。
 */
export class EnglishLearnerMemoryStore {
  private readonly store = new Map<string, EnglishLearnerMemory>();

  read(threadId: string): EnglishLearnerMemory {
    return this.store.get(threadId) ?? { ...EmptyEnglishLearnerMemory };
  }

  updateLevel(threadId: string, level: string): void {
    const next = this.read(threadId);
    next.level = level.trim() || next.level;
    this.store.set(threadId, next);
  }

  appendMistake(threadId: string, mistake: string): void {
    const trimmed = mistake.trim();
    if (!trimmed) return;
    const next = this.read(threadId);
    // 去重并保持最近在前
    next.commonMistakes = [trimmed, ...next.commonMistakes.filter((m) => m !== trimmed)].slice(
      0,
      MAX_MISTAKES,
    );
    this.store.set(threadId, next);
  }

  addLearnedPhrase(threadId: string, phrase: string): void {
    const trimmed = phrase.trim();
    if (!trimmed) return;
    const next = this.read(threadId);
    next.learnedPhrases = [trimmed, ...next.learnedPhrases.filter((p) => p !== trimmed)].slice(
      0,
      MAX_PHRASES,
    );
    this.store.set(threadId, next);
  }

  setGoals(threadId: string, goals: string[]): void {
    const next = this.read(threadId);
    next.goals = goals.filter(Boolean).slice(0, MAX_GOALS);
    this.store.set(threadId, next);
  }

  /** 导出当前快照，便于调试 / 演示脚本打印。 */
  snapshot(threadId: string): EnglishLearnerMemory {
    return { ...this.read(threadId) };
  }
}

/** 全局单例，与 `MemorySaver` 解耦：第一版不参与 checkpoint。 */
export const englishMemoryStore = new EnglishLearnerMemoryStore();
