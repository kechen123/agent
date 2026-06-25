import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { BaseMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { authMiddleware } from "../auth/authMiddleware";
import type { AuthVariables } from "../auth/types";
import {
  getSnapshot,
  isWaitingForConfirm,
  startChatStream,
  resumeStream,
} from "../runtime";
import { adaptStream, adaptResumeStream } from "../services/stream";
import type { HitlDecision } from "../types/agent";
import { acquireThreadRun } from "../runtime/run-lock";
import { assertThreadUser, bindThreadUser } from "../runtime/user-context";
import { searchKnowledge } from "../knowledge/documentService";
import { config } from "../config";
import { model } from "../services/llm";
import { messageText } from "../runtime/messages";
import type { AgentStateValue, RagStrategy } from "../types/agent";
import { createRequestId, createRunId } from "../observability/ids";
import { AppError, statusOfError, toLogError, toPublicError } from "../observability/errors";
import { logger } from "../observability/logger";
import { patchRequestContext, runWithRequestContext } from "../observability/request-context";
import { durationSince, nowMs } from "../observability/timing";

const ChatSchema = z.object({
  threadId: z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  message: z.string().trim().min(1).max(20_000),
  mode: z.enum(["auto", "chat", "rag"]).optional().default("auto"),
});

const ResumeSchema = z
  .object({
    threadId: z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
    action: z.enum(["confirm", "reject", "modify"]),
    message: z.string().trim().max(10_000).optional(),
    plan: z
      .object({
        goal: z.string().trim().min(1).max(2_000),
        steps: z
          .array(
            z.object({
              id: z.number().int().positive(),
              task: z.string().trim().min(1).max(2_000),
            }),
          )
          .min(1)
          .max(50),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "modify" && !value.message && !value.plan) {
      ctx.addIssue({
        code: "custom",
        path: ["message"],
        message: "modify 操作必须提供修改意见或计划",
      });
    }
  });

export const chatRoute = new Hono<{ Variables: AuthVariables }>();

type ChatRouteContext = Context<{ Variables: AuthVariables }>;

/**
 * 统一输出 HTTP JSON 错误。
 *
 * 这里把“内部异常对象”转换成“对外安全错误”：
 * - 日志里记录 code、message、stack 等内部排查信息；
 * - HTTP 响应里只返回安全 message 和 requestId；
 * - 调用方可以通过 requestId 回到日志里定位完整链路。
 */
function jsonError(c: ChatRouteContext, err: unknown) {
  const status = statusOfError(err) as ContentfulStatusCode;
  logger.warn("http.request.error", { status, error: toLogError(err) });
  return c.json({ ok: false, error: toPublicError(err) }, status);
}

const AutoRagDecisionSchema = z.object({
  strategy: z
    .enum(["general", "reuse", "search"])
    .describe("general=交给普通路由；reuse=用上一轮知识库原始片段；search=重新检索知识库"),
  reason: z.string().trim().max(300),
});

const autoRagDecisionModel = model.withStructuredOutput(AutoRagDecisionSchema, {
  name: "choose_rag_followup_strategy",
  method: "functionCalling",
});

const autoRagDecisionChain = ChatPromptTemplate.fromMessages([
  [
    "system",
    `你负责判断用户最新消息在知识库对话中的处理策略。

只能返回三类：
- general：明显是闲聊、感谢、问候、前端/系统操作、或与知识库问答无关；交给普通路由。
- reuse：用户是在追问上一轮知识库结果，并且“上一轮知识库原始片段”中已经有能直接回答的原文证据。
- search：用户仍在问知识库内容，但上一轮知识库原始片段没有足够证据，或者用户换了查询对象/查询主题，需要重新检索。

判断要求：
1. 不要根据上一轮助手回复判断，只看“上一轮知识库原始片段”是否有证据。
2. “学历呢”“学校呢”“还有工作经历吗”“这个人的联系方式呢”这类省略主语的问题，通常是知识库追问。
3. 如果上一轮原始片段里已经包含答案，选 reuse。
4. 如果原始片段里没有答案，但问题仍像知识库查询，选 search。
5. 如果只是“谢谢”“好的”“在吗”“继续优化 UI”等非知识库问答，选 general。`,
  ],
  [
    "human",
    `用户最新消息：{message}

最近对话：
{recentDialogue}

上一轮知识库原始片段：
{previousKnowledgeContext}`,
  ],
]).pipe(autoRagDecisionModel);

type AutoRagDecision = z.infer<typeof AutoRagDecisionSchema>;

type NormalizedChatInput =
  | { ok: true; message: string; ragMode: boolean; ragStrategy: RagStrategy; ragContext: string }
  | { ok: false; error: string };

function isKnowledgeToolText(text: string): boolean {
  return /知识库|片段内容|document_id=|未找到相关知识库片段/u.test(text);
}

function stateMessagesOf(snapshotValues: unknown): BaseMessage[] {
  const messages = (snapshotValues as Partial<AgentStateValue> | undefined)?.messages;
  return Array.isArray(messages) ? messages : [];
}

function latestKnowledgeContext(messages: BaseMessage[], fallbackContext = ""): string {
  const chunks: string[] = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const type = message.getType();
    const text = messageText(message);
    if (type === "tool" && isKnowledgeToolText(text)) {
      chunks.unshift(text);
      continue;
    }
    if (chunks.length > 0 && type === "human") break;
  }

  const context = chunks.join("\n\n") || fallbackContext;
  return context.length > 16_000 ? context.slice(-16_000) : context;
}

function recentDialogueOf(messages: BaseMessage[]): string {
  return messages
    .filter((message) => {
      const type = message.getType();
      return type === "human" || type === "ai";
    })
    .slice(-8)
    .map((message) => `${message.getType()}: ${messageText(message)}`)
    .join("\n")
    .slice(-6_000);
}

async function decideAutoRagStrategy(
  message: string,
  previousKnowledgeContext: string,
  recentDialogue: string,
): Promise<AutoRagDecision> {
  if (!previousKnowledgeContext) return { strategy: "general", reason: "没有上一轮知识库上下文" };
  try {
    return await autoRagDecisionChain.invoke({
      message,
      previousKnowledgeContext,
      recentDialogue: recentDialogue || "无",
    });
  } catch (err) {
    logger.warn("auto_rag.strategy_decision_failed", { error: toLogError(err) });
    return { strategy: "search", reason: "判断失败，保守重新检索" };
  }
}

async function normalizeChatInput(
  message: string,
  mode: "auto" | "chat" | "rag",
  userId: string,
  snapshotValues: unknown,
): Promise<NormalizedChatInput> {
  const trimmed = message.trim();
  const commandMatch = /^\/rag(?:\s+|$)/i.exec(trimmed);
  const forceRag = mode === "rag" || Boolean(commandMatch);

  if (mode === "chat" && !commandMatch) {
    return { ok: true, message: trimmed, ragMode: false, ragStrategy: "search", ragContext: "" };
  }

  const question = commandMatch ? trimmed.slice(commandMatch[0].length).trim() : trimmed;
  if (forceRag && !question) {
    return { ok: false, error: "请在 /rag 后输入要检索的问题" };
  }

  if (forceRag) {
    return { ok: true, message: question, ragMode: true, ragStrategy: "search", ragContext: "" };
  }

  const snapshotState = snapshotValues as Partial<AgentStateValue> | undefined;
  const previousMessages = stateMessagesOf(snapshotValues);
  const previousKnowledgeContext = latestKnowledgeContext(
    previousMessages,
    snapshotState?.ragContext ?? "",
  );
  if (previousKnowledgeContext) {
    const decision = await decideAutoRagStrategy(
      trimmed,
      previousKnowledgeContext,
      recentDialogueOf(previousMessages),
    );
    logger.info("auto_rag.strategy_decision", { strategy: decision.strategy, reason: decision.reason });
    if (decision.strategy === "reuse") {
      return {
        ok: true,
        message: trimmed,
        ragMode: true,
        ragStrategy: "reuse",
        ragContext: previousKnowledgeContext,
      };
    }
    if (decision.strategy === "search") {
      return { ok: true, message: trimmed, ragMode: true, ragStrategy: "search", ragContext: "" };
    }
    return { ok: true, message: trimmed, ragMode: false, ragStrategy: "search", ragContext: "" };
  }

  try {
    const hits = await searchKnowledge(userId, trimmed, 3);
    const bestDistance = hits[0]?.distance;
    const ragMode =
      typeof bestDistance === "number" && bestDistance <= config.autoRagDistanceThreshold;
    return {
      ok: true,
      message: trimmed,
      ragMode,
      ragStrategy: "search",
      ragContext: "",
    };
  } catch (err) {
    logger.warn("auto_rag.initial_lookup_skipped", { error: toLogError(err) });
    return { ok: true, message: trimmed, ragMode: false, ragStrategy: "search", ragContext: "" };
  }
}

/**
 * POST /chat：开始一轮新对话。
 *
 * 可观测性运转流程：
 * 1. 为 HTTP 请求创建 requestId，并放入 AsyncLocalStorage；
 * 2. 认证后补充 userId/threadId，后续日志会自动带上这些字段；
 * 3. 获取同线程运行锁，避免多个图运行并发写同一个 checkpoint；
 * 4. 根据 mode、/rag 命令和历史知识库上下文决定本轮 RAG 策略；
 * 5. 创建 runId，发送 run:start，再把 LangGraph streamEvents 转为标准 SSE；
 * 6. finally 中记录运行耗时并释放线程锁。
 */
chatRoute.post("/chat", authMiddleware, async (c) => {
  const requestId = c.req.header("X-Request-Id") || createRequestId();
  c.header("X-Request-Id", requestId);

  return runWithRequestContext({ requestId }, async () => {
    const requestStartedAt = nowMs();
    logger.info("http.request.start", { method: "POST", path: "/chat" });

    const parsed = ChatSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(c, new AppError("VALIDATION_ERROR", "请求参数不合法", { status: 400 }));
    }
    const { threadId, message, mode } = parsed.data;

    const user = c.get("user");
    patchRequestContext({ userId: user.id, threadId });
    try {
      bindThreadUser(threadId, user.id);
    } catch (err) {
      return jsonError(c, new AppError("AUTH_FORBIDDEN", err instanceof Error ? err.message : String(err), { status: 403 }));
    }

    const release = acquireThreadRun(threadId);
    if (!release) {
      return jsonError(c, new AppError("THREAD_BUSY", "当前线程已有任务正在运行", { status: 409 }));
    }

    let snapshotValues: unknown;
    try {
      const snapshot = await getSnapshot(threadId);
      if (isWaitingForConfirm(snapshot)) {
        release();
        return jsonError(c, new AppError("THREAD_WAITING_CONFIRMATION", "当前线程正在等待确认，请调用 /chat/resume", { status: 409 }));
      }
      snapshotValues = snapshot.values;
    } catch (err) {
      release();
      const message = err instanceof Error ? err.message : String(err);
      return jsonError(c, new AppError("INTERNAL_ERROR", `读取线程状态失败：${message}`, { status: 500, expose: true }));
    }

    const normalized = await normalizeChatInput(message, mode, user.id, snapshotValues);
    if (!normalized.ok) {
      release();
      return jsonError(c, new AppError("VALIDATION_ERROR", normalized.error, { status: 400 }));
    }

    const runId = createRunId();
    patchRequestContext({ runId });
    c.header("X-Agent-Run-Id", runId);
    logger.info("agent.run.start", {
      kind: "chat",
      mode,
      ragMode: normalized.ragMode,
      ragStrategy: normalized.ragStrategy,
      messageLength: normalized.message.length,
    });

    return streamSSE(c, async (stream) => {
      const runStartedAt = nowMs();
      let terminalStatus: "completed" | "waiting" | "error" | "cancelled" = "completed";
      await runWithRequestContext({ requestId, userId: user.id, threadId, runId }, async () => {
        try {
          await stream.writeSSE({ data: JSON.stringify({ type: "run:start", requestId, runId, threadId }) });
          const raw = startChatStream(threadId, normalized.message, c.req.raw.signal, {
            ragMode: normalized.ragMode,
            ragStrategy: normalized.ragStrategy,
            ragContext: normalized.ragContext,
          });
          for await (const event of adaptStream(raw, threadId, { runId, startedAt: runStartedAt })) {
            if (event.type === "stream:end") terminalStatus = event.status;
            await stream.writeSSE({ data: JSON.stringify(event) });
          }
        } finally {
          logger.info("agent.run.end", { kind: "chat", status: terminalStatus, durationMs: durationSince(runStartedAt) });
          logger.info("http.request.end", { method: "POST", path: "/chat", status: 200, durationMs: durationSince(requestStartedAt) });
          release();
        }
      });
    });
  });
});

/**
 * POST /chat/resume：使用用户决策恢复暂停中的图。
 *
 * `Command({ resume })` 会把 decision 作为 interrupt() 的返回值，
 * 图会从暂停节点继续，而不是新建一轮对话。
 */
chatRoute.post("/chat/resume", authMiddleware, async (c) => {
  const requestId = c.req.header("X-Request-Id") || createRequestId();
  c.header("X-Request-Id", requestId);

  return runWithRequestContext({ requestId }, async () => {
    const requestStartedAt = nowMs();
    logger.info("http.request.start", { method: "POST", path: "/chat/resume" });

    const parsed = ResumeSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(c, new AppError("VALIDATION_ERROR", "请求参数不合法", { status: 400 }));
    }
    const { threadId, action, message, plan } = parsed.data;
    const user = c.get("user");
    patchRequestContext({ userId: user.id, threadId });
    try {
      assertThreadUser(threadId, user.id);
    } catch (err) {
      return jsonError(c, new AppError("AUTH_FORBIDDEN", err instanceof Error ? err.message : String(err), { status: 403 }));
    }

    const release = acquireThreadRun(threadId);
    if (!release) {
      return jsonError(c, new AppError("THREAD_BUSY", "当前线程已有任务正在运行", { status: 409 }));
    }

    try {
      const snapshot = await getSnapshot(threadId);
      if (!isWaitingForConfirm(snapshot)) {
        release();
        return jsonError(c, new AppError("THREAD_WAITING_CONFIRMATION", "当前线程没有等待中的确认任务", { status: 409 }));
      }
    } catch (err) {
      release();
      const error = err instanceof Error ? err.message : String(err);
      return jsonError(c, new AppError("INTERNAL_ERROR", `读取线程状态失败：${error}`, { status: 500, expose: true }));
    }

    const decision: HitlDecision =
      action === "modify"
        ? { action: "modify", message, plan }
        : { action };

    const runId = createRunId();
    patchRequestContext({ runId });
    c.header("X-Agent-Run-Id", runId);
    logger.info("agent.run.start", { kind: "resume", action });

    return streamSSE(c, async (stream) => {
      const runStartedAt = nowMs();
      let terminalStatus: "completed" | "waiting" | "error" | "cancelled" = "completed";
      await runWithRequestContext({ requestId, userId: user.id, threadId, runId }, async () => {
        try {
          await stream.writeSSE({ data: JSON.stringify({ type: "run:start", requestId, runId, threadId }) });
          const raw = resumeStream(threadId, decision, c.req.raw.signal);
          for await (const event of adaptResumeStream(raw, threadId, action, { runId, startedAt: runStartedAt })) {
            if (event.type === "stream:end") terminalStatus = event.status;
            await stream.writeSSE({ data: JSON.stringify(event) });
          }
        } finally {
          logger.info("agent.run.end", { kind: "resume", action, status: terminalStatus, durationMs: durationSince(runStartedAt) });
          logger.info("http.request.end", { method: "POST", path: "/chat/resume", status: 200, durationMs: durationSince(requestStartedAt) });
          release();
        }
      });
    });
  });
});
