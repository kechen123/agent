import { useCallback, useMemo, useRef, useState } from "react";
import { openAgentStream } from "../services/agentSseAdapter";
import type {
  AgentMessageMetadata,
  AgentStreamEvent,
  AgentUIEvent,
  HitlAction,
} from "../types/agent-ui";

interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata: AgentMessageMetadata;
}

interface ThreadState {
  id: string;
  title: string;
  messages: UiMessage[];
}

const EMPTY_META: AgentMessageMetadata = { events: [], toolCalls: [] };

let idCounter = 0;
const nextId = () => `m-${Date.now()}-${idCounter++}`;
const nextEventId = () => `e-${Date.now()}-${idCounter++}`;

function emptyMeta(): AgentMessageMetadata {
  return { events: [], toolCalls: [] };
}

export function useAgentRuntime() {
  const [threads, setThreads] = useState<ThreadState[]>([
    { id: "t-1", title: "新会话", messages: [] },
  ]);
  const [currentThreadId, setCurrentThreadId] = useState<string>("t-1");
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const currentThread = useMemo(
    () => threads.find((t) => t.id === currentThreadId) ?? threads[0],
    [threads, currentThreadId],
  );

  const updateThread = useCallback(
    (threadId: string, updater: (t: ThreadState) => ThreadState) => {
      setThreads((prev) => prev.map((t) => (t.id === threadId ? updater(t) : t)));
    },
    [],
  );

  const patchAssistant = useCallback(
    (threadId: string, assistantId: string, patch: (m: UiMessage) => UiMessage) => {
      updateThread(threadId, (t) => ({
        ...t,
        messages: t.messages.map((m) => (m.id === assistantId ? patch(m) : m)),
      }));
    },
    [updateThread],
  );

  // 将后端标准 SSE 事件折叠到当前 assistant 消息的内容和元数据中。
  const applyEvent = useCallback(
    (threadId: string, assistantId: string, ev: AgentStreamEvent) => {
      patchAssistant(threadId, assistantId, (m) => {
        const meta: AgentMessageMetadata = {
          events: [...m.metadata.events],
          toolCalls: [...m.metadata.toolCalls],
          plan: m.metadata.plan,
          waitingForConfirm: m.metadata.waitingForConfirm,
        };
        let content = m.content;

        switch (ev.type) {
          case "router:start": {
            meta.events.push({
              id: nextEventId(),
              type: ev.type,
              title: "路由分析",
              description: "判断用户意图",
              status: "running",
            });
            break;
          }
          case "router:end": {
            meta.events.push({
              id: nextEventId(),
              type: ev.type,
              title: "路由结果",
              description: `→ ${ev.route}`,
              data: { route: ev.route },
              status: "done",
            });
            markLast(meta.events, "router:start", "done");
            break;
          }
          case "planner:start": {
            meta.events.push({
              id: nextEventId(),
              type: ev.type,
              title: "任务规划",
              description: "拆解执行步骤",
              status: "running",
            });
            break;
          }
          case "planner:end": {
            meta.plan = ev.plan;
            meta.events.push({
              id: nextEventId(),
              type: ev.type,
              title: "计划已生成",
              description: ev.plan.goal,
              data: ev.plan,
              status: "done",
            });
            markLast(meta.events, "planner:start", "done");
            break;
          }
          case "executor:start": {
            meta.events.push({
              id: nextEventId(),
              type: ev.type,
              title: "执行步骤",
              status: "running",
            });
            break;
          }
          case "executor:end": {
            meta.events.push({
              id: nextEventId(),
              type: ev.type,
              title: `执行第 ${ev.step.id} 步`,
              description: ev.step.task,
              data: ev.step,
              status: "done",
            });
            markLast(meta.events, "executor:start", "done");
            break;
          }
          case "tool:start": {
            meta.toolCalls.push({
              id: nextEventId(),
              toolName: ev.toolName,
              input: ev.input,
              status: "running",
            });
            break;
          }
          case "tool:end": {
            const last = meta.toolCalls[meta.toolCalls.length - 1];
            if (last && last.toolName === ev.toolName && last.status === "running") {
              last.output = ev.output;
              last.status = "done";
            }
            break;
          }
          case "message:delta": {
            content += ev.content;
            break;
          }
          case "message:end": {
            content = ev.content || content;
            break;
          }
          case "hitl:waiting": {
            meta.plan = ev.plan;
            meta.waitingForConfirm = true;
            break;
          }
          case "hitl:done": {
            meta.waitingForConfirm = false;
            break;
          }
          case "error": {
            meta.events.push({
              id: nextEventId(),
              type: "error",
              title: "出错了",
              description: ev.message,
              status: "error",
            });
            break;
          }
        }

        return { ...m, content, metadata: meta };
      });
    },
    [patchAssistant],
  );

  const startStream = useCallback(
    (url: string, body: unknown, threadId: string, assistantId: string) => {
      setRunning(true);
      const controller = openAgentStream(
        url,
        body,
        (ev) => applyEvent(threadId, assistantId, ev),
        () => {
          setRunning(false);
          abortRef.current = null;
        },
        (err) => {
          applyEvent(threadId, assistantId, { type: "error", message: err.message });
          setRunning(false);
          abortRef.current = null;
        },
      );
      abortRef.current = controller;
      return controller;
    },
    [applyEvent],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message || running) return;

      const userMsg: UiMessage = {
        id: nextId(),
        role: "user",
        content: message,
        metadata: emptyMeta(),
      };
      const assistantMsg: UiMessage = {
        id: nextId(),
        role: "assistant",
        content: "",
        metadata: emptyMeta(),
      };

      updateThread(currentThreadId, (t) => ({
        ...t,
        title: t.messages.length === 0 ? message.slice(0, 24) : t.title,
        messages: [...t.messages, userMsg, assistantMsg],
      }));

      startStream("/chat", { threadId: currentThreadId, message }, currentThreadId, assistantMsg.id);
    },
    [currentThreadId, running, startStream, updateThread],
  );

  const cancel = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  }, []);

  // 恢复暂停的 HITL 线程：确认 / 修改 / 拒绝。
  const resume = useCallback(
    (action: HitlAction, message?: string) => {
      const thread = threads.find((t) => t.id === currentThreadId);
      if (!thread || running) return;
      const lastAssistant = [...thread.messages].reverse().find((m) => m.role === "assistant");
      if (!lastAssistant) return;

      const body: Record<string, unknown> = { threadId: currentThreadId, action };
      if (action === "modify" && message) body.message = message;

      startStream("/chat/resume", body, currentThreadId, lastAssistant.id);
    },
    [currentThreadId, running, threads, startStream],
  );

  const newThread = useCallback(() => {
    const id = `t-${Date.now()}`;
    setThreads((prev) => [...prev, { id, title: "新会话", messages: [] }]);
    setCurrentThreadId(id);
  }, []);

  return {
    threads,
    currentThread,
    currentThreadId,
    setCurrentThreadId,
    newThread,
    sendMessage,
    resume,
    cancel,
    isRunning: running,
  };
}

function markLast(events: AgentUIEvent[], type: string, status: AgentUIEvent["status"]) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === type) {
      events[i].status = status;
      return;
    }
  }
}

export type { ThreadState, UiMessage };
export { EMPTY_META };
