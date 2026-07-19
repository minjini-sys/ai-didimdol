import { createLlmProvider } from "./llm-provider.js";
import { buildPlan } from "./planner.js";
import { routeInput } from "./router.js";
import { searchRegistry } from "./registry-search.js";
import { applySafetyGate } from "./safety-gate.js";

export async function runDidimdolPipeline(input, config) {
  const llm = createLlmProvider(config);
  const route = await routeInput(input, llm);
  const matches = await searchRegistry(route, config);
  const safety = applySafetyGate(route, matches);
  const plan = await buildPlan(input, route, matches, safety, llm);
  const used = selectUsedTools(route, matches, safety);

  return {
    input,
    route,
    matches: used,
    safety,
    plan,
    userView: buildUserView(route, used, safety, plan, llm.name)
  };
}

function buildUserView(route, matches, safety, plan, providerName) {
  return {
    title: plan.title,
    summary: plan.plainAnswer,
    deliverables: plan.deliverables,
    warnings: safety.status === "allow" ? [] : [...safety.warnings, ...safety.requiredConfirmations],
    routerTrace: buildRouterTrace(route, matches, safety, plan, providerName)
  };
}

function selectUsedTools(route, matches, safety) {
  const usedMcps = shouldUseMcp(route, safety) ? matches.mcps : [];
  const usedAgents = matches.agents.filter((agent) => {
    if (agent.id === "planner") return route.taskTypes.includes("plan");
    if (agent.id === "copywriter") return route.capabilities.includes("홍보 문구 생성");
    if (agent.id === "critic") return route.capabilities.includes("아이디어 검증");
    if (agent.id === "explorer") return route.capabilities.includes("아이디어 생성");
    if (agent.id === "safety-coach") return safety.status !== "allow";
    return agent.capabilities.some((capability) => route.capabilities.includes(capability));
  });

  return {
    skills: matches.skills,
    mcps: usedMcps,
    agents: usedAgents,
    remote: matches.remote
  };
}

function shouldUseMcp(route, safety) {
  if (route.taskTypes.includes("connect")) return true;
  if (safety.status !== "allow" && route.capabilities.includes("공식 출처 확인")) return true;
  return false;
}

function buildRouterTrace(route, matches, safety, plan, providerName) {
  const trace = [
    {
      title: "1. 요청 이해",
      description: "사용자 문장을 읽고 필요한 능력을 골랐습니다.",
      used: [`Router Model: ${route.model}`, `LLM Provider: ${providerName}`]
    },
    {
      title: "2. 내장 Skill 선택",
      description: "검증되어 있는 내부 Registry에서 결과물을 만들 Skill을 골랐습니다.",
      used: matches.skills.map(formatSkill)
    }
  ];

  const remoteStage = buildRemoteStage(matches.remote);
  if (remoteStage) trace.push({ ...remoteStage, title: `${trace.length + 1}. ${remoteStage.title}` });

  if (matches.mcps.length > 0) {
    trace.push({
      title: `${trace.length + 1}. MCP 연결`,
      description: "외부 확인이나 실제 도구 연결이 필요한 경우에만 MCP를 사용합니다.",
      used: matches.mcps.map((mcp) => mcp.name)
    });
  }

  if (matches.agents.length > 0) {
    trace.push({
      title: `${trace.length + 1}. Agent 역할`,
      description: "결과물을 다듬기 위해 필요한 역할의 Agent만 사용했습니다.",
      used: matches.agents.map((agent) => agent.name)
    });
  }

  if (safety.status !== "allow") {
    trace.push({
      title: `${trace.length + 1}. 안전 확인`,
      description: "개인정보, 금전, 건강처럼 조심해야 하는 요청만 확인 단계를 거칩니다.",
      used: ["Safety Gate"]
    });
  }

  trace.push({
    title: `${trace.length + 1}. 결과 작성`,
    description: "사용자가 바로 볼 수 있는 최종 결과물로 정리했습니다.",
    used: [plan.title]
  });

  return trace.filter((stage) => stage.used.length > 0);
}

function buildRemoteStage(remote) {
  if (!remote?.enabled) return null;
  if (remote.status === "failed") {
    return {
      title: "실시간 후보 검색",
      description: "인터넷 후보 검색을 시도했지만 실패했습니다. 내장 Registry로 계속 처리했습니다.",
      used: [remote.error || "검색 실패"]
    };
  }
  if (!remote.candidates?.length) {
    return {
      title: "실시간 후보 검색",
      description: "인터넷에서 새 후보를 찾았지만 검증 기준을 통과한 항목이 없었습니다.",
      used: ["채택 후보 없음"]
    };
  }
  return {
    title: "실시간 후보 검색",
    description: "GitHub에서 새 Skill/MCP/Agent 후보를 찾고 신뢰도 기준을 통과한 항목만 후보로 표시했습니다. 아직 자동 실행하지는 않습니다.",
    used: remote.candidates.map((candidate) => {
      return `${candidate.name} (${candidate.type}, trust ${candidate.trustScore}) - ${candidate.url}`;
    })
  };
}

function formatSkill(skill) {
  const source = skill.source?.locator || skill.source?.label;
  return source ? `${skill.name} (${source})` : skill.name;
}
