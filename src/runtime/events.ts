export type { AgentStreamEvent } from "../types/agent";

/** 将标准化事件序列化为 SSE `data:` 行。 */
export function toSseData(event: unknown): string {
  return `data: ${JSON.stringify(event)}`;
}

/** runtime graph 发出的节点名称，供 stream adapter 使用。 */
export const NODE_NAMES = {
  beginTurn: "beginTurn",
  router: "routerAgent",
  planner: "plannerAgent",
  executor: "executorAgent",
  reflection: "reflectionAgent",
  reply: "replyAgent",
  tool: "toolAgent",
} as const;
