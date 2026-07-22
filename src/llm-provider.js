export function createLlmProvider(config) {
  if (config.provider === "openai" && config.openaiApiKey) {
    return modelProvider("openai", config.openaiModel, (prompt) => callOpenAi(config, prompt));
  }
  if (config.provider === "gemini" && config.geminiApiKey) {
    return modelProvider("gemini", config.geminiModel, (prompt) => callGemini(config, prompt));
  }
  if (config.provider === "ollama") {
    return modelProvider("ollama", config.ollamaModel, (prompt) => callOllama(config, prompt));
  }
  return fallbackProvider();
}

function fallbackProvider() {
  return {
    name: "fallback",
    async splitIntent(_input, fallback) {
      return fallback;
    },
    async classify(_input, fallback) {
      return fallback;
    },
    async createResult(input, route, usableSkills) {
      return fallbackResult(input, route, usableSkills);
    }
  };
}

// Shared by every LLM-backed provider (openai/gemini/ollama): each only differs in
// which HTTP call and model name it uses, so that's the only thing callers pass in.
function modelProvider(name, model, callModel) {
  return {
    name,
    async splitIntent(input, fallback) {
      try {
        return { ...fallback, ...normalizeSplitIntent(await callModel(splitIntentPrompt(input))), model };
      } catch {
        return fallback;
      }
    },
    async classify(input, fallback) {
      try {
        const json = await callModel(routerPrompt(input, fallback));
        return { ...fallback, ...safeJson(json), model };
      } catch {
        return { ...fallback, model: "fallback-router" };
      }
    },
    async explainSkills(route, candidates) {
      try {
        return normalizeSkillExplanations(await callModel(skillExplanationPrompt(route, candidates)));
      } catch {
        return [];
      }
    },
    async createResult(input, route, usableSkills) {
      try {
        return normalizeResult(await callModel(resultPrompt(input, route, usableSkills))) || fallbackResult(input, route, usableSkills);
      } catch {
        return fallbackResult(input, route, usableSkills);
      }
    }
  };
}

async function callOpenAi(config, prompt) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openaiApiKey}`
    },
    body: JSON.stringify({
      model: config.openaiModel,
      input: prompt
    })
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const data = await response.json();
  return data.output_text || JSON.stringify(data);
}

async function callGemini(config, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });
  if (!response.ok) throw new Error(`Gemini request failed: ${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data);
}

async function callOllama(config, prompt) {
  const response = await fetch(`${config.ollamaBaseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ollamaModel,
      prompt,
      stream: false
    })
  });
  if (!response.ok) throw new Error(`Ollama request failed: ${response.status}`);
  const data = await response.json();
  return data.response || JSON.stringify(data);
}

function routerPrompt(input, fallback) {
  return [
    "사용자 프롬프트의 의도를 AI 활용 보조 서비스용 JSON으로 분류하세요.",
    "이 서비스의 목적은 비전공자가 전공자처럼 적절한 AI Skill을 찾아 더 좋은 답변으로 이어지게 돕는 것입니다.",
    "반드시 다음 필드를 출력하세요: intent, intentId, intentLabel, detectedNeeds, searchTerms, confidence.",
    "intentLabel은 사용자가 이해하기 쉬운 한국어로 요약하세요.",
    "detectedNeeds는 필요한 능력을 한국어 배열로 작성하세요.",
    "searchTerms는 GitHub에서 Skill 후보를 찾기 좋은 영어 검색어 배열로 작성하세요.",
    "반드시 JSON만 출력하세요.",
    `Fallback example: ${JSON.stringify(fallback)}`,
    `Input: ${input}`
  ].join("\n");
}

function splitIntentPrompt(input) {
  return [
    "사용자 입력을 처리용 JSON으로 분리하세요.",
    "목표: 긴 자료 안의 단어에 끌려가지 말고, 사용자가 실제로 원하는 행동을 찾는 것입니다.",
    "입력 마지막에 있는 '요약해줘', '정리해줘', '대본 만들어줘' 같은 명령을 가장 중요하게 보세요.",
    "본문에 MCP, 서버, 자동화, RAG 같은 단어가 있어도 마지막 명령이 요약이면 instruction은 요약입니다.",
    "반드시 JSON만 출력하세요.",
    "필드: material, instruction, outputType, ignoreAsIntent",
    "material: 사용자가 처리하려는 원문 또는 자료",
    "instruction: 사용자가 원하는 행동",
    "outputType: 요약문/대본/초안/평가/분석 등",
    "ignoreAsIntent: 자료 안에 있지만 사용자 행동으로 오해하면 안 되는 단어 배열",
    `Input: ${input}`
  ].join("\n");
}

function skillExplanationPrompt(route, candidates) {
  const compactCandidates = candidates.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    fullName: candidate.fullName,
    description: candidate.originalDescription,
    query: candidate.query,
    stars: candidate.stars
  }));

  return [
    "아래 GitHub 저장소 후보를 비전공자가 이해할 수 있는 한국어로 각각 다르게 설명하세요.",
    "서비스 맥락: 사용자는 AI Skill, MCP, Agent를 몰라도 자기 목적에 맞는 보조 기능을 고르고 씁니다.",
    "후보가 서로 비슷해 보여도 저장소 이름과 설명의 차이를 반영하세요.",
    "과장하지 말고, 저장소 설명에 없는 기능은 지어내지 마세요.",
    "반드시 JSON 배열만 출력하세요.",
    "각 항목 필드: id, plainTitle, plainSummary, helpsWith, intentFit.",
    "plainTitle은 18자 안팎의 쉬운 제목, plainSummary는 한 문장, helpsWith는 1~3개 한국어 문장 배열, intentFit은 이 요청과 맞는지 한 문장.",
    `사용자 의도: ${route.intentLabel}`,
    `검색 후보: ${JSON.stringify(compactCandidates)}`
  ].join("\n");
}

function normalizeSkillExplanations(text) {
  const parsed = safeJson(text);
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item.id === "string")
    .map((item) => ({
      id: item.id,
      plainTitle: typeof item.plainTitle === "string" ? item.plainTitle : "",
      plainSummary: typeof item.plainSummary === "string" ? item.plainSummary : "",
      helpsWith: Array.isArray(item.helpsWith) ? item.helpsWith.filter((value) => typeof value === "string") : [],
      intentFit: typeof item.intentFit === "string" ? item.intentFit : ""
    }));
}

function resultPrompt(input, route, usableSkills) {
  const material = route.split?.material || input;
  const instruction = route.split?.instruction || route.intent || input;
  const skillEvidence = usableSkills.map((skill) => ({
    name: skill.plainTitle || skill.name,
    source: skill.fullName,
    checkedFiles: skill.checkedFiles,
    evidence: skill.evidence
  }));

  return [
    "사용자가 바로 복사해서 쓸 수 있는 한국어 결과물을 만드세요.",
    "절차 설명보다 결과물을 먼저 주세요. 내부 분류, 위험도, 라우터, 모델명은 절대 쓰지 마세요.",
    "선택한 Skill의 확인 결과를 참고하되, 출처에 없는 기능은 지어내지 마세요.",
    "자료와 명령을 섞지 마세요. 자료는 처리 대상이고, 명령은 해야 할 일입니다.",
    "반드시 JSON만 출력하세요.",
    "필드: title, body",
    "body는 마크다운 문자열입니다.",
    `처리할 자료: ${material}`,
    `사용자 명령: ${instruction}`,
    `출력 형식: ${route.split?.outputType || "결과물"}`,
    `확인한 Skill: ${JSON.stringify(skillEvidence)}`
  ].join("\n");
}

function normalizeSplitIntent(text) {
  const parsed = safeJson(text);
  if (!parsed || typeof parsed !== "object") return {};
  return {
    material: typeof parsed.material === "string" ? parsed.material : "",
    instruction: typeof parsed.instruction === "string" ? parsed.instruction : "",
    outputType: typeof parsed.outputType === "string" ? parsed.outputType : "",
    ignoreAsIntent: Array.isArray(parsed.ignoreAsIntent) ? parsed.ignoreAsIntent.filter((value) => typeof value === "string") : []
  };
}

function normalizeResult(text) {
  const parsed = safeJson(text);
  if (!parsed || typeof parsed !== "object") return null;
  return {
    title: typeof parsed.title === "string" ? parsed.title : "바로 쓸 초안",
    body: typeof parsed.body === "string" ? parsed.body : ""
  };
}

function fallbackResult(input, route, usableSkills) {
  const material = route.split?.material || input;
  const instruction = route.split?.instruction || route.intent || "";
  if ((route.intentId === "summarize-and-organize" || instruction.includes("요약")) && material) {
    return summarizeFallback(material);
  }

  return {
    title: "바로 쓸 초안",
    body: [
      `${route.intentLabel} 요청을 처리하기 위해 ${usableSkills.length}개 Skill 후보를 참고했습니다.`,
      "",
      "1. 사용자가 원하는 결과 형태를 먼저 잡습니다.",
      "2. 부족한 정보가 있으면 짧은 질문으로 보완합니다.",
      "3. 확인된 내용을 실행 가능한 초안으로 정리합니다.",
      "",
      instruction ? `요청: ${instruction}` : ""
    ].filter(Boolean).join("\n")
  };
}

function summarizeFallback(material) {
  const cleaned = material.replace(/\s+/g, " ").trim();
  const sentences = cleaned
    .split(/(?<=[.!?。]|다\.|요\.|니다\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
  const scored = scoreSummarySentences(sentences);
  const picked = scored.slice(0, 6);
  const headline = scored[0] || cleaned;

  return {
    title: "요약문",
    body: [
      "## 핵심 요약",
      ...(picked.length ? picked : [cleaned.slice(0, 220)]).map((sentence) => `- ${trimSentence(sentence, 190)}`),
      "",
      "## 한 줄 요약",
      trimSentence(headline, 190)
    ].join("\n")
  };
}

function scoreSummarySentences(sentences) {
  const importantWords = ["목적", "문제", "해결", "제안", "핵심", "결과", "기능", "방법", "효과", "사용자", "필요", "제출", "조건"];
  return sentences
    .map((sentence, index) => ({
      sentence,
      score: importantWords.reduce((sum, word) => sum + (sentence.includes(word) ? 1 : 0), 0) + Math.max(0, 3 - index * 0.2)
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.sentence);
}

function trimSentence(sentence, maxLength) {
  if (sentence.length <= maxLength) return sentence;
  return `${sentence.slice(0, maxLength).trim()}...`;
}

function safeJson(text) {
  try {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}
