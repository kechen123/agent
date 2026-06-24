import { getSnapshot, isWaitingForConfirm, getInterruptPlan } from "../runtime/checkpoints";
import { NODE_NAMES } from "../runtime/events";
import type {
  AgentStreamEvent,
  Plan,
  PlanStep,
  ReflectionResult,
  Route,
} from "../types/agent";

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
  [NODE_NAMES.reflection]: "reflection",
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

function messageContentOf(message: unknown): string {
  const value = message as { content?: unknown } | null;
  if (!value) return "";
  if (typeof value.content === "string") return value.content;
  if (!Array.isArray(value.content)) return "";
  return value.content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        return String((part as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("");
}

function replyContentOf(out: Record<string, unknown> | undefined): string {
  const messages = out?.messages;
  if (!Array.isArray(messages)) return "";
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as { name?: unknown; lc_kwargs?: { name?: unknown } };
    const name =
      typeof message.name === "string"
        ? message.name
        : typeof message.lc_kwargs?.name === "string"
          ? message.lc_kwargs.name
          : "";
    const content = messageContentOf(message);
    if (content && (!name || name === "replyAgent")) return content;
  }
  return "";
}

function polishReplyText(text: string): string {
  return text
    .replace(/^(?:根据(?:查询结果|知识库信息|提供的信息|检索结果)[，,：:\s]*)+/u, "")
    .replace(/\n(?:根据(?:查询结果|知识库信息|提供的信息|检索结果)[，,：:\s]*)/gu, "\n")
    .trimStart();
}

/** 把不同来源的异常统一转换为可以安全发送给前端的文本。 */
function errorMessageOf(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "message" in value) {
    return String((value as { message?: unknown }).message ?? "未知错误");
  }
  return String(value ?? "未知错误");
}

/**
 * 流适配器：将原始 LangGraph streamEvents 流转换为前端消费的
 * 标准化 AgentStreamEvent 联合类型。
 *
 * 映射规则：
 *  - 节点 on_chain_start/on_chain_end → <node>:start / <node>:end
 *  - planner:end 携带生成的计划；executor:end 携带当前步骤和执行结果
 *  - reflection:end 携带验收结论，让前端可以观察执行/反思循环
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
  let replyContentEmitted = false;
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
        else if (node === "executor") {
          const input = (e.data as {
            input?: Partial<{
              plan: Plan;
              currentStep: number;
              retryCount: number;
            }>;
          } | undefined)?.input;
          yield {
            type: "executor:start",
            agent: NODE_NAMES.executor,
            step: input?.plan?.steps?.[input.currentStep ?? 0],
            attempt: (input?.retryCount ?? 0) + 1,
          };
        } else if (node === "reflection") {
          yield { type: "reflection:start", agent: NODE_NAMES.reflection };
        }
        continue;
      }

      if (kind === "on_chain_end" && node && e.name === e.metadata?.langgraph_node) {
        const out = asOutput(e);
        if (node === "router") {
          const route = (out?.route as Route) ?? "chat";
          const skillName = typeof out?.skillName === "string" ? out.skillName : null;
          yield { type: "router:end", route, skillName };
        } else if (node === "planner") {
          const plan = (out?.plan as Plan | undefined) ?? undefined;
          if (plan) {
            currentPlan = plan;
            yield { type: "planner:end", plan };
          }
        } else if (node === "executor") {
          const stepIdx =
            typeof out?.lastExecutedStep === "number" ? out.lastExecutedStep : -1;
          const step: PlanStep | undefined =
            currentPlan && stepIdx >= 0 ? currentPlan.steps[stepIdx] : undefined;
          const results = Array.isArray(out?.executionResults)
            ? (out.executionResults as string[])
            : [];
          const result = results.at(-1) ?? "";
          const attempt =
            typeof out?.retryCount === "number" ? (out.retryCount as number) + 1 : 1;
          if (step) yield { type: "executor:end", step, result, attempt };
        } else if (node === "reflection") {
          const reflection = out?.reflection as ReflectionResult | undefined;
          if (reflection) {
            yield {
              type: "reflection:end",
              reflection,
              currentStep:
                typeof out?.currentStep === "number" ? (out.currentStep as number) : 0,
              retryCount:
                typeof out?.retryCount === "number" ? (out.retryCount as number) : 0,
            };
          }
        } else if (node === "reply" && !replyContentEmitted) {
          const content = polishReplyText(replyContentOf(out));
          if (content) {
            yield { type: "message:end", content };
            messageBuffer = "";
            replied = false;
            replyContentEmitted = true;
          }
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
      if (kind === "on_tool_error") {
        yield {
          type: "tool:error",
          callId: e.run_id ?? e.name,
          toolName: e.name,
          error: errorMessageOf((e.data as { error?: unknown } | undefined)?.error),
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
          yield { type: "message:end", content: polishReplyText(messageBuffer) };
          messageBuffer = "";
          replied = false;
          replyContentEmitted = true;
        }
        continue;
      }
    }

    // 如果漏掉了模型结束事件，则补刷尾部消息。
    if (replied && !replyContentEmitted) {
      yield { type: "message:end", content: polishReplyText(messageBuffer) };
      messageBuffer = "";
      replied = false;
      replyContentEmitted = true;
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
    if (err instanceof Error && err.name === "AbortError") {
      yield { type: "stream:end", status: "cancelled" };
      return;
    }
    yield { type: "error", message: errorMessageOf(err) };
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
