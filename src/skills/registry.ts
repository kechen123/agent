import { config } from "../config";
import type { RegisteredSkill, Skill, SkillSource, SkillSummary } from "../types/agent";

const registry = new Map<string, RegisteredSkill>();

function catalogDescription(description: string): string {
  return description.replace(/\s+/g, " ").trim();
}

function isEnabled(name: string): boolean {
  const enabled = config.enabledSkills;
  return enabled.length === 0 || enabled.includes(name);
}

/** 注册一个 skill。同名 skill 会被覆盖。 */
export function registerSkill(skill: Skill, source: SkillSource = "builtin"): void {
  const previous = registry.get(skill.name);
  if (previous && previous.source !== source) {
    console.log(
      `[Skills] ${source} skill "${skill.name}" overrides ${previous.source} skill`,
    );
  }
  registry.set(skill.name, { ...skill, source });
}

export function getSkillByName(name: string): RegisteredSkill | undefined {
  const skill = registry.get(name);
  if (!skill || !isEnabled(skill.name)) return undefined;
  return skill;
}

export function listSkills(): RegisteredSkill[] {
  return Array.from(registry.values()).filter((skill) => isEnabled(skill.name));
}

export function listAllSkills(): RegisteredSkill[] {
  return Array.from(registry.values());
}

export function listSkillSummaries(): SkillSummary[] {
  return listAllSkills()
    .map((skill) => ({
      name: skill.name,
      description: skill.description,
      source: skill.source,
      enabled: isEnabled(skill.name),
    }))
    .sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/** 以简洁目录形式返回 skill 列表，供 router 提示词使用。 */
export function skillCatalogText(): string {
  const skills = listSkills();
  if (skills.length === 0) return "（暂无可用 skill）";
  return JSON.stringify(
    skills.map((skill) => ({
      name: skill.name,
      description: catalogDescription(skill.description),
    })),
    null,
    2,
  );
}
