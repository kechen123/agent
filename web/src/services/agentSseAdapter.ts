import type { AgentStreamEvent } from "../types/agent-ui";

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
  onEvent: (event: AgentStreamEvent) => void,
  onDone?: () => void,
  onError?: (err: Error) => void,
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`SSE 请求失败：${res.status} ${res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE 事件之间用空行分隔；单个事件可能包含多行 data。
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          for (const line of rawEvent.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              onEvent(JSON.parse(payload) as AgentStreamEvent);
            } catch {
              // 忽略格式不合法的 SSE data 行。
            }
          }
        }
      }
      onDone?.();
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      onError?.(err as Error);
    }
  })();

  return controller;
}
