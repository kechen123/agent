import { model } from "../../services/llm";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { PlanStep } from "../../types/agent";
import type { AgentRuntimeState } from "../../runtime/state";
import type { AgentDefinition } from "../base";

const SYSTEM_PROMPT = `你是一个任务执行器（Executor Agent）。
你会收到当前要执行的步骤以及之前的执行结果。
请用一句话简明描述该步骤的执行结果，不要编造未发生的事情，不要调用工具。`;

const buildChain = () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPT],
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
 * ExecutorAgent — advances the plan one step at a time.
 * Each invocation executes plan.steps[currentStep] and appends a result.
 * The graph drives multiple passes until the plan is exhausted.
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

    // Use the LLM to summarize the step's outcome (kept minimal/deterministic).
    let result: string;
    try {
      const chain = buildChain();
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
      executionResults: [result],
      currentStep: currentStep + 1,
    };
  },
};

/** Conditional edge: keep executing until steps are exhausted, then reply. */
export function routeAfterExecutor(state: AgentRuntimeState): "executor" | "reply" {
  const plan = state.plan;
  if (!plan || !plan.steps?.length) return "reply";
  if (state.currentStep >= plan.steps.length) return "reply";
  return "executor";
}
