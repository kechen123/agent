# RAG 命令与空会话输入框设计

## 目标

- 使用 `/rag 问题` 显式触发知识库检索，不依赖 Agent 猜测用户是否想查知识库。
- 将空状态快捷问题改成输入框命令建议，界面上不再显示快捷卡片。
- 新建会话无消息时输入框居中；有消息后输入框固定底部。
- 左侧知识库入口显示文档数量，不再只显示 `KB`。

## 后端行为

`POST /chat` 收到用户消息后，如果消息以 `/rag` 开头：

- `/rag` 后没有问题时返回 400。
- `/rag xxx` 会改写为内部指令，要求 Agent 先调用 `searchKnowledge` 工具，再基于检索结果回答。
- Router 对包含该内部指令的消息应路由到 `tool`。

普通消息保持现有流程，不强制知识库检索。

## 前端行为

### 命令建议

Composer 支持命令建议浮层：

- 输入为空或输入 `/` 时显示建议。
- 建议包含 `/rag 知识库问答` 和若干示例。
- 点击建议后填入输入框并聚焦。

原 EmptyState 快捷卡片不再显示。

### 空会话布局

无消息时 ChatView 显示居中的欢迎文案和 Composer。
有消息后 Composer 回到底部固定区域。

### 知识库数量

AssistantApp 登录后调用 `listDocuments(token)` 统计 ready 文档数，并传给 Sidebar/MobileSidebar。KnowledgePanel 上传/删除后通知 App 刷新数量。

## 验证

- 后端 `pnpm typecheck`。
- 前端 `cd web && pnpm typecheck`。
- 新建会话输入框居中。
- 输入 `/` 出现命令建议。
- `/rag xxx` 触发 `searchKnowledge` 工具。
- 知识库按钮显示文档数量。
