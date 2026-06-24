import { Command } from "@langchain/langgraph";
import type { StateSnapshot } from "@langchain/langgraph";
import { graph } from "./graph";
import { getThreadConfig } from "./memory";
import { getThreadUser, withActiveToolUser } from "./user-context";
import type { HitlDecision, Plan } from "../types/agent";

/** 如果线程暂停在 HITL interrupt 中，则返回 true。 */
export function isWaitingForConfirm(snapshot: StateSnapshot): boolean {
  if (!snapshot.next || snapshot.next.length === 0) return false;
  return (snapshot.tasks ?? []).some((t) => (t.interrupts ?? []).length > 0);
}

/** 如果正在等待确认，则提取 planner interrupt 暴露出的计划。 */
export function getInterruptPlan(snapshot: StateSnapshot): Plan | null {
  for (const task of snapshot.tasks ?? []) {
    for (const intr of task.interrupts ?? []) {
      if (intr.value && typeof intr.value === "object" && "steps" in intr.value) {
        return intr.value as Plan;
      }
    }
  }
  return null;
}

export async function getSnapshot(threadId: string): Promise<StateSnapshot> {
  return graph.getState(getThreadConfig(threadId));
}

/**
 * 使用用户的 HITL 决策恢复暂停中的线程。
 * 返回图事件流，由调用方（stream adapter）消费。
 */
export async function* resumeStream(threadId: string, decision: HitlDecision, signal?: AbortSignal) {
  const userId = getThreadUser(threadId);
  const events = graph.streamEvents(new Command({ resume: decision }), {
    ...getThreadConfig(threadId, userId),
    version: "v2",
    signal,
  });

  const scopedEvents = userId ? withActiveToolUser(userId, events) : events;
  for await (const event of scopedEvents) {
    yield event;
  }
}

export { Command };
