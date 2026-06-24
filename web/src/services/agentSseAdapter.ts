import type { AgentStreamEvent } from "../types/agent-ui";

function isAgentStreamEvent(value: unknown): value is AgentStreamEvent {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      typeof (value as { type?: unknown }).type === "string",
  );
}

async function responseError(res: Response): Promise<Error> {
  const fallback = `SSE 请求失败：${res.status} ${res.statusText}`;
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string") return new Error(body.error);
    if (body.error) return new Error(JSON.stringify(body.error));
  } catch {
    // 响应不一定是 JSON，例如代理服务器返回的 HTML 错误页。
  }
  return new Error(fallback);
}

/**
 * LangGraph 后端的 SSE 读取器。
 *
 * 该函数会用 POST 发送 JSON 请求体，并把响应体当作 Server-Sent Events
 * 流读取；每一行 `data: <json>` 都会被解析成类型化的 AgentStreamEvent。
 * 每收到一个事件就调用 `onEvent`，流结束时调用 `onDone`。
 *
 * 返回 AbortController，调用方可用它取消仍在进行中的流式请求。
 */
export function openAgentStream(
  url: string,
  body: unknown,
  token: string | null,
  onEvent: (event: AgentStreamEvent) => void,
  onDone?: () => void,
  onError?: (err: Error) => void,
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw await responseError(res);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const consumeFrame = (frame: string) => {
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data) return;
        const parsed: unknown = JSON.parse(data);
        if (!isAgentStreamEvent(parsed)) {
          throw new Error("收到无法识别的 Agent SSE 事件");
        }
        onEvent(parsed);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let match = /\r?\n\r?\n/.exec(buffer);
        while (match) {
          const rawEvent = buffer.slice(0, match.index);
          buffer = buffer.slice(match.index + match[0].length);
          consumeFrame(rawEvent);
          match = /\r?\n\r?\n/.exec(buffer);
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) consumeFrame(buffer);
      onDone?.();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return controller;
}
