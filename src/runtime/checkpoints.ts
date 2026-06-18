import { Command } from "@langchain/langgraph";
import type { StateSnapshot } from "@langchain/langgraph";
import { graph } from "./graph";
import { getThreadConfig } from "./memory";
import type { HitlDecision, Plan } from "../types/agent";

/** Returns true if the thread is paused inside a HITL interrupt. */
export function isWaitingForConfirm(snapshot: StateSnapshot): boolean {
  if (!snapshot.next || snapshot.next.length === 0) return false;
  return (snapshot.tasks ?? []).some((t) => (t.interrupts ?? []).length > 0);
}

/** Extract the plan surfaced by the planner's interrupt, if waiting. */
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
 * Resume a paused thread with the user's HITL decision.
 * Returns the graph event stream — the caller (stream adapter) consumes it.
 */
export function resumeStream(threadId: string, decision: HitlDecision) {
  return graph.streamEvents(new Command({ resume: decision }), {
    ...getThreadConfig(threadId),
    version: "v2",
  });
}

export { Command };
