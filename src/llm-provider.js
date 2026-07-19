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
    },
    async plan(_input, _route, _matches, _safety, fallback) {
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
    async plan(input, route, matches, safety, fallback) {
      try {
        const json = await callOpenAi(config, plannerPrompt(input, route, matches, safety, fallback));
        return { ...fallback, ...safeJson(json) };
      } catch {
        return fallback;
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
    async plan(input, route, matches, safety, fallback) {
      try {
        const json = await callGemini(config, plannerPrompt(input, route, matches, safety, fallback));
        return { ...fallback, ...safeJson(json) };
      } catch {
        return fallback;
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
    async plan(input, route, matches, safety, fallback) {
      try {
        const json = await callOllama(config, plannerPrompt(input, route, matches, safety, fallback));
        return { ...fallback, ...safeJson(json) };
      } catch {
        return fallback;
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
    "사용자 입력을 AI 디딤돌 라우터용 JSON으로 분류하세요.",
    "taskTypes는 understand, verify, create, compare, plan, learn, organize, connect 중 하나 이상입니다.",
    "riskLevel은 low, medium, high, blocked 중 하나입니다.",
    "supported는 supported, partial, unsupported 중 하나입니다.",
    "capabilities는 사용자가 원하는 최종 결과를 만드는 능력명을 한국어 배열로 작성하세요.",
    "반드시 JSON만 출력하세요.",
    `Fallback example: ${JSON.stringify(fallback)}`,
    `Input: ${input}`
  ].join("\n");
}

function plannerPrompt(input, route, matches, safety, fallback) {
  return [
    "AI 디딤돌의 사용자용 결과를 JSON으로 작성하세요.",
    "title, plainAnswer, steps, deliverables를 출력하세요.",
    "deliverables가 가장 중요합니다. 사용자가 실제로 원한 최종 산출물을 바로 작성하세요.",
    "steps는 사용자가 궁금해할 때 볼 수 있는 처리 과정입니다.",
    "deliverables 형식은 [{\"title\":\"섹션 제목\",\"items\":[\"항목1\",\"항목2\"]}]입니다.",
    "사용자는 skills, MCP, agent를 모른다고 가정하고 쉽고 구체적으로 작성하세요.",
    "안전 경고는 위험한 요청일 때만 작성하세요. 일반 요청에는 위험하다는 말을 하지 마세요.",
    "반드시 JSON만 출력하세요.",
    `Input: ${input}`,
    `Route: ${JSON.stringify(route)}`,
    `Matches: ${JSON.stringify(matches)}`,
    `Safety: ${JSON.stringify(safety)}`,
    `Fallback example: ${JSON.stringify(fallback)}`
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
