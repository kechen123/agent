import { model } from "../../services/llm";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { PlanStep } from "../../types/agent";
import type { AgentRuntimeState } from "../../runtime/state";
import type { AgentDefinition } from "../base";
import { skillPromptForState, withSkillPrompt } from "../../skills";

const SYSTEM_PROMPT = `你是一个任务执行器（Executor Agent）。
你会收到当前要执行的步骤以及之前的执行结果。
请用一句话简明描述该步骤的执行结果，不要编造未发生的事情，不要调用工具。`;

const buildChain = (systemPrompt: string) => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    [
      "human",
      `目标：{goal}
当前步骤（第 {stepId} 步）：{task}
已执行结果：{previousResults}

请用一句话给出该步骤的执行结果。`,
    ],
  ]);
  return prompt.pipe(model);
};

/**
 * ExecutorAgent — 每次推进计划中的一个步骤。
 * 每次调用都会执行 plan.steps[currentStep]，并追加一条执行结果。
 * 图会驱动多轮执行，直到计划全部完成。
 */
export const ExecutorAgent: AgentDefinition = {
  name: "executorAgent",
  description: "逐步执行计划中的步骤",
  systemPrompt: SYSTEM_PROMPT,
  async invoke(state) {
    const plan = state.plan;
    const currentStep = state.currentStep;

    if (!plan || !plan.steps?.length) {
      return {
        currentStep,
        executionResults: ["没有可执行计划"],
      };
    }

    const step: PlanStep | undefined = plan.steps[currentStep];
    if (!step) {
      return {
        currentStep,
        executionResults: ["所有步骤已执行完成"],
      };
    }

    // 使用 LLM 总结当前步骤的执行结果（保持尽量简短、确定）。
    let result: string;
    try {
      const chain = buildChain(withSkillPrompt(SYSTEM_PROMPT, skillPromptForState(state)));
      const res = await chain.invoke({
        goal: plan.goal,
        stepId: String(step.id),
        task: step.task,
        previousResults: state.executionResults.join("\n") || "（无）",
      });
      result = typeof res.content === "string" ? res.content : `已执行第 ${step.id} 步：${step.task}`;
    } catch (err) {
      result = `已执行第 ${step.id} 步：${step.task}（执行器异常：${(err as Error).message}）`;
    }

    return {
      executionResults: [...state.executionResults, result],
      currentStep: currentStep + 1,
    };
  },
};

/** 条件边：持续执行直到步骤耗尽，然后进入回复。 */
export function routeAfterExecutor(state: AgentRuntimeState): "executor" | "reply" {
  const plan = state.plan;
  if (!plan || !plan.steps?.length) return "reply";
  if (state.currentStep >= plan.steps.length) return "reply";
  return "executor";
}
