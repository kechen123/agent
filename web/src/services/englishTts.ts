// 浏览器内置 speechSynthesis 封装。
// 后续要接 Google / Azure TTS 时,只需替换 speak / cancel 内部实现即可。

const SUPPORTED =
  typeof window !== "undefined" &&
  typeof window.speechSynthesis !== "undefined" &&
  typeof window.SpeechSynthesisUtterance !== "undefined";

/** 默认英语口音;失败时浏览器会自动回退。 */
const DEFAULT_LANG = "en-US";

/** 队列:浏览器同一时刻只播一个 utterance,串行调用即可。 */
let queue: Array<{ text: string; lang?: string; rate?: number }> = [];
let playing = false;

function flush(): void {
  if (playing) return;
  const next = queue.shift();
  if (!next) return;
  playing = true;
  const utter = new SpeechSynthesisUtterance(next.text);
  utter.lang = next.lang ?? DEFAULT_LANG;
  if (next.rate) utter.rate = next.rate;
  utter.onend = () => {
    playing = false;
    flush();
  };
  utter.onerror = () => {
    playing = false;
    flush();
  };
  window.speechSynthesis.speak(utter);
}

export function speak(text: string, options: { lang?: string; rate?: number } = {}): void {
  if (!SUPPORTED) return;
  const trimmed = text.trim();
  if (!trimmed) return;
  queue.push({ text: trimmed, lang: options.lang, rate: options.rate });
  flush();
}

export function stopSpeaking(): void {
  if (!SUPPORTED) return;
  queue = [];
  window.speechSynthesis.cancel();
  playing = false;
}

export function isTtsSupported(): boolean {
  return SUPPORTED;
}
