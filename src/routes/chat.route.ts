import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { startChatStream, resumeStream } from "../runtime";
import { adaptStream, adaptResumeStream } from "../services/stream";
import type { HitlDecision } from "../types/agent";

const ChatSchema = z.object({
  threadId: z.string().min(1),
  message: z.string().min(1),
});

const ResumeSchema = z.object({
  threadId: z.string().min(1),
  action: z.enum(["confirm", "reject", "modify"]),
  message: z.string().optional(),
  plan: z
    .object({
      goal: z.string(),
      steps: z.array(z.object({ id: z.number(), task: z.string() })),
    })
    .optional(),
});

export const chatRoute = new Hono();

/** POST /chat — start a chat turn; streams standardized SSE events. */
chatRoute.post("/chat", async (c) => {
  const parsed = ChatSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }
  const { threadId, message } = parsed.data;

  return streamSSE(c, async (stream) => {
    const raw = startChatStream(threadId, message);
    for await (const event of adaptStream(raw, threadId)) {
      await stream.writeSSE({ data: JSON.stringify(event) });
    }
  });
});

/** POST /chat/resume — resume a paused (HITL) thread with the user's decision. */
chatRoute.post("/chat/resume", async (c) => {
  const parsed = ResumeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }
  const { threadId, action, message, plan } = parsed.data;

  const decision: HitlDecision =
    action === "modify"
      ? { action: "modify", message, plan }
      : { action };

  return streamSSE(c, async (stream) => {
    const raw = resumeStream(threadId, decision);
    for await (const event of adaptResumeStream(raw, threadId, action)) {
      await stream.writeSSE({ data: JSON.stringify(event) });
    }
  });
});
