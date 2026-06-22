import { Hono } from "hono";
import { listSkillSummaries } from "../skills";
import { bootstrapRuntime } from "../runtime/bootstrap";

export const skillsRoute = new Hono();

/** GET /skills — 返回安全的 Skill 摘要，不包含 systemPrompt 或本地路径。 */
skillsRoute.get("/skills", (c) => {
  bootstrapRuntime();
  return c.json({ skills: listSkillSummaries() });
});
