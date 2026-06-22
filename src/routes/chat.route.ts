import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import {
  getSnapshot,
  isWaitingForConfirm,
  startChatStream,
  resumeStream,
} from "../runtime";
import { adaptStream, adaptResumeStream } from "../services/stream";
import type { HitlDecision } from "../types/agent";
import { acquireThreadRun } from "../runtime/run-lock";

const ChatSchema = z.object({
  threadId: z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  message: z.string().trim().min(1).max(20_000),
});

const ResumeSchema = z.object({
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
        .max(50),
    })
    .optional(),
}).superRefine((value, ctx) => {
  if (value.action === "modify" && !value.message && !value.plan) {
    ctx.addIssue({
      code: "custom",
      path: ["message"],
      message: "modify 操作必须提供修改意见或计划",
    });
  }
});

export const chatRoute = new Hono();

/** POST /chat — 开始一轮对话；流式输出标准化 SSE 事件。 */
chatRoute.post("/chat", async (c) => {
  const parsed = ChatSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }
  const { threadId, message } = parsed.data;
  const snapshot = await getSnapshot(threadId);
  if (isWaitingForConfirm(snapshot)) {
    return c.json({ ok: false, error: "当前线程正在等待确认，请调用 /chat/resume" }, 409);
  }
  const release = acquireThreadRun(threadId);
  if (!release) {
    return c.json({ ok: false, error: "当前线程已有任务正在运行" }, 409);
  }

  return streamSSE(c, async (stream) => {
    try {
      const raw = startChatStream(threadId, message, c.req.raw.signal);
      for await (const event of adaptStream(raw, threadId)) {
        await stream.writeSSE({ data: JSON.stringify(event) });
      }
    } finally {
      release();
    }
  });
});

/** POST /chat/resume — 使用用户决策恢复暂停中的 HITL 线程。 */
chatRoute.post("/chat/resume", async (c) => {
  const parsed = ResumeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }
  const { threadId, action, message, plan } = parsed.data;
  const snapshot = await getSnapshot(threadId);
  if (!isWaitingForConfirm(snapshot)) {
    return c.json({ ok: false, error: "当前线程没有等待中的确认任务" }, 409);
  }
  const release = acquireThreadRun(threadId);
  if (!release) {
    return c.json({ ok: false, error: "当前线程已有任务正在运行" }, 409);
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
