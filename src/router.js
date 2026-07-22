const intentRules = [
  {
    id: "summarize-and-organize",
    label: "요약과 핵심 정리",
    keywords: ["요약", "요약해줘", "핵심만", "줄여줘", "간단히", "정리해줘", "요약문"],
    searchTerms: ["summarization skill", "document summary prompt", "key point extraction agent"]
  },
  {
    id: "document-requirement-extraction",
    label: "문서 읽기와 핵심 조건 정리",
    keywords: ["공모전", "안내문", "조건", "제출물", "문서", "핵심", "요약", "정리"],
    searchTerms: ["document summarization skill", "requirement extraction agent", "checklist generation prompt"]
  },
  {
    id: "comment-moderation",
    label: "댓글 분석과 악성 댓글 분류",
    keywords: ["유튜브 댓글", "youtube comment", "댓글", "악성 댓글", "욕설", "혐오", "moderation"],
    searchTerms: ["youtube comment moderation", "toxicity detection", "comment classification agent"]
  },
  {
    id: "automate-workflow",
    label: "반복 작업 자동화",
    keywords: ["자동", "자동화", "저장", "연결", "notion", "노션", "구글시트", "구글 시트", "파일", "생성"],
    searchTerms: ["automation workflow skill", "mcp workflow automation", "ai agent automation skill"]
  },
  {
    id: "research-and-validate",
    label: "아이디어 발굴과 검증",
    keywords: ["아이디어", "검증", "공모", "해커톤", "사업", "창업", "필요할까", "대체", "시장"],
    searchTerms: ["ideation skill", "startup validation skill", "market validation agent"]
  },
  {
    id: "write-and-create",
    label: "글쓰기와 결과물 생성",
    keywords: ["문구", "글", "작성", "홍보", "발표", "ppt", "대본", "보고서", "초안"],
    searchTerms: ["copywriting skill", "writing assistant skill", "presentation generator agent"]
  },
  {
    id: "analyze-and-classify",
    label: "분석과 분류",
    keywords: ["분석", "분류", "데이터", "비교", "평가"],
    searchTerms: ["classification agent", "data analysis agent", "analysis workflow skill"]
  },
  {
    id: "learn-and-explain",
    label: "학습과 설명",
    keywords: ["배우", "설명", "이해", "공부", "개념", "쉽게", "알려줘"],
    searchTerms: ["teaching assistant skill", "plain language skill", "learning tutor agent"]
  }
];

export async function routeInput(input, llm) {
  const split = await splitInputIntent(input, llm);
  const routingText = split.instruction || input;
  const fallback = fallbackRoute(routingText, split);
  const classified = await llm.classify?.(routingText, fallback);
  return normalizeRoute(classified || fallback, fallback, split);
}

export async function splitInputIntent(input, llm) {
  const fallback = fallbackSplit(input);
  const split = await llm.splitIntent?.(input, fallback).catch(() => null);
  return normalizeSplit(split || fallback, fallback);
}

export function fallbackRoute(input, split = fallbackSplit(input)) {
  const text = input.toLowerCase();
  const forced = forceActionFromInstruction(split.instruction || input);
  if (forced) {
    return {
      intent: split.instruction || summarizeIntent(input),
      intentId: forced.id,
      intentLabel: forced.label,
      detectedNeeds: [forced.label],
      searchTerms: forced.searchTerms,
      confidence: 0.92,
      model: "fallback-router",
      split
    };
  }

  const matched = intentRules
    .map((rule) => ({ ...rule, score: scoreRule(rule, text) }))
    .filter((rule) => rule.score > 0)
    .sort((a, b) => b.score - a.score);

  const primary = matched[0] || intentRules[0];
  const secondary = matched.slice(1, 3);

  return {
    intent: summarizeIntent(input),
    intentId: primary.id,
    intentLabel: primary.label,
    detectedNeeds: [primary, ...secondary].map((rule) => rule.label),
    searchTerms: unique([primary, ...secondary].flatMap((rule) => rule.searchTerms)),
    confidence: matched.length > 0 ? Math.min(0.9, 0.58 + primary.score * 0.08) : 0.45,
    model: "fallback-router",
    split
  };
}

function scoreRule(rule, text) {
  const keywordScore = rule.keywords.reduce((sum, keyword) => {
    return sum + (text.includes(keyword.toLowerCase()) ? 1 : 0);
  }, 0);
  if (rule.id === "comment-moderation" && (text.includes("댓글") || text.includes("comment"))) {
    return keywordScore + 5;
  }
  if (rule.id === "document-requirement-extraction" && (text.includes("공모전") || text.includes("안내문") || text.includes("제출물"))) {
    return keywordScore + 5;
  }
  return keywordScore;
}

function normalizeRoute(route, fallback, split = fallback.split) {
  return {
    intent: route.intent || fallback.intent,
    intentId: route.intentId || fallback.intentId,
    intentLabel: route.intentLabel || fallback.intentLabel,
    detectedNeeds: nonEmptyArray(route.detectedNeeds, fallback.detectedNeeds),
    searchTerms: nonEmptyArray(route.searchTerms, fallback.searchTerms),
    confidence: typeof route.confidence === "number" ? route.confidence : fallback.confidence,
    model: route.model || fallback.model,
    split
  };
}

function nonEmptyArray(value, fallback) {
  return Array.isArray(value) && value.length ? unique(value.map(String)) : fallback;
}

function unique(values) {
  return [...new Set(values)];
}

function summarizeIntent(input) {
  const compact = input.replace(/\s+/g, " ").trim();
  if (compact.length <= 100) return compact;
  return `${compact.slice(0, 97)}...`;
}

function fallbackSplit(input) {
  const compact = input.replace(/\s+/g, " ").trim();
  const instruction = extractLastInstruction(input);
  const compactInstruction = instruction.replace(/\s+/g, " ").trim();
  const material = compactInstruction && compact.endsWith(compactInstruction)
    ? compact.slice(0, -compactInstruction.length).trim()
    : "";
  return {
    material,
    instruction: compactInstruction || compact,
    outputType: inferOutputType(compactInstruction || compact),
    ignoreAsIntent: material ? collectIgnoreWords(material) : [],
    model: "fallback-splitter"
  };
}

function normalizeSplit(split, fallback) {
  return {
    material: typeof split.material === "string" ? split.material.trim() : fallback.material,
    instruction: typeof split.instruction === "string" && split.instruction.trim() ? split.instruction.trim() : fallback.instruction,
    outputType: typeof split.outputType === "string" ? split.outputType.trim() : fallback.outputType,
    ignoreAsIntent: Array.isArray(split.ignoreAsIntent) ? split.ignoreAsIntent.map(String) : fallback.ignoreAsIntent,
    model: split.model || fallback.model
  };
}

function extractLastInstruction(input) {
  const trimmed = input.trim();
  const tail = trimmed.slice(-700);
  const patterns = [
    /(?:이거|이 글|위 글|위 내용|위 자료)?\s*(요약해줘|요약해 줘|요약|핵심만 정리해줘|핵심만 정리|정리해줘|정리해 줘)\s*[.!?。]*$/i,
    /(?:이거|이 글|위 글|위 내용|위 자료)?\s*(발표문 만들어줘|대본 만들어줘|초안 작성해줘|평가해줘|분석해줘)\s*[.!?。]*$/i
  ];
  for (const pattern of patterns) {
    const match = tail.match(pattern);
    if (match) return match[0].trim();
  }

  const lines = trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const last = lines.at(-1) || "";
  if (last.length <= 120 && /(해줘|해 줘|정리|요약|분석|평가|만들어|작성)/.test(last)) return last;
  return "";
}

function forceActionFromInstruction(instruction) {
  const text = instruction.toLowerCase();
  if (["요약", "핵심만", "줄여", "간단히"].some((word) => text.includes(word))) {
    return intentRules.find((rule) => rule.id === "summarize-and-organize");
  }
  return null;
}

function inferOutputType(instruction) {
  const text = instruction.toLowerCase();
  if (text.includes("요약")) return "요약문";
  if (text.includes("대본")) return "대본";
  if (text.includes("발표")) return "발표문";
  if (text.includes("평가")) return "평가";
  if (text.includes("분석")) return "분석";
  return "결과물";
}

function collectIgnoreWords(material) {
  const lower = material.toLowerCase();
  return ["mcp", "server", "서버", "자동화", "rag", "mqtt", "mobius"].filter((word) => lower.includes(word));
}
