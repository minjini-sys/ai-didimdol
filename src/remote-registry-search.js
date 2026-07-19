const blockedWords = [
  "browser automation",
  "desktop automation",
  "terminal",
  "shell",
  "command",
  "autonomous",
  "agent2agent",
  "pentest",
  "exploit",
  "password",
  "credential",
  "crash"
];

const reviewWords = [
  "desktop",
  "browser",
  "api key",
  "token",
  "file access",
  "agent",
  "mcp",
  "automation"
];

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
    .map(addPlainKoreanEvaluation)
    .filter((candidate) => !isClearlyUnhelpful(candidate))
    .sort((a, b) => verdictRank(a) - verdictRank(b) || b.score - a.score || b.stars - a.stars)
    .slice(0, config.dynamicRegistryLimit || 5);

  return {
    source: "github",
    searchedQueries: queries,
    candidates: await enrichCandidateExplanations(candidates, route, config)
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
  const originalDescription = repo.description || "저장소 설명이 없습니다.";
  return {
    id: `github:${repo.full_name}`,
    name: repo.name,
    fullName: repo.full_name,
    originalDescription,
    url: repo.html_url,
    owner: repo.owner?.login || "",
    stars: repo.stargazers_count || 0,
    updatedAt: repo.updated_at,
    query,
    intentLabel: route.intentLabel,
    downloadPolicy: "승인 전에는 다운로드하지 않고, 로컬에도 저장하지 않습니다."
  };
}

function addPlainKoreanEvaluation(candidate) {
  const safety = assessBeforeDownload(candidate);
  return {
    ...candidate,
    plainTitle: makePlainTitle(candidate),
    plainSummary: makePlainSummary(candidate),
    helpsWith: explainHelpsWith(candidate),
    intentFit: explainIntentFit(candidate),
    verdict: buildVerdict(candidate, safety),
    precheckLevel: safety.level,
    precheckReason: safety.reason,
    precheckFlags: safety.flags,
    canApprove: safety.level !== "blocked"
  };
}

function assessBeforeDownload(candidate) {
  const text = candidateText(candidate);
  const blockedFlags = blockedWords.filter((word) => text.includes(word));
  if (blockedFlags.length > 0) {
    return {
      level: "blocked",
      flags: blockedFlags,
      reason: "브라우저, 컴퓨터, 터미널, 비밀번호, 자동 실행처럼 권한이 큰 표현이 있어 이 단계에서는 다운로드하지 않습니다."
    };
  }

  const reviewFlags = reviewWords.filter((word) => text.includes(word));
  if (reviewFlags.length > 0) {
    return {
      level: "review",
      flags: reviewFlags,
      reason: "외부 도구나 자동화와 관련된 표현이 있어 승인 후 파일 내용을 읽고 한 번 더 확인합니다."
    };
  }

  return {
    level: "ok",
    flags: [],
    reason: "저장소 설명만 보면 큰 권한을 요구하는 표현은 보이지 않습니다."
  };
}

function makePlainTitle(candidate) {
  const text = candidateText(candidate);
  if (text.includes("youtube") || text.includes("comment") || text.includes("moderation")) {
    return "댓글을 분류하거나 문제 댓글을 찾는 도구 후보";
  }
  if (text.includes("document") || text.includes("summarization") || text.includes("requirement") || text.includes("checklist")) {
    return "긴 문서에서 핵심 조건을 뽑아내는 도구 후보";
  }
  if (text.includes("notion") || text.includes("automation") || text.includes("workflow")) {
    return "반복 작업을 자동으로 이어주는 도구 후보";
  }
  if (text.includes("presentation") || text.includes("writing") || text.includes("copywriting")) {
    return "글이나 발표 자료를 만드는 도구 후보";
  }
  if (text.includes("validation") || text.includes("startup") || text.includes("market")) {
    return "아이디어가 쓸모 있는지 검토하는 도구 후보";
  }
  const readableName = readableRepoName(candidate.name);
  return `${readableName} 도구 후보`;
}

function makePlainSummary(candidate) {
  const text = candidateText(candidate);
  if (text.includes("desktop") || text.includes("browser automation")) {
    return "사용자 컴퓨터나 브라우저에서 작업을 대신 실행하는 성격이 강한 도구입니다.";
  }
  if (text.includes("comment") && text.includes("classification")) {
    return "댓글을 읽고 유형별로 나누는 데 쓰일 수 있는 후보입니다.";
  }
  if (text.includes("document") || text.includes("summarization")) {
    return "긴 문서나 안내문을 짧게 요약하는 데 쓰일 수 있는 후보입니다.";
  }
  if (text.includes("requirement") || text.includes("checklist")) {
    return "해야 할 일, 조건, 제출물을 목록으로 뽑는 데 쓰일 수 있는 후보입니다.";
  }
  if (text.includes("moderation") || text.includes("toxicity")) {
    return "욕설, 혐오, 사기성 표현처럼 문제가 될 수 있는 문장을 찾는 데 쓰일 수 있습니다.";
  }
  if (text.includes("workflow") || text.includes("automation")) {
    return "여러 작업을 순서대로 묶어 자동으로 처리하는 데 쓰일 수 있습니다.";
  }
  const description = cleanDescription(candidate.originalDescription);
  if (description) return `저장소 설명에 따르면 ${description}`;
  return `${readableRepoName(candidate.name)}라는 이름의 저장소로, 검색 의도와 일부 관련이 있어 후보로 가져왔습니다.`;
}

function explainHelpsWith(candidate) {
  const text = candidateText(candidate);
  const items = [];
  if (text.includes("comment")) items.push("댓글 내용을 읽고 분류하는 작업");
  if (text.includes("moderation") || text.includes("toxicity")) items.push("악성 표현이나 문제 댓글을 걸러내는 작업");
  if (text.includes("classification")) items.push("여러 문장을 정해진 기준으로 나누는 작업");
  if (text.includes("document") || text.includes("summarization")) items.push("긴 안내문을 핵심만 남겨 요약하는 작업");
  if (text.includes("requirement") || text.includes("checklist")) items.push("조건, 제출물, 마감일 같은 확인 항목을 뽑는 작업");
  if (text.includes("workflow") || text.includes("automation")) items.push("반복되는 절차를 자동화하는 작업");
  if (text.includes("skill") || text.includes("prompt")) items.push("AI에게 더 좋은 지시를 주는 작업");
  if (items.length) return items;

  const nameWords = readableRepoName(candidate.name);
  const description = cleanDescription(candidate.originalDescription);
  if (description) return [`${description} 내용을 바탕으로 요청과 맞는지 확인하는 작업`];
  return [`${nameWords} 저장소가 실제 Skill로 쓸 수 있는지 확인하는 작업`];
}

function explainIntentFit(candidate) {
  const query = candidate.query.replace(" in:name,description", "");
  const matched = matchedQueryWords(candidate, query);
  if (matched.length) {
    return `"${candidate.intentLabel}"에 맞춰 검색했고, 저장소 정보에서 ${matched.map((word) => `"${word}"`).join(", ")} 같은 관련 단어가 보였습니다.`;
  }
  return `"${candidate.intentLabel}"와 관련된 후보를 찾기 위해 "${query}"로 검색한 결과에 포함됐습니다.`;
}

async function enrichCandidateExplanations(candidates, route, config) {
  const explain = config.llmProvider?.explainSkills;
  if (typeof explain !== "function" || candidates.length === 0) return candidates;

  const explanations = await explain(route, candidates).catch(() => []);
  const byId = new Map(explanations.map((item) => [item.id, item]));
  return candidates.map((candidate) => {
    const explanation = byId.get(candidate.id);
    if (!explanation) return candidate;
    return {
      ...candidate,
      plainTitle: explanation.plainTitle || candidate.plainTitle,
      plainSummary: explanation.plainSummary || candidate.plainSummary,
      helpsWith: explanation.helpsWith?.length ? explanation.helpsWith : candidate.helpsWith,
      intentFit: explanation.intentFit || candidate.intentFit,
      explanationModel: config.llmProvider.name
    };
  });
}

function cleanDescription(description) {
  if (!description || description === "저장소 설명이 없습니다.") return "";
  const cleaned = description
    .replace(/\s+/g, " ")
    .replace(/[.。]+$/u, "")
    .trim();
  if (!cleaned) return "";
  return `${cleaned.slice(0, 140)}${cleaned.length > 140 ? "..." : ""} 기능과 관련된 후보입니다.`;
}

function readableRepoName(name) {
  return String(name || "AI")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 4)
    .join(" ") || "AI";
}

function matchedQueryWords(candidate, query) {
  const text = candidateText(candidate);
  return [...new Set(query
    .split(/\s+/)
    .map((word) => word.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((word) => word.length > 3 && text.includes(word)))]
    .slice(0, 3);
}

function buildVerdict(candidate, safety) {
  if (safety.level === "blocked") {
    return {
      label: "다운로드 차단",
      reason: "권한이 큰 도구일 수 있어 사용자가 승인해도 이 단계에서는 다운로드하지 않습니다."
    };
  }
  if (safety.level === "review") {
    return {
      label: "관련 후보",
      reason: "요청과 관련은 있어 보입니다. 승인하면 파일 내용을 임시로 읽고 실제로 써도 되는지 한 번 더 확인합니다."
    };
  }
  if (candidate.score >= 70) {
    return {
      label: "추천 후보",
      reason: "요청과 관련된 단어가 많고 큰 권한 표현이 없어 다음 단계에서 내용을 읽어볼 만합니다."
    };
  }
  return {
    label: "약한 후보",
    reason: "일부 관련성은 있지만, 실제 Skill로 쓰기 적절한지는 추가 확인이 필요합니다."
  };
}

function isLikelySkillRepository(candidate) {
  const text = candidateText(candidate);
  if (text.includes("awesome") || text.includes("public-apis")) return false;
  return ["skill", "agent", "prompt", "mcp", "workflow", "automation", "assistant", "classification", "moderation", "analysis", "toxicity", "comment", "document"].some((word) => text.includes(word));
}

function isClearlyUnhelpful(candidate) {
  const text = candidateText(candidate);
  return text.includes("server-crash") || text.includes("crash server") || text.includes("exploit") || text.includes("pentest");
}

function scoreCandidate(candidate) {
  const text = candidateText(candidate);
  const starsScore = Math.min(35, Math.floor(Math.log10(candidate.stars + 1) * 12));
  const freshnessScore = isRecentlyUpdated(candidate.updatedAt) ? 25 : 5;
  const skillWordScore = ["skill", "agent", "prompt", "mcp", "workflow"].reduce((sum, word) => sum + (text.includes(word) ? 8 : 0), 0);
  const descriptionScore = candidate.originalDescription === "저장소 설명이 없습니다." ? 0 : 10;
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

function verdictRank(candidate) {
  if (candidate.verdict?.label === "추천 후보") return 0;
  if (candidate.verdict?.label === "관련 후보") return 1;
  if (candidate.verdict?.label === "약한 후보") return 2;
  return 3;
}

function candidateText(candidate) {
  return `${candidate.name} ${candidate.fullName} ${candidate.originalDescription}`.toLowerCase();
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
