import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { authMiddleware } from "./authMiddleware";
import { AuthError, loginUser, registerUser } from "./authService";
import type { AuthVariables } from "./types";

const RegisterSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(6).max(128),
  name: z.string().trim().min(1).max(100).optional(),
});

const LoginSchema = z.object({
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(128),
});

export const authRoute = new Hono<{ Variables: AuthVariables }>();

authRoute.post("/api/auth/register", async (c) => {
  const parsed = RegisterSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await registerUser(parsed.data);
    return c.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return c.json({ ok: false, error: err.message }, err.status as ContentfulStatusCode);
    }
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

authRoute.post("/api/auth/login", async (c) => {
  const parsed = LoginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await loginUser(parsed.data);
    return c.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return c.json({ ok: false, error: err.message }, err.status as ContentfulStatusCode);
    }
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

authRoute.get("/api/auth/me", authMiddleware, (c) => {
  return c.json({ user: c.get("user") });
});
