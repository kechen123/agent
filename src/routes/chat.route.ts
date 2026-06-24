import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
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

async function normalizeChatInput(
  message: string,
  mode: "auto" | "chat" | "rag",
  userId: string,
): Promise<{ ok: true; message: string; ragMode: boolean } | { ok: false; error: string }> {
  const trimmed = message.trim();
  const commandMatch = /^\/rag(?:\s+|$)/i.exec(trimmed);
  const forceRag = mode === "rag" || Boolean(commandMatch);

  if (mode === "chat" && !commandMatch) {
    return { ok: true, message: trimmed, ragMode: false };
  }

  const question = commandMatch ? trimmed.slice(commandMatch[0].length).trim() : trimmed;
  if (forceRag && !question) {
    return { ok: false, error: "请在 /rag 后输入要检索的问题" };
  }

  if (forceRag) {
    return { ok: true, message: question, ragMode: true };
  }

  try {
    const hits = await searchKnowledge(userId, trimmed, 3);
    const bestDistance = hits[0]?.distance;
    const ragMode =
      typeof bestDistance === "number" && bestDistance <= config.autoRagDistanceThreshold;
    return { ok: true, message: trimmed, ragMode };
  } catch (err) {
    console.warn("[AutoRAG] skip knowledge lookup", err);
    return { ok: true, message: trimmed, ragMode: false };
  }
}

/**
 * POST /chat：开始一轮新对话。
 *
 * 同一 threadId 必须串行执行，否则两个图运行会并发写入同一个 checkpoint。
 * 因此先获取线程锁，再检查 checkpoint 是否正在等待 HITL。
 */
chatRoute.post("/chat", authMiddleware, async (c) => {
  const parsed = ChatSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }
  const { threadId, message, mode } = parsed.data;

  const user = c.get("user");
  try {
    bindThreadUser(threadId, user.id);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error }, 403);
  }

  const normalized = await normalizeChatInput(message, mode, user.id);
  if (!normalized.ok) {
    return c.json({ ok: false, error: normalized.error }, 400);
  }

  const release = acquireThreadRun(threadId);
  if (!release) {
    return c.json({ ok: false, error: "当前线程已有任务正在运行" }, 409);
  }

  try {
    const snapshot = await getSnapshot(threadId);
    if (isWaitingForConfirm(snapshot)) {
      release();
      return c.json({ ok: false, error: "当前线程正在等待确认，请调用 /chat/resume" }, 409);
    }
  } catch (err) {
    release();
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: `读取线程状态失败：${message}` }, 500);
  }

  return streamSSE(c, async (stream) => {
    try {
      const raw = startChatStream(threadId, normalized.message, c.req.raw.signal, {
        ragMode: normalized.ragMode,
      });
      for await (const event of adaptStream(raw, threadId)) {
        await stream.writeSSE({ data: JSON.stringify(event) });
      }
    } finally {
      release();
    }
  });
});

/**
 * POST /chat/resume：使用用户决策恢复暂停中的图。
 *
 * `Command({ resume })` 会把 decision 作为 interrupt() 的返回值，
 * 图会从暂停节点继续，而不是新建一轮对话。
 */
chatRoute.post("/chat/resume", authMiddleware, async (c) => {
  const parsed = ResumeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }
  const { threadId, action, message, plan } = parsed.data;
  const user = c.get("user");
  try {
    assertThreadUser(threadId, user.id);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error }, 403);
  }

  const release = acquireThreadRun(threadId);
  if (!release) {
    return c.json({ ok: false, error: "当前线程已有任务正在运行" }, 409);
  }

  try {
    const snapshot = await getSnapshot(threadId);
    if (!isWaitingForConfirm(snapshot)) {
      release();
      return c.json({ ok: false, error: "当前线程没有等待中的确认任务" }, 409);
    }
  } catch (err) {
    release();
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: `读取线程状态失败：${error}` }, 500);
  }

  const decision: HitlDecision =
    action === "modify"
      ? { action: "modify", message, plan }
      : { action };

  return streamSSE(c, async (stream) => {
    try {
      const raw = resumeStream(threadId, decision, c.req.raw.signal);
      for await (const event of adaptResumeStream(raw, threadId, action)) {
        await stream.writeSSE({ data: JSON.stringify(event) });
      }
    } finally {
      release();
    }
  });
});
