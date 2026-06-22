import type { SkillsResponse } from "../types/skills";

export async function fetchSkills(signal?: AbortSignal): Promise<SkillsResponse> {
  const res = await fetch("/skills", { signal });
  if (!res.ok) {
    throw new Error(`Skill 列表请求失败：${res.status} ${res.statusText}`);
  }
  return (await res.json()) as SkillsResponse;
}
