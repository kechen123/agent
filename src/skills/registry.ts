import { config } from "../config";
import type { Skill } from "../types/agent";

const registry = new Map<string, Skill>();

/** Register a skill. Overwrites an existing skill with the same name. */
export function registerSkill(skill: Skill): void {
  registry.set(skill.name, skill);
}

export function getSkillByName(name: string): Skill | undefined {
  return registry.get(name);
}

export function listSkills(): Skill[] {
  const all = Array.from(registry.values());
  const enabled = config.enabledSkills;
  if (enabled.length === 0) return all;
  return all.filter((s) => enabled.includes(s.name));
}

/** Returns the list of skills as a concise catalog for the router prompt. */
export function skillCatalogText(): string {
  const skills = listSkills();
  if (skills.length === 0) return "（暂无可用 skill）";
  return skills
    .map((s) => `- ${s.name}: ${s.description}`)
    .join("\n");
}
