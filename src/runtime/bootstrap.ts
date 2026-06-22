import { registerBuiltinTools } from "../tools";
import { registerBuiltinSkills, loadProjectSkills } from "../skills";

let bootstrapped = false;

/** 启动时显式注册工具、内置 Skill 和项目级 Skill。 */
export function bootstrapRuntime(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  registerBuiltinTools();
  registerBuiltinSkills();
  loadProjectSkills();
}
