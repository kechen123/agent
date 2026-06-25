import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  runId?: string;
  threadId?: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * 在当前异步调用链上放入请求上下文。
 *
 * 可以把 AsyncLocalStorage 理解为“异步调用链上的上下文背包”：
 * - 路由入口把 requestId 放进去；
 * - 认证后补充 userId；
 * - Agent 流式运行开始时补充 runId/threadId；
 * - 深层的 stream adapter、tool、service 写日志时不需要层层传参，也能自动带上这些字段。
 *
 * 注意：上下文中只保存追踪字段，不能保存 JWT、API Key、数据库连接串、文档内容等敏感信息。
 */
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** 读取当前异步调用链上的上下文；没有上下文时返回 undefined。 */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/**
 * 在已有上下文上补充字段。
 *
 * 这个函数会原地更新当前 store。AsyncLocalStorage 的 store 是一个普通对象，
 * 在同一次请求链路内补充 runId/userId/threadId 后，后续 logger 都能读取到新字段。
 */
export function patchRequestContext(patch: Partial<RequestContext>): RequestContext | undefined {
  const current = storage.getStore();
  if (!current) return undefined;
  Object.assign(current, patch);
  return current;
}
