import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../auth/authMiddleware";
import type { AuthVariables } from "../auth/types";
import {
  deleteDocument,
  listDocuments,
  searchKnowledge,
  uploadDocument,
} from "./documentService";

const SearchSchema = z.object({
  query: z.string().trim().min(1).max(2_000),
  topK: z.number().int().min(1).max(20).optional().default(5),
});

export const knowledgeRoute = new Hono<{ Variables: AuthVariables }>();

knowledgeRoute.use("/api/knowledge/*", authMiddleware);

knowledgeRoute.get("/api/knowledge/documents", async (c) => {
  const user = c.get("user");
  const documents = await listDocuments(user.id);
  return c.json({ documents });
});

knowledgeRoute.post("/api/knowledge/documents", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof globalThis.File)) {
    return c.json({ ok: false, error: "请使用 multipart/form-data 上传 file 字段" }, 400);
  }

  try {
    const document = await uploadDocument(user.id, file);
    return c.json({ document });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("不支持的文件格式") ? 400 : 500;
    return c.json({ ok: false, error: message }, status);
  }
});

knowledgeRoute.delete("/api/knowledge/documents/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const ok = await deleteDocument(user.id, id);
  if (!ok) {
    return c.json({ ok: false, error: "文档不存在" }, 404);
  }
  return c.json({ ok: true });
});

knowledgeRoute.post("/api/knowledge/search", async (c) => {
  const parsed = SearchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  const user = c.get("user");
  const results = await searchKnowledge(user.id, parsed.data.query, parsed.data.topK);
  return c.json({ results });
});
