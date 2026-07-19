const candidateFiles = [
  "SKILL.md",
  "skill.md",
  "README.md",
  "README.ko.md",
  "prompts/README.md",
  "skills/SKILL.md",
  ".codex/skills/SKILL.md"
];

const dangerousPatterns = [
  { word: "rm -rf", reason: "파일을 강제로 삭제하는 명령이 보입니다." },
  { word: "sudo", reason: "관리자 권한을 요구할 수 있습니다." },
  { word: "password", reason: "비밀번호와 관련된 처리가 보입니다." },
  { word: "token", reason: "토큰 같은 민감한 값과 관련된 처리가 보입니다." },
  { word: "credential", reason: "인증 정보와 관련된 처리가 보입니다." },
  { word: "shell", reason: "명령 실행과 관련된 처리가 보입니다." },
  { word: "terminal", reason: "터미널 명령 실행과 관련된 처리가 보입니다." },
  { word: "browser automation", reason: "브라우저를 대신 조작하는 기능이 보입니다." }
];

export async function inspectApprovedSkills(input, route, approved, config) {
  const inspected = await Promise.all(approved.map((candidate) => inspectCandidate(candidate, route, config)));
  const usable = inspected.filter((item) => item.decision === "사용 가능");

  return {
    mode: "skill-review",
    title: "Skill 내용을 임시로 확인했습니다",
    summary: `${approved.length}개 후보를 확인했고, ${usable.length}개를 결과 작성에 사용할 수 있다고 판단했습니다.`,
    inspected,
    usable
  };
}

export async function createSkillBasedResult(input, route, usable, llm) {
  return buildUsableResult(input, route, usable, llm);
}

async function inspectCandidate(candidate, route, config) {
  const files = await readCandidateFiles(candidate, config);
  const joined = files.map((file) => `${file.path}\n${file.text}`).join("\n\n").slice(0, 12000);
  const flags = findDangerFlags(joined || candidate.originalDescription || "");
  const relevance = scoreRelevance(route, `${candidate.fullName} ${candidate.originalDescription} ${joined}`);
  const hasSkillFile = files.some((file) => /skill\.md$/i.test(file.path));

  let decision = "사용 가능";
  let reason = "요청과 관련된 설명을 확인했고, 큰 권한을 요구하는 내용은 보이지 않았습니다.";
  if (!files.length) {
    decision = "보류";
    reason = "README나 SKILL 파일을 읽지 못해 실제 내용을 확인하지 못했습니다.";
  } else if (flags.length) {
    decision = "사용 보류";
    reason = flags[0].reason;
  } else if (relevance < 1) {
    decision = "보류";
    reason = "파일 내용에서 사용자 요청과 직접 맞는 단서를 충분히 찾지 못했습니다.";
  }

  return {
    ...candidate,
    decision,
    reason,
    checkedFiles: files.map((file) => file.path),
    hasSkillFile,
    evidence: summarizeEvidence(files, candidate),
    flags: flags.map((flag) => flag.reason),
    relevance
  };
}

async function readCandidateFiles(candidate, config) {
  const fullName = candidate.fullName || candidate.url?.replace("https://github.com/", "");
  if (!fullName || !fullName.includes("/")) return [];

  const branch = await getDefaultBranch(fullName, config).catch(() => "main");
  const tried = new Set();
  const files = [];

  for (const filePath of candidateFiles) {
    const attempts = [branch, "main", "master"];
    for (const ref of attempts) {
      const key = `${ref}:${filePath}`;
      if (tried.has(key)) continue;
      tried.add(key);
      const text = await fetchRawFile(fullName, ref, filePath, config).catch(() => "");
      if (text) {
        files.push({ path: filePath, text: text.slice(0, 6000) });
        break;
      }
    }
    if (files.length >= 2) break;
  }

  return files;
}

async function getDefaultBranch(fullName, config) {
  const response = await fetch(`https://api.github.com/repos/${fullName}`, {
    headers: githubHeaders(config)
  });
  if (!response.ok) throw new Error(`GitHub repo read failed: ${response.status}`);
  const data = await response.json();
  return data.default_branch || "main";
}

async function fetchRawFile(fullName, branch, filePath, config) {
  const url = `https://raw.githubusercontent.com/${fullName}/${branch}/${filePath}`;
  const response = await fetch(url, { headers: githubHeaders(config) });
  if (!response.ok) return "";
  const text = await response.text();
  if (/^404: Not Found/i.test(text)) return "";
  return text;
}

function githubHeaders(config) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ai-didimdol"
  };
  if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;
  return headers;
}

function findDangerFlags(text) {
  const lower = text.toLowerCase();
  return dangerousPatterns.filter((pattern) => lower.includes(pattern.word));
}

function scoreRelevance(route, text) {
  const lower = text.toLowerCase();
  return (route.searchTerms || [])
    .flatMap((term) => term.split(/\s+/))
    .map((word) => word.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((word) => word.length > 3)
    .filter((word, index, words) => words.indexOf(word) === index)
    .reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
}

function summarizeEvidence(files, candidate) {
  if (!files.length) return `${candidate.fullName}에서 README나 SKILL 파일을 찾지 못했습니다.`;
  const first = files[0].text.replace(/\s+/g, " ").trim();
  return first ? first.slice(0, 220) : `${files[0].path} 파일을 읽었습니다.`;
}

async function buildUsableResult(input, route, usable, llm) {
  if (!usable.length) {
    return {
      title: "바로 쓸 결과물을 만들 수 없습니다",
      body: "선택한 후보 중 실제 내용을 확인해 사용할 수 있는 Skill이 없었습니다. 다른 후보를 선택하거나 검색어를 바꿔 다시 시도해야 합니다."
    };
  }

  if (typeof llm?.createResult === "function") {
    const generated = await llm.createResult(input, route, usable).catch(() => null);
    if (generated?.title && generated?.body) return generated;
  }

  return {
    title: "바로 쓸 초안",
    body: [
      `${route.intentLabel} 요청을 처리하기 위해 ${usable.length}개 Skill 후보를 참고했습니다.`,
      "",
      "1. 먼저 원문에서 조건, 대상, 제출물, 마감일을 분리합니다.",
      "2. 빠진 정보가 있으면 사용자에게 짧게 질문합니다.",
      "3. 확인된 조건을 체크리스트로 바꾸고, 바로 복사할 수 있는 형태로 정리합니다.",
      "",
      `사용자 요청: ${input}`
    ].join("\n")
  };
}
