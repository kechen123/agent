import { model } from "../../services/llm";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { PlanStep } from "../../types/agent";
import type { AgentRuntimeState } from "../../runtime/state";
import type { AgentDefinition } from "../base";
import { skillPromptForState, withSkillPrompt } from "../../skills";

const SYSTEM_PROMPT = `你是一个任务执行器（Executor Agent）。
你会收到当前要执行的步骤以及之前的执行结果。
请用一句话说明你对该步骤完成了什么。

重要边界：
1. 当前 Executor 只负责“基于已有上下文生成执行结果”，不会真的修改文件或调用外部系统
2. 不要声称执行了未真实发生的外部操作
3. 不要调用工具
4. 如果缺少完成步骤所需的信息，要明确说明缺少什么`;

const buildChain = (systemPrompt: string) => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    [
      "human",
      `目标：{goal}
当前步骤（第 {stepId} 步）：{task}
本步骤尝试次数：{attempt}
已执行结果：{previousResults}
Reflection 反馈：{reflectionFeedback}

请给出本次尝试的执行结果。`,
    ],
  ]);
  return prompt.pipe(model);
};

/**
 * ExecutorAgent 每次只尝试执行 `plan.steps[currentStep]`。
 *
 * 这里故意不推进 `currentStep`。步骤是否完成由 ReflectionAgent 判断：
 *
 * - pass：Reflection 推进到下一步；
 * - retry：currentStep 保持不变，Executor 再次执行当前步骤；
 * - replan/fail：转向重新规划或最终回复。
 *
 * 这是 Agent Loop 中“执行”和“验收”职责分离的关键。
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
        lastExecutedStep: null,
        errors: [...state.errors, "Executor 没有收到可执行计划"],
      };
    }

    const step: PlanStep | undefined = plan.steps[currentStep];
    if (!step) {
      return {
        lastExecutedStep: null,
      };
    }

    const attempt = state.retryCount + 1;

    // 当前示例没有给 Executor 绑定工具，因此这里是“LLM 执行结果生成”，不是真实外部执行。
    let result: string;
    try {
      const chain = buildChain(withSkillPrompt(SYSTEM_PROMPT, skillPromptForState(state)));
      const res = await chain.invoke({
        goal: plan.goal,
        stepId: String(step.id),
        task: step.task,
        attempt: String(attempt),
        previousResults: state.executionResults.join("\n") || "（无）",
        reflectionFeedback: state.reflection?.feedback || "（无）",
      });
      result =
        typeof res.content === "string" && res.content.trim()
          ? res.content.trim()
          : `第 ${step.id} 步没有产生有效执行结果`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result = `第 ${step.id} 步执行器异常：${message}`;
      return {
        executionResults: [...state.executionResults, result],
        lastExecutedStep: currentStep,
        errors: [...state.errors, result],
        retryCount: state.retryCount,
      };
    }

    return {
      executionResults: [...state.executionResults, result],
      lastExecutedStep: currentStep,
      reflection: null,
      retryCount: state.retryCount,
    };
  },
};

/**
 * 保留这个纯路由函数用于学习和测试。
 * 当前主图由 ReflectionAgent 决定 Executor 后续方向，因此 graph.ts 不直接使用它。
 */
export function routeAfterExecutor(state: AgentRuntimeState): "executor" | "reply" {
  const plan = state.plan;
  if (!plan || !plan.steps?.length) return "reply";
  if (state.currentStep >= plan.steps.length) return "reply";
  return "executor";
}
