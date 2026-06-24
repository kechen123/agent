# Agent Runtime

一个基于 LangGraph 的多 Agent Runtime 框架。后端用 Node.js + TypeScript + Hono 提供标准化 SSE 事件流，前端用 React + Vite + TailwindCSS 展示聊天、执行时间线、计划卡片、工具调用和 HITL 确认。

当前已内置：多 Agent 执行循环、人工介入确认（HITL）、Skill 选择与注入、工具调用、基于 PostgreSQL + pgvector 的个人知识库与 RAG、JWT 登录认证、线程级并发锁与用户隔离。

> 本项目**不是 monorepo**，**不使用 pnpm workspace**。根目录是后端项目，`web/` 是前端项目；两者独立安装依赖、独立启动。

## 项目结构说明

```text
.
├─ src/                  # 后端源码
├─ skills/               # 项目级 Claude Code Skill（SKILL.md）
├─ scripts/              # 数据库初始化与验证脚本
├─ uploads/              # 知识库上传文件落地目录（默认）
├─ package.json          # 后端 package.json
├─ pnpm-lock.yaml        # 后端锁文件
├─ .env.example          # 后端环境变量示例
└─ web/
   ├─ src/               # 前端源码
   ├─ package.json       # 前端 package.json
   ├─ pnpm-lock.yaml     # 前端锁文件
   └─ vite.config.ts     # 前端 Vite 配置
```

不使用 `pnpm --filter`。

## 环境变量

复制 `.env.example` 为 `.env` 并填写：

```bash
# 聊天模型（OpenAI 兼容）
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
MODEL_TEMPERATURE=0

# 后端服务
PORT=3000
WEB_ORIGIN=http://localhost:5173

# Agent Loop 安全上限
MAX_AGENT_RETRIES=2
MAX_TOOL_CALLS=8

# Tool / Skill 白名单（逗号分隔，留空表示全部启用）
ENABLED_TOOLS=
ENABLED_SKILLS=

# PostgreSQL / pgvector
DATABASE_URL=postgresql://用户名:密码@localhost:5432/agent4

# Embedding 向量模型
EMBEDDING_API_KEY=
EMBEDDING_BASE_URL=
EMBEDDING_MODEL=text-embedding-v3
EMBEDDING_DIM=2048
AUTO_RAG_DISTANCE_THRESHOLD=0.55

# 知识库上传
UPLOAD_DIR=uploads

# JWT 登录认证
JWT_SECRET=请换成一个足够长的随机字符串
JWT_EXPIRES_IN=7d
```

说明：

- `DEEPSEEK_API_KEY`：聊天模型 API Key，必须放在 `.env`，不要写死到代码中。
- `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL`：OpenAI 兼容接口地址与模型名；也兼容旧变量 `MODEL_NAME`。
- `PORT`：后端监听端口，默认 `3000`。
- `WEB_ORIGIN`：前端来源，用于 CORS / 部署约定。
- `MAX_AGENT_RETRIES`：单个步骤额外允许的重试次数，默认 `2`。
- `MAX_TOOL_CALLS`：单轮对话允许的最大工具调用次数，默认 `8`。
- `ENABLED_TOOLS` / `ENABLED_SKILLS`：逗号分隔白名单，留空表示启用全部已注册项；`ENABLED_SKILLS` 会影响 Router 可选 Skill、Agent 注入和 `GET /skills` 的 `enabled` 字段。
- `DATABASE_URL`：PostgreSQL 连接字符串，目标库需已安装并启用 pgvector 扩展。
- `EMBEDDING_*`：Embedding 服务配置。`EMBEDDING_API_KEY` / `EMBEDDING_BASE_URL` 留空时回退使用 `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL`。`EMBEDDING_DIM` 必须与 `src/db/schema.sql` 中 `vector(2048)` 的维度一致。
- `AUTO_RAG_DISTANCE_THRESHOLD`：自动知识库模式的 pgvector 距离阈值，越小越严格，默认 `0.55`。
- `UPLOAD_DIR`：上传文件保存目录，相对路径相对后端启动目录解析。
- `JWT_SECRET`：JWT 签名密钥，生产环境请换成足够长的随机字符串。
- `JWT_EXPIRES_IN`：JWT 过期时间，例如 `7d`、`24h`、`60m`。

## 后端启动

需要先准备一个安装了 pgvector 扩展的 PostgreSQL 数据库，并在 `.env` 中配置 `DATABASE_URL`。

```bash
pnpm install
pnpm db:init        # 初始化数据库表结构（users / kb_documents / kb_chunks）
pnpm typecheck
pnpm verify:agent-loop
pnpm verify:skills
pnpm dev
```

服务默认启动在：

```text
http://localhost:3000
```

可用接口：

- `GET /health`：健康检查，返回 `{ "ok": true, "service": "agent-runtime" }`。
- `POST /api/auth/register`：注册账号，返回 `{ token, user }`。
- `POST /api/auth/login`：登录（支持邮箱或用户名），返回 `{ token, user }`。
- `GET /api/auth/me`：携带 Bearer Token，返回当前用户。
- `GET /api/knowledge/documents`：列出当前用户的文档（需登录）。
- `POST /api/knowledge/documents`：上传文档并入库（multipart/form-data，需登录）。
- `DELETE /api/knowledge/documents/:id`：删除文档及其向量片段（需登录）。
- `POST /api/knowledge/search`：向量检索当前用户知识库（需登录）。
- `GET /skills`：返回已成功注册 Skill 的安全摘要，不包含 systemPrompt 或本地路径。
- `POST /chat`：开始一轮对话，返回 SSE（需登录）。
- `POST /chat/resume`：继续 HITL 暂停的线程，返回 SSE（需登录）。

所有 `/api/*` 与 `/chat`、`/chat/resume` 接口需要 `Authorization: Bearer <token>`。

## 前端启动

在 `web/` 目录执行：

```bash
cd web
pnpm install
pnpm typecheck
pnpm dev
```

前端默认启动在：

```text
http://localhost:5173
```

Vite 代理（目标默认 `http://localhost:3210`，可通过 `web/.env` 的 `VITE_API_PROXY_TARGET` 覆盖，例如改为 `http://localhost:3000`）：

- `/chat`、`/chat/resume` → 后端
- `/health` → 后端
- `/skills` → 后端
- `/api` → 后端（覆盖 auth 与 knowledge 接口）

> 前端默认把请求代理到 `3210` 端口。若后端运行在默认的 `3000` 端口，请在 `web/.env` 设置 `VITE_API_PROXY_TARGET=http://localhost:3000`，或把后端 `PORT` 改为 `3210`。

`web/.npmrc` 中的 `onlyBuiltDependencies[]=esbuild` 用于让 pnpm 11 正常处理 Vite 依赖，不表示 workspace。

## 架构总览

### 后端执行流

```text
START → beginTurn → routerAgent
routerAgent --route-->  chat    → replyAgent → END
                       tool    → toolAgent ⇄ tools → replyAgent → END
                       plan    → plannerAgent → planConfirm(interrupt)
                                    planConfirm --decision-->
                                       confirm  → executorAgent → reflectionAgent
                                                     ├─ pass   → 下一步骤 Executor / Reply
                                                     ├─ retry  → 当前步骤 Executor
                                                     ├─ replan → Planner
                                                     └─ fail   → Reply
                                       modify   → modifyPlanNode → plannerAgent（重新规划）
                                       reject   → replyAgent → END
                       execute → executorAgent → reflectionAgent → ...
```

- `beginTurn`：每轮 `/chat` 先经过它，重置仅当前轮有效的状态（计划、执行结果、Reflection、重试计数、工具计数、HITL 决策），同时保留跨轮的对话上下文。
- `replyAgent` 是唯一面向用户输出消息的 Agent；只有它会产生 `message:delta`。
- router/planner/executor/tool 的模型流会被 `services/stream.ts` 过滤，避免多个 Agent 同时向用户输出正文。
- HITL 使用 LangGraph `interrupt()` 暂停，并通过 `Command({ resume })` 继续执行。
- `tools` 节点在调用时懒加载当前注册表中的工具，而不是在图编译时固定工具列表。

### Agent Loop

计划任务的主循环是：

```text
Planner → HITL → Executor → Reflection
                         ├─ pass   → 下一步骤 / Reply
                         ├─ retry  → 当前步骤 Executor
                         ├─ replan → Planner
                         └─ fail   → Reply
```

- `ReflectionAgent` 是纯函数式状态转移：`pass` 推进步骤并清空重试计数，`retry` 停留并自增，`replan`/`fail` 记录错误后交给条件边。
- 达到 `maxRetries` 后，`retry` 会被强制转换成 `fail`，防止无限循环。
- 学习边界：当前 `ExecutorAgent` 只根据上下文生成步骤结果，不会自动修改文件或访问外部系统。需要真实执行时，应把能力封装为 Tool。

### 登录认证（JWT）

```text
src/auth/
├─ authService.ts     # 注册 / 登录 / 查询用户，bcrypt 哈希密码
├─ jwt.ts             # JWT 签发与校验
├─ authMiddleware.ts  # 从 Authorization 头解析并校验 Bearer Token
├─ routes.ts          # /api/auth/register、/api/auth/login、/api/auth/me
└─ types.ts           # AuthUser、AuthVariables
```

- 密码用 `bcryptjs`（cost 12）哈希存储。
- 登录支持邮箱或用户名。
- 中间件校验成功后把 `user` 注入 Hono context，后续路由通过 `c.get("user")` 取到当前用户。

### 知识库与 RAG

```text
src/knowledge/
├─ documentService.ts  # 上传、列表、删除、向量检索
├─ documentParser.ts   # 解析 txt / md / pdf / docx
├─ chunkText.ts        # 滑窗切分（默认 800 字符，重叠 100）
├─ embeddingService.ts # 调用 OpenAI 兼容 / 多模态 Embedding 接口
└─ routes.ts           # /api/knowledge/*（均需登录）
```

数据存储（`src/db/schema.sql`）：

- `users`：账号表。
- `kb_documents`：文档元数据，按 `user_id` 隔离，状态为 `processing` / `ready` / `failed`。
- `kb_chunks`：文档切片与 `vector(2048)` 向量，外键级联删除。

检索用 pgvector 的 `<=>` 距离排序，所有查询都以 `user_id` 过滤，保证用户之间数据隔离。

### 自动 RAG 策略

`POST /chat` 支持 `mode` 字段（`auto` / `chat` / `rag`），同时支持 `/rag <问题>` 命令强制走知识库：

- `chat`：普通对话，不触发知识库。
- `rag` 或 `/rag`：强制 RAG 模式，调用 `searchKnowledge` 工具检索后回答。
- `auto`（默认）：
  1. 若上一轮已有知识库片段，用一个轻量结构化模型判断 `general` / `reuse` / `search`；
     - `reuse`：复用上一轮原始片段，不重新检索；
     - `search`：重新检索知识库；
     - `general`：交给普通路由。
  2. 若上一轮没有知识库上下文，先用问题做一次 topK=3 检索，最佳 `distance <= AUTO_RAG_DISTANCE_THRESHOLD` 才进入 RAG。

`RouterAgent` 在 `ragMode` 下直接短路：`reuse` 走 `chat`，`search` 走 `tool` 并强制调用 `searchKnowledge` 工具，且工具检索会以当前登录用户身份进行。

### 用户隔离与线程锁

```text
src/runtime/
├─ user-context.ts  # 线程与用户绑定、AsyncLocalStorage 传递工具用户
├─ run-lock.ts      # 同一 threadId 串行执行
└─ memory.ts        # 内存 checkpointer（按 thread_id 隔离）
```

- 每个线程绑定一个用户，跨用户访问会被拒绝（403）。
- 同一 `threadId` 同时只允许一个图运行，否则返回 409，避免并发写入同一个 checkpoint。
- 工具调用期间通过 `AsyncLocalStorage` 把 `userId` 透传给 `searchKnowledge` 工具，确保只检索当前用户的数据。

## 后端目录说明

```text
src/
├─ agents/               # Agent 定义：router、planner、executor、reflection、reply、tool
├─ auth/                 # JWT 注册 / 登录 / 中间件
├─ config/               # 环境变量配置
├─ db/                   # PostgreSQL 客户端与建表 schema
├─ knowledge/            # 知识库解析、切分、Embedding、向量检索与路由
├─ routes/               # Hono HTTP / SSE 路由（chat、skills）
├─ runtime/              # LangGraph 图、状态、checkpoint、HITL、用户隔离、线程锁、入口
├─ services/             # LLM 和 SSE 事件适配服务
├─ skills/               # Skill 注册表、内置 Skill、项目级 Skill 加载
├─ tools/                # Tool 注册表和内置 Tool
└─ types/                # 共享类型和 AgentStreamEvent
```

## 前端目录说明

```text
web/src/
├─ app/                  # 应用装配、登录态恢复、HITL action context
├─ components/
│  ├─ agent/             # ChatView、Composer、AssistantMessage、HitlConfirmCard 等
│  ├─ auth/              # LoginView
│  ├─ knowledge/         # KnowledgePanel：上传 / 列表 / 检索测试
│  ├─ layout/            # Sidebar、MobileSidebar
│  └─ skills/            # SkillsPanel
├─ hooks/                # useAgentRuntime：线程、SSE、消息元数据折叠、模式切换
├─ services/             # agentSseAdapter、authApi、authStorage、knowledgeApi、skillsApi
└─ types/                # 前端镜像的 AgentStreamEvent 与 UI 元数据类型
```

前端已覆盖的能力：

- 登录 / 注册 / 登录态恢复（`authStorage` 持久化 token）
- 多会话线程管理
- 用户消息和 AI 流式回复
- 执行过程时间线、计划卡片、工具调用卡片
- HITL 确认 / 修改 / 取消操作
- 知识库模式切换（自动 / 只用知识库 / 关闭）与 `/rag` 命令识别
- 知识库面板：上传、文档状态、删除、向量检索测试
- Skill 列表面板

## 新增 Tool

1. 新建 `src/tools/<name>.tool.ts`。
2. 使用 LangChain `tool()` 和 Zod schema 定义工具。
3. 在 `src/tools/index.ts` 的 `registerBuiltinTools()` 中调用 `registerTool()`。
4. 不需要改图结构，Runtime 会从注册表懒加载工具。

> 需要访问当前用户的工具（如知识库检索）应通过 `getActiveToolUser()` 获取用户 ID，而不是从请求里直接读取。

## 新增 Skill

本项目支持两类 Skill：

1. **内置 TypeScript Skill**：位于 `src/skills`，适合随代码发布的能力。
2. **项目级 Claude Code Skill 格式**：由用户手动复制到项目根目录 `skills/<skill-name>/SKILL.md`，后端启动时加载。

### 项目级 Claude Code Skill

目录示例：

```text
skills/
└─ frontend-design/
   ├─ SKILL.md
   ├─ references/
   └─ scripts/
```

当前只会加载：

```text
skills/*/SKILL.md
```

不会读取或复制任何用户目录下的 `.claude/skills`。如需使用 Claude Code Skill，请手动复制到本项目根目录的 `skills/` 中。

`SKILL.md` 使用 Claude Code 标准 frontmatter 格式：

```md
---
name: frontend-design
description: |
  Create production-grade frontend interfaces with strong visual craft.
tools:
  - getWeather
---

# Frontend Design

Skill 正文会作为 agent4 的 Skill systemPrompt 使用。
```

加载规则：

- 后端启动时先注册 `src/skills` 内置 Skill，再加载项目根目录 `skills/*/SKILL.md`。
- 项目级 Skill 与内置 Skill 同名时，项目级 Skill 覆盖内置 Skill。
- 新增或修改 `SKILL.md` 后，需要重启后端生效。
- `ENABLED_SKILLS` 是逗号分隔白名单；留空表示启用全部已成功注册的 Skill。
- Router 只读取 Skill 的 `name` 和 `description`，不会读取完整正文。
- 命中 Skill 后，Skill 正文会注入 Planner、Executor、Tool 和 Reply Agent。
- `tools` 未声明表示使用全局启用工具，空数组表示禁止工具，非空数组表示工具白名单。

`references/` 与 `scripts/` 说明：

- 第一版不会自动读取 `references/`。如果需要引用资料，请把必要内容写进 `SKILL.md` 正文。
- `scripts/` 可以随 Skill 放在目录中，但绝不会自动执行。
- 如果脚本需要真正执行，必须额外封装成项目的 LangChain Tool。
- Claude Code 专属工具、Slash Command、MCP 或本机权限能力不能直接迁移到 agent4 Runtime；只能迁移可表达为提示词、项目 Tool 或后端能力的部分。

### 内置 TypeScript Skill

1. 新建 `src/skills/<name>.skill.ts`。
2. 创建 `Skill` 对象，包含 `name`、`description`、`systemPrompt` 等字段。
3. 在 `src/skills/index.ts` 注册。

## 新增 Agent

1. 新建 `src/agents/<name>/<name>.ts`。
2. 实现 `AgentDefinition`。
3. 在 `src/agents/index.ts` 导出。
4. 在 `src/runtime/graph.ts` 中接入节点与边。

## assistant-ui 状态

当前前端保留 `@assistant-ui/react` 依赖，但实际界面使用自研 Chat UI。原因是当前安装的 assistant-ui `0.7.x` 中，`Thread` 的自定义消息 API 与原接入方式不兼容。后续替换回 assistant-ui 标准 Runtime 时，应先读取实际安装版本的类型定义再改代码。
