import { getSnapshot, isWaitingForConfirm, getInterruptPlan } from "../runtime/checkpoints";
import { NODE_NAMES } from "../runtime/events";
import type { AgentStreamEvent, Plan, PlanStep, Route } from "../types/agent";

/** Minimal structural view of a LangGraph streamEvents v2 event. */
interface RawStreamEvent {
  event: string;
  name: string;
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
 * Stream adapter: converts the raw LangGraph streamEvents stream into the
 * standardized AgentStreamEvent union the frontend consumes.
 *
 * Mapping rules:
 *  - node on_chain_start/on_chain_end  → <node>:start / <node>:end
 *  - planner:end carries the generated plan; executor:end carries the step
 *  - on_tool_start / on_tool_end       → tool:start / tool:end
 *  - on_chat_model_stream (replyAgent) → message:delta; model end → message:end
 *  - router/planner/executor/tool model streams are filtered out (not user-facing)
 *  - after the stream ends, if the thread is paused on a HITL interrupt → hitl:waiting
 */
export async function* adaptStream(
  raw: AsyncIterable<RawStreamEvent>,
  threadId: string,
): AsyncGenerator<AgentStreamEvent> {
  let messageBuffer = "";
  let currentPlan: Plan | null = null;
  let replied = false;

  // Seed the plan from the checkpoint so resume streams (where planner:end
  // does not re-fire) can still resolve executor:end steps.
  try {
    const seed = await getSnapshot(threadId);
    const seedPlan = (seed.values as { plan?: Plan | null } | undefined)?.plan;
    if (seedPlan) currentPlan = seedPlan;
  } catch {
    // ignore — snapshot may not exist yet on a fresh thread
  }

  try {
    for await (const e of raw) {
      const node = nodeOf(e);
      const kind = e.event;

      // ── Node lifecycle ────────────────────────────────────────────────
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

      // ── Tool lifecycle ────────────────────────────────────────────────
      if (kind === "on_tool_start") {
        yield { type: "tool:start", toolName: e.name, input: (e.data as { input?: unknown } | undefined)?.input };
        continue;
      }
      if (kind === "on_tool_end") {
        yield { type: "tool:end", toolName: e.name, output: (e.data as { output?: unknown } | undefined)?.output };
        continue;
      }

      // ── User-facing message deltas (replyAgent only) ──────────────────
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

    // Flush a trailing message if the model-end event was missed.
    if (replied) {
      yield { type: "message:end", content: messageBuffer };
      messageBuffer = "";
      replied = false;
    }

    // ── HITL: detect a paused thread after the stream settles ──────────
    const snapshot = await getSnapshot(threadId);
    if (isWaitingForConfirm(snapshot)) {
      const plan = getInterruptPlan(snapshot) ?? currentPlan;
      if (plan) yield { type: "hitl:waiting", plan };
    }
  } catch (err) {
    yield { type: "error", message: (err as Error).message ?? String(err) };
  }
}

/**
 * Adapter for a resume (HITL) stream. Emits a hitl:done up front with the
 * chosen action, then forwards the standardized events from the resumed graph.
 */
export async function* adaptResumeStream(
  raw: AsyncIterable<RawStreamEvent>,
  threadId: string,
  action: "confirm" | "reject" | "modify",
): AsyncGenerator<AgentStreamEvent> {
  yield { type: "hitl:done", action };
  yield* adaptStream(raw, threadId);
}
