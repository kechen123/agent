import { MemorySaver } from "@langchain/langgraph";

/**
 * 单一内存 checkpoint 存储，由编译后的图共享。
 * 对话状态以 thread_id 为键，确保每个会话相互隔离。
 */
export const memory = new MemorySaver();

export function getThreadConfig(threadId: string, userId?: string) {
  return {
    configurable: {
      thread_id: threadId,
      ...(userId ? { user_id: userId } : {}),
    },
  };
}
