import fs from "node:fs";

export function loadEnv(filePath = ".env") {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function getConfig() {
  loadEnv();
  return {
    provider: process.env.LLM_PROVIDER || "fallback",
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    ollamaModel: process.env.OLLAMA_MODEL || "qwen3:8b",
    port: Number.parseInt(process.env.PORT || "3000", 10)
  };
}

