import type { Skill } from "../types/agent";

export const frontendSkill: Skill = {
  name: "frontend",
  description: "前端开发相关任务：React/TypeScript/TailwindCSS 的实现、调试、代码审查建议",
  systemPrompt:
    "你擅长前端工程。在回答时优先考虑 React + TypeScript + TailwindCSS 技术栈，" +
    "关注组件复用、类型安全、可访问性与性能。给出的代码应是可直接落地的最小实现。",
  tools: [],
};
