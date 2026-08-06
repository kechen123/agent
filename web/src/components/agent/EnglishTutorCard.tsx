import { useState } from "react";
import type {
  EnglishBetterExpression,
  EnglishCorrection,
  EnglishNextPractice,
  EnglishPhrase,
  EnglishPronunciationTip,
  EnglishTutorResponse,
  EnglishWordByWordItem,
} from "../../types/english-tutor";
import { isTtsSupported, speak, stopSpeaking } from "../../services/englishTts";

interface EnglishTutorCardProps {
  data: EnglishTutorResponse;
}

const MODE_LABEL: Record<EnglishTutorResponse["mode"], string> = {
  chinese_to_english: "中文 → 英文",
  english_chat: "英文聊天",
  correction: "纠错",
  explain_phrase: "短语 / 单词",
  pronunciation: "发音",
  mixed: "综合",
};

export function EnglishTutorCard({ data }: EnglishTutorCardProps) {
  const ttsReady = isTtsSupported();

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm">
      {/* 顶部:模式徽章 + 整句播放 */}
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-emerald-600/90 px-2.5 py-0.5 text-xs font-medium text-white">
          English · {MODE_LABEL[data.mode] ?? data.mode}
        </span>
        {ttsReady ? (
          <SentencePlayButton text={data.pronunciation.text || data.replyEn} />
        ) : null}
      </div>

      {/* 逐词可点击发音 + 中文对照 */}
      <WordByWordLine items={data.wordByWord} />

      {/* 中文解释 */}
      <p className="mt-3 text-[15px] leading-7 text-neutral-700">{data.replyZh}</p>

      {/* 发音提示 */}
      <PronunciationSection data={data.pronunciation} />

      {/* 纠错 */}
      {data.correction ? <CorrectionSection data={data.correction} /> : null}

      {/* 关键词短语 */}
      {data.phrases.length > 0 ? <PhrasesSection items={data.phrases} /> : null}

      {/* 更地道表达 */}
      {data.betterExpressions.length > 0 ? (
        <BetterExpressionsSection items={data.betterExpressions} />
      ) : null}

      {/* 下一句练习 */}
      <NextPracticeSection data={data.nextPractice} />
    </div>
  );
}

// ─── 子组件 ──────────────────────────────────────────────────────────────────

function SentencePlayButton({ text }: { text: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
      onClick={() => {
        if (playing) {
          stopSpeaking();
          setPlaying(false);
          return;
        }
        setPlaying(true);
        speak(text, { rate: 0.95 });
        // 没有 onend 事件可以精确收尾,简单用超时兜底
        window.setTimeout(() => setPlaying(false), Math.max(2000, text.length * 80));
      }}
    >
      <span aria-hidden>{playing ? "■" : "▶"}</span>
      {playing ? "停止" : "整句播放"}
    </button>
  );
}

function WordByWordLine({ items }: { items: EnglishWordByWordItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-end gap-x-1 gap-y-2">
        {items.map((item, index) => (
          <WordChip key={`${item.en}-${index}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function WordChip({ item }: { item: EnglishWordByWordItem }) {
  const isPunctuation = item.zh === "" || /^[\s\p{P}]+$/u.test(item.en);
  if (isPunctuation) {
    return (
      <span className="px-0.5 text-xl leading-7 text-neutral-700">{item.en}</span>
    );
  }
  return (
    <button
      type="button"
      title={item.ipa ? `${item.ipa} · ${item.zh}` : item.zh}
      className="group inline-flex flex-col items-center rounded-lg px-1.5 py-1 transition hover:bg-emerald-100/70"
      onClick={() => speak(item.en)}
    >
      <span className="text-xl font-medium leading-7 text-neutral-900 underline-offset-4 group-hover:underline">
        {item.en}
      </span>
      <span className="text-xs leading-4 text-neutral-500">{item.zh}</span>
    </button>
  );
}

function PronunciationSection({ data }: { data: EnglishPronunciationTip }) {
  if (!data.tips || data.tips.length === 0) return null;
  return (
    <section className="mt-3 rounded-xl bg-white/70 p-3">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
        发音提示
      </h4>
      <ul className="space-y-1 text-sm leading-6 text-neutral-700">
        {data.tips.map((tip, index) => (
          <li key={index} className="flex gap-2">
            <span className="text-emerald-500">•</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CorrectionSection({ data }: { data: EnglishCorrection }) {
  return (
    <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
        纠错
      </h4>
      <p className="text-sm leading-6 text-amber-900">
        <span className="font-mono text-[13px]">{data.original}</span>
        <span className="mx-2 text-amber-500">→</span>
        <span className="font-mono text-[13px] font-semibold">{data.corrected}</span>
      </p>
      <p className="mt-1 text-sm leading-6 text-neutral-700">{data.reasonZh}</p>
    </section>
  );
}

function PhrasesSection({ items }: { items: EnglishPhrase[] }) {
  return (
    <section className="mt-3 rounded-xl bg-white/70 p-3">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
        关键词 / 短语
      </h4>
      <ul className="space-y-2 text-sm leading-6 text-neutral-700">
        {items.map((phrase, index) => (
          <li key={index} className="flex flex-col gap-0.5">
            <span className="flex items-baseline gap-2">
              <button
                type="button"
                className="font-mono text-[14px] font-semibold text-emerald-700 underline-offset-4 hover:underline"
                onClick={() => speak(phrase.text)}
              >
                {phrase.text}
              </button>
              <span className="text-neutral-500">· {phrase.meaningZh}</span>
            </span>
            <span className="text-neutral-600">
              <span className="font-mono text-[13px]">{phrase.exampleEn}</span>
              <span className="ml-2 text-neutral-500">{phrase.exampleZh}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BetterExpressionsSection({ items }: { items: EnglishBetterExpression[] }) {
  return (
    <section className="mt-3 rounded-xl bg-white/70 p-3">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
        更地道表达
      </h4>
      <ul className="space-y-2 text-sm leading-6 text-neutral-700">
        {items.map((item, index) => (
          <li key={index} className="flex flex-col gap-0.5">
            <span className="flex items-baseline gap-2">
              <button
                type="button"
                className="font-mono text-[14px] font-semibold text-emerald-700 underline-offset-4 hover:underline"
                onClick={() => speak(item.text)}
              >
                {item.text}
              </button>
              <span className="text-neutral-500">· {item.meaningZh}</span>
            </span>
            <span className="text-neutral-600">{item.usageZh}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NextPracticeSection({ data }: { data: EnglishNextPractice }) {
  return (
    <section className="mt-3 rounded-xl border border-sky-200 bg-sky-50/70 p-3">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
        下一句练习
      </h4>
      <p className="text-sm leading-6 text-sky-900">
        <button
          type="button"
          className="font-mono text-[14px] font-semibold underline-offset-4 hover:underline"
          onClick={() => speak(data.questionEn)}
        >
          {data.questionEn}
        </button>
      </p>
      <p className="mt-1 text-sm leading-6 text-neutral-600">{data.questionZh}</p>
    </section>
  );
}
