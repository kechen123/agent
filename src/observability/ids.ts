import { randomUUID } from "node:crypto";

/**
 * 生成带前缀的可读 ID。
 *
 * 为什么不用裸 UUID：
 * - 日志里同时会出现 HTTP 请求、Agent 运行、工具调用等多类 ID；
 * - 加上 req_/run_ 前缀后，排查问题时一眼就能看出 ID 的语义；
 * - 底层仍使用 randomUUID，避免不同请求之间发生碰撞。
 */
function createPrefixedId(prefix: "req" | "run"): string {
  return `${prefix}_${randomUUID()}`;
}

/** HTTP 请求级追踪 ID：一次 HTTP 请求只有一个 requestId。 */
export function createRequestId(): string {
  return createPrefixedId("req");
}

/** Agent/SSE 运行级追踪 ID：一次 /chat 或 /chat/resume 流式运行只有一个 runId。 */
export function createRunId(): string {
  return createPrefixedId("run");
}
