import { createLlmProvider } from "./llm-provider.js";
import { routeInput } from "./router.js";
import { searchRemoteSkills } from "./remote-registry-search.js";
import { inspectApprovedSkills } from "./skill-inspector.js";

export async function runDidimdolPipeline(input, config, options = {}) {
  const llm = createLlmProvider(config);
  const route = await routeInput(input, llm);

  if (options.approvedSkillIds?.length) {
    return buildApprovedView(input, route, options.approvedSkillIds, options.candidates || [], config, llm);
  }

  const skillSearch = await searchRemoteSkills(route, {
    ...config,
    llmProvider: llm,
    dynamicRegistryMaxQueries: config.dynamicRegistryMaxQueries || 3,
    dynamicRegistryPerQuery: config.dynamicRegistryPerQuery || 5,
    dynamicRegistryLimit: config.dynamicRegistryLimit || 5,
    dynamicRegistryTimeoutMs: config.dynamicRegistryTimeoutMs || 5000
  }).catch((error) => ({
    source: "github",
    searchedQueries: route.searchTerms || [],
    candidates: [],
    error: error.message
  }));

  return {
    input,
    route,
    skillSearch,
    userView: buildSkillApprovalView(route, skillSearch)
  };
}

function buildSkillApprovalView(route, skillSearch) {
  return {
    mode: "skill-approval",
    title: "의도를 파악하고 Skill 후보를 찾았습니다",
    intent: {
      label: route.intentLabel,
      summary: route.intent,
      needs: route.detectedNeeds,
      confidence: route.confidence,
      model: route.model
    },
    search: {
      source: "GitHub 실시간 검색",
      queries: skillSearch.searchedQueries || [],
      error: skillSearch.error || ""
    },
    candidates: skillSearch.candidates || [],
    emptyMessage: skillSearch.error
      ? "인터넷 검색에 실패했습니다. GitHub 토큰이나 네트워크 설정을 확인해야 합니다."
      : "조건에 맞는 Skill 후보를 찾지 못했습니다. 프롬프트를 조금 더 구체적으로 입력하면 다시 검색할 수 있습니다."
  };
}

async function buildApprovedView(input, route, approvedSkillIds, candidates, config, llm) {
  const approved = candidates.filter((candidate) => approvedSkillIds.includes(candidate.id));
  const review = await inspectApprovedSkills(input, route, approved, config, llm);
  return {
    input,
    route,
    skillSearch: { source: "github", searchedQueries: route.searchTerms || [], candidates },
    userView: review
  };
}
