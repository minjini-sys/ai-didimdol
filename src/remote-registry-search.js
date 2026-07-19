const capabilityQueries = {
  "아이디어 생성": ["llm ideation skill", "creative ideation prompt skill", "AI brainstorming agent"],
  "아이디어 검증": ["startup validation agent", "market validation prompt", "idea validation AI"],
  "홍보 문구 생성": ["marketing copywriting prompt", "small business marketing AI", "copywriting agent"],
  "실행 계획 생성": ["planning agent workflow", "action plan generator AI", "weekly planning prompt"],
  "댓글 분석": ["youtube comment analysis tool", "comment analysis agent", "social media comment analysis"],
  "악성 댓글 분류": ["toxicity classification tool", "comment moderation agent", "abusive comment detection"],
  "스프레드시트 저장": ["google sheets mcp server", "spreadsheet automation agent", "google sheets api tool"],
  "회의 받아쓰기": ["audio transcription mcp server", "meeting transcription agent", "speech to text workflow"],
  "회의 요약": ["meeting summarization agent", "meeting notes AI", "action item extraction agent"],
  "Notion 정리": ["notion mcp server", "notion integration agent", "notion meeting notes automation"],
  "도구 조합 추천": ["mcp agent workflow", "ai tool orchestration", "agent workflow builder"],
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
    .filter(hasRelevantRepoText)
    .filter((candidate) => isRequestSpecificCandidate(candidate, route))
    .filter(isExecutableLookingCandidate)
    .map(scoreRemoteCandidate)
    .filter((candidate) => !isGenericList(candidate))
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
  return [...new Set(queries)].map((query) => `${query} in:name,description`);
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
    matchedCapabilities: inferMatchedCapabilities(repo, route.capabilities),
    verified: false,
    executable: false
  };
}

function inferCandidateType(repo, query) {
  const text = repoText(repo, query);
  if (text.includes("mcp")) return "mcp";
  if (text.includes("agent")) return "agent";
  return "skill";
}

function inferMatchedCapabilities(repo, capabilities) {
  const text = repoText(repo);
  return capabilities.filter((capability) => {
    return capabilityKeywords(capability).some((keyword) => text.includes(keyword));
  });
}

function scoreRemoteCandidate(candidate) {
  const starsScore = Math.min(30, Math.floor(Math.log10(candidate.stars + 1) * 10));
  const freshnessScore = isRecentlyUpdated(candidate.updatedAt) ? 20 : 5;
  const descriptionScore = candidate.description && candidate.description !== "설명이 없습니다." ? 15 : 0;
  const capabilityScore = candidate.matchedCapabilities.length > 0 ? 25 : 0;
  const typeScore = ["mcp", "skill", "agent"].includes(candidate.type) ? 10 : 0;
  return {
    ...candidate,
    trustScore: starsScore + freshnessScore + descriptionScore + capabilityScore + typeScore,
    riskNote: "실시간 검색 후보입니다. 자동 실행하지 않고 사용 전 확인과 검증이 필요합니다."
  };
}

function hasRelevantRepoText(candidate) {
  return candidate.matchedCapabilities.length > 0 && !isGenericList(candidate);
}

function isExecutableLookingCandidate(candidate) {
  const text = `${candidate.name} ${candidate.fullName} ${candidate.description}`.toLowerCase();
  const executionWords = ["mcp", "agent", "api", "sdk", "tool", "server", "connector", "integration", "youtube", "sheets", "notion", "transcription"];
  const moderationWords = ["comment moderation", "toxicity", "abusive comment", "youtube comment"];
  return executionWords.some((word) => text.includes(word)) || moderationWords.some((word) => text.includes(word));
}

function isRequestSpecificCandidate(candidate, route) {
  const text = `${candidate.name} ${candidate.fullName} ${candidate.description}`.toLowerCase();
  const checks = [];

  if (route.capabilities.includes("댓글 분석")) checks.push(text.includes("youtube") || text.includes("comment"));
  if (route.capabilities.includes("악성 댓글 분류")) checks.push(text.includes("moderation") || text.includes("toxicity") || text.includes("abusive") || text.includes("comment"));
  if (route.capabilities.includes("스프레드시트 저장")) checks.push(text.includes("sheet") || text.includes("spreadsheet") || text.includes("google"));
  if (route.capabilities.includes("회의 받아쓰기")) checks.push(text.includes("audio") || text.includes("transcription") || text.includes("speech"));
  if (route.capabilities.includes("Notion 정리")) checks.push(text.includes("notion"));
  if (route.capabilities.includes("도구 조합 추천")) checks.push(text.includes("mcp") || text.includes("agent") || text.includes("workflow") || text.includes("connector") || text.includes("integration"));

  if (route.capabilities.includes("댓글 분석")) {
    return text.includes("youtube") || text.includes("comment");
  }
  return checks.length === 0 || checks.some(Boolean);
}

function isGenericList(candidate) {
  const text = `${candidate.name} ${candidate.fullName}`.toLowerCase();
  return text.includes("awesome") || text.includes("public-apis") || text === "ecc";
}

function capabilityKeywords(capability) {
  const map = {
    "댓글 분석": ["comment", "youtube", "social"],
    "악성 댓글 분류": ["toxicity", "moderation", "abusive", "hate", "comment"],
    "스프레드시트 저장": ["sheet", "spreadsheet", "google"],
    "회의 받아쓰기": ["audio", "speech", "transcription"],
    "회의 요약": ["meeting", "summary", "notes", "action item"],
    "Notion 정리": ["notion"],
    "도구 조합 추천": ["mcp", "agent", "workflow", "orchestration", "tool"],
    "아이디어 생성": ["ideation", "brainstorm", "creative"],
    "아이디어 검증": ["validation", "startup", "market"],
    "홍보 문구 생성": ["copywriting", "marketing", "copy"],
    "실행 계획 생성": ["planning", "workflow", "plan"],
    "공식 출처 확인": ["search", "verification", "fact"],
    "쉬운 말 변환": ["plain", "simplify", "accessibility"],
    "문서 작성": ["document", "writing", "presentation"]
  };
  return map[capability] || [];
}

function repoText(repo, query = "") {
  return `${repo.name} ${repo.full_name} ${repo.description || ""} ${query}`.toLowerCase();
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
