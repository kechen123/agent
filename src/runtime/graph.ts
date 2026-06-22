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
  ReflectionAgent,
  routeAfterReflection,
  modifyPlanNode,
  routeAfterPlanner,
  ExecutorAgent,
  routeAfterExecutor,
  ReplyAgent,
  ToolAgent,
  routeAfterTool,
} from "../agents";
import { BeginTurnAgent } from "./turn";

/**
 * `tools` 节点在调用时懒构建（而不是在图编译时构建），
 * 因此总能读取当前工具注册表。注册表由 runtime/index.ts 在启动时填充；
 * 如果在模块求值阶段构建 ToolNode，会捕获到空工具集。
 */
async function toolsNode(
  state: AgentRuntimeState,
  config: LangGraphRunnableConfig,
): Promise<Partial<AgentRuntimeState>> {
  const node = createToolNode();
  return (await node.invoke(state, config)) as Partial<AgentRuntimeState>;
}

/**
 * graph.ts 只负责组装流程。这里不放业务提示词；每个节点都委托给
 * AgentDefinition，提示词保存在其 systemPrompt 中。
 *
 * 流程：
 *   START → routerAgent
 *   routerAgent --route-->  chat    → replyAgent → END
 *                           tool    → toolAgent ⇄ tools → replyAgent → END
 *                           plan    → plannerAgent → planConfirm(interrupt)
 *                                        planConfirm --decision-->
 *                                            confirm  → executorAgent ⇄ executor → replyAgent → END
 *                                            modify   → modifyPlanNode → plannerAgent（重新规划）
 *                                            reject   → replyAgent → END
 *                           execute → executorAgent ⇄ executor → replyAgent → END
 */
const workflow = new StateGraph(AgentState)
  .addNode("beginTurn", BeginTurnAgent.invoke)
  .addNode("routerAgent", RouterAgent.invoke)
  .addNode("toolAgent", ToolAgent.invoke)
  .addNode("tools", toolsNode)
  .addNode("plannerAgent", PlannerAgent.invoke)
  .addNode("planConfirm", planConfirmNode)
  .addNode("reflectionAgent", ReflectionAgent.invoke)
  .addNode("modifyPlan", modifyPlanNode)
  .addNode("executorAgent", ExecutorAgent.invoke)
  .addNode("replyAgent", ReplyAgent.invoke)
  .addEdge(START, "beginTurn")
  .addEdge("beginTurn", "routerAgent")
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
  .addEdge("executorAgent", "reflectionAgent")
  .addConditionalEdges("planConfirm", routeAfterPlanner, {
    executor: "executorAgent",
    modifyPlan: "modifyPlan",
    reply: "replyAgent",
  })
  .addEdge("modifyPlan", "plannerAgent")
  .addConditionalEdges("reflectionAgent", routeAfterReflection, {
    executor: "executorAgent",
    planner: "plannerAgent",
    reply: "replyAgent",
  })
  .addEdge("replyAgent", END);


export const graph = workflow.compile({ checkpointer: memory });
