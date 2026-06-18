import { MemorySaver } from "@langchain/langgraph";

/**
 * Single in-memory checkpoint store, shared by the compiled graph.
 * Conversation state is keyed by thread_id so each session is isolated.
 */
export const memory = new MemorySaver();

export function getThreadConfig(threadId: string) {
  return { configurable: { thread_id: threadId } };
}
