# Agent Runtime

一个 Node.js + TypeScript + LangGraph 的多 Agent Runtime 示例项目，后端通过标准化 SSE 输出 Agent 执行事件，前端用 React + Vite 展示聊天、执行时间线、计划、工具调用和 HITL 确认卡片。

## 项目结构说明

本项目**不是 monorepo**，**不使用 pnpm workspace**。

- 根目录：后端项目，依赖安装到根目录 `node_modules`。
- `web/`：前端项目，依赖安装到 `web/node_modules`。
- 不使用 `pnpm --filter`。

```text
.
├─ src/                  # 后端源码
├─ package.json          # 后端 package.json
├─ pnpm-lock.yaml        # 后端锁文件
├─ .env.example          # 后端环境变量示例
└─ web/
   ├─ src/               # 前端源码
   ├─ package.json       # 前端 package.json
   ├─ pnpm-lock.yaml     # 前端锁文件
   └─ vite.config.ts     # 前端 Vite 配置
```

## 环境变量

复制 `.env.example` 为 `.env` 并填写：

```bash
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
MODEL_TEMPERATURE=0
PORT=3000
WEB_ORIGIN=http://localhost:5173
ENABLED_TOOLS=
ENABLED_SKILLS=
```

说明：

- `DEEPSEEK_API_KEY`：DeepSeek API Key，必须放在 `.env`，不要写死到代码中。
- `DEEPSEEK_BASE_URL`：OpenAI 兼容接口地址。
- `DEEPSEEK_MODEL`：模型名；代码也兼容旧变量 `MODEL_NAME`。
- `PORT`：后端监听端口，默认 `3000`。
- `WEB_ORIGIN`：前端来源，默认 `http://localhost:5173`。
- `ENABLED_TOOLS` / `ENABLED_SKILLS`：逗号分隔白名单，留空表示启用全部已注册项；`ENABLED_SKILLS` 会影响 Router 可选 Skill、Agent 注入和 `GET /skills` 的 `enabled` 字段。

## 后端启动

在根目录执行：

```bash
pnpm install
pnpm typecheck
pnpm verify:skills
pnpm dev
```

服务默认启动在：

```text
http://localhost:3000
```

可用接口：

- `GET /health`：健康检查。
- `GET /skills`：返回已成功注册 Skill 的安全摘要，不包含 systemPrompt 或本地路径。
- `POST /chat`：开始一次对话，返回 SSE。
- `POST /chat/resume`：继续 HITL 暂停的线程，返回 SSE。

健康检查返回：

```json
{
  "ok": true,
  "service": "agent-runtime"
}
```

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

Vite 代理：

- `/chat` → `http://localhost:3000/chat`
- `/chat/resume` → `http://localhost:3000/chat/resume`
- `/health` → `http://localhost:3000/health`
- `/skills` → `http://localhost:3000/skills`

`web/.npmrc` 中的 `onlyBuiltDependencies[]=esbuild` 用于让 pnpm 11 正常处理 Vite 依赖，不表示 workspace。

## 后端目录说明

```text
src/
├─ agents/               # Agent 定义：router、planner、executor、reply、tool
├─ config/               # 环境变量配置
├─ routes/               # Hono HTTP / SSE 路由
├─ runtime/              # LangGraph 图、状态、checkpoint、HITL、入口
├─ services/             # LLM 和 SSE 事件适配服务
├─ skills/               # Skill 注册表和内置 Skill
├─ tools/                # Tool 注册表和内置 Tool
└─ types/                # 共享类型和 AgentStreamEvent
```

## 前端目录说明

```text
web/src/
├─ app/                  # 应用装配、HITL action context
├─ components/           # UI 组件
│  ├─ agent/             # AgentTimeline、PlanCard、ToolCallCard、HitlConfirmCard、ChatView
│  └─ layout/            # Sidebar
├─ hooks/                # useAgentRuntime：线程、SSE、消息状态
├─ services/             # agentSseAdapter：SSE 读取器
└─ types/                # 前端类型
```

## 新增 Tool

1. 新建 `src/tools/<name>.tool.ts`。
2. 使用 LangChain `tool()` 和 Zod schema 定义工具。
3. 在 `src/tools/index.ts` 的 `registerBuiltinTools()` 中调用 `registerTool()`。
4. 不需要改图结构，Runtime 会从注册表懒加载工具。

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

不会读取或复制：

```text
C:\Users\Administrator\.claude\skills
```

也不会扫描任何用户目录下的 `.claude/skills`。如需使用 Claude Code Skill，请手动复制到本项目根目录的 `skills/` 中。

`SKILL.md` 使用 Claude Code 标准 frontmatter 格式：

```md
---
name: frontend-design
description: |
  Create production-grade frontend interfaces with strong visual craft.
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

`references/` 与 `scripts/` 说明：

- 第一版不会自动读取 `references/`。如果需要引用资料，请把必要内容写进 `SKILL.md` 正文，或后续实现受限的 Markdown 引用加载。
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

当前前端保留 `@assistant-ui/react` 依赖，但实际界面使用自研 Chat UI。界面已覆盖：

- 用户消息和 AI 流式回复
- 执行过程时间线
- 执行计划卡片
- 工具调用折叠卡片
- HITL 确认 / 修改 / 取消操作
- SSE 接收与消息元数据折叠

原因是当前安装的 assistant-ui `0.7.x` 中，`Thread` 的自定义消息 API 与原接入方式不兼容。后续替换回 assistant-ui 标准 Runtime 时，应先读取实际安装版本的类型定义再改代码。
