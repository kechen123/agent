import { model } from "../../services/llm";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import type { ReflectionResult } from "../../types/agent";
import type { AgentRuntimeState } from "../../runtime/state";
import type { AgentDefinition } from "../base";
import { skillPromptForState, withSkillPrompt } from "../../skills";

export const ReflectionSchema = z.object({
  status: z.enum(["pass", "retry", "replan", "fail"]),
  reason: z.string().trim().min(1),
  feedback: z.string().trim().min(1),
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
- fail：无法继续执行

注意：
- “表达得像完成了”不等于真的完成，要检查结果是否满足当前步骤
- 如果结果明确说明缺少必要信息，优先 retry 或 replan
- retry 的反馈必须具体说明下一次应如何改进
- 不要仅因为措辞简短就判定 retry`;

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

/**
 * 把 Reflection 的判断转换成 State 更新。
 *
 * 这是一个纯函数，不调用模型，便于单元验证 Agent Loop 的状态转移：
 *
 * - pass：推进 currentStep，并清空当前步骤的 retryCount；
 * - retry：不推进步骤，只增加 retryCount；
 * - replan/fail：保留当前位置并记录错误，交给 Conditional Edge 决定去向；
 * - 达到 maxRetries 后，retry 会被强制转换成 fail，防止无限循环。
 */
export function applyReflectionResult(
  state: AgentRuntimeState,
  input: ReflectionResult,
): Partial<AgentRuntimeState> {
  let reflection = input;

  if (reflection.status === "retry" && state.retryCount >= state.maxRetries) {
    reflection = {
      status: "fail",
      reason: `当前步骤已达到最大重试次数 ${state.maxRetries}`,
      feedback: reflection.feedback,
    };
  }

  if (reflection.status === "pass") {
    return {
      reflection,
      currentStep: state.currentStep + 1,
      retryCount: 0,
    };
  }

  if (reflection.status === "retry") {
    return {
      reflection,
      currentStep: state.currentStep,
      retryCount: state.retryCount + 1,
    };
  }

  const error = `${reflection.reason}：${reflection.feedback}`;
  return {
    reflection,
    currentStep: state.currentStep,
    retryCount: 0,
    errors: [...state.errors, error],
  };
}

export const ReflectionAgent: AgentDefinition = {
  name: "reflectionAgent",
  description: "检查执行结果并决定继续、重试、重规划或失败",
  systemPrompt: SYSTEM_PROMPT,
  async invoke(state) {
    const plan = state.plan;
    const currentStepIndex = state.lastExecutedStep;
    const step =
      currentStepIndex === null || currentStepIndex === undefined
        ? undefined
        : plan?.steps?.[currentStepIndex];

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

    let reflection: ReflectionResult;
    try {
      const chain = buildChain(withSkillPrompt(SYSTEM_PROMPT, skillPromptForState(state)));
      reflection = await chain.invoke({
        goal: plan.goal,
        plan: JSON.stringify(plan, null, 2),
        currentStep: `第 ${step.id} 步：${step.task}`,
        executorResult,
        executionResults: state.executionResults.join("\n") || "（无）",
        retryCount: String(state.retryCount),
        maxRetries: String(state.maxRetries),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reflection = {
        status: "fail",
        reason: "Reflection Agent 调用失败",
        feedback: message,
      };
    }

    return applyReflectionResult(state, reflection);
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
    return "executor";
  }

  if (status === "replan") {
    return "planner";
  }

  return "reply";
}
