import { getSkillByName } from "./registry";
import type { AgentRuntimeState } from "../runtime/state";

export function skillPromptForState(state: AgentRuntimeState): string {
  if (!state.skillName) return "";
  return getSkillByName(state.skillName)?.systemPrompt ?? "";
}

export function withSkillPrompt(basePrompt: string, skillPrompt: string): string {
  const trimmed = skillPrompt.trim();
  return trimmed ? `${basePrompt}\n\n# 领域 Skill 提示\n${trimmed}` : basePrompt;
}
