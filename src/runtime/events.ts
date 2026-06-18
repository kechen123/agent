export type { AgentStreamEvent } from "../types/agent";

/** Serialize a standardized event as an SSE `data:` line. */
export function toSseData(event: unknown): string {
  return `data: ${JSON.stringify(event)}`;
}

/** Node names emitted by the runtime graph — used by the stream adapter. */
export const NODE_NAMES = {
  router: "routerAgent",
  planner: "plannerAgent",
  executor: "executorAgent",
  reply: "replyAgent",
  tool: "toolAgent",
} as const;
