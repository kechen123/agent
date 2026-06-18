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
- `ENABLED_TOOLS` / `ENABLED_SKILLS`：逗号分隔白名单，留空表示启用全部已注册项。

## 后端启动

在根目录执行：

```bash
pnpm install
pnpm typecheck
pnpm dev
```

服务默认启动在：

```text
http://localhost:3000
```

可用接口：

- `GET /health`：健康检查。
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

1. 新建 `src/skills/<name>.skill.ts`。
2. 创建 `Skill` 对象，包含 `name`、`description`、`systemPrompt` 等字段。
3. 在 `src/skills/index.ts` 注册。
4. Router 会读取 Skill 列表，并在命中后把 Skill 提示注入 ReplyAgent。

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
