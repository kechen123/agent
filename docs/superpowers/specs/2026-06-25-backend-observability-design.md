# 后端运行可观测性工程化设计

日期：2026-06-25

## 背景与当前进度

当前项目已经具备多 Agent Runtime 的核心能力：

- 后端基于 Node.js、TypeScript、Hono、LangGraph，提供 `/chat` 与 `/chat/resume` SSE 流式接口。
- Runtime 图已经包含 `beginTurn`、`routerAgent`、`plannerAgent`、`toolAgent`、`executorAgent`、`reflectionAgent`、`replyAgent` 与 HITL 确认流程。
- `replyAgent` 是唯一面向用户输出正文的 Agent，其他 Agent 的模型流由 `services/stream.ts` 过滤。
- 已支持 JWT 登录认证、线程与用户绑定、同线程运行锁、Skill 注册与注入、Tool 注册与懒加载。
- 已支持 PostgreSQL + pgvector 的个人知识库、文档上传、向量检索、自动 RAG、`/rag` 强制知识库模式。
- 前端已覆盖登录、会话、SSE 消息、执行时间线、计划卡片、工具调用、HITL 操作、知识库面板和 Skill 列表。
- 后端 `pnpm typecheck` 与前端 `cd web && pnpm typecheck` 当前均通过。

主要工程化缺口集中在运行可观测性：请求级追踪 ID、Agent run ID、结构化日志、节点/工具耗时、统一错误分类、就绪检查和故障定位流程还没有形成闭环。

## 目标

本次设计采用“后端工程化 / 运行可观测 / 垂直切片”方案，先打通一次请求从 HTTP 到 LangGraph 再到 SSE 的观察链路。

核心目标：

1. 每个 HTTP 请求都有 `requestId`。
2. 每次 Agent 流式运行都有 `runId`。
3. 日志能够通过 `requestId`、`runId`、`threadId`、`userId` 串联一次完整运行。
4. `/chat` 与 `/chat/resume` 能记录 Agent run 生命周期、节点生命周期、工具生命周期、最终状态和耗时。
5. HTTP 错误与 SSE 错误具备统一错误码，便于定位和前端展示。
6. 新增 `/ready` 就绪检查，区分进程存活与运行依赖是否可用。
7. 后端新增或关键逻辑必须带详细中文注释，并同步补充运转流程文档，方便学习和复盘。

## 非目标

本轮不做以下内容：

- 不引入 OpenTelemetry、Prometheus、Grafana 等重型观测体系。
- 不落库保存完整运行历史。
- 不重构所有 API 的错误响应。
- 不改变 Agent 决策逻辑、RAG 策略或 LangGraph 图结构。
- 不替换 checkpointer。
- 不重写前端 UI。
- 不主动调用 LLM / Embedding API 做 readiness 探测，避免产生额外费用或限流风险。

## 推荐方案

采用轻量垂直切片：新增 `src/observability/` 横切模块，并在 `/chat`、`/chat/resume`、`services/stream.ts`、健康检查和配置检查中接入。

目录设计：

```text
src/observability/
├─ ids.ts              # 生成 requestId / runId
├─ request-context.ts  # AsyncLocalStorage 保存当前请求/运行上下文
├─ logger.ts           # 结构化 JSON line 日志
├─ errors.ts           # AppError、ErrorCode、HTTP/SSE 错误转换
└─ timing.ts           # 耗时计算工具
```

这种方案的优点是：

- 侵入面小，不需要重写 Agent 节点。
- 能覆盖最关键的 `/chat` 与 `/chat/resume` 链路。
- 日志与 SSE 可通过同一组 ID 对齐。
- 后续可以平滑演进到运行审计表或 OpenTelemetry。

## 请求与运行标识

每个后端请求生成或接收一个 `requestId`：

```http
X-Request-Id: req_xxx
```

如果客户端没有传入，则服务端自动生成，例如：

```text
req_01j...
```

每次 Agent 流式运行生成一个 `runId`：

```text
run_01j...
```

二者关系：

```text
requestId = HTTP 请求级追踪标识
runId     = Agent/SSE 运行级追踪标识
threadId  = 前端会话线程 ID
userId    = JWT 认证后的用户 ID
```

`requestId` 用于 HTTP 入口、错误响应和日志串联；`runId` 用于 Agent run、LangGraph 事件、SSE 事件和运行耗时统计。

## 请求上下文

新增 `request-context.ts`，使用 `AsyncLocalStorage` 保存当前异步调用链上的上下文：

```ts
interface RequestContext {
  requestId: string;
  runId?: string;
  userId?: string;
  threadId?: string;
}
```

后端代码中的日志可以直接读取当前上下文，而不需要层层传参。

设计说明：

- `AsyncLocalStorage` 类似“当前异步调用链的上下文背包”。
- 路由入口设置 `requestId`。
- 认证后补充 `userId`。
- `/chat` 和 `/chat/resume` 创建 run 时补充 `runId` 与 `threadId`。
- 不能在上下文中保存 JWT、API Key、数据库连接串或文档内容。

## 结构化日志

新增轻量 `logger`，默认输出 JSON line：

```json
{
  "time": "2026-06-25T00:00:00.000Z",
  "level": "info",
  "event": "agent.run.end",
  "requestId": "req_xxx",
  "runId": "run_xxx",
  "threadId": "t-1",
  "userId": "...",
  "status": "completed",
  "durationMs": 1420
}
```

日志方法：

```ts
logger.debug(event, fields)
logger.info(event, fields)
logger.warn(event, fields)
logger.error(event, fields)
```

日志自动合并当前 `RequestContext`，并清理值为 `undefined` 的字段。

### 日志事件分类

HTTP 层：

- `http.request.start`
- `http.request.end`
- `http.request.error`

Agent 运行层：

- `agent.run.start`
- `agent.run.end`
- `agent.run.error`
- `agent.run.cancelled`

LangGraph 节点层：

- `agent.node.start`
- `agent.node.end`
- `agent.node.error`

Tool 层：

- `agent.tool.start`
- `agent.tool.end`
- `agent.tool.error`

配置与就绪检查：

- `config.validation.warning`
- `ready.check.start`
- `ready.check.end`
- `ready.database.check`

### 日志安全规则

默认不记录：

- 用户完整输入。
- AI 完整回复。
- 工具完整输出。
- 知识库片段全文。
- JWT token。
- 文件内容。
- 数据库连接串。
- API Key 或 JWT Secret。

默认允许记录：

- 字符长度。
- 安全截断摘要。
- route、skillName、status。
- node、toolName、durationMs。
- topK、distance 等非敏感指标。
- 错误 code 与安全 message。

## 错误模型

新增统一错误码：

```ts
type ErrorCode =
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

新增 `AppError`：

```ts
class AppError extends Error {
  code: ErrorCode;
  status: number;
  expose: boolean;
}
```

HTTP 错误响应推荐格式：

```json
{
  "ok": false,
  "error": {
    "code": "THREAD_BUSY",
    "message": "当前线程已有任务正在运行",
    "requestId": "req_xxx"
  }
}
```

SSE 错误事件保持兼容，新增可选字段：

```ts
{
  type: "error",
  message: string,
  code?: ErrorCode,
  requestId?: string,
  runId?: string
}
```

## SSE 事件兼容设计

现有 `AgentStreamEvent` 做非破坏式扩展。

新增运行开始事件：

```ts
{
  type: "run:start";
  requestId: string;
  runId: string;
  threadId: string;
}
```

扩展 `stream:end`：

```ts
{
  type: "stream:end";
  status: "completed" | "waiting" | "error" | "cancelled";
  runId?: string;
  durationMs?: number;
}
```

前端兼容策略：

- `run:start` 可作为时间线事件显示“运行已开始”。
- `stream:end.durationMs` 可用于显示本次运行耗时。
- `error.code` 可用于错误详情。
- 现有逻辑不依赖这些字段时，主流程不受影响。

## Stream Adapter 观测设计

`services/stream.ts` 当前负责把 LangGraph `streamEvents` 转换成前端消费的 `AgentStreamEvent`。本轮让它额外承担“观察者”职责：

```text
Raw LangGraph Event
  → 识别 node/tool lifecycle
  → 记录结构化日志
  → 计算 node/tool durationMs
  → yield 原有 AgentStreamEvent
```

实现方式：

- 用 `Map<string, number>` 保存节点开始时间。
- 用 `Map<string, number>` 保存工具开始时间。
- 在 `on_chain_start`、`on_chain_end`、`on_tool_start`、`on_tool_end`、`on_tool_error` 处写日志。
- Adapter 不修改 Agent State，不参与业务决策。

## `/chat` 运转流程

```text
POST /chat
  → 生成/读取 requestId
  → 认证得到 userId
  → 解析 threadId/message/mode
  → 绑定 threadId 与 userId
  → 获取同线程运行锁
  → 读取 LangGraph checkpoint
  → 如果线程等待 HITL，返回 THREAD_WAITING_CONFIRMATION
  → normalizeChatInput 判断 RAG 策略
  → 创建 runId
  → 更新请求上下文：requestId/userId/threadId/runId
  → 记录 agent.run.start
  → streamSSE
      → 发送 run:start
      → startChatStream
      → LangGraph streamEvents
      → adaptStream 转为 AgentStreamEvent
          → 记录 node/tool start/end/error
          → 计算 durationMs
          → 输出 SSE
      → 发送 stream:end
  → 记录 agent.run.end / agent.run.error / agent.run.cancelled
  → 释放线程锁
```

## `/chat/resume` 运转流程

```text
POST /chat/resume
  → 生成/读取 requestId
  → 认证得到 userId
  → 解析 threadId/action/message/plan
  → 校验 threadId 属于当前用户
  → 获取同线程运行锁
  → 检查 checkpoint 是否等待 HITL
  → 创建 runId
  → 更新请求上下文：requestId/userId/threadId/runId
  → 记录 agent.run.start，kind=resume，action=confirm/reject/modify
  → streamSSE
      → 发送 run:start
      → 发送 hitl:done
      → resumeStream
      → adaptStream 转换后续事件
  → 记录 agent.run.end / agent.run.error / agent.run.cancelled
  → 释放线程锁
```

## 健康检查与就绪检查

保留 `/health` 作为存活检查：

```json
{
  "ok": true,
  "service": "agent-runtime"
}
```

新增 `/ready` 作为就绪检查：

```json
{
  "ok": true,
  "service": "agent-runtime",
  "checks": {
    "config": { "ok": true },
    "database": { "ok": true, "durationMs": 12 },
    "llm": { "ok": true, "configured": true },
    "embedding": { "ok": true, "configured": true, "dimension": 2048 }
  },
  "requestId": "req_xxx"
}
```

如果关键检查失败，返回 `503 Service Unavailable`。

### 配置自检

新增 `validateRuntimeConfig()`，检查：

- `DEEPSEEK_API_KEY` 是否配置。
- `DEEPSEEK_BASE_URL` 是否配置。
- `DEEPSEEK_MODEL` 是否配置。
- `DATABASE_URL` 是否配置。
- `JWT_SECRET` 是否配置且不是示例值。
- `EMBEDDING_MODEL` 是否配置。
- `EMBEDDING_DIM` 是否为正整数。
- `UPLOAD_DIR` 是否配置。

启动时只写 warning，不阻止开发启动；`/ready` 严格体现检查结果。

### 数据库就绪检查

数据库只执行轻量查询：

```sql
SELECT 1
```

并记录耗时。对外错误使用安全 message：

```json
{
  "code": "DATABASE_ERROR",
  "message": "数据库连接失败"
}
```

完整异常只进入结构化日志。

## 中文注释与学习型文档约定

根据用户要求，本轮后端代码修改必须加入详细中文注释，尤其是：

- `request-context.ts`：解释为什么使用 `AsyncLocalStorage`。
- `logger.ts`：解释结构化日志字段、上下文合并和敏感信息边界。
- `errors.ts`：解释错误码、对外错误和内部日志错误的区别。
- `timing.ts`：解释耗时统计的使用方式。
- `stream.ts`：解释 LangGraph raw events 到标准 SSE 事件的转换过程。
- `chat.route.ts`：解释 `/chat` 与 `/chat/resume` 的请求生命周期。
- `health.route.ts`：解释 `/health` 和 `/ready` 的区别。

文档需要同步补充运行流程，至少更新：

- `README.md`：新增“后端可观测性”和 `/ready` 说明。
- `AGENTS.md`：新增后续开发约定。
- `CLAUDE.md`：新增后续 AI 协作约定。

## 测试与验证

本轮验证分三层。

### 类型检查

```bash
pnpm typecheck
cd web && pnpm typecheck
```

### 脚本验证

保持现有脚本通过：

```bash
pnpm verify:agent-loop
pnpm verify:skills
```

### 手工验证

1. `GET /health` 返回 `200`。
2. `GET /ready` 在配置齐全、数据库可连时返回 `200`。
3. `GET /ready` 在数据库不可连或关键配置缺失时返回 `503` 和结构化检查结果。
4. `POST /chat` SSE 首帧包含 `run:start`。
5. `POST /chat` 正常结束时包含带 `runId` 和 `durationMs` 的 `stream:end`。
6. 同一 `threadId` 并发请求返回 `THREAD_BUSY`。
7. 等待 HITL 时再次调用 `/chat` 返回 `THREAD_WAITING_CONFIRMATION`。
8. 日志中能用同一个 `requestId` / `runId` 串联 HTTP、Agent run、node、tool、stream end。

## 后续演进方向

本轮完成后，可以继续演进：

1. 将运行摘要落库，支持前端历史运行调试。
2. 接入 OpenTelemetry trace/span。
3. 引入 Prometheus metrics。
4. 给 RAG 增加检索质量评测与引用溯源指标。
5. 引入正式测试框架，覆盖路由、错误模型和 stream adapter。
6. 增加手动诊断接口：`POST /diagnostics/llm`、`POST /diagnostics/embedding`。

## 自检结果

- 无 `TBD`、`TODO` 或占位章节。
- 范围聚焦在后端运行可观测垂直切片，没有混入运行审计落库或前端重写。
- 架构、事件类型、日志、错误、健康检查和文档要求互相一致。
- 已明确兼容策略：SSE 新字段为非破坏式扩展。
- 已明确中文注释与运转流程文档是实施约束。
