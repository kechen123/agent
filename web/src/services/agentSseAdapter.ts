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

      const consumeFrame = (frame: string) => {
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data) return;
        onEvent(JSON.parse(data) as AgentStreamEvent);
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
      if ((err as Error).name === "AbortError") return;
      onError?.(err as Error);
    }
  })();

  return controller;
}
