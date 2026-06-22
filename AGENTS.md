# AGENTS.md

本文件为 Codex 在本仓库中工作时提供项目约定和运行说明。

## 项目定位

这是一个基于 LangGraph 的多 Agent Runtime 框架，后端提供标准化 SSE 事件层，前端使用 React + Vite 展示 Agent 执行过程。

> 重要：本项目**不是 monorepo**，**不使用 pnpm workspace**。根目录是后端项目，`web/` 是前端项目；两者独立安装依赖、独立启动。

- **后端**（`src/`）：Node.js + TypeScript + LangGraph + Hono。提供 `POST /chat` 和 `POST /chat/resume`，以 SSE 流输出标准化 `AgentStreamEvent`。
- **前端**（`web/`）：React + Vite + TailwindCSS。前端当前使用自研 Chat UI 渲染消息、执行过程、计划、工具调用和 HITL 操作；`@assistant-ui/react` 依赖保留，后续替换回 assistant-ui 标准 Runtime 时，应先读取实际安装版本的类型定义再改代码。

## 安装与启动

### 后端（根目录）

```bash
pnpm install
pnpm typecheck
pnpm dev
```

- `pnpm dev` 启动 Hono 服务，默认监听 `PORT=3000`。
- `pnpm typecheck` 执行 `tsc --noEmit`。
- 健康检查：`GET /health`，返回 `{ "ok": true, "service": "agent-runtime" }`。
- Skill 列表：`GET /skills`，返回已成功注册 Skill 的安全摘要，不包含 systemPrompt 或本地路径。

### 前端（`web/` 目录）

```bash
cd web
pnpm install
pnpm typecheck
pnpm dev
```

- `pnpm dev` 启动 Vite，默认监听 `http://localhost:5173`。
- Vite 将 `/chat`、`/chat/resume`、`/health`、`/skills` 代理到 `http://localhost:3000`。
- `web/.npmrc` 用于允许 Vite 依赖的 `esbuild` 安装配置，不代表 workspace。

## 环境变量

配置文件读取 `.env`；示例见 `.env.example`。

至少需要：

```bash
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
PORT=3000
WEB_ORIGIN=http://localhost:5173
```

兼容旧变量 `MODEL_NAME`，但新配置优先使用 `DEEPSEEK_MODEL`。不要把 API Key 写死到代码中。

`ENABLED_TOOLS` / `ENABLED_SKILLS` 是逗号分隔白名单，留空表示启用全部已注册项；`ENABLED_SKILLS` 会影响 Router 可选 Skill、Agent 注入和 `GET /skills` 的 `enabled` 字段。

## 后端目录结构

```text
src/
├─ types/agent.ts        # 共享领域类型与 SSE 事件类型
├─ config/index.ts       # 环境变量驱动的配置单例
├─ services/llm.ts       # 共享 ChatOpenAI 实例（DeepSeek / OpenAI 兼容）
├─ services/stream.ts    # LangGraph streamEvents → AgentStreamEvent 适配器
├─ tools/                # Tool 注册表：registerTool/getTools/createToolNode
├─ skills/               # Skill 注册表：registerSkill/getSkillByName/listSkills
├─ agents/               # AgentDefinition 基类与 router/planner/executor/reply/tool
├─ runtime/              # state、graph、memory、events、checkpoints(HITL)、index
├─ routes/chat.route.ts  # Hono SSE 路由
└─ app.ts                # Hono app 与 @hono/node-server 启动入口
```

### 后端执行流

```text
START → routerAgent
router --route-->  chat    → replyAgent → END
                  tool    → toolAgent ⇄ tools → replyAgent → END
                  plan    → plannerAgent → planConfirm(interrupt)
                              planConfirm --decision-->
                                confirm  → executorAgent ⇄ executor → replyAgent → END
                                modify   → modifyPlanNode → plannerAgent（重新规划）
                                reject   → replyAgent → END
                  execute → executorAgent ⇄ executor → replyAgent → END
```

- `replyAgent` 是唯一面向用户输出消息的 Agent；只有它会产生 `message:delta`。
- router/planner/executor/tool 的模型流会被 `services/stream.ts` 过滤，避免多个 Agent 同时向用户输出正文。
- HITL 使用 LangGraph `interrupt()` 暂停，并通过 `Command({ resume })` 继续执行。
- `tools` 节点在调用时懒加载当前注册表中的工具，而不是在图编译时固定工具列表。

## 前端目录结构

```text
web/src/
├─ app/                  # 应用装配与 HITL action context
├─ components/agent/     # AgentTimeline、PlanCard、ToolCallCard、HitlConfirmCard、ChatView
├─ components/layout/    # Sidebar
├─ hooks/                # useAgentRuntime：线程状态、SSE、消息元数据折叠
├─ services/             # agentSseAdapter：POST + SSE data 行解析
└─ types/                # 前端镜像的 AgentStreamEvent 与 UI 元数据类型
```

## 扩展点

### 新增 Tool

1. 在 `src/tools/<name>.tool.ts` 创建 LangChain `tool()` 和 Zod schema。
2. 在 `src/tools/index.ts` 的 `registerBuiltinTools()` 中调用 `registerTool()`。
3. 工具循环会通过注册表自动绑定，不需要修改 `runtime/graph.ts`。

### 新增 Skill

支持两类 Skill：

1. 内置 TypeScript Skill：在 `src/skills/<name>.skill.ts` 创建并在 `src/skills/index.ts` 注册。
2. 项目级 Claude Code Skill：用户手动复制到项目根目录 `skills/<skill-name>/SKILL.md`。

项目级目录示例：

```text
skills/
└─ frontend-design/
   ├─ SKILL.md
   ├─ references/
   └─ scripts/
```

只加载 `skills/*/SKILL.md`，不读取、不扫描、不复制 `C:\Users\Administrator\.claude\skills` 或任何用户目录下的 `.claude/skills`。

`SKILL.md` 格式：

```md
---
name: frontend-design
description: |
  Create production-grade frontend interfaces...
---

# Frontend Design

Skill 正文……
```

启动顺序：先注册内置 Skill，再加载项目级 Skill；同名时项目级覆盖内置。`ENABLED_SKILLS` 为空表示启用全部，非空时作为逗号分隔白名单。新增或修改 `SKILL.md` 后必须重启后端。

Router 只读取 `name` 和 `description`。命中 Skill 后，正文会注入 PlannerAgent、ExecutorAgent、ToolAgent 和 ReplyAgent。

第一版不会自动读取 `references/`。`scripts/` 绝不会自动执行；要真正执行脚本，必须封装为项目 LangChain Tool。Claude Code 专属工具能力不能直接迁移。

### 新增 Agent

1. 在 `src/agents/<name>/<name>.ts` 实现 `AgentDefinition`。
2. 从 `src/agents/index.ts` 导出。
3. 在 `src/runtime/graph.ts` 中接入节点和边。

## 当前 assistant-ui 状态

`@assistant-ui/react` 仍保留在 `web/package.json` 中，但当前安装版本 `0.7.x` 的 `Thread` 自定义消息 API 与原代码不兼容。前端当前使用自研 Chat UI 渲染消息、执行过程、计划、工具调用和 HITL 操作；后续替换回 assistant-ui 标准 Runtime 时，应先读取实际安装版本的类型定义再改代码。
