import { AsyncLocalStorage } from "node:async_hooks";

const threadUsers = new Map<string, string>();
const toolUserStorage = new AsyncLocalStorage<string>();

export function bindThreadUser(threadId: string, userId: string): void {
  const existing = threadUsers.get(threadId);
  if (existing && existing !== userId) {
    throw new Error("当前线程属于其他用户");
  }
  threadUsers.set(threadId, userId);
}

export function getThreadUser(threadId: string): string | undefined {
  return threadUsers.get(threadId);
}

export function assertThreadUser(threadId: string, userId: string): void {
  const existing = threadUsers.get(threadId);
  if (!existing) {
    throw new Error("当前线程未绑定用户");
  }
  if (existing !== userId) {
    throw new Error("当前线程属于其他用户");
  }
}

export async function* withActiveToolUser<T>(
  userId: string,
  iterable: AsyncIterable<T>,
): AsyncGenerator<T> {
  const iterator = toolUserStorage.run(userId, () => iterable[Symbol.asyncIterator]());
  while (true) {
    const result = await toolUserStorage.run(userId, () => iterator.next());
    if (result.done) return;
    yield result.value;
  }
}

export function getActiveToolUser(): string | undefined {
  return toolUserStorage.getStore();
}
