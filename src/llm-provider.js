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
      const json = await callOpenAi(config, routerPrompt(input, fallback));
      return { ...fallback, ...safeJson(json), model: config.openaiModel };
    },
    async plan(input, route, matches, safety, fallback) {
      const json = await callOpenAi(config, plannerPrompt(input, route, matches, safety, fallback));
      return { ...fallback, ...safeJson(json) };
    }
  };
}

function geminiProvider(config) {
  return {
    name: "gemini",
    async classify(input, fallback) {
      const json = await callGemini(config, routerPrompt(input, fallback));
      return { ...fallback, ...safeJson(json), model: config.geminiModel };
    },
    async plan(input, route, matches, safety, fallback) {
      const json = await callGemini(config, plannerPrompt(input, route, matches, safety, fallback));
      return { ...fallback, ...safeJson(json) };
    }
  };
}

function ollamaProvider(config) {
  return {
    name: "ollama",
    async classify(input, fallback) {
      const json = await callOllama(config, routerPrompt(input, fallback));
      return { ...fallback, ...safeJson(json), model: config.ollamaModel };
    },
    async plan(input, route, matches, safety, fallback) {
      const json = await callOllama(config, plannerPrompt(input, route, matches, safety, fallback));
      return { ...fallback, ...safeJson(json) };
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
  const data = await response.json();
  return data.output_text || JSON.stringify(data);
}

async function callGemini(config, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
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
  const data = await response.json();
  return data.response || JSON.stringify(data);
}

function routerPrompt(input, fallback) {
  return [
    "사용자 입력을 AI 디딤돌 라우터 JSON으로 분류하세요.",
    "taskTypes는 understand, verify, create, compare, plan, learn, organize, connect 중 하나 이상입니다.",
    "riskLevel은 low, medium, high, blocked 중 하나입니다.",
    "supported는 supported, partial, unsupported 중 하나입니다.",
    "반드시 JSON만 출력하세요.",
    `Fallback example: ${JSON.stringify(fallback)}`,
    `Input: ${input}`
  ].join("\n");
}

function plannerPrompt(input, route, matches, safety, fallback) {
  return [
    "AI 디딤돌 사용자용 실행 계획을 JSON으로 작성하세요.",
    "title, plainAnswer, steps 배열만 출력하세요.",
    "사용자는 skills, MCP, agent를 모른다고 가정하고 쉬운 말로 작성하세요.",
    `Input: ${input}`,
    `Route: ${JSON.stringify(route)}`,
    `Matches: ${JSON.stringify(matches)}`,
    `Safety: ${JSON.stringify(safety)}`,
    `Fallback example: ${JSON.stringify(fallback)}`
  ].join("\n");
}

function safeJson(text) {
  try {
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

