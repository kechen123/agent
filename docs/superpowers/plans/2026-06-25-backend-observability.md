# Backend Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight backend observability vertical slice for request/run tracing, structured logs, node/tool timings, typed errors, `/ready`, and learning-oriented Chinese runtime documentation.

**Architecture:** Add a focused `src/observability/` module for IDs, request context, logging, timing, and public errors. Wire it into `/chat`, `/chat/resume`, `services/stream.ts`, health/readiness routing, shared event types, and docs without changing Agent decision logic or RAG behavior.

**Tech Stack:** Node.js, TypeScript, Hono, LangGraph `streamEvents`, AsyncLocalStorage, PostgreSQL `pg`, React/Vite TypeScript mirror types.

---

## File Structure

Create:

- `src/observability/ids.ts` — generate readable `req_...` and `run_...` IDs.
- `src/observability/request-context.ts` — store `requestId`, `runId`, `threadId`, `userId` in `AsyncLocalStorage` with detailed Chinese comments.
- `src/observability/logger.ts` — emit JSON-line structured logs and merge request context automatically.
- `src/observability/timing.ts` — provide monotonic timing helpers.
- `src/observability/errors.ts` — define `ErrorCode`, `AppError`, public error conversion, and SSE error metadata.
- `src/routes/health.route.ts` — own `/health` and `/ready`, including config and database readiness checks.

Modify:

- `src/types/agent.ts` — add `ErrorCode`, `run:start`, optional error metadata, optional stream-end metadata.
- `web/src/types/agent-ui.ts` — mirror backend SSE event changes.
- `web/src/hooks/useAgentRuntime.ts` — display `run:start` and optional error code/duration in existing metadata without major UI redesign.
- `src/config/index.ts` — add config self-check helpers and warning metadata.
- `src/db/client.ts` — add a small `checkDbReady()` helper using `SELECT 1`.
- `src/services/stream.ts` — log node/tool lifecycle, durations, final stream status, and include run metadata.
- `src/routes/chat.route.ts` — create request/run context, emit `run:start`, use typed errors for key failure cases, log run lifecycle.
- `src/app.ts` — mount `healthRoute`, log startup/config warnings, remove inline `/health` handler.
- `README.md` — document request/run IDs, `/ready`, structured logs, and the `/chat` runtime flow.
- `AGENTS.md` — document observability conventions for future agents.
- `CLAUDE.md` — document observability conventions and Chinese-comment requirement for future Claude Code sessions.

Validation commands:

- `pnpm typecheck`
- `cd web && pnpm typecheck`
- `pnpm verify:agent-loop`
- `pnpm verify:skills`

---

### Task 1: Add observability primitives

**Files:**
- Create: `src/observability/ids.ts`
- Create: `src/observability/request-context.ts`
- Create: `src/observability/timing.ts`
- Create: `src/observability/logger.ts`
- Create: `src/observability/errors.ts`

- [ ] **Step 1: Create `src/observability/ids.ts`**

```ts
import { randomUUID } from "node:crypto";

/**
 * 生成带前缀的可读 ID。
 *
 * 为什么不用裸 UUID：
 * - 日志里同时会出现 HTTP 请求、Agent 运行、工具调用等多类 ID；
 * - 加上 req_/run_ 前缀后，排查问题时一眼就能看出 ID 的语义；
 * - 底层仍使用 randomUUID，避免不同请求之间发生碰撞。
 */
function createPrefixedId(prefix: "req" | "run"): string {
  return `${prefix}_${randomUUID()}`;
}

/** HTTP 请求级追踪 ID：一次 HTTP 请求只有一个 requestId。 */
export function createRequestId(): string {
  return createPrefixedId("req");
}

/** Agent/SSE 运行级追踪 ID：一次 /chat 或 /chat/resume 流式运行只有一个 runId。 */
export function createRunId(): string {
  return createPrefixedId("run");
}
```

- [ ] **Step 2: Create `src/observability/request-context.ts`**

```ts
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  runId?: string;
  threadId?: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * 在当前异步调用链上放入请求上下文。
 *
 * 可以把 AsyncLocalStorage 理解为“异步调用链上的上下文背包”：
 * - 路由入口把 requestId 放进去；
 * - 认证后补充 userId；
 * - Agent 流式运行开始时补充 runId/threadId；
 * - 深层的 stream adapter、tool、service 写日志时不需要层层传参，也能自动带上这些字段。
 *
 * 注意：上下文中只保存追踪字段，不能保存 JWT、API Key、数据库连接串、文档内容等敏感信息。
 */
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** 读取当前异步调用链上的上下文；没有上下文时返回 undefined。 */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/**
 * 在已有上下文上补充字段。
 *
 * 这个函数会原地更新当前 store。AsyncLocalStorage 的 store 是一个普通对象，
 * 在同一次请求链路内补充 runId/userId/threadId 后，后续 logger 都能读取到新字段。
 */
export function patchRequestContext(patch: Partial<RequestContext>): RequestContext | undefined {
  const current = storage.getStore();
  if (!current) return undefined;
  Object.assign(current, patch);
  return current;
}
```

- [ ] **Step 3: Create `src/observability/timing.ts`**

```ts
/**
 * 返回单调递增的毫秒时间。
 *
 * 使用 performance.now() 而不是 Date.now() 的原因：
 * - Date.now() 受系统时间调整影响；
 * - performance.now() 更适合计算耗时；
 * - 日志里的绝对时间仍由 logger 用 new Date().toISOString() 生成。
 */
export function nowMs(): number {
  return performance.now();
}

/** 计算从 start 到当前的耗时，保留整数毫秒，便于日志阅读。 */
export function durationSince(start: number): number {
  return Math.max(0, Math.round(nowMs() - start));
}
```

- [ ] **Step 4: Create `src/observability/logger.ts`**

```ts
import { getRequestContext } from "./request-context";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

function cleanObject(value: LogFields): LogFields {
  const cleaned: LogFields = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (fieldValue !== undefined) cleaned[key] = fieldValue;
  }
  return cleaned;
}

/**
 * 输出一行结构化 JSON 日志。
 *
 * 设计原则：
 * - 每行都是完整 JSON，方便被 Docker、云日志、日志采集器解析；
 * - 自动合并 RequestContext，避免每个调用点手动传 requestId/runId；
 * - 不在 logger 内主动打印敏感 payload，调用方也只能传安全摘要。
 */
function write(level: LogLevel, event: string, fields: LogFields = {}): void {
  const context = getRequestContext() ?? {};
  const payload = cleanObject({
    time: new Date().toISOString(),
    level,
    event,
    ...context,
    ...fields,
  });

  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, fields?: LogFields) => write("debug", event, fields),
  info: (event: string, fields?: LogFields) => write("info", event, fields),
  warn: (event: string, fields?: LogFields) => write("warn", event, fields),
  error: (event: string, fields?: LogFields) => write("error", event, fields),
};
```

- [ ] **Step 5: Create `src/observability/errors.ts`**

```ts
import type { ErrorCode } from "../types/agent";
import { getRequestContext } from "./request-context";

export { type ErrorCode };

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly expose: boolean;

  constructor(code: ErrorCode, message: string, options: { status?: number; expose?: boolean } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? 500;
    this.expose = options.expose ?? this.status < 500;
  }
}

export interface PublicErrorBody {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    requestId?: string;
  };
}

/**
 * 把未知异常转换成对外安全错误。
 *
 * 对外响应不能直接暴露内部异常栈、数据库连接信息、供应商错误详情。
 * AppError.expose=true 的错误可以直接展示；未知错误统一展示“服务器内部错误”。
 */
export function toPublicError(err: unknown): PublicErrorBody["error"] {
  const context = getRequestContext();
  if (err instanceof AppError) {
    return {
      code: err.code,
      message: err.expose ? err.message : "服务器内部错误",
      requestId: context?.requestId,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "服务器内部错误",
    requestId: context?.requestId,
  };
}

export function statusOfError(err: unknown): number {
  return err instanceof AppError ? err.status : 500;
}

/** 给 SSE error 事件使用的安全错误元信息。 */
export function toSseError(err: unknown): {
  code: ErrorCode;
  message: string;
  requestId?: string;
  runId?: string;
} {
  const context = getRequestContext();
  if (err instanceof AppError) {
    return {
      code: err.code,
      message: err.expose ? err.message : "服务器内部错误",
      requestId: context?.requestId,
      runId: context?.runId,
    };
  }

  const message = err instanceof Error ? err.message : String(err ?? "未知错误");
  return {
    code: "INTERNAL_ERROR",
    message,
    requestId: context?.requestId,
    runId: context?.runId,
  };
}

/** 给结构化日志使用的内部错误摘要。 */
export function toLogError(err: unknown): { name: string; message: string; stack?: string; code?: string } {
  if (err instanceof AppError) {
    return { name: err.name, message: err.message, code: err.code, stack: err.stack };
  }
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { name: "UnknownError", message: String(err ?? "未知错误") };
}
```

- [ ] **Step 6: Run backend typecheck and commit**

Run:

```bash
pnpm typecheck
```

Expected: `tsc --noEmit` exits `0`.

Commit:

```bash
git add src/observability/ids.ts src/observability/request-context.ts src/observability/timing.ts src/observability/logger.ts src/observability/errors.ts
git commit -m "feat: add observability primitives"
```

---

### Task 2: Extend shared SSE/error types and frontend mirror

**Files:**
- Modify: `src/types/agent.ts`
- Modify: `web/src/types/agent-ui.ts`
- Modify: `web/src/hooks/useAgentRuntime.ts`

- [ ] **Step 1: Modify `src/types/agent.ts`**

Insert after `export type RagStrategy = "search" | "reuse";`:

```ts
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_REQUIRED"
  | "AUTH_FORBIDDEN"
  | "THREAD_BUSY"
  | "THREAD_WAITING_CONFIRMATION"
  | "CONFIG_ERROR"
  | "DATABASE_ERROR"
  | "LLM_ERROR"
  | "TOOL_ERROR"
  | "STREAM_CANCELLED"
  | "INTERNAL_ERROR";
```

Replace the tail of `AgentStreamEvent` with:

```ts
  | { type: "run:start"; requestId: string; runId: string; threadId: string }
  | { type: "message:delta"; content: string }
  | { type: "message:end"; content: string }
  | { type: "hitl:waiting"; plan: Plan }
  | { type: "hitl:done"; action: HitlAction }
  | { type: "error"; message: string; code?: ErrorCode; requestId?: string; runId?: string }
  | {
      type: "stream:end";
      status: "completed" | "waiting" | "error" | "cancelled";
      runId?: string;
      durationMs?: number;
    };
```

- [ ] **Step 2: Modify `web/src/types/agent-ui.ts`**

Insert after `export type ReflectionStatus = "pass" | "retry" | "replan" | "fail";`:

```ts
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_REQUIRED"
  | "AUTH_FORBIDDEN"
  | "THREAD_BUSY"
  | "THREAD_WAITING_CONFIRMATION"
  | "CONFIG_ERROR"
  | "DATABASE_ERROR"
  | "LLM_ERROR"
  | "TOOL_ERROR"
  | "STREAM_CANCELLED"
  | "INTERNAL_ERROR";
```

Replace the tail of `AgentStreamEvent` with the same frontend-safe union:

```ts
  | { type: "run:start"; requestId: string; runId: string; threadId: string }
  | { type: "message:delta"; content: string }
  | { type: "message:end"; content: string }
  | { type: "hitl:waiting"; plan: Plan }
  | { type: "hitl:done"; action: HitlAction }
  | { type: "error"; message: string; code?: ErrorCode; requestId?: string; runId?: string }
  | {
      type: "stream:end";
      status: "completed" | "waiting" | "error" | "cancelled";
      runId?: string;
      durationMs?: number;
    };
```

- [ ] **Step 3: Modify `web/src/hooks/useAgentRuntime.ts` for `run:start` and duration display**

Inside the `switch (event.type)` in `applyEvent`, add this case before `router:start`:

```ts
          case "run:start":
            meta.events.push({
              id: nextEventId(),
              type: event.type,
              title: "运行已开始",
              description: `runId=${event.runId}`,
              data: event,
              status: "done",
            });
            break;
```

Replace the current `case "error":` block with:

```ts
          case "error":
            meta.streamStatus = "error";
            finalizeRunning(meta, "error");
            meta.events.push({
              id: nextEventId(),
              type: "error",
              title: event.code ? `运行失败：${event.code}` : "运行失败",
              description: event.message,
              data: event,
              status: "error",
            });
            break;
```

Inside `case "stream:end":`, after the cancelled block, add:

```ts
            if (event.durationMs !== undefined && event.status !== "cancelled") {
              meta.events.push({
                id: nextEventId(),
                type: event.type,
                title: "运行结束",
                description: `状态：${event.status}，耗时：${event.durationMs}ms`,
                data: event,
                status: event.status === "error" ? "error" : "done",
              });
            }
```

- [ ] **Step 4: Run typechecks and commit**

Run:

```bash
pnpm typecheck
cd web && pnpm typecheck
```

Expected: both commands exit `0`.

Commit:

```bash
git add src/types/agent.ts web/src/types/agent-ui.ts web/src/hooks/useAgentRuntime.ts
git commit -m "feat: extend agent stream observability events"
```

---

### Task 3: Add config validation and readiness helpers

**Files:**
- Modify: `src/config/index.ts`
- Modify: `src/db/client.ts`

- [ ] **Step 1: Modify `src/config/index.ts`**

Append after `export type AppConfig = typeof config;`:

```ts
export interface ConfigCheckIssue {
  key: string;
  code: "missing" | "invalid" | "insecure-default";
  message: string;
}

export interface RuntimeConfigCheck {
  ok: boolean;
  issues: ConfigCheckIssue[];
}

/**
 * 检查运行所需配置是否明显缺失或仍使用示例值。
 *
 * 这个函数只做“配置形状检查”，不调用外部 LLM / Embedding 服务。
 * 原因：ready 检查可能被部署平台频繁调用，不能因为检查接口而消耗 token、触发限流或产生费用。
 */
export function validateRuntimeConfig(): RuntimeConfigCheck {
  const issues: ConfigCheckIssue[] = [];

  if (!config.apiKey) {
    issues.push({ key: "DEEPSEEK_API_KEY", code: "missing", message: "聊天模型 API Key 未配置" });
  }
  if (!config.baseURL) {
    issues.push({ key: "DEEPSEEK_BASE_URL", code: "missing", message: "聊天模型 Base URL 未配置" });
  }
  if (!config.modelName) {
    issues.push({ key: "DEEPSEEK_MODEL", code: "missing", message: "聊天模型名称未配置" });
  }
  if (!config.databaseUrl) {
    issues.push({ key: "DATABASE_URL", code: "missing", message: "数据库连接字符串未配置" });
  }
  if (!config.jwtSecret) {
    issues.push({ key: "JWT_SECRET", code: "missing", message: "JWT 签名密钥未配置" });
  } else if (config.jwtSecret.includes("请换成")) {
    issues.push({ key: "JWT_SECRET", code: "insecure-default", message: "JWT_SECRET 仍是示例值" });
  }
  if (!config.embeddingApiKey) {
    issues.push({ key: "EMBEDDING_API_KEY", code: "missing", message: "Embedding API Key 未配置，且没有可用回退值" });
  }
  if (!config.embeddingBaseURL) {
    issues.push({ key: "EMBEDDING_BASE_URL", code: "missing", message: "Embedding Base URL 未配置" });
  }
  if (!config.embeddingModel) {
    issues.push({ key: "EMBEDDING_MODEL", code: "missing", message: "Embedding 模型名称未配置" });
  }
  if (!Number.isInteger(config.embeddingDim) || config.embeddingDim <= 0) {
    issues.push({ key: "EMBEDDING_DIM", code: "invalid", message: "Embedding 维度必须是正整数" });
  }
  if (!config.uploadDir) {
    issues.push({ key: "UPLOAD_DIR", code: "missing", message: "上传目录未配置" });
  }

  return { ok: issues.length === 0, issues };
}
```

- [ ] **Step 2: Modify `src/db/client.ts`**

Append before `closeDb()`:

```ts
/**
 * 数据库就绪检查。
 *
 * 这里只执行 SELECT 1，避免 readiness 接口对数据库造成额外压力。
 * 如果 DATABASE_URL 缺失或数据库不可连接，调用方会把它转换成 /ready 的失败项。
 */
export async function checkDbReady(): Promise<void> {
  await query("SELECT 1");
}
```

- [ ] **Step 3: Run backend typecheck and commit**

Run:

```bash
pnpm typecheck
```

Expected: exits `0`.

Commit:

```bash
git add src/config/index.ts src/db/client.ts
git commit -m "feat: add runtime readiness checks"
```

---

### Task 4: Add health/readiness route and startup observability

**Files:**
- Create: `src/routes/health.route.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Create `src/routes/health.route.ts`**

```ts
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { config, validateRuntimeConfig } from "../config";
import { checkDbReady } from "../db/client";
import { createRequestId } from "../observability/ids";
import { logger } from "../observability/logger";
import { runWithRequestContext } from "../observability/request-context";
import { durationSince, nowMs } from "../observability/timing";
import { toLogError } from "../observability/errors";

export const healthRoute = new Hono();

/**
 * GET /health：进程存活检查。
 *
 * 它只说明 Hono 进程能响应请求，不检查数据库、模型或配置。
 * 这样部署平台做 liveness probe 时，不会因为数据库短暂抖动而误杀进程。
 */
healthRoute.get("/health", (c) => {
  const requestId = c.req.header("X-Request-Id") || createRequestId();
  return runWithRequestContext({ requestId }, () => {
    c.header("X-Request-Id", requestId);
    return c.json({ ok: true, service: "agent-runtime", requestId });
  });
});

type ReadyCheck =
  | { ok: true; durationMs?: number; configured?: boolean; dimension?: number }
  | { ok: false; code: string; message: string; durationMs?: number };

/**
 * GET /ready：运行就绪检查。
 *
 * 它回答“当前服务是否准备好承接真实请求”：
 * - config：关键环境变量是否齐全；
 * - database：PostgreSQL 是否可连接；
 * - llm/embedding：只做配置级检查，不调用外部模型 API。
 */
healthRoute.get("/ready", async (c) => {
  const requestId = c.req.header("X-Request-Id") || createRequestId();
  return runWithRequestContext({ requestId }, async () => {
    const startedAt = nowMs();
    c.header("X-Request-Id", requestId);
    logger.info("ready.check.start");

    const configCheck = validateRuntimeConfig();
    const checks: Record<string, ReadyCheck> = {
      config: configCheck.ok
        ? { ok: true }
        : {
            ok: false,
            code: "CONFIG_ERROR",
            message: configCheck.issues.map((issue) => `${issue.key}: ${issue.message}`).join("；"),
          },
      llm: {
        ok: Boolean(config.apiKey && config.baseURL && config.modelName),
        configured: Boolean(config.apiKey && config.baseURL && config.modelName),
      },
      embedding: {
        ok: Boolean(config.embeddingApiKey && config.embeddingBaseURL && config.embeddingModel && config.embeddingDim > 0),
        configured: Boolean(config.embeddingApiKey && config.embeddingBaseURL && config.embeddingModel),
        dimension: config.embeddingDim,
      },
    };

    const dbStartedAt = nowMs();
    try {
      await checkDbReady();
      checks.database = { ok: true, durationMs: durationSince(dbStartedAt) };
      logger.info("ready.database.check", { ok: true, durationMs: checks.database.durationMs });
    } catch (err) {
      checks.database = {
        ok: false,
        code: "DATABASE_ERROR",
        message: "数据库连接失败",
        durationMs: durationSince(dbStartedAt),
      };
      logger.error("ready.database.check", { ok: false, error: toLogError(err), durationMs: checks.database.durationMs });
    }

    const ok = Object.values(checks).every((check) => check.ok);
    const durationMs = durationSince(startedAt);
    logger.info("ready.check.end", { ok, durationMs });

    return c.json(
      { ok, service: "agent-runtime", checks, requestId, durationMs },
      (ok ? 200 : 503) as ContentfulStatusCode,
    );
  });
});
```

- [ ] **Step 2: Modify `src/app.ts` imports and route mounting**

Add import:

```ts
import { healthRoute } from "./routes/health.route";
import { validateRuntimeConfig } from "./config";
import { logger } from "./observability/logger";
```

Remove inline:

```ts
app.get("/health", (c) => c.json({ ok: true, service: "agent-runtime" }));
```

Add before other routes:

```ts
app.route("/", healthRoute);
```

Replace `serve` callback with:

```ts
serve({ fetch: app.fetch, port: config.port }, (info) => {
  logger.info("app.start", {
    service: "agent-runtime",
    port: info.port,
    modelName: config.modelName,
    embeddingModel: config.embeddingModel,
    embeddingDim: config.embeddingDim,
    uploadDir: config.uploadDir,
  });

  const configCheck = validateRuntimeConfig();
  for (const issue of configCheck.issues) {
    logger.warn("config.validation.warning", issue);
  }
});
```

The resulting import block should not duplicate `config`; keep a single `import { config, validateRuntimeConfig } from "./config";`.

- [ ] **Step 3: Run backend typecheck and commit**

Run:

```bash
pnpm typecheck
```

Expected: exits `0`.

Commit:

```bash
git add src/routes/health.route.ts src/app.ts
git commit -m "feat: add readiness route and startup logs"
```

---

### Task 5: Instrument stream adapter with node/tool timings

**Files:**
- Modify: `src/services/stream.ts`

- [ ] **Step 1: Add imports to `src/services/stream.ts`**

Add:

```ts
import { logger } from "../observability/logger";
import { getRequestContext } from "../observability/request-context";
import { durationSince, nowMs } from "../observability/timing";
import { toLogError, toSseError } from "../observability/errors";
```

- [ ] **Step 2: Change `adaptStream` signature and setup timing maps**

Replace signature:

```ts
export async function* adaptStream(
  raw: AsyncIterable<RawStreamEvent>,
  threadId: string,
): AsyncGenerator<AgentStreamEvent> {
```

with:

```ts
export async function* adaptStream(
  raw: AsyncIterable<RawStreamEvent>,
  threadId: string,
  options: { runId?: string; startedAt?: number } = {},
): AsyncGenerator<AgentStreamEvent> {
```

After local variables (`finalStatus`) add:

```ts
  const streamStartedAt = options.startedAt ?? nowMs();
  const nodeStarts = new Map<string, number>();
  const toolStarts = new Map<string, number>();
```

- [ ] **Step 3: Log node start/end/error inside lifecycle branches**

Inside `if (kind === "on_chain_start" ... )`, before yielding node-specific events, add:

```ts
        nodeStarts.set(node, nowMs());
        logger.info("agent.node.start", { node, langgraphNode: e.metadata?.langgraph_node });
```

Inside `if (kind === "on_chain_end" ... )`, before node-specific `if (node === "router")`, add:

```ts
        const durationMs = nodeStarts.has(node) ? durationSince(nodeStarts.get(node)!) : undefined;
        logger.info("agent.node.end", { node, durationMs });
```

Add a new branch before tool lifecycle handling:

```ts
      if (kind === "on_chain_error" && node) {
        const durationMs = nodeStarts.has(node) ? durationSince(nodeStarts.get(node)!) : undefined;
        logger.error("agent.node.error", {
          node,
          durationMs,
          error: toLogError((e.data as { error?: unknown } | undefined)?.error),
        });
        continue;
      }
```

- [ ] **Step 4: Log tool start/end/error with durations**

Inside `if (kind === "on_tool_start")`, before yield, add:

```ts
        const callId = e.run_id ?? e.name;
        toolStarts.set(callId, nowMs());
        logger.info("agent.tool.start", { callId, toolName: e.name });
```

Then change yielded `callId` to use the local `callId`.

Inside `if (kind === "on_tool_end")`, before yield, add:

```ts
        const callId = e.run_id ?? e.name;
        const durationMs = toolStarts.has(callId) ? durationSince(toolStarts.get(callId)!) : undefined;
        logger.info("agent.tool.end", { callId, toolName: e.name, durationMs });
```

Then change yielded `callId` to use the local `callId`.

Inside `if (kind === "on_tool_error")`, before yield, add:

```ts
        const callId = e.run_id ?? e.name;
        const durationMs = toolStarts.has(callId) ? durationSince(toolStarts.get(callId)!) : undefined;
        logger.error("agent.tool.error", {
          callId,
          toolName: e.name,
          durationMs,
          error: toLogError((e.data as { error?: unknown } | undefined)?.error),
        });
```

Then change yielded `callId` to use the local `callId`.

- [ ] **Step 5: Add runId/duration to stream end and typed SSE errors**

Replace:

```ts
    yield { type: "stream:end", status: finalStatus };
```

with:

```ts
    const durationMs = durationSince(streamStartedAt);
    logger.info("agent.stream.end", { status: finalStatus, durationMs });
    yield { type: "stream:end", status: finalStatus, runId: options.runId ?? getRequestContext()?.runId, durationMs };
```

Replace catch block body:

```ts
    if (err instanceof Error && err.name === "AbortError") {
      yield { type: "stream:end", status: "cancelled" };
      return;
    }
    yield { type: "error", message: errorMessageOf(err) };
    yield { type: "stream:end", status: "error" };
```

with:

```ts
    const durationMs = durationSince(streamStartedAt);
    if (err instanceof Error && err.name === "AbortError") {
      logger.warn("agent.stream.cancelled", { durationMs });
      yield { type: "stream:end", status: "cancelled", runId: options.runId ?? getRequestContext()?.runId, durationMs };
      return;
    }
    logger.error("agent.stream.error", { durationMs, error: toLogError(err) });
    yield { type: "error", ...toSseError(err), message: errorMessageOf(err) };
    yield { type: "stream:end", status: "error", runId: options.runId ?? getRequestContext()?.runId, durationMs };
```

- [ ] **Step 6: Update `adaptResumeStream` signature**

Replace signature:

```ts
export async function* adaptResumeStream(
  raw: AsyncIterable<RawStreamEvent>,
  threadId: string,
  action: "confirm" | "reject" | "modify",
): AsyncGenerator<AgentStreamEvent> {
```

with:

```ts
export async function* adaptResumeStream(
  raw: AsyncIterable<RawStreamEvent>,
  threadId: string,
  action: "confirm" | "reject" | "modify",
  options: { runId?: string; startedAt?: number } = {},
): AsyncGenerator<AgentStreamEvent> {
```

Replace:

```ts
yield* adaptStream(raw, threadId);
```

with:

```ts
yield* adaptStream(raw, threadId, options);
```

- [ ] **Step 7: Run backend typecheck and commit**

Run:

```bash
pnpm typecheck
```

Expected: exits `0`.

Commit:

```bash
git add src/services/stream.ts
git commit -m "feat: log agent stream lifecycle"
```

---

### Task 6: Wire request/run context into chat routes

**Files:**
- Modify: `src/routes/chat.route.ts`

- [ ] **Step 1: Add imports**

Add:

```ts
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { createRequestId, createRunId } from "../observability/ids";
import { AppError, statusOfError, toLogError, toPublicError } from "../observability/errors";
import { logger } from "../observability/logger";
import { patchRequestContext, runWithRequestContext } from "../observability/request-context";
import { durationSince, nowMs } from "../observability/timing";
```

- [ ] **Step 2: Add a helper after route declaration**

After `export const chatRoute = new Hono...`, add:

```ts
function jsonError(c: Parameters<Parameters<typeof chatRoute.post>[1]>[0], err: unknown) {
  const status = statusOfError(err) as ContentfulStatusCode;
  logger.warn("http.request.error", { status, error: toLogError(err) });
  return c.json({ ok: false, error: toPublicError(err) }, status);
}
```

If TypeScript rejects the helper type, replace it with an inline local function inside each route as shown in Step 3 and Step 5.

- [ ] **Step 3: Wrap `/chat` route body in request context**

Replace route handler start:

```ts
chatRoute.post("/chat", authMiddleware, async (c) => {
```

with:

```ts
chatRoute.post("/chat", authMiddleware, async (c) => {
  const requestId = c.req.header("X-Request-Id") || createRequestId();
  c.header("X-Request-Id", requestId);
  return runWithRequestContext({ requestId }, async () => {
    const requestStartedAt = nowMs();
    logger.info("http.request.start", { method: "POST", path: "/chat" });
```

At the very end of the `/chat` handler, add the extra closing `});` so the wrapper closes.

- [ ] **Step 4: Convert key `/chat` early errors to AppError**

Inside `/chat`, replace validation error return with:

```ts
    if (!parsed.success) {
      return jsonError(c, new AppError("VALIDATION_ERROR", "请求参数不合法", { status: 400 }));
    }
```

After `const user = c.get("user");`, add:

```ts
    patchRequestContext({ userId: user.id, threadId });
```

Replace thread bind catch body with:

```ts
      return jsonError(c, new AppError("AUTH_FORBIDDEN", err instanceof Error ? err.message : String(err), { status: 403 }));
```

Replace thread lock failure with:

```ts
      return jsonError(c, new AppError("THREAD_BUSY", "当前线程已有任务正在运行", { status: 409 }));
```

Replace waiting confirmation return with:

```ts
        return jsonError(c, new AppError("THREAD_WAITING_CONFIRMATION", "当前线程正在等待确认，请调用 /chat/resume", { status: 409 }));
```

Replace snapshot catch return with:

```ts
      return jsonError(c, new AppError("INTERNAL_ERROR", `读取线程状态失败：${message}`, { status: 500, expose: true }));
```

Replace normalized error return with:

```ts
      return jsonError(c, new AppError("VALIDATION_ERROR", normalized.error, { status: 400 }));
```

- [ ] **Step 5: Add run lifecycle inside `/chat` streamSSE**

Before `return streamSSE`, add:

```ts
    const runId = createRunId();
    patchRequestContext({ runId });
    c.header("X-Agent-Run-Id", runId);
    logger.info("agent.run.start", {
      kind: "chat",
      mode,
      ragMode: normalized.ragMode,
      ragStrategy: normalized.ragStrategy,
      messageLength: normalized.message.length,
    });
```

Inside `streamSSE`, before creating `raw`, add:

```ts
        const runStartedAt = nowMs();
        await stream.writeSSE({ data: JSON.stringify({ type: "run:start", requestId, runId, threadId }) });
```

Change:

```ts
      for await (const event of adaptStream(raw, threadId)) {
```

to:

```ts
      for await (const event of adaptStream(raw, threadId, { runId, startedAt: runStartedAt })) {
```

In `finally`, before `release();`, add:

```ts
        logger.info("agent.run.end", { kind: "chat", durationMs: durationSince(runStartedAt) });
        logger.info("http.request.end", { method: "POST", path: "/chat", status: 200, durationMs: durationSince(requestStartedAt) });
```

- [ ] **Step 6: Apply the same pattern to `/chat/resume`**

Wrap handler with `requestId` context like `/chat`, using path `/chat/resume`.

Convert key errors:

```ts
VALIDATION_ERROR -> 400
AUTH_FORBIDDEN -> 403
THREAD_BUSY -> 409
THREAD_WAITING_CONFIRMATION -> 409 with message "当前线程没有等待中的确认任务"
INTERNAL_ERROR -> 500 for snapshot read failure
```

After parsing user/thread, call:

```ts
    patchRequestContext({ userId: user.id, threadId });
```

Before `streamSSE`, create `runId`, set header, log:

```ts
    const runId = createRunId();
    patchRequestContext({ runId });
    c.header("X-Agent-Run-Id", runId);
    logger.info("agent.run.start", { kind: "resume", action });
```

Inside stream, write `run:start`, pass options to `adaptResumeStream`:

```ts
        const runStartedAt = nowMs();
        await stream.writeSSE({ data: JSON.stringify({ type: "run:start", requestId, runId, threadId }) });
        const raw = resumeStream(threadId, decision, c.req.raw.signal);
        for await (const event of adaptResumeStream(raw, threadId, action, { runId, startedAt: runStartedAt })) {
          await stream.writeSSE({ data: JSON.stringify(event) });
        }
```

Log end and release in finally as in `/chat`.

- [ ] **Step 7: Run backend typecheck and commit**

Run:

```bash
pnpm typecheck
```

Expected: exits `0`. If the helper type in Step 2 fails, inline `jsonError` inside each handler with the same body.

Commit:

```bash
git add src/routes/chat.route.ts
git commit -m "feat: trace chat runs with request context"
```

---

### Task 7: Update docs with runtime flow and observability conventions

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `README.md` API section**

In the available interface list, add:

```md
- `GET /ready`：就绪检查，返回配置、数据库、LLM/Embedding 配置状态；失败时返回 `503`。
```

After the architecture overview section, add:

```md
### 后端可观测性

后端为每个 HTTP 请求生成 `requestId`，并为每次 `/chat` / `/chat/resume` 流式 Agent 运行生成 `runId`。

- `requestId`：HTTP 请求级追踪标识，会出现在 `X-Request-Id` 响应头、错误响应和结构化日志中。
- `runId`：Agent/SSE 运行级追踪标识，会出现在 `X-Agent-Run-Id` 响应头、`run:start` / `stream:end` SSE 事件和结构化日志中。

结构化日志以 JSON line 输出，常见事件包括：

- `http.request.start` / `http.request.end` / `http.request.error`
- `agent.run.start` / `agent.run.end`
- `agent.node.start` / `agent.node.end` / `agent.node.error`
- `agent.tool.start` / `agent.tool.end` / `agent.tool.error`
- `ready.check.start` / `ready.check.end`

日志默认不记录 JWT、API Key、数据库连接串、用户文档全文、完整工具输出或完整模型回复。

#### `/chat` 运转流程

```text
POST /chat
  → 生成/读取 requestId
  → 认证得到 userId
  → 绑定 threadId 与 userId
  → 获取同线程运行锁
  → 读取 LangGraph checkpoint
  → normalizeChatInput 判断 RAG 策略
  → 创建 runId
  → 写 agent.run.start 日志
  → streamSSE
      → 发送 run:start
      → startChatStream
      → LangGraph streamEvents
      → adaptStream 转为 AgentStreamEvent
          → 记录 node/tool start/end/error
          → 计算 durationMs
          → 输出 SSE
      → 发送 stream:end
  → 写 agent.run.end 日志
  → 释放同线程运行锁
```
```

- [ ] **Step 2: Update `AGENTS.md` and `CLAUDE.md` conventions**

Add a section near extension points or project conventions in both files:

```md
## 后端可观测性约定

- 修改 `/chat`、`/chat/resume`、Agent Runtime、Tool、RAG 或 SSE 流程时，应保持 `requestId` / `runId` 可追踪。
- 新增后端运行链路时，优先使用 `src/observability/logger.ts` 输出结构化日志，不要散落 `console.log`。
- 日志只能记录安全摘要，不能记录 JWT、API Key、数据库连接串、用户文档全文或完整工具输出。
- 新增面向前端的 SSE 事件时，必须同步更新 `src/types/agent.ts` 与 `web/src/types/agent-ui.ts`。
- 后端关键流程代码需要写中文注释，尤其是 Agent 运转、SSE 转换、请求上下文、错误处理和 Tool 调用边界。
- 改动运行流程后，应同步更新 README 或相关设计/计划文档中的运转流程说明，方便学习和复盘。
```

- [ ] **Step 3: Commit docs**

Commit:

```bash
git add README.md AGENTS.md CLAUDE.md
git commit -m "docs: document backend observability flow"
```

---

### Task 8: Final validation

**Files:**
- No code changes expected unless validation reveals a defect.

- [ ] **Step 1: Run backend typecheck**

```bash
pnpm typecheck
```

Expected: exits `0`.

- [ ] **Step 2: Run backend verification scripts**

```bash
pnpm verify:agent-loop
pnpm verify:skills
```

Expected:

```text
Agent Loop 状态转移验证通过
Skill loading verification passed.
```

- [ ] **Step 3: Run frontend typecheck**

```bash
cd web && pnpm typecheck
```

Expected: exits `0`.

- [ ] **Step 4: Inspect git status**

```bash
git status --short
```

Expected: no uncommitted changes.

- [ ] **Step 5: If validation required fixes, commit them**

If files changed during validation fixes:

```bash
git add <changed-files>
git commit -m "fix: stabilize backend observability wiring"
```

---

## Self-Review

Spec coverage:

- Request/run IDs: Task 1, Task 2, Task 6.
- Structured logs: Task 1, Task 4, Task 5, Task 6.
- Node/tool durations: Task 5.
- Typed HTTP/SSE errors: Task 1, Task 2, Task 6.
- `/ready`: Task 3, Task 4.
- Startup config warnings: Task 3, Task 4.
- Chinese comments and runtime-flow docs: Task 1, Task 3, Task 4, Task 7.
- Frontend type compatibility: Task 2.
- Validation: Task 8.

Placeholder scan:

- No TBD/TODO/fill-in placeholders.
- Each implementation task includes exact files, code, commands, expected result, and commit command.

Type consistency:

- `ErrorCode` is defined in `src/types/agent.ts` and imported by `observability/errors.ts`.
- `adaptStream` and `adaptResumeStream` option signatures match `chat.route.ts` usage.
- `run:start`, `error`, and `stream:end` frontend/backend event shapes match.
- `requestId` and `runId` field names are consistent across headers, logs, and SSE.
