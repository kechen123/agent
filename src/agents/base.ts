import type { AgentRuntimeState } from "../runtime/state";

/**
 * Shared shape every agent implements. The `invoke` function is the LangGraph
 * node body and must return only the state fields it changed.
 *
 * `systemPrompt` is a field (not inlined) so skills can append to it before
 * building the chain.
 */
export interface AgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  invoke: (state: AgentRuntimeState) => Promise<Partial<AgentRuntimeState>>;
}

/** Map of registered agents, keyed by node name. */
export interface AgentRegistry {
  [nodeName: string]: (state: AgentRuntimeState) => Promise<Partial<AgentRuntimeState>>;
}
