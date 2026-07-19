const capabilityQueries = {
  "아이디어 생성": ["llm ideation skill", "creative ideation prompt skill", "AI brainstorming agent"],
  "아이디어 검증": ["startup validation agent", "market validation prompt", "idea validation AI"],
  "홍보 문구 생성": ["marketing copywriting prompt", "small business marketing AI", "copywriting agent"],
  "실행 계획 생성": ["planning agent workflow", "action plan generator AI", "weekly planning prompt"],
  "위험 신호 탐지": ["phishing detection AI", "scam message detection", "safety checker agent"],
  "공식 출처 확인": ["fact checking MCP server", "web search MCP server", "verification agent"],
  "쉬운 말 변환": ["plain language AI", "simplify text prompt", "accessibility writing AI"],
  "문서 작성": ["document generation AI agent", "presentation prompt skill", "writing assistant agent"]
};

const taskQueries = {
  create: ["AI agent skill create"],
  verify: ["AI verification MCP agent"],
  plan: ["AI planning agent workflow"],
  understand: ["AI plain language assistant"],
  organize: ["AI summarization skill"],
  connect: ["MCP server integration"]
};

export async function searchRemoteRegistry(route, config = {}) {
  if (!config.dynamicRegistry) {
    return { enabled: false, status: "disabled", candidates: [] };
  }

  const queries = buildQueries(route).slice(0, config.dynamicRegistryMaxQueries);
  if (queries.length === 0) return { enabled: true, status: "no-query", candidates: [] };

  const results = [];
  for (const query of queries) {
    const repositories = await searchGithubRepositories(query, config);
    results.push(...repositories.map((repo) => normalizeGithubRepo(repo, query, route)));
  }

  const candidates = dedupeByUrl(results)
    .map(scoreRemoteCandidate)
    .filter((candidate) => candidate.trustScore >= config.dynamicRegistryMinTrust)
    .sort((a, b) => b.trustScore - a.trustScore || b.stars - a.stars)
    .slice(0, config.dynamicRegistryLimit);

  return {
    enabled: true,
    status: "ok",
    searchedQueries: queries,
    candidates
  };
}

function buildQueries(route) {
  const queries = [];
  for (const capability of route.capabilities) {
    queries.push(...(capabilityQueries[capability] || []));
  }
  for (const taskType of route.taskTypes) {
    queries.push(...(taskQueries[taskType] || []));
  }
  return [...new Set(queries)].map((query) => `${query} in:name,description,readme`);
}

async function searchGithubRepositories(query, config) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(Math.min(config.dynamicRegistryPerQuery, 10)));

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ai-didimdol"
  };
  if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.dynamicRegistryTimeoutMs);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`GitHub search failed: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeGithubRepo(repo, query, route) {
  return {
    id: `github:${repo.full_name}`,
    name: repo.name,
    description: repo.description || "설명이 없습니다.",
    type: inferCandidateType(repo, query),
    source: "GitHub 실시간 검색",
    url: repo.html_url,
    owner: repo.owner?.login || "",
    fullName: repo.full_name,
    stars: repo.stargazers_count || 0,
    updatedAt: repo.updated_at,
    query,
    matchedCapabilities: inferMatchedCapabilities(query, route.capabilities),
    verified: false,
    executable: false
  };
}

function inferCandidateType(repo, query) {
  const text = `${repo.name} ${repo.description || ""} ${query}`.toLowerCase();
  if (text.includes("mcp")) return "mcp";
  if (text.includes("agent")) return "agent";
  return "skill";
}

function inferMatchedCapabilities(query, capabilities) {
  return capabilities.filter((capability) => {
    return (capabilityQueries[capability] || []).some((candidateQuery) => query.includes(candidateQuery));
  });
}

function scoreRemoteCandidate(candidate) {
  const starsScore = Math.min(35, Math.floor(Math.log10(candidate.stars + 1) * 12));
  const freshnessScore = isRecentlyUpdated(candidate.updatedAt) ? 20 : 5;
  const descriptionScore = candidate.description && candidate.description !== "설명이 없습니다." ? 15 : 0;
  const capabilityScore = candidate.matchedCapabilities.length > 0 ? 20 : 0;
  const typeScore = candidate.type === "mcp" || candidate.type === "skill" || candidate.type === "agent" ? 10 : 0;
  return {
    ...candidate,
    trustScore: starsScore + freshnessScore + descriptionScore + capabilityScore + typeScore,
    riskNote: "실시간 검색 후보입니다. 자동 실행하지 않고 사람이 확인한 뒤 Registry에 추가해야 합니다."
  };
}

function isRecentlyUpdated(dateText) {
  const updated = new Date(dateText).getTime();
  if (Number.isNaN(updated)) return false;
  const yearMs = 365 * 24 * 60 * 60 * 1000;
  return Date.now() - updated < yearMs;
}

function dedupeByUrl(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
