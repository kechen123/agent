# 知识库前端管理面板设计

## 背景

后端已经提供按用户隔离的知识库 API，前端已经接入登录并能在聊天请求中携带 JWT。当前缺少文档上传、文档列表、删除和搜索测试入口。

## 目标

- 在前端增加「知识库」入口。
- 登录后可打开知识库管理面板。
- 支持上传 txt、md、pdf、docx 文档。
- 支持查看当前用户文档列表、状态、chunk 数和错误信息。
- 支持删除文档。
- 支持输入 query 做 topK=5 的搜索测试。
- 所有知识库请求都携带当前登录 token。

## 入口与布局

在 Sidebar 底部 Skills 附近增加「知识库」按钮。移动端 Sidebar 也显示该入口，点击后关闭移动菜单并打开面板。

新增 `web/src/components/knowledge/KnowledgePanel.tsx`，采用右侧抽屉形式，与现有 SkillsPanel 的交互一致。

## API Service

新增 `web/src/services/knowledgeApi.ts`：

- `listDocuments(token)` 调用 `GET /api/knowledge/documents`。
- `uploadDocument(token, file)` 调用 `POST /api/knowledge/documents`，使用 multipart/form-data。
- `deleteDocument(token, id)` 调用 `DELETE /api/knowledge/documents/:id`。
- `searchKnowledge(token, query)` 调用 `POST /api/knowledge/search`，`topK` 固定为 5。

统一解析后端 `{ error }` 响应并抛出可展示错误。

## 面板功能

### 上传文档

- 文件选择框只提示支持 txt/md/pdf/docx。
- 上传按钮在未选择文件或上传中时禁用。
- 上传成功后清空文件选择并刷新文档列表。

### 文档列表

- 打开面板时加载列表。
- 展示原始文件名、状态、chunk 数、更新时间。
- failed 文档显示 error_message。
- 删除按钮调用删除接口，成功后刷新列表。

### 搜索测试

- 输入 query。
- 点击搜索调用知识库搜索 API。
- 展示 filename、distance、content。
- 空结果显示“未找到相关片段”。

## App 接入

修改：

- `web/src/app/AssistantApp.tsx` 增加 `knowledgeOpen` 状态，渲染 KnowledgePanel。
- `web/src/components/layout/Sidebar.tsx` 增加知识库按钮 props。
- `web/src/components/layout/MobileSidebar.tsx` 传递知识库按钮并在点击后关闭移动侧栏。

## 非目标

- 不做拖拽上传。
- 不做文档内容预览。
- 不做搜索结果插入聊天输入框。
- 不做分页，首版直接展示后端返回列表。

## 验证

- `cd web && pnpm typecheck`。
- 登录后打开知识库面板。
- 上传文本文件后列表刷新并显示 chunk 数。
- 搜索能返回片段。
- 删除文档后列表更新。
