// ─── 后端标准化 SSE 事件（与后端 types/agent.ts 保持镜像） ───────────────

export interface PlanStep {
  id: number;
  task: string;
}

export interface Plan {
  goal: string;
  steps: PlanStep[];
}

export type HitlAction = "confirm" | "reject" | "modify";

export type AgentStreamEvent =
  | { type: "router:start"; agent: string }
  | { type: "router:end"; route: "chat" | "tool" | "plan" | "execute" }
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

// ─── 前端 UI 类型 ───────────────────────────────────────────────────────────

export type AgentEventStatus = "running" | "done" | "error";

// Agent 执行时间线中的一个步骤。
export interface AgentUIEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  data?: unknown;
  status: AgentEventStatus;
}

export interface ToolCallInfo {
  id: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  status: AgentEventStatus;
}

// 附加到 assistant 消息上的元数据，用于驱动时间线、计划卡片、工具卡片和 HITL 卡片。
export interface AgentMessageMetadata {
  events: AgentUIEvent[];
  plan?: Plan;
  toolCalls: ToolCallInfo[];
  waitingForConfirm?: boolean;
}

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
