import { createLlmProvider } from "./llm-provider.js";
import { buildPlan } from "./planner.js";
import { routeInput } from "./router.js";
import { searchRegistry } from "./registry-search.js";
import { applySafetyGate } from "./safety-gate.js";

export async function runDidimdolPipeline(input, config) {
  const llm = createLlmProvider(config);
  const route = await routeInput(input, llm);
  const matches = await searchRegistry(route);
  const safety = applySafetyGate(route, matches);
  const plan = await buildPlan(input, route, matches, safety, llm);

  return {
    input,
    route,
    matches,
    safety,
    plan,
    userView: buildUserView(route, matches, safety, plan)
  };
}

function buildUserView(route, matches, safety, plan) {
  return {
    summary: plan.plainAnswer,
    statusLabel: safety.status === "block" ? "지원 불가" : safety.status === "confirm" ? "확인 필요" : "지원 가능",
    taskLabels: route.taskTypes,
    capabilities: route.capabilities,
    recommendedSkills: matches.skills.map((skill) => skill.name),
    recommendedMcps: matches.mcps.map((mcp) => mcp.name),
    recommendedAgents: matches.agents.map((agent) => agent.name),
    steps: plan.steps,
    warnings: safety.warnings,
    confirmations: safety.requiredConfirmations
  };
}

