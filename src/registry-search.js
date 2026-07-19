import fs from "node:fs/promises";
import { searchRemoteRegistry } from "./remote-registry-search.js";

const registryPaths = {
  skills: "data/skill-registry.json",
  mcps: "data/mcp-registry.json",
  agents: "data/agent-registry.json"
};

const broadCapabilities = new Set(["다음 행동 안내", "문서 작성", "일정 관리", "결과물 생성"]);

export async function loadRegistries() {
  const [skills, mcps, agents] = await Promise.all([
    readJson(registryPaths.skills),
    readJson(registryPaths.mcps),
    readJson(registryPaths.agents)
  ]);
  return { skills, mcps, agents };
}

export async function searchRegistry(route, config = {}) {
  const registries = await loadRegistries();
  const local = {
    skills: rank(registries.skills, route).slice(0, 5),
    mcps: rank(registries.mcps, route).slice(0, 4),
    agents: rank(registries.agents, route).slice(0, 4)
  };

  const remote = await searchRemoteRegistry(route, config).catch((error) => ({
    enabled: Boolean(config.dynamicRegistry),
    status: "failed",
    error: error.message,
    candidates: []
  }));

  return { ...local, remote };
}

function rank(items, route) {
  return items
    .map((item) => ({ ...item, score: scoreItem(item, route) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.trustScore - a.trustScore);
}

function scoreItem(item, route) {
  const specificRouteCapabilities = route.capabilities.filter((capability) => !broadCapabilities.has(capability));
  const hasSpecificMatch =
    specificRouteCapabilities.length === 0 ||
    specificRouteCapabilities.some((capability) => item.capabilities.includes(capability));

  if (!hasSpecificMatch) return 0;

  const capabilityScore = route.capabilities.reduce((sum, capability) => {
    if (!item.capabilities.includes(capability)) return sum;
    return sum + (broadCapabilities.has(capability) ? 1 : 4);
  }, 0);
  const taskScore = route.taskTypes.reduce((sum, taskType) => {
    return sum + (item.taskTypes?.includes(taskType) ? 2 : 0);
  }, 0);
  const riskPenalty = route.riskLevel === "high" && item.privacyRisk === "high" ? -2 : 0;
  const verifiedBonus = item.verified ? 1 : 0;
  return capabilityScore + taskScore + riskPenalty + verifiedBonus;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}
