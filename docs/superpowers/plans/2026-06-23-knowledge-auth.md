# Knowledge Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add JWT authentication, PostgreSQL/pgvector document knowledge base APIs, per-user isolation, and an Agent knowledge-search tool.

**Architecture:** Add focused modules for database access, auth, knowledge ingestion/search, and thread-user binding. Hono routes enforce JWT authentication; `/chat` and `/chat/resume` bind each `threadId` to a user so `searchKnowledgeTool` can safely search only that user's documents. The existing LangGraph graph stays structurally unchanged; the tool registry receives one new tool.

**Tech Stack:** Node.js, TypeScript strict mode, Hono, LangGraph/LangChain tools, PostgreSQL `pg`, pgvector, OpenAI-compatible embeddings, bcryptjs, jsonwebtoken, pdf-parse, mammoth, uuid.

---

## File Structure

### Create

- `src/db/schema.sql` — PostgreSQL schema for users, documents, chunks, triggers, and vector indexes.
- `src/db/client.ts` — `pg.Pool` wrapper with `query`, `getClient`, and graceful shutdown.
- `scripts/init-db.ts` — reads `src/db/schema.sql` and executes it.
- `src/auth/types.ts` — shared auth user and Hono variable types.
- `src/auth/jwt.ts` — JWT sign/verify helpers using env config.
- `src/auth/authService.ts` — register/login/current-user database logic.
- `src/auth/authMiddleware.ts` — Hono middleware that sets `user` on context.
- `src/auth/routes.ts` — `/api/auth/register`, `/api/auth/login`, `/api/auth/me`.
- `src/runtime/user-context.ts` — in-memory `threadId -> userId` binding and tool-call context helper.
- `src/knowledge/chunkText.ts` — text chunking with overlap.
- `src/knowledge/documentParser.ts` — txt/md/pdf/docx parser.
- `src/knowledge/embeddingService.ts` — OpenAI-compatible embedding calls and dimension validation.
- `src/knowledge/documentService.ts` — upload/list/delete/search orchestration.
- `src/knowledge/routes.ts` — authenticated knowledge API routes.
- `src/tools/searchKnowledge.tool.ts` — LangChain structured tool for Agent knowledge search.

### Modify

- `package.json` — add dependencies and `db:init` script.
- `.env.example` — add database, embedding, upload, and JWT variables.
- `tsconfig.json` — include `scripts/**/*.ts` so `scripts/init-db.ts` typechecks.
- `src/config/index.ts` — expose database, embedding, upload, and JWT config.
- `src/app.ts` — mount auth and knowledge routes; close DB pool on shutdown.
- `src/routes/chat.route.ts` — require auth and bind/check thread ownership.
- `src/runtime/index.ts` — wrap `graph.streamEvents` with current thread context.
- `src/tools/index.ts` — register and export `searchKnowledgeTool`.

---

## Task 1: Install dependencies and extend project configuration

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `tsconfig.json`
- Modify: `src/config/index.ts`

- [ ] **Step 1: Install backend dependencies**

Run from repo root:

```bash
pnpm add pg pdf-parse mammoth uuid bcryptjs jsonwebtoken
pnpm add -D @types/pg @types/jsonwebtoken @types/bcryptjs
```

Expected: `package.json` and `pnpm-lock.yaml` update. No `multer` is installed because upload uses Hono native multipart parsing.

- [ ] **Step 2: Add db:init script**

Update `package.json` scripts to include:

```json
{
  "scripts": {
    "dev": "tsx src/app.ts",
    "typecheck": "tsc --noEmit",
    "db:init": "tsx scripts/init-db.ts",
    "verify:agent-loop": "tsx scripts/verify-agent-loop.ts",
    "verify:skills": "tsx scripts/verify-skills.ts",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

- [ ] **Step 3: Extend .env.example**

Append to `.env.example`:

```env
# PostgreSQL / pgvector
DATABASE_URL=postgresql://用户名:密码@localhost:5432/agent4

# Embeddings. API Key/Base URL reuse DEEPSEEK_API_KEY and DEEPSEEK_BASE_URL.
EMBEDDING_MODEL=text-embedding-v3
EMBEDDING_DIM=1024

# Knowledge uploads
UPLOAD_DIR=uploads

# Auth
JWT_SECRET=请换成一个足够长的随机字符串
JWT_EXPIRES_IN=7d
```

- [ ] **Step 4: Include scripts in TypeScript project**

Change `tsconfig.json` include to:

```json
"include": ["src/**/*.ts", "scripts/**/*.ts"]
```

- [ ] **Step 5: Extend config**

Modify `src/config/index.ts` so `config` includes:

```ts
export const config = {
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
  baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  modelName: process.env.DEEPSEEK_MODEL ?? process.env.MODEL_NAME ?? "deepseek-v4-flash",
  temperature: num("MODEL_TEMPERATURE", 0),
  port: num("PORT", 3000),
  maxAgentRetries: nonNegativeInt("MAX_AGENT_RETRIES", 2),
  maxToolCalls: nonNegativeInt("MAX_TOOL_CALLS", 8),
  enabledTools: list("ENABLED_TOOLS"),
  enabledSkills: list("ENABLED_SKILLS"),
  databaseUrl: process.env.DATABASE_URL ?? "",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-v3",
  embeddingDim: nonNegativeInt("EMBEDDING_DIM", 1024),
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
} as const;
```

Keep the existing helper functions and `AppConfig` export.

- [ ] **Step 6: Verify config typecheck scope**

Run:

```bash
pnpm typecheck
```

Expected: TypeScript may fail only because new dependencies/modules are not implemented yet if later imports were added. If only Task 1 changes exist, expected output is success.

---

## Task 2: Add database schema, client, and init script

**Files:**
- Create: `src/db/schema.sql`
- Create: `src/db/client.ts`
- Create: `scripts/init-db.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Create schema.sql**

Create `src/db/schema.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kb_documents (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  file_path text NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'ready', 'failed')),
  error_message text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kb_chunks (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  content text NOT NULL,
  chunk_index int NOT NULL,
  embedding vector(1024) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_users_updated_at ON users;
CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_kb_documents_updated_at ON kb_documents;
CREATE TRIGGER set_kb_documents_updated_at
BEFORE UPDATE ON kb_documents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_kb_documents_user_created
ON kb_documents (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_document_chunk
ON kb_chunks (document_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding_hnsw
ON kb_chunks USING hnsw (embedding vector_cosine_ops);
```

- [ ] **Step 2: Create db client**

Create `src/db/client.ts`:

```ts
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { config } from "../config";

const pool = new Pool({
  connectionString: config.databaseUrl,
});

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL 未配置");
  }
  return pool.query<T>(text, params);
}

export async function getClient(): Promise<PoolClient> {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL 未配置");
  }
  return pool.connect();
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
```

- [ ] **Step 3: Create init script**

Create `scripts/init-db.ts`:

```ts
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { query, closeDb } from "../src/db/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main(): Promise<void> {
  const schemaPath = resolve(__dirname, "../src/db/schema.sql");
  const sql = await readFile(schemaPath, "utf8");
  await query(sql);
  console.log("Database schema initialized.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
```

- [ ] **Step 4: Add graceful shutdown in app**

In `src/app.ts`, import and use `closeDb`:

```ts
import { closeDb } from "./db/client";
```

After `serve(...)`, add:

```ts
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`Received ${signal}, shutting down...`);
  await closeDb().catch((err) => {
    console.error("Failed to close database pool", err);
  });
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
```

- [ ] **Step 5: Verify database init script typechecks**

Run:

```bash
pnpm typecheck
```

Expected: success if no later imports are missing.

---

## Task 3: Add authentication domain and routes

**Files:**
- Create: `src/auth/types.ts`
- Create: `src/auth/jwt.ts`
- Create: `src/auth/authService.ts`
- Create: `src/auth/authMiddleware.ts`
- Create: `src/auth/routes.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Create auth types**

Create `src/auth/types.ts`:

```ts
export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

export type AuthVariables = {
  user: AuthUser;
};
```

- [ ] **Step 2: Create JWT helpers**

Create `src/auth/jwt.ts`:

```ts
import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config";

export type JwtPayload = {
  sub: string;
  email: string;
};

function getJwtSecret(): string {
  if (!config.jwtSecret) {
    throw new Error("JWT_SECRET 未配置");
  }
  return config.jwtSecret;
}

export function signAuthToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn,
  };
  return jwt.sign(payload, getJwtSecret(), options);
}

export function verifyAuthToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("无效 token");
  }

  const sub = decoded.sub;
  const email = (decoded as { email?: unknown }).email;
  if (typeof sub !== "string" || typeof email !== "string") {
    throw new Error("无效 token payload");
  }

  return { sub, email };
}
```

- [ ] **Step 3: Create auth service**

Create `src/auth/authService.ts`:

```ts
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
  if (exists.rowCount > 0) {
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
  const email = input.email.trim().toLowerCase();
  const result = await query<UserRow>(
    "SELECT id, email, password_hash, name FROM users WHERE email = $1",
    [email],
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
```

- [ ] **Step 4: Create auth middleware**

Create `src/auth/authMiddleware.ts`:

```ts
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
```

- [ ] **Step 5: Create auth routes**

Create `src/auth/routes.ts`:

```ts
import { Hono } from "hono";
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
  email: z.string().trim().email().max(320),
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
      return c.json({ ok: false, error: err.message }, err.status);
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
      return c.json({ ok: false, error: err.message }, err.status);
    }
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

authRoute.get("/api/auth/me", authMiddleware, (c) => {
  return c.json({ user: c.get("user") });
});
```

- [ ] **Step 6: Mount auth route**

In `src/app.ts`, import and mount:

```ts
import { authRoute } from "./auth/routes";

app.route("/", authRoute);
```

Place auth route before chat route; route ordering does not conflict.

- [ ] **Step 7: Typecheck auth**

Run:

```bash
pnpm typecheck
```

Expected: success. If `jsonwebtoken` rejects `expiresIn` typing, adjust `jwtExpiresIn` by casting inside `signAuthToken`:

```ts
expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"],
```

---

## Task 4: Require auth for chat and bind thread ownership

**Files:**
- Create: `src/runtime/user-context.ts`
- Modify: `src/routes/chat.route.ts`
- Modify: `src/runtime/index.ts`

- [ ] **Step 1: Create user-context helper**

Create `src/runtime/user-context.ts`:

```ts
const threadUsers = new Map<string, string>();
let activeToolUserId: string | undefined;

export function bindThreadUser(threadId: string, userId: string): void {
  const existing = threadUsers.get(threadId);
  if (existing && existing !== userId) {
    throw new Error("当前线程属于其他用户");
  }
  threadUsers.set(threadId, userId);
}

export function getThreadUser(threadId: string): string | undefined {
  return threadUsers.get(threadId);
}

export function assertThreadUser(threadId: string, userId: string): void {
  const existing = threadUsers.get(threadId);
  if (!existing) {
    throw new Error("当前线程未绑定用户");
  }
  if (existing !== userId) {
    throw new Error("当前线程属于其他用户");
  }
}

export async function withActiveToolUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const previous = activeToolUserId;
  activeToolUserId = userId;
  try {
    return await fn();
  } finally {
    activeToolUserId = previous;
  }
}

export function getActiveToolUser(): string | undefined {
  return activeToolUserId;
}
```

- [ ] **Step 2: Protect chat route with auth middleware**

Modify `src/routes/chat.route.ts` imports:

```ts
import { authMiddleware } from "../auth/authMiddleware";
import type { AuthVariables } from "../auth/types";
import { assertThreadUser, bindThreadUser } from "../runtime/user-context";
```

Change route declaration:

```ts
export const chatRoute = new Hono<{ Variables: AuthVariables }>();
```

Change `/chat` handler signature to include middleware:

```ts
chatRoute.post("/chat", authMiddleware, async (c) => {
```

After parsing `{ threadId, message }`, add:

```ts
const user = c.get("user");
try {
  bindThreadUser(threadId, user.id);
} catch (err) {
  const error = err instanceof Error ? err.message : String(err);
  return c.json({ ok: false, error }, 403);
}
```

Change `/chat/resume` handler signature:

```ts
chatRoute.post("/chat/resume", authMiddleware, async (c) => {
```

After parsing `{ threadId, action, message, plan }`, add:

```ts
const user = c.get("user");
try {
  assertThreadUser(threadId, user.id);
} catch (err) {
  const error = err instanceof Error ? err.message : String(err);
  return c.json({ ok: false, error }, 403);
}
```

- [ ] **Step 3: Run graph streams with active tool user**

Modify `src/runtime/index.ts` imports:

```ts
import { getThreadUser, withActiveToolUser } from "./user-context";
```

Change `startChatStream` to:

```ts
export async function* startChatStream(threadId: string, message: string, signal?: AbortSignal) {
  const userId = getThreadUser(threadId);
  const stream = () =>
    graph.streamEvents(
      { messages: [new HumanMessage(message)] },
      { ...getThreadConfig(threadId), version: "v2", signal },
    );

  if (!userId) {
    yield* await stream();
    return;
  }

  const events = await withActiveToolUser(userId, stream);
  yield* events;
}
```

If TypeScript rejects `yield* await stream()` because `streamEvents` returns an async iterable promise-like value in this LangGraph version, use this equivalent form:

```ts
const events = userId ? await withActiveToolUser(userId, stream) : await stream();
for await (const event of events) {
  yield event;
}
```

Use the second form if needed because it is explicit and easier to typecheck.

- [ ] **Step 4: Typecheck chat auth**

Run:

```bash
pnpm typecheck
```

Expected: success.

---

## Task 5: Add text parsing, chunking, and embeddings

**Files:**
- Create: `src/knowledge/chunkText.ts`
- Create: `src/knowledge/documentParser.ts`
- Create: `src/knowledge/embeddingService.ts`

- [ ] **Step 1: Create chunkText**

Create `src/knowledge/chunkText.ts`:

```ts
export type ChunkOptions = {
  chunkSize?: number;
  overlap?: number;
};

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const chunkSize = options.chunkSize ?? 800;
  const overlap = options.overlap ?? 100;
  if (chunkSize <= 0) {
    throw new Error("chunkSize 必须大于 0");
  }
  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error("overlap 必须大于等于 0 且小于 chunkSize");
  }

  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = end - overlap;
  }

  return chunks;
}
```

- [ ] **Step 2: Smoke-test chunkText before consumers**

Run:

```bash
pnpm exec tsx -e "import { chunkText } from './src/knowledge/chunkText.ts'; const chunks = chunkText('a'.repeat(1700)); if (chunks.length !== 3) throw new Error(String(chunks.length)); console.log('chunkText ok');"
```

Expected: `chunkText ok`.

- [ ] **Step 3: Create document parser**

Create `src/knowledge/documentParser.ts`:

```ts
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export type ParseDocumentInput = {
  filePath: string;
  originalName: string;
  mimeType: string;
};

export async function parseDocument(input: ParseDocumentInput): Promise<string> {
  const ext = extname(input.originalName).toLowerCase();
  const mime = input.mimeType.toLowerCase();

  if (ext === ".txt" || ext === ".md" || mime.startsWith("text/")) {
    return readFile(input.filePath, "utf8");
  }

  if (ext === ".pdf" || mime === "application/pdf") {
    const buffer = await readFile(input.filePath);
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (
    ext === ".docx" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ path: input.filePath });
    return result.value;
  }

  throw new Error("不支持的文件格式，仅支持 txt、md、pdf、docx");
}
```

- [ ] **Step 4: Create embedding service**

Create `src/knowledge/embeddingService.ts`:

```ts
import { OpenAIEmbeddings } from "@langchain/openai";
import { config } from "../config";

const embeddings = new OpenAIEmbeddings({
  model: config.embeddingModel,
  apiKey: config.apiKey,
  configuration: {
    baseURL: config.baseURL,
  },
});

function assertEmbeddingDim(vector: number[]): void {
  if (vector.length !== config.embeddingDim) {
    throw new Error(
      `Embedding 维度不匹配：期望 ${config.embeddingDim}，实际 ${vector.length}`,
    );
  }
}

export async function embedQuery(text: string): Promise<number[]> {
  const vector = await embeddings.embedQuery(text);
  assertEmbeddingDim(vector);
  return vector;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const vectors = await embeddings.embedDocuments(texts);
  for (const vector of vectors) {
    assertEmbeddingDim(vector);
  }
  return vectors;
}
```

- [ ] **Step 5: Typecheck knowledge primitives**

Run:

```bash
pnpm typecheck
```

Expected: success. If `pdf-parse` lacks bundled declarations, add a local declaration file `src/types/pdf-parse.d.ts`:

```ts
declare module "pdf-parse" {
  export type PdfParseResult = { text: string };
  export default function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
}
```

Then rerun `pnpm typecheck`.

---

## Task 6: Add document service and knowledge API routes

**Files:**
- Create: `src/knowledge/documentService.ts`
- Create: `src/knowledge/routes.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Create document service**

Create `src/knowledge/documentService.ts` with these exports and behavior:

```ts
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { File } from "node:buffer";
import { v4 as uuidv4 } from "uuid";
import type { PoolClient } from "pg";
import { config } from "../config";
import { getClient, query } from "../db/client";
import { chunkText } from "./chunkText";
import { embedQuery, embedTexts } from "./embeddingService";
import { parseDocument } from "./documentParser";

export type DocumentStatus = "processing" | "ready" | "failed";

export type KnowledgeDocument = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  status: DocumentStatus;
  errorMessage: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeSearchResult = {
  content: string;
  filename: string;
  documentId: string;
  distance: number;
};

function vectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

async function updateFailedDocument(
  client: PoolClient,
  documentId: string,
  message: string,
): Promise<void> {
  await client.query(
    "UPDATE kb_documents SET status = 'failed', error_message = $2 WHERE id = $1",
    [documentId, message],
  );
}

export async function uploadDocument(userId: string, file: File): Promise<{ id: string; status: DocumentStatus; chunkCount: number }> {
  const originalName = file.name || "upload";
  const mimeType = file.type || "application/octet-stream";
  const id = uuidv4();
  const ext = extname(originalName);
  const filename = `${id}${ext}`;
  const uploadDir = config.uploadDir;
  const filePath = join(uploadDir, filename);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO kb_documents (id, user_id, filename, original_name, mime_type, file_path, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'processing')`,
      [id, userId, filename, originalName, mimeType, filePath],
    );

    const text = await parseDocument({ filePath, originalName, mimeType });
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new Error("文档没有可入库的文本内容");
    }

    const vectors = await embedTexts(chunks);
    for (let i = 0; i < chunks.length; i += 1) {
      await client.query(
        `INSERT INTO kb_chunks (id, document_id, content, chunk_index, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [uuidv4(), id, chunks[i], i, vectorLiteral(vectors[i])],
      );
    }

    await client.query(
      "UPDATE kb_documents SET status = 'ready', error_message = NULL WHERE id = $1",
      [id],
    );
    await client.query("COMMIT");
    return { id, status: "ready", chunkCount: chunks.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await updateFailedDocument(client, id, message);
      await client.query("COMMIT");
    } catch {
      await client.query("ROLLBACK").catch(() => undefined);
    }
    await unlink(filePath).catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function listDocuments(userId: string): Promise<KnowledgeDocument[]> {
  const result = await query<{
    id: string;
    filename: string;
    original_name: string;
    mime_type: string;
    status: DocumentStatus;
    error_message: string | null;
    chunk_count: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT d.id, d.filename, d.original_name, d.mime_type, d.status, d.error_message,
            COUNT(c.id)::text AS chunk_count, d.created_at, d.updated_at
     FROM kb_documents d
     LEFT JOIN kb_chunks c ON c.document_id = d.id
     WHERE d.user_id = $1
     GROUP BY d.id
     ORDER BY d.created_at DESC`,
    [userId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    originalName: row.original_name,
    mimeType: row.mime_type,
    status: row.status,
    errorMessage: row.error_message,
    chunkCount: Number(row.chunk_count),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));
}

export async function deleteDocument(userId: string, documentId: string): Promise<boolean> {
  const found = await query<{ file_path: string }>(
    "SELECT file_path FROM kb_documents WHERE id = $1 AND user_id = $2",
    [documentId, userId],
  );
  const filePath = found.rows[0]?.file_path;
  if (!filePath) return false;

  const deleted = await query("DELETE FROM kb_documents WHERE id = $1 AND user_id = $2", [
    documentId,
    userId,
  ]);
  if ((deleted.rowCount ?? 0) === 0) return false;

  await unlink(filePath).catch((err) => {
    console.warn(`删除本地文件失败：${filePath}`, err);
  });
  return true;
}

export async function searchKnowledge(
  userId: string,
  searchQuery: string,
  topK = 5,
): Promise<KnowledgeSearchResult[]> {
  const limit = Math.min(Math.max(topK, 1), 20);
  const vector = await embedQuery(searchQuery);
  const result = await query<{
    content: string;
    filename: string;
    document_id: string;
    distance: number;
  }>(
    `SELECT c.content, d.filename, d.id AS document_id, c.embedding <=> $1::vector AS distance
     FROM kb_chunks c
     JOIN kb_documents d ON d.id = c.document_id
     WHERE d.user_id = $2 AND d.status = 'ready'
     ORDER BY c.embedding <=> $1::vector
     LIMIT $3`,
    [vectorLiteral(vector), userId, limit],
  );

  return result.rows.map((row) => ({
    content: row.content,
    filename: row.filename,
    documentId: row.document_id,
    distance: Number(row.distance),
  }));
}
```

- [ ] **Step 2: If File import fails, adjust type source**

If `import type { File } from "node:buffer"` fails in this Node typings version, remove that import and rely on the DOM `File` type already available through `tsconfig.json` `lib: ["ES2022", "DOM"]`.

- [ ] **Step 3: Create knowledge routes**

Create `src/knowledge/routes.ts`:

```ts
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
  if (!(file instanceof File)) {
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
```

- [ ] **Step 4: Mount knowledge route**

In `src/app.ts`, import and mount:

```ts
import { knowledgeRoute } from "./knowledge/routes";

app.route("/", knowledgeRoute);
```

Mount before `chatRoute` or after it; paths do not conflict.

- [ ] **Step 5: Typecheck knowledge API**

Run:

```bash
pnpm typecheck
```

Expected: success. If `File` is not globally available at runtime in the installed Node version, replace the upload check with a structural check:

```ts
if (!(file instanceof globalThis.File)) {
  return c.json({ ok: false, error: "请使用 multipart/form-data 上传 file 字段" }, 400);
}
```

---

## Task 7: Add Agent knowledge-search tool

**Files:**
- Create: `src/tools/searchKnowledge.tool.ts`
- Modify: `src/tools/index.ts`

- [ ] **Step 1: Create searchKnowledge tool**

Create `src/tools/searchKnowledge.tool.ts`:

```ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getActiveToolUser } from "../runtime/user-context";
import { searchKnowledge } from "../knowledge/documentService";

function formatResults(
  results: Array<{ content: string; filename: string; documentId: string; distance: number }>,
): string {
  if (results.length === 0) {
    return "未找到相关知识库片段。";
  }

  const lines = [`找到 ${results.length} 条相关知识库片段：`];
  results.forEach((result, index) => {
    lines.push(
      "",
      `[${index + 1}] ${result.filename} / document_id=${result.documentId}`,
      `distance=${result.distance}`,
      result.content,
    );
  });
  return lines.join("\n");
}

export const searchKnowledgeTool = tool(
  async ({ query }: { query: string }) => {
    const userId = getActiveToolUser();
    if (!userId) {
      return "当前会话未绑定用户，请先登录后再使用知识库检索。";
    }

    const results = await searchKnowledge(userId, query, 5);
    return formatResults(results);
  },
  {
    name: "searchKnowledge",
    description: "检索当前登录用户上传的文档知识库，返回最相关的知识库片段。",
    schema: z.object({
      query: z.string().trim().min(1).describe("要在知识库中检索的问题或关键词"),
    }),
  },
);
```

- [ ] **Step 2: Register tool**

Modify `src/tools/index.ts`:

```ts
import { registerTool } from "./registry";
import { getWeather } from "./weather.tool";
import { searchKnowledgeTool } from "./searchKnowledge.tool";

/** 注册内置工具。启动时调用一次。 */
export function registerBuiltinTools(): void {
  registerTool(getWeather);
  registerTool(searchKnowledgeTool);
}

export { getWeather } from "./weather.tool";
export { searchKnowledgeTool } from "./searchKnowledge.tool";
export { registerTool, getTools, getToolsByName, createToolNode } from "./registry";
```

- [ ] **Step 3: Typecheck tool registration**

Run:

```bash
pnpm typecheck
```

Expected: success.

---

## Task 8: Final verification and manual test commands

**Files:**
- Verify all changed files

- [ ] **Step 1: Install dependencies from lockfile state**

Run:

```bash
pnpm install
```

Expected: dependency graph is up to date.

- [ ] **Step 2: Run TypeScript verification**

Run:

```bash
pnpm typecheck
```

Expected: success.

- [ ] **Step 3: Initialize database after configuring .env**

After setting `DATABASE_URL` to a PostgreSQL database with pgvector installed, run:

```bash
pnpm db:init
```

Expected:

```text
Database schema initialized.
```

- [ ] **Step 4: Start server**

Run:

```bash
pnpm dev
```

Expected server log:

```text
Agent runtime listening on http://localhost:3000
```

- [ ] **Step 5: Register and login manually**

Use curl or an HTTP client:

```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@qq.com","password":"123456","name":"测试用户"}'
```

Expected: JSON with `token` and `user`.

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@qq.com","password":"123456"}'
```

Expected: JSON with `token` and `user`.

- [ ] **Step 6: Verify current user**

Set shell variable manually:

```bash
TOKEN='paste-token-here'
```

Then run:

```bash
curl -s http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

Expected: current user JSON.

- [ ] **Step 7: Upload txt document**

Create a local sample file outside git-tracked source or in a temp directory:

```bash
printf 'agent4 是一个多 Agent Runtime。它支持工具调用和计划确认。' > /tmp/agent4-kb.txt
curl -s -X POST http://localhost:3000/api/knowledge/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/agent4-kb.txt;type=text/plain"
```

Expected: JSON containing `document.status = ready` and `chunkCount >= 1`.

- [ ] **Step 8: List documents**

```bash
curl -s http://localhost:3000/api/knowledge/documents \
  -H "Authorization: Bearer $TOKEN"
```

Expected: uploaded document appears with `chunkCount >= 1`.

- [ ] **Step 9: Search knowledge**

```bash
curl -s -X POST http://localhost:3000/api/knowledge/search \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"query":"agent4 支持什么？","topK":5}'
```

Expected: result includes uploaded content.

- [ ] **Step 10: Delete document**

Copy the document id from upload/list response:

```bash
DOC_ID='paste-document-id-here'
curl -s -X DELETE "http://localhost:3000/api/knowledge/documents/$DOC_ID" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: `{ "ok": true }`. A subsequent list call does not show the document.

- [ ] **Step 11: Verify chat auth and tool availability**

Call `/chat` without token:

```bash
curl -i -X POST http://localhost:3000/chat \
  -H 'Content-Type: application/json' \
  -d '{"threadId":"t1","message":"你好"}'
```

Expected: HTTP 401.

Call `/chat` with token:

```bash
curl -N -X POST http://localhost:3000/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"threadId":"t1","message":"请检索我的知识库：agent4 支持什么？"}'
```

Expected: SSE stream starts; if the router selects tool usage, `searchKnowledge` can only access the current user's documents.

- [ ] **Step 12: Commit implementation**

After all verification passes:

```bash
git status --short
git add package.json pnpm-lock.yaml .env.example tsconfig.json src scripts
git commit -m "feat: add auth knowledge base"
```

Expected: one implementation commit after the design/spec commit.

---

## Self-Review

- Spec coverage: covered dependencies, env config, schema, db client/init, auth routes/middleware, chat binding, parser/chunker/embedding, document service, knowledge API, Agent tool, and verification.
- Placeholder scan: no TBD/TODO/fill-in placeholders remain. Conditional notes describe concrete fallbacks for known type/runtime differences.
- Type consistency: `AuthUser`, `AuthVariables`, `searchKnowledge`, `uploadDocument`, `getActiveToolUser`, and route response names are consistent across tasks.
