export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

const STORAGE_KEY = "agent4.auth";

export function getAuthSession(): AuthSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.token === "string" &&
      parsed.user &&
      typeof parsed.user.id === "string" &&
      typeof parsed.user.email === "string"
    ) {
      return {
        token: parsed.token,
        user: {
          id: parsed.user.id,
          email: parsed.user.email,
          name: typeof parsed.user.name === "string" ? parsed.user.name : null,
        },
      };
    }
  } catch {
    clearAuthSession();
  }

  return null;
}

export function setAuthSession(session: AuthSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
