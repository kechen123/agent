import { ChatPromptTemplate } from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { interrupt } from "@langchain/langgraph";
import { model } from "../../services/llm";
import type { Plan, HitlDecision } from "../../types/agent";
import type { AgentRuntimeState } from "../../runtime/state";
import type { AgentDefinition } from "../base";

export const PlanSchema = z.object({
  goal: z.string(),
  steps: z.array(
    z.object({
      id: z.number(),
      task: z.string(),
    }),
  ),
});

const SYSTEM_PROMPT = `你是一名专业的任务规划专家（Planner Agent）。

职责：
1. 理解用户目标
2. 将复杂任务拆解为多个可执行步骤
3. 每个步骤必须具体、明确、可执行
4. 不要执行任务
5. 不要解释
6. 只负责规划

规划原则：
- 每个步骤只能做一件事
- 步骤之间必须有先后顺序
- 优先拆分为最小可执行单元
- 如果任务非常简单（1步即可完成），只返回1个步骤
- 不要生成无意义步骤
- 不要生成重复步骤
- 不要输出最终答案
- 不要调用工具`;

const plannerModel = model.withStructuredOutput(PlanSchema, {
  name: "create_task_plan",
  method: "functionCalling",
});

const buildChain = () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPT],
    ["placeholder", "{messages}"],
  ]);
  return prompt.pipe(plannerModel);
};

/**
 * PlannerAgent — generates the plan and commits it to state.
 *
 * NOTE: generation is split from the interrupt (see `planConfirmNode` below).
 * An interrupt always re-runs its node from the top on resume, so the expensive
 * LLM generation lives in THIS node (which completes and commits `plan`) while
 * the cheap interrupt lives in a separate node. This avoids regenerating the
 * plan when the user confirms/modifies.
 */
export const PlannerAgent: AgentDefinition = {
  name: "plannerAgent",
  description: "将复杂任务拆解为可执行步骤",
  systemPrompt: SYSTEM_PROMPT,
  async invoke(state) {
    // If a plan already exists (re-entry after modify), keep it.
    if (state.plan !== null) {
      return { currentStep: 0 };
    }
    const chain = buildChain();
    const res = await chain.invoke({ messages: state.messages });
    const plan: Plan = { goal: res.goal, steps: res.steps };
    console.log("[Planner] plan generated", plan);
    return { plan, currentStep: 0 };
  },
};

/**
 * planConfirmNode — pauses the graph to ask the user to confirm the plan.
 * On resume, `interrupt()` returns the user's HitlDecision.
 */
export async function planConfirmNode(
  state: AgentRuntimeState,
): Promise<Partial<AgentRuntimeState>> {
  const decision = interrupt<Plan | null, HitlDecision>(state.plan);
  return { decision };
}

/**
 * modifyPlanNode — re-plans using the user's modification note.
 * Appends the note as a HumanMessage and clears the old plan so PlannerAgent
 * regenerates from scratch, then the graph loops back through planConfirm.
 */
export async function modifyPlanNode(
  state: AgentRuntimeState,
): Promise<Partial<AgentRuntimeState>> {
  const note = state.decision?.message ?? "";
  return {
    plan: null,
    decision: null,
    messages: [new HumanMessage(`用户修改意见：${note}`)],
  };
}

/** Conditional edge after the confirm interrupt. */
export function routeAfterPlanner(state: AgentRuntimeState): "executor" | "modifyPlan" | "reply" {
  const action = state.decision?.action;
  if (action === "confirm") return "executor";
  if (action === "modify") return "modifyPlan";
  return "reply"; // reject → reply with cancellation
}

export type PlanConfirmResult = { decision: HitlDecision };
