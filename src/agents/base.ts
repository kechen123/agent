import type { AgentRuntimeState } from "../runtime/state";

/**
 * 所有 Agent 共同实现的结构。`invoke` 函数是 LangGraph
 * 节点主体，只返回本次修改过的状态字段。
 *
 * `systemPrompt` 保留为字段（不内联），便于 skill 在构建链路前追加提示。
 */
export interface AgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  invoke: (state: AgentRuntimeState) => Promise<Partial<AgentRuntimeState>>;
}

/** 已注册 Agent 映射表，以节点名称作为键。 */
export interface AgentRegistry {
  [nodeName: string]: (state: AgentRuntimeState) => Promise<Partial<AgentRuntimeState>>;
}
