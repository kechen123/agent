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

// ─── 技能 ───────────────────────────────────────────────────────────────────

export type SkillSource = "builtin" | "project";

export interface Skill {
  name: string;
  description: string;
  systemPrompt: string;
  // 该技能允许使用的工具名称。
  tools?: string[];
}

export interface RegisteredSkill extends Skill {
  source: SkillSource;
}

export interface SkillSummary {
  name: string;
  description: string;
  source: SkillSource;
  enabled: boolean;
}

// ─── 工具 ───────────────────────────────────────────────────────────────────

export interface RegisteredTool {
  name: string;
  description: string;
  tool: StructuredTool;
}

// ─── 人工介入确认 ───────────────────────────────────────────────────────────

export type HitlAction = "confirm" | "reject" | "modify";

export interface HitlDecision {
  action: HitlAction;
  // 操作为 "modify" 时可携带修改意见或修订后的计划。
  message?: string;
  plan?: Plan;
}

// ─── 运行时状态形状（与 runtime/state.ts Annotation 对齐）────────────────────

export interface AgentStateValue {
  messages: BaseMessage[];
  route: Route | "";
  plan: Plan | null;
  currentStep: number;
  executionResults: string[];
  // 路由器选中的技能名称；没有命中时为空。
  skillName: string | null;
  // 最近一次从用户侧收到的人工介入决策。
  decision: HitlDecision | null;
}

// ─── 接口请求 / 响应 ─────────────────────────────────────────────────────────

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

export type AgentStreamEvent = { type: "router:start"; agent: string } | { type: "router:end"; route: Route } | { type: "planner:start"; agent: string } | { type: "planner:end"; plan: Plan } | { type: "executor:start"; agent: string } | { type: "executor:end"; step: PlanStep; currentStep: number } | { type: "tool:start"; callId: string; toolName: string; input: unknown } | { type: "tool:end"; callId: string; toolName: string; output: unknown } | { type: "message:delta"; content: string } | { type: "message:end"; content: string } | { type: "hitl:waiting"; plan: Plan } | { type: "hitl:done"; action: HitlAction } | { type: "error"; message: string } | { type: "stream:end"; status: "completed" | "waiting" | "error" | "cancelled" };

export type ReflectionStatus = "pass" | "retry" | "replan" | "fail";

export interface ReflectionResult {
  status: ReflectionStatus;
  reason: string;
  feedback: string;
}