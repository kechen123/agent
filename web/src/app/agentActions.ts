import { createContext, useContext } from "react";
import type { HitlAction } from "../types/agent-ui";

export interface AgentActions {
  resume: (action: HitlAction, message?: string) => void;
}

export const AgentActionsContext = createContext<AgentActions | null>(null);

export function useAgentActions(): AgentActions {
  const ctx = useContext(AgentActionsContext);
  if (!ctx) throw new Error("useAgentActions must be used within AgentActionsContext");
  return ctx;
}
