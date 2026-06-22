export type SkillSource = "builtin" | "project";

export interface SkillSummary {
  name: string;
  description: string;
  source: SkillSource;
  enabled: boolean;
}

export interface SkillsResponse {
  skills: SkillSummary[];
}
