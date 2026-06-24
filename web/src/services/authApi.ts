import type { AuthSession, AuthUser } from "./authStorage";

async function parseError(res: Response): Promise<Error> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string") return new Error(body.error);
    if (body.error) return new Error(JSON.stringify(body.error));
  } catch {
    // ignore non-JSON errors
  }
  return new Error(`请求失败：${res.status} ${res.statusText}`);
}

export async function login(account: string, password: string): Promise<AuthSession> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: account, password }),
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as AuthSession;
}

export async function getMe(token: string, signal?: AbortSignal): Promise<AuthUser> {
  const res = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  const body = (await res.json()) as { user: AuthUser };
  return body.user;
}
