import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { registerSkill } from "./registry";
import type { Skill } from "../types/agent";

const PROJECT_ROOT = path.resolve(process.cwd());
const PROJECT_SKILLS_DIR = path.join(PROJECT_ROOT, "skills");
const SKILL_FILE_NAME = "SKILL.md";
const MAX_SKILL_FILE_BYTES = 256 * 1024;
const SAFE_SKILL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const SAFE_TOOL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * tools 是可选 frontmatter 字段。
 *
 * 未声明 tools 与声明 `tools: []` 的含义不同，因此这里保留 undefined。
 */
function parseToolNames(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("frontmatter tools 必须是字符串数组");
  }

  const names = value.map((item) => {
    const name = asNonEmptyString(item);
    if (!name || !SAFE_TOOL_NAME.test(name)) {
      throw new Error(`frontmatter tools 包含非法工具名：${String(item)}`);
    }
    return name;
  });

  return [...new Set(names)];
}

function parseSkillFile(filePath: string): Skill {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new Error("SKILL.md 不是文件");
  }
  if (stat.size > MAX_SKILL_FILE_BYTES) {
    throw new Error(`SKILL.md 超过大小限制 ${MAX_SKILL_FILE_BYTES} bytes`);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);

  const name = asNonEmptyString(parsed.data.name);
  if (!name) throw new Error("frontmatter 缺少 name");
  if (!SAFE_SKILL_NAME.test(name)) {
    throw new Error(`frontmatter name 格式非法：${name}`);
  }

  const description = asNonEmptyString(parsed.data.description);
  if (!description) throw new Error("frontmatter 缺少 description");

  const systemPrompt = parsed.content.trim();
  if (!systemPrompt) throw new Error("SKILL.md 正文为空");

  return {
    name,
    description,
    systemPrompt,
    tools: parseToolNames(parsed.data.tools),
  };
}

export function loadProjectSkillsFromDirectory(projectSkillsDir: string): void {
  if (!fs.existsSync(projectSkillsDir)) {
    console.log(`[Skills] project skills directory not found: ${projectSkillsDir}`);
    return;
  }

  const skillsDir = fs.realpathSync(projectSkillsDir);
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillDir = path.join(skillsDir, entry.name);
    const skillFile = path.join(skillDir, SKILL_FILE_NAME);

    try {
      const realSkillFile = fs.realpathSync(skillFile);
      if (!isInside(skillsDir, realSkillFile)) {
        throw new Error("SKILL.md 路径越过项目 skills 目录");
      }

      const skill = parseSkillFile(realSkillFile);
      registerSkill(skill, "project");
      console.log(`[Skills] loaded project skill: ${skill.name}`);
    } catch (err) {
      console.error(`[Skills] failed to load project skill from ${entry.name}/${SKILL_FILE_NAME}:`, err);
    }
  }
}

export function loadProjectSkills(): void {
  loadProjectSkillsFromDirectory(PROJECT_SKILLS_DIR);
}
