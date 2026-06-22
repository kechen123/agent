// ─── 后端标准化流事件（与后端 types/agent.ts 保持镜像）──────────────────

export interface PlanStep {
  id: number;
  task: string;
}

export interface Plan {
  goal: string;
  steps: PlanStep[];
}

export type HitlAction = "confirm" | "reject" | "modify";
export type ReflectionStatus = "pass" | "retry" | "replan" | "fail";

export interface ReflectionResult {
  status: ReflectionStatus;
  reason: string;
  feedback: string;
}

export type AgentStreamEvent =
  | { type: "router:start"; agent: string }
  | {
      type: "router:end";
      route: "chat" | "tool" | "plan" | "execute";
      skillName: string | null;
    }
  | { type: "planner:start"; agent: string }
  | { type: "planner:end"; plan: Plan }
  | { type: "executor:start"; agent: string; step?: PlanStep; attempt: number }
  | { type: "executor:end"; step: PlanStep; result: string; attempt: number }
  | { type: "reflection:start"; agent: string }
  | {
      type: "reflection:end";
      reflection: ReflectionResult;
      currentStep: number;
      retryCount: number;
    }
  | { type: "tool:start"; callId: string; toolName: string; input: unknown }
  | { type: "tool:end"; callId: string; toolName: string; output: unknown }
  | { type: "tool:error"; callId: string; toolName: string; error: string }
  | { type: "message:delta"; content: string }
  | { type: "message:end"; content: string }
  | { type: "hitl:waiting"; plan: Plan }
  | { type: "hitl:done"; action: HitlAction }
  | { type: "error"; message: string }
  | { type: "stream:end"; status: "completed" | "waiting" | "error" | "cancelled" };

// ─── 前端界面类型 ───────────────────────────────────────────────────────────

export type AgentEventStatus = "running" | "done" | "error";

// 执行时间线中的一个步骤。
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

// 附加到助手消息上的元数据，用于驱动时间线、计划卡片、工具卡片和人工介入卡片。
export interface AgentMessageMetadata {
  events: AgentUIEvent[];
  plan?: Plan;
  route?: "chat" | "tool" | "plan" | "execute";
  skillName?: string | null;
  currentStep?: number;
  retryCount?: number;
  reflection?: ReflectionResult;
  toolCalls: ToolCallInfo[];
  waitingForConfirm?: boolean;
  streamStatus?: "streaming" | "completed" | "waiting" | "error" | "cancelled";
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
