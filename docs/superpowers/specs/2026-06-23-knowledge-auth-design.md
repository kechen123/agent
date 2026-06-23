# 用户认证与文档知识库设计

## 背景

agent4 当前是 Node.js + TypeScript + Hono + LangGraph 的多 Agent Runtime。后端已有标准 SSE 聊天接口、工具注册表和 OpenAI-compatible LLM 配置。本设计新增用户登录系统、PostgreSQL + pgvector 文档知识库、知识库检索 API，以及供 Agent 调用的知识库检索 Tool。

## 目标

- 支持用户注册、登录、获取当前用户信息。
- 使用 bcrypt 存储密码哈希，使用 JWT 做接口认证。
- 新增 PostgreSQL 数据库连接和 pgvector schema 初始化脚本。
- 支持用户上传 txt、md、pdf、docx 文档，解析、分块、embedding 后写入 pgvector。
- 知识库文档、搜索结果和 Agent Tool 检索都按用户隔离。
- 不破坏现有 LangGraph 执行流，只通过认证、上下文绑定和 Tool 注册扩展能力。

## 非目标

- 不实现前端登录 UI。
- 不实现异步任务队列或后台 worker；首版上传接口同步完成解析和入库。
- 不实现数据库迁移框架；使用 `src/db/schema.sql` 和 `pnpm db:init` 初始化。
- 不让模型或客户端显式传入 userId 作为权限依据。

## 依赖

后端新增依赖：

- `pg`
- `@types/pg`
- `pdf-parse`
- `mammoth`
- `uuid`
- `bcryptjs`
- `jsonwebtoken`
- `@types/jsonwebtoken`
- `@types/bcryptjs`

文件上传使用 Hono 原生 `multipart/form-data`，不引入 multer。

## 环境变量

`.env.example` 和配置模块新增：

```env
DATABASE_URL=postgresql://用户名:密码@localhost:5432/agent4
EMBEDDING_MODEL=text-embedding-v3
EMBEDDING_DIM=1024
UPLOAD_DIR=uploads
JWT_SECRET=请换成一个足够长的随机字符串
JWT_EXPIRES_IN=7d
```

Embedding API 复用现有 `DEEPSEEK_API_KEY` 和 `DEEPSEEK_BASE_URL`，只单独配置模型名和维度。

## 数据库设计

新增 `src/db/schema.sql`：

- `CREATE EXTENSION IF NOT EXISTS vector;`
- `users`
- `kb_documents`
- `kb_chunks`
- `updated_at` 更新时间触发器
- HNSW cosine 索引

### users

- `id uuid primary key`
- `email text unique not null`
- `password_hash text not null`
- `name text`
- `created_at timestamp not null default now()`
- `updated_at timestamp not null default now()`

### kb_documents

- `id uuid primary key`
- `user_id uuid not null references users(id) on delete cascade`
- `filename text not null`
- `original_name text not null`
- `mime_type text not null`
- `file_path text not null`
- `status text not null check (status in ('processing', 'ready', 'failed'))`
- `error_message text`
- `created_at timestamp not null default now()`
- `updated_at timestamp not null default now()`

### kb_chunks

- `id uuid primary key`
- `document_id uuid not null references kb_documents(id) on delete cascade`
- `content text not null`
- `chunk_index int not null`
- `embedding vector(1024) not null`
- `created_at timestamp not null default now()`

`kb_chunks` 不保存 `user_id`。所有隔离通过 `document_id -> kb_documents.user_id` 完成。

## 数据库连接与初始化

新增：

- `src/db/client.ts`
- `scripts/init-db.ts`

`src/db/client.ts` 使用 `pg.Pool`，从 `DATABASE_URL` 读取连接字符串，导出 `query()` 方法，并支持 graceful shutdown。`scripts/init-db.ts` 读取 `src/db/schema.sql` 并执行。`package.json` 增加：

```json
"db:init": "tsx scripts/init-db.ts"
```

## 认证设计

新增 `src/auth/`：

- `authService.ts`
- `jwt.ts`
- `authMiddleware.ts`
- `routes.ts`

### 接口

`POST /api/auth/register`

```json
{
  "email": "test@qq.com",
  "password": "123456",
  "name": "测试用户"
}
```

`POST /api/auth/login`

```json
{
  "email": "test@qq.com",
  "password": "123456"
}
```

注册和登录成功返回：

```json
{
  "token": "jwt token",
  "user": {
    "id": "...",
    "email": "...",
    "name": "..."
  }
}
```

`GET /api/auth/me` 需要 `Authorization: Bearer token`，返回当前用户。

### 认证规则

- 注册前检查 email 是否存在，存在时返回 409。
- 密码使用 bcrypt hash，不保存明文。
- JWT secret 必须从 `.env` 读取；未配置时认证相关操作报错。
- 登录失败返回 401 和明确错误。
- `authMiddleware` 校验 token 后把用户挂到 `c.set("user", user)`。

## Chat 用户绑定

`/chat` 和 `/chat/resume` 都改为必须登录。

新增轻量上下文模块，例如 `src/runtime/user-context.ts`：

- `bindThreadUser(threadId, userId)`
- `getThreadUser(threadId)`
- `assertThreadUser(threadId, userId)`

`POST /chat`：

1. 读取并校验 JWT。
2. 若 threadId 未绑定，绑定当前用户。
3. 若 threadId 已绑定到其他用户，返回 403。
4. 保持现有 run lock、checkpoint 和 SSE 流程。

`POST /chat/resume`：

1. 读取并校验 JWT。
2. 校验 threadId 属于当前用户。
3. 保持现有 resume 流程。

该绑定是进程内轻量映射，满足首版 Agent Tool 用户隔离。后续如需跨进程/重启恢复，可以把 thread-user 关系持久化到数据库。

## 知识库模块

新增 `src/knowledge/`：

- `documentParser.ts`
- `chunkText.ts`
- `embeddingService.ts`
- `documentService.ts`
- `routes.ts`

### documentParser.ts

支持：

- `.txt` / `text/plain`
- `.md` / `text/markdown` / `text/plain`
- `.pdf` / `application/pdf`
- `.docx` / Office Open XML Word MIME

不支持格式抛明确错误。

### chunkText.ts

`chunkText(text, { chunkSize = 800, overlap = 100 })`：

- 按字符长度切分。
- 相邻 chunk 保留约 100 字 overlap。
- trim 并过滤空白内容。

### embeddingService.ts

- 使用 OpenAI-compatible embeddings endpoint。
- 复用 `config.apiKey` 和 `config.baseURL`。
- 模型使用 `config.embeddingModel`。
- 校验每个向量长度等于 `config.embeddingDim`，不一致时抛错。

### documentService.ts

`uploadDocument(userId, file)`：

1. 保存文件到 `UPLOAD_DIR`，文件名使用 uuid 和原扩展名。
2. 插入 `kb_documents`，`status = processing`。
3. 解析文本。
4. 分块。
5. 生成 embedding。
6. 批量插入 `kb_chunks`。
7. 更新 `kb_documents.status = ready`。
8. 出错时更新 `status = failed` 和 `error_message`，并删除已保存文件，避免脏文件。

`deleteDocument(userId, documentId)`：

1. 查询 `file_path`，条件包含 `id` 和 `user_id`。
2. 执行 `DELETE FROM kb_documents WHERE id = $1 AND user_id = $2`。
3. 删除成功后删除本地文件。
4. chunks 依赖数据库 `ON DELETE CASCADE` 删除，不逐条删除。

`listDocuments(userId)`：

- 返回当前用户文档列表。
- 附带 chunk 数量。

`searchKnowledge(userId, query, topK)`：

- query 转 embedding。
- join `kb_documents` 并限制 `user_id` 和 `status = 'ready'`。
- 使用 cosine distance 排序。
- 返回 `content`、`filename`、`document_id`、`distance`。

搜索 SQL：

```sql
SELECT c.content, d.filename, d.id AS document_id, c.embedding <=> $1 AS distance
FROM kb_chunks c
JOIN kb_documents d ON d.id = c.document_id
WHERE d.user_id = $2 AND d.status = 'ready'
ORDER BY c.embedding <=> $1
LIMIT $3;
```

## 知识库 API

全部需要登录：

- `GET /api/knowledge/documents`
- `POST /api/knowledge/documents`
- `DELETE /api/knowledge/documents/:id`
- `POST /api/knowledge/search`

上传接口使用 multipart 字段 `file`。搜索 body：

```json
{
  "query": "xxx",
  "topK": 5
}
```

`topK` 默认 5，上限 20。

## Agent Tool 设计

新增 `src/tools/searchKnowledge.tool.ts`：

输入：

```json
{
  "query": "string"
}
```

输出为相关知识库片段文本。

注册到 `registerBuiltinTools()`。Tool 不接受 userId，不信任模型传递权限数据。Tool 运行时从当前 thread 上下文查 userId，然后调用 `searchKnowledge(userId, query, topK)`。如果当前会话没有绑定用户，返回明确提示，不做全局检索。

## 错误处理

- JWT 缺失或无效：401。
- threadId 不属于当前用户：403。
- 注册 email 已存在：409。
- 登录失败：401。
- 上传格式不支持：400。
- 文档不存在或不属于当前用户：404。
- embedding 维度不匹配：500，并标记文档 failed。
- 删除本地文件失败不回滚数据库删除，但记录 warning，避免数据库中残留文档。

## 测试与验证

实现后运行：

```bash
pnpm install
pnpm typecheck
```

需要本地 PostgreSQL 已安装 pgvector 后运行：

```bash
pnpm db:init
```

手动验证路径：

1. 注册用户。
2. 登录获取 token。
3. 调用 `/api/auth/me`。
4. 使用 token 上传 txt/md/pdf/docx。
5. 查询文档列表并确认 chunk 数量。
6. 搜索知识库并确认只返回当前用户文档。
7. 删除文档并确认文档和本地文件被删除，chunks 由级联删除。
8. 使用另一个用户确认无法看到、搜索或删除第一个用户的文档。
9. 使用 token 调用 `/chat`，确认 Agent 可调用 `searchKnowledgeTool` 且只检索当前用户知识库。
