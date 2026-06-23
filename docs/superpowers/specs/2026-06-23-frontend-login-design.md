# 前端登录接入设计

## 背景

后端已经新增 JWT 登录、知识库用户隔离，并要求 `/chat` 和 `/chat/resume` 带 `Authorization: Bearer token`。当前前端没有登录状态，继续直接调用聊天接口会得到 401。

## 目标

- 前端新增登录页，不做注册页。
- 支持使用用户名 `kechen` 和密码 `qwe123` 登录。
- 登录成功后保存 JWT，并在聊天和恢复确认请求中自动携带 Authorization header。
- 支持刷新页面后从 localStorage 恢复登录态，并通过 `/api/auth/me` 校验。
- 支持退出登录。
- 提供一条可重复执行的固定用户 SQL，用户之后可手动执行。

## 后端登录调整

保留 `users` 表字段，不新增 `username` 字段。将 `users.name` 作为用户名使用。

- `email` 保存占位邮箱，例如 `kechen@example.local`。
- `name` 保存用户名 `kechen`。
- `/api/auth/login` 仍接收 `{ email, password }`，但 `email` 字段语义扩展为账号。
- 如果账号包含 `@`，按 `email` 查询；否则按 `name` 查询。

为了避免用户名重复，`src/db/schema.sql` 增加 partial unique index：

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name_unique
ON users (name)
WHERE name IS NOT NULL;
```

## 固定用户 SQL

新增 `src/db/seed-kechen.sql`，插入或更新用户：

- `id` 固定 UUID。
- `email = 'kechen@example.local'`。
- `name = 'kechen'`。
- `password_hash` 为 `qwe123` 的 bcrypt hash。

SQL 使用 `ON CONFLICT (email) DO UPDATE`，可重复执行。

## 前端模块

新增：

- `web/src/services/authStorage.ts`
  - 保存、读取、清除 token 和 user。
- `web/src/services/authApi.ts`
  - 调用 `/api/auth/login` 和 `/api/auth/me`。
- `web/src/components/auth/LoginView.tsx`
  - 登录表单，默认账号 `kechen`，默认密码 `qwe123`。

修改：

- `web/src/app/AssistantApp.tsx`
  - 启动时读取 localStorage。
  - 有 token 时调用 `/api/auth/me` 校验。
  - 未登录显示 LoginView。
  - 登录后显示现有 Chat workbench。
  - 提供退出登录按钮。
- `web/src/hooks/useAgentRuntime.ts`
  - 接收 token，并传给 SSE adapter。
- `web/src/services/agentSseAdapter.ts`
  - 支持 Authorization header。
- `web/src/components/layout/Sidebar.tsx` / `MobileSidebar.tsx`
  - 显示当前用户和退出按钮。

## 非目标

- 不做注册页面。
- 不做知识库上传/列表/删除/搜索前端管理页面。本次只保证聊天请求带 token，使 Agent 可使用后端用户上下文。

## 验证

- 根目录运行 `pnpm typecheck`。
- `web/` 目录运行 `pnpm typecheck`。
- 执行 seed SQL 后，用 `kechen / qwe123` 登录。
- 登录后发送聊天消息，确认 `/chat` 不再 401。
- 刷新页面后仍保持登录。
- 退出登录后回到登录页。
