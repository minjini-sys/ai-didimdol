import fs from "node:fs/promises";

const registryPaths = {
  skills: "data/skill-registry.json",
  mcps: "data/mcp-registry.json",
  agents: "data/agent-registry.json"
};

export async function loadRegistries() {
  const [skills, mcps, agents] = await Promise.all([
    readJson(registryPaths.skills),
    readJson(registryPaths.mcps),
    readJson(registryPaths.agents)
  ]);
  return { skills, mcps, agents };
}

export async function searchRegistry(route) {
  const registries = await loadRegistries();
  return {
    skills: rank(registries.skills, route).slice(0, 5),
    mcps: rank(registries.mcps, route).slice(0, 4),
    agents: rank(registries.agents, route).slice(0, 4)
  };
}

function rank(items, route) {
  return items
    .map((item) => ({ ...item, score: scoreItem(item, route) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.trustScore - a.trustScore);
}

function scoreItem(item, route) {
  const capabilityScore = route.capabilities.reduce((sum, capability) => {
    return sum + (item.capabilities.includes(capability) ? 3 : 0);
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

