import { Annotation } from "@langchain/langgraph";
import { BaseMessage, SystemMessage } from "@langchain/core/messages";
import type { Plan, Route, HitlDecision } from "../types/agent";

/**
 * Runtime state shared across all agents.
 * Field reducers matter: `messages` and `executionResults` are append-only
 * (concat), the rest are last-writer-wins.
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
    reducer: (oldValue, newValue) => oldValue.concat(newValue),
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
});

export type AgentRuntimeState = typeof AgentState.State;
