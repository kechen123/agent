import { Annotation } from "@langchain/langgraph";
import { BaseMessage, SystemMessage } from "@langchain/core/messages";
import type { Plan, Route, HitlDecision, ReflectionResult } from "../types/agent";

/**
 * 所有 Agent 共享的运行时状态。
 * 字段 reducer 很重要：`messages` 和 `executionResults` 只追加
 *（concat），其余字段采用最后写入者获胜。
 */
export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (oldMessage, newMessages) => oldMessage.concat(newMessages),
    default: () => [new SystemMessage("你是一个乐于助人的 AI 助手。")],
  }),
  route: Annotation<Route | "">({
    reducer: (_oldValue, newValue) => newValue,
    default: () => "",
  }),
  plan: Annotation<Plan | null>({
    reducer: (_oldValue, newValue) => newValue,
    default: () => null,
  }),
  currentStep: Annotation<number>({
    reducer: (_, y) => y,
    default: () => 0,
  }),
  executionResults: Annotation<string[]>({
    reducer: (_oldValue, newValue) => newValue,
    default: () => [],
  }),
  skillName: Annotation<string | null>({
    reducer: (_, v) => v,
    default: () => null,
  }),
  decision: Annotation<HitlDecision | null>({
    reducer: (_, v) => v,
    default: () => null,
  }),
  //保存 ReflectionAgent 的判断结果
  reflection: Annotation<ReflectionResult | null>({
    reducer: (_oldValue, newValue) => newValue,
    default: () => null,
  }),
  //记录当前步骤已经重试几次。
  retryCount: Annotation<number>({
    reducer: (_oldValue, newValue) => newValue,
    default: () => 0,
  }),
  //最大重试次数。
  maxRetries: Annotation<number>({
    reducer: (_oldValue, newValue) => newValue,
    default: () => 2,
  }),
  //保存失败原因。
  errors: Annotation<string[]>({
    reducer: (_oldValue, newValue) => newValue,
    default: () => [],
  }),
});

export type AgentRuntimeState = typeof AgentState.State;
