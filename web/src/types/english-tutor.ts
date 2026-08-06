// 前端镜像 src/skills/english/types.ts
// 保持字段名与后端一致,这样 message content 里的 JSON 解析后能直接用于渲染。

export type EnglishInputType =
  | "chinese_to_english"
  | "english_chat"
  | "correction"
  | "explain_phrase"
  | "pronunciation"
  | "mixed";

export interface EnglishWordByWordItem {
  en: string;
  zh: string;
  ipa?: string;
}

export interface EnglishPronunciationTip {
  text: string;
  tips: string[];
}

export interface EnglishCorrection {
  original: string;
  corrected: string;
  reasonZh: string;
}

export interface EnglishPhrase {
  text: string;
  meaningZh: string;
  exampleEn: string;
  exampleZh: string;
}

export interface EnglishBetterExpression {
  text: string;
  meaningZh: string;
  usageZh: string;
}

export interface EnglishNextPractice {
  questionEn: string;
  questionZh: string;
}

export interface EnglishTutorResponse {
  mode: EnglishInputType;
  replyEn: string;
  replyZh: string;
  pronunciation: EnglishPronunciationTip;
  correction?: EnglishCorrection;
  phrases: EnglishPhrase[];
  betterExpressions: EnglishBetterExpression[];
  nextPractice: EnglishNextPractice;
  wordByWord: EnglishWordByWordItem[];
}
