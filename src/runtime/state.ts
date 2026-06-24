import { Annotation } from "@langchain/langgraph";
import { BaseMessage, SystemMessage } from "@langchain/core/messages";
import type { Plan, Route, HitlDecision, ReflectionResult } from "../types/agent";
import { config } from "../config";

/**
 * 所有 Agent 共享的运行时状态（State）。
 *
 * LangGraph 中每个 Node 不直接修改同一个对象，而是返回“局部状态更新”。
 * Annotation 上的 reducer 决定新值如何合并：
 *
 * - `messages` 使用追加合并，因为对话历史不能被后一个节点覆盖。
 * - 其他字段采用“最后写入者获胜”，节点必须返回计算后的完整值。
 *
 * 学习时可以把 State 理解成多个 Agent 之间共享的白板。
 */
export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (oldMessage, newMessages) => oldMessage.concat(newMessages),
    default: () => [new SystemMessage("你是一个乐于助人的 AI 助手。")],
  }),
  /**
   * 当前轮最初的用户请求。
   * 计划修改会向 messages 追加内部 HumanMessage，因此 Reply 不能再简单取最后一条 HumanMessage。
   */
  request: Annotation<string>({
    reducer: (_oldValue, newValue) => newValue,
    default: () => "",
  }),
  ragMode: Annotation<boolean>({
    reducer: (_oldValue, newValue) => newValue,
    default: () => false,
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
  /**
   * Executor 最近一次执行的步骤下标。
   * `currentStep` 表示下一步要执行谁，二者不能混用，否则 retry 会跳到下一步。
   */
  lastExecutedStep: Annotation<number | null>({
    reducer: (_oldValue, newValue) => newValue,
    default: () => null,
  }),
  skillName: Annotation<string | null>({
    reducer: (_, v) => v,
    default: () => null,
  }),
  decision: Annotation<HitlDecision | null>({
    reducer: (_, v) => v,
    default: () => null,
  }),
  /** 保存 ReflectionAgent 最近一次判断结果。 */
  reflection: Annotation<ReflectionResult | null>({
    reducer: (_oldValue, newValue) => newValue,
    default: () => null,
  }),
  /** 当前步骤已经重试的次数；步骤通过后会重置。 */
  retryCount: Annotation<number>({
    reducer: (_oldValue, newValue) => newValue,
    default: () => 0,
  }),
  /** 单个步骤允许的最大重试次数。 */
  maxRetries: Annotation<number>({
    reducer: (_oldValue, newValue) => newValue,
    default: () => config.maxAgentRetries,
  }),
  /** 当前轮已经发生的可读错误，最终由 ReplyAgent 统一解释。 */
  errors: Annotation<string[]>({
    reducer: (_oldValue, newValue) => newValue,
    default: () => [],
  }),
  /** 本轮累计发起的工具调用数量，用于防止 ReAct 工具循环失控。 */
  toolCallCount: Annotation<number>({
    reducer: (_oldValue, newValue) => newValue,
    default: () => 0,
  }),
  /** 一轮对话最多允许的工具调用次数。 */
  maxToolCalls: Annotation<number>({
    reducer: (_oldValue, newValue) => newValue,
    default: () => config.maxToolCalls,
  }),
});

export type AgentRuntimeState = typeof AgentState.State;
