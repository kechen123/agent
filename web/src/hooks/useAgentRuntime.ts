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

interface ActiveRun {
  controller: AbortController;
  assistantId: string;
}

const EMPTY_META: AgentMessageMetadata = {
  events: [],
  toolCalls: [],
  streamStatus: "completed",
};

let idCounter = 0;
const nextId = () => `m-${Date.now()}-${idCounter++}`;
const nextEventId = () => `e-${Date.now()}-${idCounter++}`;

function emptyMeta(streamStatus: AgentMessageMetadata["streamStatus"] = "completed"): AgentMessageMetadata {
  return { events: [], toolCalls: [], streamStatus };
}

export function useAgentRuntime() {
  const [threads, setThreads] = useState<ThreadState[]>([
    { id: "t-1", title: "新会话", messages: [] },
  ]);
  const [currentThreadId, setCurrentThreadId] = useState<string>("t-1");
  const [runningThreadIds, setRunningThreadIds] = useState<Set<string>>(() => new Set());
  const activeRunsRef = useRef(new Map<string, ActiveRun>());

  const currentThread = useMemo(
    () => threads.find((thread) => thread.id === currentThreadId) ?? threads[0],
    [threads, currentThreadId],
  );

  const updateThread = useCallback(
    (threadId: string, updater: (thread: ThreadState) => ThreadState) => {
      setThreads((previous) =>
        previous.map((thread) => (thread.id === threadId ? updater(thread) : thread)),
      );
    },
    [],
  );

  const patchAssistant = useCallback(
    (threadId: string, assistantId: string, patch: (message: UiMessage) => UiMessage) => {
      updateThread(threadId, (thread) => ({
        ...thread,
        messages: thread.messages.map((message) =>
          message.id === assistantId ? patch(message) : message,
        ),
      }));
    },
    [updateThread],
  );

  const setThreadRunning = useCallback((threadId: string, running: boolean) => {
    setRunningThreadIds((previous) => {
      const next = new Set(previous);
      if (running) next.add(threadId);
      else next.delete(threadId);
      return next;
    });
  }, []);

  const applyEvent = useCallback(
    (threadId: string, assistantId: string, event: AgentStreamEvent) => {
      patchAssistant(threadId, assistantId, (message) => {
        const meta: AgentMessageMetadata = {
          events: [...message.metadata.events],
          toolCalls: message.metadata.toolCalls.map((call) => ({ ...call })),
          plan: message.metadata.plan,
          route: message.metadata.route,
          skillName: message.metadata.skillName,
          currentStep: message.metadata.currentStep,
          retryCount: message.metadata.retryCount,
          reflection: message.metadata.reflection,
          waitingForConfirm: message.metadata.waitingForConfirm,
          streamStatus: message.metadata.streamStatus,
        };
        let content = message.content;

        switch (event.type) {
          case "router:start":
            meta.events.push({
              id: nextEventId(),
              type: event.type,
              title: "理解请求",
              description: "判断最合适的处理方式",
              status: "running",
            });
            break;
          case "router:end":
            markLast(meta.events, "router:start", "done");
            meta.route = event.route;
            meta.skillName = event.skillName;
            break;
          case "planner:start":
            meta.events.push({
              id: nextEventId(),
              type: event.type,
              title: "制定计划",
              description: "拆解为可执行步骤",
              status: "running",
            });
            break;
          case "planner:end":
            meta.plan = event.plan;
            markLast(meta.events, "planner:start", "done");
            meta.events.push({
              id: nextEventId(),
              type: event.type,
              title: "计划已生成",
              description: event.plan.goal,
              data: event.plan,
              status: "done",
            });
            break;
          case "executor:start":
            meta.events.push({
              id: nextEventId(),
              type: event.type,
              title: event.step
                ? `执行第 ${event.step.id} 步`
                : "执行计划",
              description:
                event.attempt > 1 ? `第 ${event.attempt} 次尝试` : event.step?.task,
              status: "running",
            });
            break;
          case "executor:end":
            markLast(meta.events, "executor:start", "done");
            meta.events.push({
              id: nextEventId(),
              type: event.type,
              title: `第 ${event.step.id} 步执行完成`,
              description: event.result || event.step.task,
              data: event,
              status: "done",
            });
            break;
          case "reflection:start":
            meta.events.push({
              id: nextEventId(),
              type: event.type,
              title: "检查执行结果",
              description: "Reflection Agent 正在判断是否通过、重试或重新规划",
              status: "running",
            });
            break;
          case "reflection:end": {
            markLast(meta.events, "reflection:start", "done");
            meta.reflection = event.reflection;
            meta.currentStep = event.currentStep;
            meta.retryCount = event.retryCount;
            const reflectionLabel = {
              pass: "检查通过",
              retry: "需要重试",
              replan: "需要重新规划",
              fail: "无法继续执行",
            }[event.reflection.status];
            meta.events.push({
              id: nextEventId(),
              type: event.type,
              title: reflectionLabel,
              description: `${event.reflection.reason}；${event.reflection.feedback}`,
              data: event.reflection,
              status:
                event.reflection.status === "fail" ? "error" : "done",
            });
            break;
          }
          case "tool:start":
            meta.toolCalls.push({
              id: event.callId,
              toolName: event.toolName,
              input: event.input,
              status: "running",
            });
            break;
          case "tool:end": {
            const call = meta.toolCalls.find((item) => item.id === event.callId);
            if (call) {
              call.output = event.output;
              call.status = "done";
            }
            break;
          }
          case "tool:error": {
            const call = meta.toolCalls.find((item) => item.id === event.callId);
            if (call) {
              call.output = event.error;
              call.status = "error";
            } else {
              meta.toolCalls.push({
                id: event.callId,
                toolName: event.toolName,
                output: event.error,
                status: "error",
              });
            }
            break;
          }
          case "message:delta":
            content += event.content;
            break;
          case "message:end":
            content = event.content || content;
            break;
          case "hitl:waiting":
            meta.plan = event.plan;
            meta.waitingForConfirm = true;
            meta.streamStatus = "waiting";
            break;
          case "hitl:done":
            meta.waitingForConfirm = false;
            meta.streamStatus = "streaming";
            break;
          case "error":
            meta.streamStatus = "error";
            finalizeRunning(meta, "error");
            meta.events.push({
              id: nextEventId(),
              type: "error",
              title: "运行失败",
              description: event.message,
              status: "error",
            });
            break;
          case "stream:end":
            meta.streamStatus = event.status === "waiting" ? "waiting" : event.status;
            finalizeRunning(meta, event.status === "error" ? "error" : "done");
            if (event.status === "cancelled") {
              meta.events.push({
                id: nextEventId(),
                type: event.type,
                title: "已停止生成",
                status: "done",
              });
            }
            break;
        }

        return { ...message, content, metadata: meta };
      });
    },
    [patchAssistant],
  );

  const startStream = useCallback(
    (url: string, body: unknown, threadId: string, assistantId: string) => {
      setThreadRunning(threadId, true);
      let terminalEventReceived = false;
      let controller: AbortController;

      const cleanup = () => {
        const active = activeRunsRef.current.get(threadId);
        if (active?.controller === controller) {
          activeRunsRef.current.delete(threadId);
          setThreadRunning(threadId, false);
        }
      };

      controller = openAgentStream(
        url,
        body,
        (event) => {
          if (event.type === "stream:end") terminalEventReceived = true;
          applyEvent(threadId, assistantId, event);
        },
        () => {
          if (!terminalEventReceived) {
            applyEvent(threadId, assistantId, {
              type: "error",
              message: "连接提前结束，未收到完整的运行结果。",
            });
          }
          cleanup();
        },
        (error) => {
          applyEvent(threadId, assistantId, { type: "error", message: error.message });
          cleanup();
        },
      );

      activeRunsRef.current.set(threadId, { controller, assistantId });
      return controller;
    },
    [applyEvent, setThreadRunning],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message || activeRunsRef.current.has(currentThreadId)) return;

      const userMessage: UiMessage = {
        id: nextId(),
        role: "user",
        content: message,
        metadata: emptyMeta(),
      };
      const assistantMessage: UiMessage = {
        id: nextId(),
        role: "assistant",
        content: "",
        metadata: emptyMeta("streaming"),
      };

      updateThread(currentThreadId, (thread) => ({
        ...thread,
        title: thread.messages.length === 0 ? message.slice(0, 24) : thread.title,
        messages: [...thread.messages, userMessage, assistantMessage],
      }));

      startStream(
        "/chat",
        { threadId: currentThreadId, message },
        currentThreadId,
        assistantMessage.id,
      );
    },
    [currentThreadId, startStream, updateThread],
  );

  const cancel = useCallback(() => {
    const active = activeRunsRef.current.get(currentThreadId);
    if (!active) return;
    applyEvent(currentThreadId, active.assistantId, {
      type: "stream:end",
      status: "cancelled",
    });
    active.controller.abort();
    activeRunsRef.current.delete(currentThreadId);
    setThreadRunning(currentThreadId, false);
  }, [applyEvent, currentThreadId, setThreadRunning]);

  const resume = useCallback(
    (action: HitlAction, message?: string) => {
      const thread = threads.find((item) => item.id === currentThreadId);
      if (!thread || activeRunsRef.current.has(currentThreadId)) return;
      const assistantMessage = [...thread.messages]
        .reverse()
        .find((item) => item.role === "assistant" && item.metadata.waitingForConfirm);
      if (!assistantMessage) return;

      const body: Record<string, unknown> = { threadId: currentThreadId, action };
      if (action === "modify" && message) body.message = message;
      startStream("/chat/resume", body, currentThreadId, assistantMessage.id);
    },
    [currentThreadId, startStream, threads],
  );

  const newThread = useCallback(() => {
    const id = `t-${Date.now()}`;
    setThreads((previous) => [...previous, { id, title: "新会话", messages: [] }]);
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
    isRunning: runningThreadIds.has(currentThreadId),
  };
}

function markLast(events: AgentUIEvent[], type: string, status: AgentUIEvent["status"]) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].type === type && events[index].status === "running") {
      events[index].status = status;
      return;
    }
  }
}

function finalizeRunning(
  meta: AgentMessageMetadata,
  status: AgentUIEvent["status"],
) {
  for (const event of meta.events) {
    if (event.status === "running") event.status = status;
  }
  for (const call of meta.toolCalls) {
    if (call.status === "running") call.status = status;
  }
}

export type { ThreadState, UiMessage };
export { EMPTY_META };
