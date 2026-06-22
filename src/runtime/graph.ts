import { StateGraph, START, END } from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { AgentState, type AgentRuntimeState } from "./state";
import { memory } from "./memory";
import { createToolNode } from "../tools";
import { getSkillByName } from "../skills";
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
  routeAfterPlanModification,
  ReplyAgent,
  ToolAgent,
  routeAfterTool,
} from "../agents";
import { BeginTurnAgent } from "./turn";

/**
 * `tools` 节点在调用时懒构建（而不是在图编译时构建）。
 *
 * 这样做有两个目的：
 * 1. 启动完成后再读取工具注册表，避免图编译时捕获空工具集；
 * 2. 根据当前 State 中选中的 Skill 动态应用工具白名单。
 */
async function toolsNode(
  state: AgentRuntimeState,
  config: LangGraphRunnableConfig,
): Promise<Partial<AgentRuntimeState>> {
  const skill = state.skillName ? getSkillByName(state.skillName) : undefined;
  const node = createToolNode(skill?.tools);
  return (await node.invoke(state, config)) as Partial<AgentRuntimeState>;
}

/**
 * graph.ts 只负责组装流程。这里不放业务提示词；每个节点都委托给
 * AgentDefinition，提示词保存在其 systemPrompt 中。
 *
 * 流程：
 *   START → beginTurn → routerAgent
 *   routerAgent --route-->  chat    → replyAgent → END
 *                           tool    → toolAgent ⇄ tools → replyAgent → END
 *                           plan    → plannerAgent → planConfirm(interrupt)
 *                                        planConfirm --decision-->
 *                                            confirm  → executorAgent → reflectionAgent
 *                                                           ├─ pass  → 下一步 Executor / Reply
 *                                                           ├─ retry → 当前步 Executor
 *                                                           ├─ replan→ Planner
 *                                                           └─ fail  → Reply
 *                                            modify   → modifyPlanNode → plannerAgent（重新规划）
 *                                            reject   → replyAgent → END
 *                           execute → executorAgent → reflectionAgent
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
  .addConditionalEdges("modifyPlan", routeAfterPlanModification, {
    planner: "plannerAgent",
    planConfirm: "planConfirm",
  })
  .addConditionalEdges("reflectionAgent", routeAfterReflection, {
    executor: "executorAgent",
    planner: "plannerAgent",
    reply: "replyAgent",
  })
  .addEdge("replyAgent", END);


export const graph = workflow.compile({ checkpointer: memory });
