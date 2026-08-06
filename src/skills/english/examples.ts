/**
 * 少量示例，仅用于在 prompt 中示范 JSON 形状。
 * 注意：示例必须用 ```json 代码块包裹，便于 LLM 模仿。
 */
export interface EnglishFewShotExample {
  user: string;
  /** 严格 JSON 字符串，可被 JSON.parse 解析为 EnglishTutorResponse。 */
  assistantJson: string;
}

export const englishFewShotExamples: EnglishFewShotExample[] = [
  {
    user: "我想说『今天真的很累』，英文怎么说？",
    assistantJson: JSON.stringify(
      {
        mode: "chinese_to_english",
        replyEn: "I'm really worn out today.",
        replyZh: "今天我真的累坏了。",
        pronunciation: {
          text: "I'm really worn out today.",
          tips: [
            "worn out /wɔːrn aʊt/，重音落在 worn 上",
            "out 里的 /aʊ/ 是 '啊呜' 的双元音",
          ],
        },
        correction: undefined,
        phrases: [
          {
            text: "worn out",
            meaningZh: "筋疲力尽的，比 tired 更口语化",
            exampleEn: "After the marathon I was completely worn out.",
            exampleZh: "跑完马拉松后我完全累垮了。",
          },
        ],
        betterExpressions: [
          {
            text: "I'm completely drained today.",
            meaningZh: "今天我整个人被掏空了",
            usageZh: "比 worn out 更夸张，适合加班后吐槽",
          },
          {
            text: "Today really took it out of me.",
            meaningZh: "今天真把我累坏了",
            usageZh: "更委婉、更书面的说法",
          },
        ],
        nextPractice: {
          questionEn:
            "Try this: 'I've been swamped with work today.' Can you guess what 'swamped' means?",
          questionZh:
            "试着理解这句话，再造一个今天很累但理由不同的英文句子。",
        },
        wordByWord: [
          { en: "I'm", zh: "我是", ipa: "aɪm" },
          { en: "really", zh: "真的", ipa: "ˈrɪli" },
          { en: "worn out", zh: "筋疲力尽", ipa: "wɔːrn aʊt" },
          { en: "today", zh: "今天", ipa: "təˈdeɪ" },
          { en: ".", zh: "", ipa: undefined },
        ],
      },
      null,
      2,
    ),
  },
  {
    user: "I go to park yesterday with my friend.",
    assistantJson: JSON.stringify(
      {
        mode: "correction",
        replyEn: "I went to the park yesterday with my friend.",
        replyZh: "昨天我和朋友一起去了公园。",
        pronunciation: {
          text: "I went to the park yesterday with my friend.",
          tips: [
            "went /went/ 是 go 的过去式，元音 /ɛ/",
            "park 的 /p/ 要送气，/k/ 不送气",
          ],
        },
        correction: {
          original: "I go to park yesterday with my friend.",
          corrected: "I went to the park yesterday with my friend.",
          reasonZh:
            "三个问题：① yesterday 是过去时间，go 必须改成 went；② park 是单数可数名词，前面要加 the 或 a；③ go / went 等不规则动词的过去式需要专门记忆。",
        },
        phrases: [
          {
            text: "go to the park",
            meaningZh: "去公园",
            exampleEn: "We go to the park every weekend.",
            exampleZh: "我们每个周末都去公园。",
          },
        ],
        betterExpressions: [
          {
            text: "My friend and I hit the park yesterday.",
            meaningZh: "我朋友和我昨天去了公园",
            usageZh: "更口语化，hit the + 地点 = 顺路去玩",
          },
        ],
        nextPractice: {
          questionEn:
            "Now try past tense with another verb: 'I ____ (eat) sushi last night.'",
          questionZh: "把 eat 改成正确的过去式，再用它造一个完整句子。",
        },
        wordByWord: [
          { en: "I", zh: "我", ipa: "aɪ" },
          { en: "went", zh: "去了（go 的过去式）", ipa: "went" },
          { en: "to", zh: "到", ipa: "tuː" },
          { en: "the", zh: "（定冠词）", ipa: "ðə" },
          { en: "park", zh: "公园", ipa: "pɑːrk" },
          { en: "yesterday", zh: "昨天", ipa: "ˈjestərdeɪ" },
          { en: "with", zh: "和", ipa: "wɪð" },
          { en: "my", zh: "我的", ipa: "maɪ" },
          { en: "friend", zh: "朋友", ipa: "frend" },
          { en: ".", zh: "", ipa: undefined },
        ],
      },
      null,
      2,
    ),
  },
  {
    user: "What's the difference between 'make' and 'do'?",
    assistantJson: JSON.stringify(
      {
        mode: "explain_phrase",
        replyEn:
          "'Make' usually means to create or produce something (make a cake, make a decision). 'Do' is more about tasks or activities (do homework, do the dishes).",
        replyZh:
          "make 一般指『制造、生产』某样东西（做蛋糕、做决定）；do 更偏向『完成一项任务或活动』（做作业、做饭）。",
        pronunciation: {
          text: "make a cake / do homework",
          tips: ["make /meɪk/", "do /duː/"],
        },
        correction: undefined,
        phrases: [
          {
            text: "make a decision",
            meaningZh: "做决定",
            exampleEn: "I need to make a decision by Friday.",
            exampleZh: "我得在周五前做出决定。",
          },
          {
            text: "do the dishes",
            meaningZh: "洗碗",
            exampleEn: "Could you do the dishes tonight?",
            exampleZh: "今晚你能洗碗吗？",
          },
        ],
        betterExpressions: [
          {
            text: "make + 具体产物 (make a video, make progress)",
            meaningZh: "产出某个具体东西",
            usageZh: "能摸到、看到、量化的结果用 make",
          },
          {
            text: "do + 抽象活动 (do exercise, do research)",
            meaningZh: "做一项活动 / 任务",
            usageZh: "动作本身是目的，看不到最终产物",
          },
        ],
        nextPractice: {
          questionEn:
            "Fill in the blank: 'I need to ____ (make / do) an appointment with the doctor.'",
          questionZh: "想想看，为什么这里用 make 更自然？",
        },
        wordByWord: [
          { en: "'Make'", zh: "make 制造", ipa: "meɪk" },
          { en: "usually", zh: "通常", ipa: "ˈjuːʒuəli" },
          { en: "means", zh: "意思是", ipa: "miːnz" },
          { en: "to", zh: "去 / 为了", ipa: "tuː" },
          { en: "create", zh: "创造", ipa: "kriˈeɪt" },
          { en: "or", zh: "或者", ipa: "ɔːr" },
          { en: "produce", zh: "生产", ipa: "prəˈduːs" },
          { en: "something", zh: "某样东西", ipa: "ˈsʌmθɪŋ" },
          { en: ".", zh: "", ipa: undefined },
        ],
      },
      null,
      2,
    ),
  },
];
