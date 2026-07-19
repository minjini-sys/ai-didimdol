export async function searchRemoteSkills(route, config = {}) {
  const queries = buildSkillQueries(route).slice(0, config.dynamicRegistryMaxQueries || 3);
  const results = [];

  for (const query of queries) {
    const repositories = await searchGithubRepositories(query, config);
    results.push(...repositories.map((repo) => normalizeSkillCandidate(repo, query, route)));
  }

  const candidates = dedupeByUrl(results)
    .filter(isLikelySkillRepository)
    .map(scoreCandidate)
    .sort((a, b) => b.score - a.score || b.stars - a.stars)
    .slice(0, config.dynamicRegistryLimit || 5);

  return {
    source: "github",
    searchedQueries: queries,
    candidates
  };
}

function buildSkillQueries(route) {
  const terms = route.searchTerms?.length ? route.searchTerms : ["ai skill agent workflow"];
  return terms.map((term) => `${term} in:name,description`);
}

async function searchGithubRepositories(query, config) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(Math.min(config.dynamicRegistryPerQuery || 5, 10)));

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ai-didimdol"
  };
  if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.dynamicRegistryTimeoutMs || 5000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`GitHub search failed: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeSkillCandidate(repo, query, route) {
  const description = repo.description || "설명이 없는 저장소입니다.";
  return {
    id: `github:${repo.full_name}`,
    name: repo.name,
    fullName: repo.full_name,
    description,
    url: repo.html_url,
    owner: repo.owner?.login || "",
    stars: repo.stargazers_count || 0,
    updatedAt: repo.updated_at,
    query,
    intentLabel: route.intentLabel,
    whyMatched: buildWhyMatched(description, query, route),
    downloadPolicy: "승인 전에는 다운로드하지 않고, 로컬에도 저장하지 않습니다."
  };
}

function buildWhyMatched(description, query, route) {
  const pieces = [
    `"${route.intentLabel}" 의도에 맞는 Skill 후보로 검색되었습니다.`,
    `검색어: ${query.replace(" in:name,description,readme", "")}`
  ];
  if (description && description !== "설명이 없는 저장소입니다.") pieces.push(`저장소 설명: ${description}`);
  return pieces.join(" ");
}

function isLikelySkillRepository(candidate) {
  const text = `${candidate.name} ${candidate.fullName} ${candidate.description}`.toLowerCase();
  if (text.includes("awesome") || text.includes("public-apis")) return false;
  return ["skill", "agent", "prompt", "mcp", "workflow", "automation", "assistant", "classification", "moderation", "analysis"].some((word) => text.includes(word));
}

function scoreCandidate(candidate) {
  const text = `${candidate.name} ${candidate.fullName} ${candidate.description}`.toLowerCase();
  const starsScore = Math.min(35, Math.floor(Math.log10(candidate.stars + 1) * 12));
  const freshnessScore = isRecentlyUpdated(candidate.updatedAt) ? 25 : 5;
  const skillWordScore = ["skill", "agent", "prompt", "mcp", "workflow"].reduce((sum, word) => sum + (text.includes(word) ? 8 : 0), 0);
  const descriptionScore = candidate.description === "설명이 없는 저장소입니다." ? 0 : 10;
  const queryWords = candidate.query
    .replace("in:name,description", "")
    .split(/\s+/)
    .filter((word) => word.length > 3);
  const queryMatchScore = queryWords.reduce((sum, word) => sum + (text.includes(word.toLowerCase()) ? 7 : 0), 0);
  return {
    ...candidate,
    score: starsScore + freshnessScore + skillWordScore + descriptionScore + queryMatchScore
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
