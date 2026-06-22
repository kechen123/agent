import { getSnapshot, isWaitingForConfirm, getInterruptPlan } from "../runtime/checkpoints";
import { NODE_NAMES } from "../runtime/events";
import type { AgentStreamEvent, Plan, PlanStep, Route } from "../types/agent";

/** LangGraph streamEvents v2 事件的最小结构视图。 */
interface RawStreamEvent {
  event: string;
  name: string;
  run_id?: string;
  data?: unknown;
  metadata?: { langgraph_node?: string; [k: string]: unknown };
}

const NODE_BY_NAME: Record<string, string> = {
  [NODE_NAMES.router]: "router",
  [NODE_NAMES.planner]: "planner",
  [NODE_NAMES.executor]: "executor",
  [NODE_NAMES.reply]: "reply",
  [NODE_NAMES.tool]: "tool",
};

function nodeOf(e: RawStreamEvent): string | undefined {
  const n = e.metadata?.langgraph_node;
  return n ? NODE_BY_NAME[n] : undefined;
}

function asOutput(e: RawStreamEvent): Record<string, unknown> | undefined {
  const data = e.data as { output?: unknown } | undefined;
  const out = data?.output;
  return out && typeof out === "object" ? (out as Record<string, unknown>) : undefined;
}

function textOf(chunk: unknown): string {
  const c = chunk as { content?: unknown } | null;
  return typeof c?.content === "string" ? c.content : "";
}

/**
 * 流适配器：将原始 LangGraph streamEvents 流转换为前端消费的
 * 标准化 AgentStreamEvent 联合类型。
 *
 * 映射规则：
 *  - 节点 on_chain_start/on_chain_end → <node>:start / <node>:end
 *  - planner:end 携带生成的计划；executor:end 携带当前步骤
 *  - on_tool_start / on_tool_end      → tool:start / tool:end
 *  - on_chat_model_stream（replyAgent）→ message:delta；模型结束 → message:end
 *  - router/planner/executor/tool 的模型流会被过滤（不面向用户）
 *  - 流结束后，如果线程暂停在 HITL interrupt 上 → hitl:waiting
 */
export async function* adaptStream(
  raw: AsyncIterable<RawStreamEvent>,
  threadId: string,
): AsyncGenerator<AgentStreamEvent> {
  let messageBuffer = "";
  let currentPlan: Plan | null = null;
  let replied = false;
  let finalStatus: "completed" | "waiting" = "completed";

  // 从 checkpoint 中预填计划，这样 resume 流（planner:end 不会重新触发）
  // 仍然可以解析 executor:end 对应的步骤。
  try {
    const seed = await getSnapshot(threadId);
    const seedPlan = (seed.values as { plan?: Plan | null } | undefined)?.plan;
    if (seedPlan) currentPlan = seedPlan;
  } catch {
    // 忽略：新线程可能还没有 snapshot
  }

  try {
    for await (const e of raw) {
      const node = nodeOf(e);
      const kind = e.event;

      // ── 节点生命周期 ────────────────────────────────────────────────
      if (kind === "on_chain_start" && node && e.name === e.metadata?.langgraph_node) {
        if (node === "router") yield { type: "router:start", agent: NODE_NAMES.router };
        else if (node === "planner") yield { type: "planner:start", agent: NODE_NAMES.planner };
        else if (node === "executor") yield { type: "executor:start", agent: NODE_NAMES.executor };
        continue;
      }

      if (kind === "on_chain_end" && node && e.name === e.metadata?.langgraph_node) {
        const out = asOutput(e);
        if (node === "router") {
          const route = (out?.route as Route) ?? "chat";
          yield { type: "router:end", route };
        } else if (node === "planner") {
          const plan = (out?.plan as Plan | undefined) ?? undefined;
          if (plan) {
            currentPlan = plan;
            yield { type: "planner:end", plan };
          }
        } else if (node === "executor") {
          const newStep = typeof out?.currentStep === "number" ? (out.currentStep as number) : 0;
          const stepIdx = newStep - 1;
          const step: PlanStep | undefined =
            currentPlan && stepIdx >= 0 ? currentPlan.steps[stepIdx] : undefined;
          if (step) yield { type: "executor:end", step, currentStep: newStep };
        }
        continue;
      }

      // ── 工具生命周期 ────────────────────────────────────────────────
      if (kind === "on_tool_start") {
        yield {
          type: "tool:start",
          callId: e.run_id ?? e.name,
          toolName: e.name,
          input: (e.data as { input?: unknown } | undefined)?.input,
        };
        continue;
      }
      if (kind === "on_tool_end") {
        yield {
          type: "tool:end",
          callId: e.run_id ?? e.name,
          toolName: e.name,
          output: (e.data as { output?: unknown } | undefined)?.output,
        };
        continue;
      }

      // ── 面向用户的消息增量（仅 replyAgent）──────────────────────────
      if (kind === "on_chat_model_stream" && node === "reply") {
        const chunk = (e.data as { chunk?: unknown } | undefined)?.chunk;
        const text = textOf(chunk);
        if (text) {
          messageBuffer += text;
          replied = true;
          yield { type: "message:delta", content: text };
        }
        continue;
      }

      if (kind === "on_chat_model_end" && node === "reply") {
        if (replied) {
          yield { type: "message:end", content: messageBuffer };
          messageBuffer = "";
          replied = false;
        }
        continue;
      }
    }

    // 如果漏掉了模型结束事件，则补刷尾部消息。
    if (replied) {
      yield { type: "message:end", content: messageBuffer };
      messageBuffer = "";
      replied = false;
    }

    // ── HITL：流稳定后检测暂停中的线程 ─────────────────────────────
    const snapshot = await getSnapshot(threadId);
    if (isWaitingForConfirm(snapshot)) {
      const plan = getInterruptPlan(snapshot) ?? currentPlan;
      if (plan) {
        finalStatus = "waiting";
        yield { type: "hitl:waiting", plan };
      }
    }
    yield { type: "stream:end", status: finalStatus };
  } catch (err) {
    yield { type: "error", message: (err as Error).message ?? String(err) };
    yield { type: "stream:end", status: "error" };
  }
}

/**
 * resume（HITL）流适配器。先发出带有已选 action 的 hitl:done，
 * 然后转发恢复后的图产生的标准化事件。
 */
export async function* adaptResumeStream(
  raw: AsyncIterable<RawStreamEvent>,
  threadId: string,
  action: "confirm" | "reject" | "modify",
): AsyncGenerator<AgentStreamEvent> {
  yield { type: "hitl:done", action };
  yield* adaptStream(raw, threadId);
}
