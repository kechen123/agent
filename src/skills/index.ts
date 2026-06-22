import { registerSkill } from "./registry";
import { frontendSkill } from "./frontend.skill";

/** 注册内置 skills。启动时调用一次。 */
export function registerBuiltinSkills(): void {
  registerSkill(frontendSkill, "builtin");
}

export {
  registerSkill,
  getSkillByName,
  listSkills,
  listAllSkills,
  listSkillSummaries,
  skillCatalogText,
} from "./registry";
export { loadProjectSkills, loadProjectSkillsFromDirectory } from "./project-loader";
export { skillPromptForState, withSkillPrompt } from "./prompt";
export { frontendSkill } from "./frontend.skill";
