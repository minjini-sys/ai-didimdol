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
