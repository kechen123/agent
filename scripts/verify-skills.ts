import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  frontendSkill,
  listAllSkills,
  listSkillSummaries,
  registerBuiltinSkills,
} from "../src/skills/index";
import { loadProjectSkillsFromDirectory } from "../src/skills/project-loader";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeSkill(root: string, dirname: string, content: string): void {
  const dir = path.join(root, dirname);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), content, "utf8");
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent4-skills-"));
const skillsRoot = path.join(tempRoot, "skills");
fs.mkdirSync(skillsRoot, { recursive: true });

try {
  registerBuiltinSkills();

  writeSkill(
    skillsRoot,
    "frontend-design",
    `---
name: frontend-design
description: |
  Create production-grade frontend interfaces
  with strong visual craft.
---

# Frontend Design

Use the project frontend conventions.
`,
  );

  writeSkill(
    skillsRoot,
    "broken",
    `---
name: broken
---

Missing description should not block other skills.
`,
  );

  writeSkill(
    skillsRoot,
    frontendSkill.name,
    `---
name: ${frontendSkill.name}
description: Project override for builtin frontend skill
---

# Project Frontend

This project-level skill overrides the builtin frontend skill.
`,
  );

  loadProjectSkillsFromDirectory(skillsRoot);

  const allSkills = listAllSkills();
  const summaries = listSkillSummaries();
  const frontendDesignSkill = allSkills.find((skill) => skill.name === "frontend-design");
  const frontendDesign = summaries.find((skill) => skill.name === "frontend-design");
  const broken = summaries.find((skill) => skill.name === "broken");
  const frontend = summaries.find((skill) => skill.name === frontendSkill.name);
  const enabledNames = summaries.filter((skill) => skill.enabled).map((skill) => skill.name);

  assert(frontendDesign, "expected frontend-design project skill to load");
  assert(frontendDesign.description.includes("production-grade frontend interfaces"), "expected multiline YAML description to parse");
  assert(frontendDesign.source === "project", "expected frontend-design source to be project");
  assert(
    frontendDesignSkill?.systemPrompt.includes("Use the project frontend conventions."),
    "expected Markdown body to become systemPrompt",
  );
  assert(!broken, "expected broken skill not to be registered");
  assert(frontend?.source === "project", "expected project skill to override same-name builtin skill");
  if (process.env.ENABLED_SKILLS) {
    assert(
      enabledNames.every((name) => process.env.ENABLED_SKILLS?.split(",").map((item) => item.trim()).includes(name)),
      "expected enabled skill names to follow ENABLED_SKILLS whitelist",
    );
  }

  const userSkillPath = "C:\\Users\\Administrator\\.claude\\skills";
  assert(!skillsRoot.startsWith(userSkillPath), "verification must not use user .claude skills path");

  console.log("Skill loading verification passed.");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
