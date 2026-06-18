import { StateGraph, START, END } from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { AgentState, type AgentRuntimeState } from "./state";
import { memory } from "./memory";
import { createToolNode } from "../tools";
import {
  RouterAgent,
  routeAfterRouter,
  PlannerAgent,
  planConfirmNode,
  modifyPlanNode,
  routeAfterPlanner,
  ExecutorAgent,
  routeAfterExecutor,
  ReplyAgent,
  ToolAgent,
  routeAfterTool,
} from "../agents";

/**
 * `tools` node is built lazily at invocation time (not at graph-compile time)
 * so it always reads the current tool registry. The registry is populated by
 * runtime/index.ts on startup; building the ToolNode during module eval would
 * capture an empty toolset.
 */
async function toolsNode(
  state: AgentRuntimeState,
  config: LangGraphRunnableConfig,
): Promise<Partial<AgentRuntimeState>> {
  const node = createToolNode();
  return (await node.invoke(state, config)) as Partial<AgentRuntimeState>;
}

/**
 * graph.ts only assembles the flow. No business prompts live here — every
 * node delegates to an AgentDefinition whose systemPrompt holds the prompt.
 *
 * Flow:
 *   START → routerAgent
 *   routerAgent --route-->  chat    → replyAgent → END
 *                           tool    → toolAgent ⇄ tools → replyAgent → END
 *                           plan    → plannerAgent → planConfirm(interrupt)
 *                                        planConfirm --decision-->
 *                                            confirm  → executorAgent ⇄ executor → replyAgent → END
 *                                            modify   → modifyPlanNode → plannerAgent (re-plan)
 *                                            reject   → replyAgent → END
 *                           execute → executorAgent ⇄ executor → replyAgent → END
 */
const workflow = new StateGraph(AgentState)
  .addNode("routerAgent", RouterAgent.invoke)
  .addNode("toolAgent", ToolAgent.invoke)
  .addNode("tools", toolsNode)
  .addNode("plannerAgent", PlannerAgent.invoke)
  .addNode("planConfirm", planConfirmNode)
  .addNode("modifyPlan", modifyPlanNode)
  .addNode("executorAgent", ExecutorAgent.invoke)
  .addNode("replyAgent", ReplyAgent.invoke)
  .addEdge(START, "routerAgent")
  .addConditionalEdges("routerAgent", routeAfterRouter, {
    chat: "replyAgent",
    tool: "toolAgent",
    plan: "plannerAgent",
    execute: "executorAgent",
  })
  .addConditionalEdges("toolAgent", routeAfterTool, {
    tools: "tools",
    reply: "replyAgent",
  })
  .addEdge("tools", "toolAgent")
  .addEdge("plannerAgent", "planConfirm")
  .addConditionalEdges("planConfirm", routeAfterPlanner, {
    executor: "executorAgent",
    modifyPlan: "modifyPlan",
    reply: "replyAgent",
  })
  .addEdge("modifyPlan", "plannerAgent")
  .addConditionalEdges("executorAgent", routeAfterExecutor, {
    executor: "executorAgent",
    reply: "replyAgent",
  })
  .addEdge("replyAgent", END);

export const graph = workflow.compile({ checkpointer: memory });
