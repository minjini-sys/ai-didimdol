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
    if (agent.id === "moderation-analyst") return route.capabilities.includes("댓글 분석") || route.capabilities.includes("악성 댓글 분류");
    if (agent.id === "workflow-architect") return route.capabilities.includes("도구 조합 추천") || route.capabilities.includes("스프레드시트 저장");
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
  if (route.capabilities.includes("댓글 분석") || route.capabilities.includes("스프레드시트 저장")) return true;
  if (safety.status !== "allow" && route.capabilities.includes("공식 출처 확인")) return true;
  return false;
}

function buildRouterTrace(route, matches, safety, plan, providerName) {
  const trace = [
    {
      title: "1. 요청 파악",
      description: "입력한 문장에서 원하는 결과와 필요한 도움 기능을 골랐습니다.",
      used: ["요청 내용을 읽고 필요한 결과 형태를 정했습니다."]
    },
    {
      title: "2. 도움 기능 선택",
      description: "결과물을 만들기 위해 필요한 기능만 골랐습니다.",
      used: matches.skills.map(formatSkill)
    }
  ];

  const remoteStage = buildRemoteStage(matches.remote, route);
  if (remoteStage) trace.push({ ...remoteStage, title: `${trace.length + 1}. ${remoteStage.title}` });

  if (matches.mcps.length > 0) {
    trace.push({
      title: `${trace.length + 1}. 외부 도구 연결`,
      description: "댓글 가져오기나 구글시트 저장처럼 실제 연결이 필요한 경우에만 사용합니다.",
      used: matches.mcps.map((mcp) => mcp.name)
    });
  }

  if (matches.agents.length > 0) {
    trace.push({
      title: `${trace.length + 1}. 역할 나누기`,
      description: "분석, 계획, 문장 작성처럼 필요한 역할만 나눠 처리했습니다.",
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

function buildRemoteStage(remote, route) {
  if (!remote?.enabled) return null;
  if (!shouldShowRemoteStage(route)) return null;
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
    description: "GitHub에서 새 후보를 찾아봤습니다. 바로 실행하지 않고 참고 후보로만 보여줍니다.",
    used: remote.candidates.map((candidate) => {
      return `${candidate.name} - ${candidate.url}`;
    })
  };
}

function shouldShowRemoteStage(route) {
  const text = route.intent.toLowerCase();
  return ["github", "깃허브", "인터넷", "최신", "새로 나온", "실시간", "mcp 서버"].some((keyword) => text.includes(keyword));
}

function formatSkill(skill) {
  const source = skill.source?.locator || skill.source?.label;
  return source ? `${skill.name} (${source})` : skill.name;
}
