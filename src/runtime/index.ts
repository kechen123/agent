import { HumanMessage } from "@langchain/core/messages";
import { graph } from "./graph";
import { getThreadConfig } from "./memory";
import { bootstrapRuntime } from "./bootstrap";
import { getThreadUser, withActiveToolUser } from "./user-context";
import type { RagStrategy } from "../types/agent";

bootstrapRuntime();

export { graph } from "./graph";
export { AgentState, type AgentRuntimeState } from "./state";
export { memory, getThreadConfig } from "./memory";
export {
  isWaitingForConfirm,
  getInterruptPlan,
  getSnapshot,
  resumeStream,
} from "./checkpoints";
export type { AgentStreamEvent } from "./events";

/**
 * 为指定线程开始（或继续）一轮对话。返回原始 LangGraph streamEvents 流；
 * 调用方应将其传给 stream adapter（services/stream.ts），
 * 以得到标准化的 AgentStreamEvent 值。
 */
export async function* startChatStream(
  threadId: string,
  message: string,
  signal?: AbortSignal,
  options?: { ragMode?: boolean; ragStrategy?: RagStrategy; ragContext?: string },
) {
  const userId = getThreadUser(threadId);
  const events = graph.streamEvents(
    {
      messages: [new HumanMessage(message)],
      ragMode: options?.ragMode === true,
      ragStrategy: options?.ragStrategy ?? "search",
      ragContext: options?.ragContext ?? "",
    },
    { ...getThreadConfig(threadId, userId), version: "v2", signal },
  );

  const scopedEvents = userId ? withActiveToolUser(userId, events) : events;
  for await (const event of scopedEvents) {
    yield event;
  }
}
