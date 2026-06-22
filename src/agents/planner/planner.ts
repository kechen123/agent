import { ChatPromptTemplate } from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { interrupt } from "@langchain/langgraph";
import { model } from "../../services/llm";
import type { Plan, HitlDecision } from "../../types/agent";
import type { AgentRuntimeState } from "../../runtime/state";
import type { AgentDefinition } from "../base";
import { getConversationMessages } from "../../runtime/messages";
import { skillPromptForState, withSkillPrompt } from "../../skills";

export const PlanSchema = z.object({
  goal: z.string().trim().min(1),
  steps: z.array(
    z.object({
      id: z.number(),
      task: z.string().trim().min(1),
    }),
  ).min(1).max(20),
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

const buildChain = (systemPrompt: string) => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    ["placeholder", "{messages}"],
    [
      "human",
      `如果存在 Reflection 反馈，请修正原计划中的问题；如果没有则正常规划。
Reflection 反馈：{reflectionFeedback}`,
    ],
  ]);
  return prompt.pipe(plannerModel);
};

/**
 * PlannerAgent — 生成计划并提交到状态中。
 *
 * 注意：计划生成与 interrupt 分离（见下方 `planConfirmNode`）。
 * interrupt 在恢复时总会从节点开头重新运行，因此昂贵的 LLM
 * 计划生成放在本节点中（本节点会完成并提交 `plan`），便宜的
 * interrupt 则放在单独节点中。这样可避免用户确认/修改时重新生成计划。
 */
export const PlannerAgent: AgentDefinition = {
  name: "plannerAgent",
  description: "将复杂任务拆解为可执行步骤",
  systemPrompt: SYSTEM_PROMPT,
  async invoke(state) {
    const chain = buildChain(withSkillPrompt(SYSTEM_PROMPT, skillPromptForState(state)));
    const res = await chain.invoke({
      messages: getConversationMessages(state.messages),
      reflectionFeedback: state.reflection?.feedback || "（无）",
    });
    const plan: Plan = {
      goal: res.goal.trim(),
      steps: res.steps
        .map((step, index) => ({ id: index + 1, task: step.task.trim() }))
        .filter((step) => step.task.length > 0),
    };
    console.log("[Planner] plan generated", plan);
    return {
      plan,
      currentStep: 0,
      lastExecutedStep: null,
      executionResults: [],
      reflection: null,
      retryCount: 0,
    };
  },
};

/**
 * planConfirmNode — 暂停图执行，询问用户是否确认计划。
 * 恢复执行时，`interrupt()` 会返回用户的 HitlDecision。
 */
export async function planConfirmNode(
  state: AgentRuntimeState,
): Promise<Partial<AgentRuntimeState>> {
  const decision = interrupt<Plan | null, HitlDecision>(state.plan);
  return { decision };
}

/**
 * modifyPlanNode — 根据用户的修改意见重新规划。
 * 将修改意见作为 HumanMessage 追加，并清空旧计划，使 PlannerAgent
 * 从头重新生成计划，然后图会回到 planConfirm。
 */
export async function modifyPlanNode(
  state: AgentRuntimeState,
): Promise<Partial<AgentRuntimeState>> {
  const submittedPlan = state.decision?.plan;
  if (submittedPlan) {
    const plan: Plan = {
      goal: submittedPlan.goal.trim(),
      steps: submittedPlan.steps.map((step, index) => ({
        id: index + 1,
        task: step.task.trim(),
      })),
    };
    return {
      plan,
      currentStep: 0,
      lastExecutedStep: null,
      executionResults: [],
      reflection: null,
      retryCount: 0,
      decision: null,
    };
  }

  const note = state.decision?.message ?? "";
  return {
    plan: null,
    currentStep: 0,
    lastExecutedStep: null,
    executionResults: [],
    reflection: null,
    retryCount: 0,
    decision: null,
    messages: [new HumanMessage(`用户修改意见：${note}`)],
  };
}

/**
 * 用户直接提交完整计划时，再次进入 planConfirm 让用户确认；
 * 用户只提交文字修改意见时，回到 Planner 重新生成计划。
 */
export function routeAfterPlanModification(
  state: AgentRuntimeState,
): "planner" | "planConfirm" {
  return state.plan ? "planConfirm" : "planner";
}

/** 确认 interrupt 之后的条件边。 */
export function routeAfterPlanner(state: AgentRuntimeState): "executor" | "modifyPlan" | "reply" {
  const action = state.decision?.action;
  if (action === "confirm") return "executor";
  if (action === "modify") return "modifyPlan";
  return "reply"; // reject → 回复取消结果
}

export type PlanConfirmResult = { decision: HitlDecision };
