import { registerSkill } from "../registry";
import { englishSkill } from "./skill";

export function registerEnglishSkill(): void {
  registerSkill(englishSkill, "builtin");
}

export { englishSkill } from "./skill";
export { englishMemoryStore, EnglishLearnerMemoryStore } from "./memory";
export { classifyEnglishInput, chineseCharRatio } from "./router";
export { extractEnglishJson, safeStringifyEnglish } from "./format";
export { runEnglishTutor } from "./service";
export {
  EmptyEnglishLearnerMemory,
  EnglishTutorResponseSchema,
  type EnglishInputType,
  type EnglishLearnerMemory,
  type EnglishTutorResponse,
  type EnglishTutorHistoryItem,
} from "./types";
export { buildEnglishSystemPrompt } from "./prompts";
export { englishFewShotExamples } from "./examples";
