import { model } from "../../services/llm";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import type { PlanStep } from "../../types/agent";
import type { AgentRuntimeState } from "../../runtime/state";
import type { AgentDefinition } from "../base";
import { skillPromptForState, withSkillPrompt } from "../../skills";

export const ReflectionSchema = z.object({
  status: z.enum(["pass", "retry", "replan", "fail"]),
  reason: z.string(),
  feedback: z.string(),
});

const SYSTEM_PROMPT = `你是 Reflection Agent，负责检查 Executor Agent 的执行结果。

职责：
1. 判断当前步骤是否已经完成
2. 判断是否需要重试
3. 判断是否需要重新规划
4. 判断是否无法继续
5. 不要执行任务
6. 不要调用工具
7. 只输出结构化判断

判断规则：
- pass：当前步骤已经完成
- retry：当前步骤结果不够好，但原计划仍然可行
- replan：当前计划不合理，需要重新规划
- fail：无法继续执行`;

const reflectionModel = model.withStructuredOutput(ReflectionSchema, {
  name: "reflect_execution_result",
  method: "functionCalling",
});

const buildChain = (systemPrompt: string) => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    [
      "human",
      `用户目标：{goal}

      当前计划：
      {plan}

      当前步骤：
      {currentStep}

      本次执行结果：
      {executorResult}

      全部执行结果：
      {executionResults}

      重试次数：
      {retryCount}/{maxRetries}

      请判断下一步应该 pass、retry、replan 还是 fail。`,
    ],
  ]);

  return prompt.pipe(reflectionModel);
};

export const ReflectionAgent: AgentDefinition = {
  name: "reflectionAgent",
  description: "检查执行结果并决定继续、重试、重规划或失败",
  systemPrompt: SYSTEM_PROMPT,
  async invoke(state) {
    const plan = state.plan;
    const currentStepIndex = Math.max(0, state.currentStep - 1);
    const step = plan?.steps?.[currentStepIndex];

    const executorResult = state.executionResults[state.executionResults.length - 1] ?? "（无执行结果）";

    if (!plan || !step) {
      return {
        reflection: {
          status: "fail",
          reason: "没有可检查的计划或步骤",
          feedback: "请先生成有效计划",
        },
      };
    }

    const chain = buildChain(withSkillPrompt(SYSTEM_PROMPT, skillPromptForState(state)));

    const res = await chain.invoke({
      goal: plan.goal,
      plan: JSON.stringify(plan, null, 2),
      currentStep: `第 ${step.id} 步：${step.task}`,
      executorResult,
      executionResults: state.executionResults.join("\n") || "（无）",
      retryCount: String(state.retryCount ?? 0),
      maxRetries: String(state.maxRetries ?? 2),
    });

    return {
      reflection: res,
    };
  },
};

export function routeAfterReflection(state: AgentRuntimeState): "executor" | "planner" | "reply" {
  const status = state.reflection?.status;

  if (status === "pass") {
    const plan = state.plan;

    if (!plan || state.currentStep >= plan.steps.length) {
      return "reply";
    }

    return "executor";
  }

  if (status === "retry") {
    if ((state.retryCount ?? 0) >= (state.maxRetries ?? 2)) {
      return "reply";
    }

    return "executor";
  }

  if (status === "replan") {
    return "planner";
  }

  return "reply";
}