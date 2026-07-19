export function createLlmProvider(config) {
  if (config.provider === "openai" && config.openaiApiKey) return openaiProvider(config);
  if (config.provider === "gemini" && config.geminiApiKey) return geminiProvider(config);
  if (config.provider === "ollama") return ollamaProvider(config);
  return fallbackProvider();
}

function fallbackProvider() {
  return {
    name: "fallback",
    async classify(_input, fallback) {
      return fallback;
    }
  };
}

function openaiProvider(config) {
  return {
    name: "openai",
    async classify(input, fallback) {
      try {
        const json = await callOpenAi(config, routerPrompt(input, fallback));
        return { ...fallback, ...safeJson(json), model: config.openaiModel };
      } catch {
        return { ...fallback, model: "fallback-router" };
      }
    },
    async explainSkills(route, candidates) {
      try {
        return normalizeSkillExplanations(await callOpenAi(config, skillExplanationPrompt(route, candidates)));
      } catch {
        return [];
      }
    }
  };
}

function geminiProvider(config) {
  return {
    name: "gemini",
    async classify(input, fallback) {
      try {
        const json = await callGemini(config, routerPrompt(input, fallback));
        return { ...fallback, ...safeJson(json), model: config.geminiModel };
      } catch {
        return { ...fallback, model: "fallback-router" };
      }
    },
    async explainSkills(route, candidates) {
      try {
        return normalizeSkillExplanations(await callGemini(config, skillExplanationPrompt(route, candidates)));
      } catch {
        return [];
      }
    }
  };
}

function ollamaProvider(config) {
  return {
    name: "ollama",
    async classify(input, fallback) {
      try {
        const json = await callOllama(config, routerPrompt(input, fallback));
        return { ...fallback, ...safeJson(json), model: config.ollamaModel };
      } catch {
        return { ...fallback, model: "fallback-router" };
      }
    },
    async explainSkills(route, candidates) {
      try {
        return normalizeSkillExplanations(await callOllama(config, skillExplanationPrompt(route, candidates)));
      } catch {
        return [];
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
    "intentLabel은 사용자가 하려는 일을 쉬운 한국어로 요약하세요.",
    "detectedNeeds는 필요한 능력을 한국어 배열로 작성하세요.",
    "searchTerms는 GitHub에서 Skill 후보를 찾기 좋은 영어 검색어 배열로 작성하세요.",
    "반드시 JSON만 출력하세요.",
    `Fallback example: ${JSON.stringify(fallback)}`,
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
    "아래 GitHub 저장소 후보를 비전공자도 이해할 수 있는 한국어로 각각 다르게 설명하세요.",
    "서비스 맥락: 사용자는 AI Skill, MCP, Agent를 몰라도 자기 목적에 맞는 도움 기능을 고르고 싶어 합니다.",
    "후보가 서로 비슷해 보여도 저장소 이름과 설명의 차이를 반영하세요.",
    "과장하지 말고, 저장소 설명에 없는 기능을 지어내지 마세요.",
    "반드시 JSON 배열만 출력하세요.",
    "각 항목 필드: id, plainTitle, plainSummary, helpsWith, intentFit.",
    "plainTitle은 18자 안팎의 쉬운 제목, plainSummary는 한 문장, helpsWith는 1~3개 한국어 문장 배열, intentFit은 왜 이 요청과 맞는지 한 문장.",
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
