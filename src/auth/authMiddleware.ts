import { createMiddleware } from "hono/factory";
import { getUserById } from "./authService";
import { verifyAuthToken } from "./jwt";
import type { AuthVariables } from "./types";

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return c.json({ ok: false, error: "未登录" }, 401);
  }

  try {
    const payload = verifyAuthToken(match[1]);
    const user = await getUserById(payload.sub);
    if (!user) {
      return c.json({ ok: false, error: "用户不存在" }, 401);
    }
    c.set("user", user);
    await next();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: `认证失败：${message}` }, 401);
  }
});
