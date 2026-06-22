import type { AgentDefinition } from "../agents/base";
import { getLatestHumanMessage, messageText } from "./messages";

/**
 * 每个新的 `/chat` 请求都会先经过这里。
 *
 * checkpoint 会保留整个线程的 State，所以必须区分：
 * - 跨轮保留：messages（对话上下文）。
 * - 仅当前轮有效：计划、执行结果、Reflection、重试计数、工具计数和 HITL 决策。
 *
 * 如果漏掉重置字段，新一轮可能错误继承上一轮的执行进度。
 */
export const BeginTurnAgent: AgentDefinition = {
  name: "beginTurn",
  description: "初始化新的用户轮次",
  systemPrompt: "",
  async invoke(state) {
    return {
      request: messageText(getLatestHumanMessage(state.messages)),
      route: "",
      plan: null,
      currentStep: 0,
      executionResults: [],
      lastExecutedStep: null,
      skillName: null,
      decision: null,
      reflection: null,
      retryCount: 0,
      errors: [],
      toolCallCount: 0,
    };
  },
};
