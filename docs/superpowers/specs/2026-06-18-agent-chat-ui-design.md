# Agent Chat UI 优化设计

日期：2026-06-18

## 背景

当前前端已经可以跑通对话、SSE 流式输出、Agent 执行过程、计划卡片、工具调用卡片和 HITL 确认卡片，但界面偏 demo，缺少正式 AI 产品的层级、留白和质感。本次目标是在不修改后端逻辑、不修改 SSE 协议、不重构业务代码的前提下，对现有 React + TailwindCSS 前端做 UI 优化。

## 设计目标

- 做成高级、简洁、现代的浅色 Agent Chat UI。
- 气质采用融合风格：Claude 的留白和克制、ChatGPT 的输入体验、Cursor 的开发者/Agent 执行质感。
- 保持现有组件边界和数据流，优先通过 TailwindCSS className、少量展示结构和文案调整完成。
- 所有 UI 文案中文化。
- 不引入大型 UI 库，不改变业务状态管理，不改变 SSE event type。

## 范围

### 本次会修改

- `web/src/app/AssistantApp.tsx`
- `web/src/components/layout/Sidebar.tsx`
- `web/src/components/agent/ChatView.tsx`
- `web/src/components/agent/AssistantMessage.tsx`
- `web/src/components/agent/AgentTimeline.tsx`
- `web/src/components/agent/PlanCard.tsx`
- `web/src/components/agent/HitlConfirmCard.tsx`
- `web/src/components/agent/ToolCallCard.tsx`
- `web/src/index.css`
- 必要时新增一个很小的前端工具函数，例如 `cn()`
- README / CLAUDE.md 中涉及前端 UI 状态的中文说明

### 本次不会修改

- 后端 `src/` 逻辑
- `/chat`、`/chat/resume`、`/health` 接口
- SSE 协议和 `AgentStreamEvent` 类型
- `useAgentRuntime` 的业务流程和事件折叠逻辑
- assistant-ui 依赖接入方式
- 新增大型 UI 库或状态管理库

## 视觉系统

- 背景：浅灰，优先使用 `#f7f7f8` / `#fafafa` / Tailwind neutral 色系。
- 主内容：白色卡片、浅边框、轻阴影。
- 圆角：主要容器 16px-24px；按钮和输入框 14px-22px。
- 强调色：克制的蓝紫色，用于主按钮、计划卡片 accent、聚焦态。
- 状态色：绿色表示完成/运行正常，红色表示错误，琥珀色表示 HITL 提示；均使用低饱和浅色背景。
- 信息密度：聊天内容宽松，Agent 元数据卡片紧凑，避免执行过程抢占正文。

## 页面布局

`AssistantApp` 保持现有 provider 和 runtime 数据流，只调整页面壳层：

- 根容器使用 `h-screen w-full overflow-hidden bg-[#f7f7f8]`。
- 左侧 sidebar 固定宽度约 260px。
- 右侧聊天区 flex 填满剩余宽度。
- 聊天区内部包含：顶部 header、可滚动消息区、底部输入区。
- 消息内容居中，最大宽度 820px-900px。
- 消息区底部预留足够 padding，避免被底部输入框遮挡。

## Sidebar 设计

Sidebar 从简单按钮列表升级为产品侧栏：

- 顶部显示产品名 `Agent Runtime`，副标题 `LangGraph Agent Workspace`。
- “新建会话”按钮改为柔和深色或蓝紫渐变按钮，宽度铺满，圆角 16px，hover 有明显但克制的反馈。
- 会话列表卡片化：
  - 当前会话使用白底、浅阴影、深色文字和轻边框突出。
  - 非当前会话使用透明/浅灰 hover。
  - 标题缺省时显示 `新会话`。
- 底部增加状态块：绿色状态点、`Local Agent`、`Running`，表达本地 Agent 正在运行。

## Header 设计

顶部 header 取代普通标题区：

- 高度约 64px。
- 左侧显示：
  - 标题 `Agent Runtime`
  - 副标题 `LangGraph · Tool Calling · HITL`
- 右侧显示：
  - 绿色状态点和 `在线`
  - 当前 threadId 的简短形式，例如末尾 8 位。
- 背景使用白色或半透明白，底部只有轻微边框。

## 消息设计

### 用户消息

- 右侧对齐。
- 深灰/近黑气泡。
- 圆角更自然，例如 22px 并微调右下角。
- 最大宽度约 72%，保持长文本可读。

### AI 消息

- 左侧对齐。
- 使用轻量白色容器，浅边框和非常轻的阴影。
- 最大宽度允许接近 100%，避免 Markdown 内容被压窄。
- 空内容时显示 `正在思考…`，样式更柔和。

### Markdown

通过 Tailwind prose 和局部 className 优化：

- 段落间距更舒适。
- 标题、列表、引用、代码块、行内代码样式统一。
- 代码块使用浅灰背景、圆角、横向滚动。
- 不让文字挤在一起。

## AgentTimeline 设计

标题改为 `执行过程`，组件展示为轻量 timeline：

- 白色卡片，边框 `#e5e7eb`，轻阴影，圆角 18px。
- 每个步骤一行，包含：
  - 状态图标：running 小 spinner、done 绿色 check、error 红色标识。
  - 标题。
  - 中文状态：`执行中` / `已完成` / `失败`。
  - 简短描述。
- 行间距紧凑，不占过多空间。
- running 状态使用动画，但避免大面积闪烁。

## PlanCard 设计

计划卡片从重蓝色改成克制的高级浅色卡片：

- 标题：`执行计划`。
- 白色或近白色背景，浅边框，轻阴影。
- 左侧增加细蓝紫 accent border。
- `plan.goal` 作为计划目标，以中等字重展示。
- 步骤使用编号圆点，淡蓝紫底色，深蓝紫文字。
- 步骤之间使用轻分隔或间距，让内容紧凑但清晰。

## HitlConfirmCard 设计

HITL 确认卡使用克制浅琥珀提示风格：

- 主文案：`是否执行该计划？`
- 浅琥珀背景、浅边框，不使用高饱和色块。
- 三个按钮统一高度和圆角：
  - `确认执行`：主按钮，蓝紫色或深色。
  - `修改计划`：次按钮，浅色边框。
  - `取消任务`：ghost / danger，红色文字或浅红 hover。
- 修改模式 textarea 使用圆角、浅边框、聚焦蓝紫阴影。
- 修改模式按钮文案保持中文，例如 `提交修改`、`返回`。

## ToolCallCard 设计

工具调用卡保持默认折叠，降低视觉噪音：

- 每个工具调用行显示工具名和中文状态。
- 若现有前端类型中存在耗时字段则展示；若没有，不新增协议字段。
- 展开后显示 `参数` 和 `结果`。
- JSON 区域使用浅灰背景、monospace、圆角、横向滚动，并限制最大高度，避免铺满页面。

## 输入框设计

底部输入区做成 ChatGPT 风格浮层：

- 白色浮层卡片，圆角 18px-24px。
- 浅灰边框和轻阴影。
- 聚焦时显示蓝紫色边框/阴影。
- textarea 自动增长，最大高度 160px。
- placeholder 使用：`输入消息，按 Enter 发送，Shift + Enter 换行`。
- 发送按钮放右侧，运行中禁用发送并提供停止按钮或 loading/停止状态。
- 按钮全部使用产品化样式，避免原生按钮感。

## 中文化与文档

- UI 组件文案统一中文。
- 新增注释使用中文。
- README / CLAUDE.md 中与前端说明相关的内容保持中文并更新为当前 UI 状态，避免继续强调“临时 demo UI”的观感。

## 验证标准

- `cd web && pnpm typecheck` 通过。
- `cd web && pnpm dev` 能启动 Vite。
- 页面高度为 100vh，没有主页面滚动条溢出。
- 输入框不遮挡最后一条消息。
- 新 UI 保持现有对话、SSE、AgentTimeline、PlanCard、ToolCallCard、HitlConfirmCard 行为不变。
- 后端文件和 SSE 类型没有改动。

## 实施策略

采用“原组件轻量美化”策略：

1. 先调整页面壳层、sidebar、header 和输入框。
2. 再优化用户/AI 消息和 Markdown 样式。
3. 最后优化 AgentTimeline、PlanCard、HitlConfirmCard、ToolCallCard。
4. 运行前端 typecheck 验证。

该策略改动面小、风险低，最符合本次“只做 UI 优化，不改业务逻辑”的约束。
