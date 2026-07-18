import { CAPABILITY_RULES, RISK_KEYWORDS, TASK_TYPES } from "./task-taxonomy.js";

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function unique(values) {
  return [...new Set(values)];
}

export function fallbackRoute(input) {
  const text = input.toLowerCase();
  const matchedTaskTypes = TASK_TYPES
    .filter((type) => includesAny(text, type.keywords))
    .map((type) => type.id);

  const riskLevel = includesAny(text, RISK_KEYWORDS.blocked)
    ? "blocked"
    : includesAny(text, RISK_KEYWORDS.high)
      ? "high"
      : includesAny(text, RISK_KEYWORDS.medium)
        ? "medium"
        : "low";

  const capabilities = CAPABILITY_RULES
    .filter((rule) => includesAny(text, rule.keywords))
    .map((rule) => rule.capability);

  const defaults = matchedTaskTypes.length > 0 ? matchedTaskTypes : ["understand"];
  const defaultCapabilities = capabilities.length > 0 ? capabilities : ["쉬운 말 변환", "다음 행동 안내"];

  return {
    intent: summarizeIntent(input),
    taskTypes: unique(defaults),
    riskLevel,
    capabilities: unique(defaultCapabilities),
    supported: riskLevel === "blocked" ? "unsupported" : riskLevel === "high" ? "partial" : "supported",
    confidence: capabilities.length > 0 ? 0.78 : 0.56,
    model: "fallback-router"
  };
}

export async function routeInput(input, llm) {
  const fallback = fallbackRoute(input);
  const result = await llm.classify?.(input, fallback);
  return normalizeRoute(result || fallback, fallback);
}

function normalizeRoute(route, fallback) {
  return {
    intent: route.intent || fallback.intent,
    taskTypes: Array.isArray(route.taskTypes) && route.taskTypes.length ? route.taskTypes : fallback.taskTypes,
    riskLevel: ["low", "medium", "high", "blocked"].includes(route.riskLevel) ? route.riskLevel : fallback.riskLevel,
    capabilities: Array.isArray(route.capabilities) && route.capabilities.length ? route.capabilities : fallback.capabilities,
    supported: ["supported", "partial", "unsupported"].includes(route.supported) ? route.supported : fallback.supported,
    confidence: typeof route.confidence === "number" ? route.confidence : fallback.confidence,
    model: route.model || fallback.model
  };
}

function summarizeIntent(input) {
  const compact = input.replace(/\s+/g, " ").trim();
  if (compact.length <= 80) return compact;
  return `${compact.slice(0, 77)}...`;
}

