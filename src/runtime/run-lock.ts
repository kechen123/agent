const activeThreads = new Set<string>();

/**
 * 同一 thread 同时只允许一个图运行，避免两个请求并发写入同一个 checkpoint。
 */
export function acquireThreadRun(threadId: string): (() => void) | null {
  if (activeThreads.has(threadId)) return null;
  activeThreads.add(threadId);
  return () => {
    activeThreads.delete(threadId);
  };
}
