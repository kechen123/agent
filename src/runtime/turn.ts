import type { AgentDefinition } from "../agents/base";

/**
 * 每个新的 /chat 请求都会先经过这里。
 * 对话消息需要保留，但 plan、执行结果和 HITL 决策只属于上一轮，必须显式清理。
 */
export const BeginTurnAgent: AgentDefinition = {
  name: "beginTurn",
  description: "初始化新的用户轮次",
  systemPrompt: "",
  async invoke() {
    return {
      route: "",
      plan: null,
      currentStep: 0,
      executionResults: [],
      skillName: null,
      decision: null,
    };
  },
};
