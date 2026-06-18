import type { StructuredTool } from "@langchain/core/tools";
import type { BaseMessage } from "@langchain/core/messages";

// ─── 路由 ────────────────────────────────────────────────────────────────────

export type Route = "chat" | "tool" | "plan" | "execute";

// ─── 计划 ────────────────────────────────────────────────────────────────────

export interface PlanStep {
  id: number;
  task: string;
}

export interface Plan {
  goal: string;
  steps: PlanStep[];
}

// ─── Skill ──────────────────────────────────────────────────────────────────

export interface Skill {
  name: string;
  description: string;
  systemPrompt: string;
  // 该 Skill 允许使用的 Tool 名称。
  tools?: string[];
}

// ─── Tool ───────────────────────────────────────────────────────────────────

export interface RegisteredTool {
  name: string;
  description: string;
  tool: StructuredTool;
}

// ─── HITL（Human In The Loop）────────────────────────────────────────────────

export type HitlAction = "confirm" | "reject" | "modify";

export interface HitlDecision {
  action: HitlAction;
  // action === "modify" 时可携带修改意见或修订后的计划。
  message?: string;
  plan?: Plan;
}

// ─── Runtime 状态形状（与 runtime/state.ts Annotation 对齐）──────────────────

export interface AgentStateValue {
  messages: BaseMessage[];
  route: Route | "";
  plan: Plan | null;
  currentStep: number;
  executionResults: string[];
  // Router 选中的 Skill 名称；没有命中时为空。
  skillName: string | null;
  // 最近一次从用户侧收到的 HITL 决策。
  decision: HitlDecision | null;
}

// ─── HTTP 请求 / 响应 ────────────────────────────────────────────────────────

export interface ChatRequest {
  threadId: string;
  message: string;
}

export interface ResumeRequest {
  threadId: string;
  action: HitlAction;
  message?: string;
  plan?: Plan;
}

export interface ChatResponse {
  threadId: string;
  ok: boolean;
}

// ─── 标准化 SSE 事件（供前端消费）────────────────────────────────────────────

export type AgentStreamEvent =
  | { type: "router:start"; agent: string }
  | { type: "router:end"; route: Route }
  | { type: "planner:start"; agent: string }
  | { type: "planner:end"; plan: Plan }
  | { type: "executor:start"; agent: string }
  | { type: "executor:end"; step: PlanStep; currentStep: number }
  | { type: "tool:start"; toolName: string; input: unknown }
  | { type: "tool:end"; toolName: string; output: unknown }
  | { type: "message:delta"; content: string }
  | { type: "message:end"; content: string }
  | { type: "hitl:waiting"; plan: Plan }
  | { type: "hitl:done"; action: HitlAction }
  | { type: "error"; message: string };
