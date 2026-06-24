import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { query } from "../db/client";
import { signAuthToken } from "./jwt";
import type { AuthUser } from "./types";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function toAuthUser(row: Pick<UserRow, "id" | "email" | "name">): AuthUser {
  return { id: row.id, email: row.email, name: row.name };
}

export async function registerUser(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ token: string; user: AuthUser }> {
  const email = input.email.trim().toLowerCase();
  const exists = await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
  if ((exists.rowCount ?? 0) > 0) {
    throw new AuthError("邮箱已注册", 409);
  }

  const id = uuidv4();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const result = await query<UserRow>(
    `INSERT INTO users (id, email, password_hash, name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, password_hash, name`,
    [id, email, passwordHash, input.name?.trim() || null],
  );

  const user = toAuthUser(result.rows[0]);
  const token = signAuthToken({ sub: user.id, email: user.email });
  return { token, user };
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ token: string; user: AuthUser }> {
  const account = input.email.trim();
  const normalized = account.toLowerCase();
  const loginByEmail = normalized.includes("@");
  const result = await query<UserRow>(
    loginByEmail
      ? "SELECT id, email, password_hash, name FROM users WHERE email = $1"
      : "SELECT id, email, password_hash, name FROM users WHERE name = $1",
    [loginByEmail ? normalized : account],
  );
  const row = result.rows[0];
  if (!row) {
    throw new AuthError("邮箱或密码错误", 401);
  }

  const ok = await bcrypt.compare(input.password, row.password_hash);
  if (!ok) {
    throw new AuthError("邮箱或密码错误", 401);
  }

  const user = toAuthUser(row);
  const token = signAuthToken({ sub: user.id, email: user.email });
  return { token, user };
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const result = await query<Pick<UserRow, "id" | "email" | "name">>(
    "SELECT id, email, name FROM users WHERE id = $1",
    [id],
  );
  const row = result.rows[0];
  return row ? toAuthUser(row) : null;
}
