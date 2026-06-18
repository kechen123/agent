import { registerSkill } from "./registry";
import { frontendSkill } from "./frontend.skill";

/** Register built-in skills. Call once at startup. */
export function registerBuiltinSkills(): void {
  registerSkill(frontendSkill);
}

export { registerSkill, getSkillByName, listSkills, skillCatalogText } from "./registry";
export { frontendSkill } from "./frontend.skill";
