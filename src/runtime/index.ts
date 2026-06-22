import { HumanMessage } from "@langchain/core/messages";
import { graph } from "./graph";
import { getThreadConfig } from "./memory";
import { bootstrapRuntime } from "./bootstrap";

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
export function startChatStream(threadId: string, message: string, signal?: AbortSignal) {
  return graph.streamEvents(
    { messages: [new HumanMessage(message)] },
    { ...getThreadConfig(threadId), version: "v2", signal },
  );
}
