import { HumanMessage } from "@langchain/core/messages";
import { graph } from "./graph";
import { getThreadConfig } from "./memory";
import { registerBuiltinTools } from "../tools";
import { registerBuiltinSkills } from "../skills";

// Register built-in tools & skills once at module load.
registerBuiltinTools();
registerBuiltinSkills();

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
 * Start (or continue) a chat turn for a thread. Returns the raw LangGraph
 * streamEvents stream; callers should pass it through the stream adapter
 * (services/stream.ts) to get standardized AgentStreamEvent values.
 */
export function startChatStream(threadId: string, message: string) {
  return graph.streamEvents(
    { messages: [new HumanMessage(message)] },
    { ...getThreadConfig(threadId), version: "v2" },
  );
}
