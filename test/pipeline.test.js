import assert from "node:assert/strict";
import test from "node:test";
import { generateDidimdolResult, runDidimdolPipeline } from "../src/pipeline.js";

const commentRepo = {
  name: "comment-moderation-agent",
  full_name: "example/comment-moderation-agent",
  description: "AI workflow for comment moderation and classification",
  html_url: "https://github.com/example/comment-moderation-agent",
  stargazers_count: 120,
  updated_at: new Date().toISOString(),
  owner: { login: "example" }
};

test("detects user intent before searching for skills", async (t) => {
  mockSearch(t, [commentRepo]);

  const result = await runDidimdolPipeline(
    "유튜브 댓글을 분석해서 악성 댓글을 분류하고 싶어.",
    { provider: "fallback", dynamicRegistryLimit: 3, dynamicRegistryPerQuery: 1, dynamicRegistryMaxQueries: 1 }
  );

  assert.equal(result.userView.mode, "skill-approval");
  assert.equal(result.userView.intent.label, "댓글 분석과 악성 댓글 분류");
  assert.ok(result.userView.intent.needs.includes("댓글 분석과 악성 댓글 분류"));
});

test("uses the final instruction instead of misleading words in the material", async (t) => {
  mockSearch(t, [
    {
      name: "summary-skill",
      full_name: "example/summary-skill",
      description: "Summarization and key point extraction skill",
      html_url: "https://github.com/example/summary-skill",
      stargazers_count: 80,
      updated_at: new Date().toISOString(),
      owner: { login: "example" }
    }
  ]);

  const input = [
    "MCP_Server.py는 센서 데이터 자동 수집, 서버 연결, 파일 저장, RAG 검색 기능을 포함한다.",
    "이 시스템은 반복 작업 자동화와 데이터 저장을 통해 운영 효율을 높인다.",
    "이거 요약해줘"
  ].join("\n");

  const result = await runDidimdolPipeline(
    input,
    { provider: "fallback", dynamicRegistryLimit: 3, dynamicRegistryPerQuery: 1, dynamicRegistryMaxQueries: 1 }
  );

  assert.equal(result.userView.intent.label, "요약과 핵심 정리");
  assert.equal(result.route.intentLabel, "요약과 핵심 정리");
  assert.equal("split" in result.route, false);
});

test("explains internet skill candidates with filled user-facing sections", async (t) => {
  mockSearch(t, [commentRepo]);

  const result = await runDidimdolPipeline(
    "유튜브 댓글을 분석해서 악성 댓글을 분류하고 싶어.",
    { provider: "fallback", dynamicRegistryLimit: 3, dynamicRegistryPerQuery: 1, dynamicRegistryMaxQueries: 1 }
  );

  const candidate = result.userView.candidates[0];
  assert.equal(result.userView.search.source, "GitHub 실시간 검색");
  assert.equal(candidate.fullName, "example/comment-moderation-agent");
  assert.ok(candidate.plainTitle);
  assert.ok(candidate.helpsWith.length > 0);
  assert.equal(candidate.downloadPolicy, "승인 전에는 다운로드하지 않고, 로컬에도 저장하지 않습니다.");
});

test("fallback candidate explanations stay different per repository", async (t) => {
  mockSearch(t, [
    {
      name: "meeting-notes-assistant",
      full_name: "example/meeting-notes-assistant",
      description: "Assistant that turns meeting notes into action items",
      html_url: "https://github.com/example/meeting-notes-assistant",
      stargazers_count: 90,
      updated_at: new Date().toISOString(),
      owner: { login: "example" }
    },
    {
      name: "email-draft-agent",
      full_name: "example/email-draft-agent",
      description: "Agent for drafting short customer emails",
      html_url: "https://github.com/example/email-draft-agent",
      stargazers_count: 80,
      updated_at: new Date().toISOString(),
      owner: { login: "example" }
    }
  ]);

  const result = await runDidimdolPipeline(
    "회의 내용을 정리하고 고객에게 보낼 메일 초안을 만들고 싶어.",
    { provider: "fallback", dynamicRegistryLimit: 3, dynamicRegistryPerQuery: 2, dynamicRegistryMaxQueries: 1 }
  );

  const summaries = result.userView.candidates.map((candidate) => candidate.plainSummary);
  const helps = result.userView.candidates.map((candidate) => candidate.helpsWith.join(" / "));
  assert.equal(result.userView.candidates.length, 2);
  assert.notEqual(summaries[0], summaries[1]);
  assert.notEqual(helps[0], helps[1]);
});

test("blocked candidates cannot be approved or downloaded", async (t) => {
  mockSearch(t, [
    {
      name: "browserwing",
      full_name: "browserwing/browserwing",
      description: "Browser automation agent that can run terminal commands and control a browser",
      html_url: "https://github.com/browserwing/browserwing",
      stargazers_count: 1377,
      updated_at: new Date().toISOString(),
      owner: { login: "browserwing" }
    }
  ]);

  const result = await runDidimdolPipeline(
    "반복 업무를 자동화할 Skill을 찾고 싶어.",
    { provider: "fallback", dynamicRegistryLimit: 3, dynamicRegistryPerQuery: 1, dynamicRegistryMaxQueries: 1 }
  );

  const candidate = result.userView.candidates[0];
  assert.equal(candidate.canApprove, false);
  assert.equal(candidate.verdict.label, "다운로드 차단");
  assert.equal(candidate.precheckLevel, "blocked");
});

test("routes contest notices to document requirement extraction", async (t) => {
  mockSearch(t, [
    {
      name: "document-summary-skill",
      full_name: "example/document-summary-skill",
      description: "Document summarization and requirement extraction checklist generator",
      html_url: "https://github.com/example/document-summary-skill",
      stargazers_count: 80,
      updated_at: new Date().toISOString(),
      owner: { login: "example" }
    }
  ]);

  const result = await runDidimdolPipeline(
    "긴 공모전 안내문을 읽고 핵심 조건과 제출물을 정리하는 데 도움이 되는 AI Skill을 찾고 싶어.",
    { provider: "fallback", dynamicRegistryLimit: 3, dynamicRegistryPerQuery: 1, dynamicRegistryMaxQueries: 1 }
  );

  const candidate = result.userView.candidates[0];
  assert.equal(result.userView.intent.label, "문서 읽기와 핵심 조건 정리");
  assert.ok(candidate.plainTitle.includes("문서") || candidate.plainSummary.includes("문서"));
});

test("approval reads candidate files temporarily and builds a review", async (t) => {
  mockGithubFiles(t, {
    "example/comment-moderation-agent": "Comment moderation skill. Classify comments and detect toxicity."
  });

  const candidate = approvedCandidate({
    id: "github:example/comment-moderation-agent",
    name: "comment-moderation-agent",
    fullName: "example/comment-moderation-agent",
    plainTitle: "댓글 분류를 돕는 도구 후보"
  });

  const result = await runDidimdolPipeline(
    "유튜브 댓글을 분석해서 악성 댓글을 분류하고 싶어.",
    { provider: "fallback" },
    {
      approvedSkillIds: [candidate.id],
      candidates: [candidate]
    }
  );

  assert.equal(result.userView.mode, "skill-review");
  assert.equal(result.userView.inspected.length, 1);
  assert.equal(result.userView.inspected[0].decision, "사용 가능");
  assert.deepEqual(result.userView.inspected[0].checkedFiles, ["README.md"]);
  assert.equal(result.userView.result, undefined);
  assert.equal(result.userView.usable.length, 1);
});

test("approval can inspect multiple selected skills", async (t) => {
  mockGithubFiles(t, {
    "example/comment-moderation-agent": "Comment moderation and classification workflow.",
    "example/classification-workflow": "Classification workflow for analysis tasks."
  });

  const candidates = [
    approvedCandidate({
      id: "github:example/comment-moderation-agent",
      name: "comment-moderation-agent",
      fullName: "example/comment-moderation-agent",
      plainTitle: "댓글 분류를 돕는 도구 후보"
    }),
    approvedCandidate({
      id: "github:example/classification-workflow",
      name: "classification-workflow",
      fullName: "example/classification-workflow",
      plainTitle: "분류 기준을 잡아주는 도구 후보"
    })
  ];

  const result = await runDidimdolPipeline(
    "유튜브 댓글을 분석해서 악성 댓글을 분류하고 싶어.",
    { provider: "fallback" },
    {
      approvedSkillIds: candidates.map((candidate) => candidate.id),
      candidates
    }
  );

  assert.equal(result.userView.mode, "skill-review");
  assert.equal(result.userView.inspected.length, 2);
  assert.deepEqual(result.userView.inspected.map((candidate) => candidate.id), candidates.map((candidate) => candidate.id));
});

test("result generation is separated from skill inspection", async () => {
  const usableSkills = [
    {
      id: "github:example/comment-moderation-agent",
      name: "comment-moderation-agent",
      fullName: "example/comment-moderation-agent",
      plainTitle: "댓글 분류를 돕는 도구 후보",
      checkedFiles: ["README.md"],
      evidence: "Comment moderation and classification workflow.",
      decision: "사용 가능"
    }
  ];

  const result = await generateDidimdolResult(
    "유튜브 댓글을 분석해서 악성 댓글을 분류하고 싶어.",
    { provider: "fallback" },
    { usableSkills }
  );

  assert.equal(result.userView.mode, "generated-result");
  assert.ok(result.userView.result.body.includes("요청"));
});

test("summary result does not paste the full source text", async () => {
  const input = [
    "AI 디딤돌은 비전공자가 AI Skill과 MCP를 몰라도 목적에 맞는 도움을 받을 수 있게 만드는 서비스다.",
    "서비스는 먼저 사용자의 명령과 자료를 분리하고, 필요한 Skill을 찾은 뒤, 승인된 후보만 임시로 읽는다.",
    "그 다음 안전성과 관련성을 확인하고 사용자에게 바로 쓸 수 있는 결과물을 제공한다.",
    "이거 요약해줘"
  ].join("\n");

  const result = await generateDidimdolResult(
    input,
    { provider: "fallback" },
    { usableSkills: [approvedCandidate({ fullName: "example/summary-skill", plainTitle: "요약 도구 후보" })] }
  );

  assert.equal(result.userView.result.title, "요약문");
  assert.ok(result.userView.result.body.includes("핵심 요약"));
  assert.equal(result.userView.result.body.includes("이거 요약해줘"), false);
  assert.notEqual(result.userView.result.body.replace(/\s+/g, " ").trim(), input.replace(/\s+/g, " ").trim());
});

test("one-line summary is a full sentence, not raw text cut off mid-word", async () => {
  const material = [
    "휴먼 디지털 트윈은 사람의 신체적, 내면적 부분을 디지털로 모델링하고 시뮬레이션하는 기술이다.",
    "최근 기술 발전과 함께 휴먼 디지털 트윈은 의료, 교육, 훈련 등 다양한 분야에서 활용되고 있다.",
    "실제와 유사한 환경에서 인간의 행동과 의사결정을 이해하기 위한 연구로 확장되고 있다."
  ].join(" ");
  const input = `${material}\n이거 요약해줘`;

  const result = await generateDidimdolResult(
    input,
    { provider: "fallback" },
    { usableSkills: [approvedCandidate({ fullName: "example/summary-skill", plainTitle: "요약 도구 후보" })] }
  );

  const oneLine = result.userView.result.body.split("## 한 줄 요약")[1].trim();
  assert.ok(oneLine.length > 0);
  assert.equal(oneLine.includes("..."), false);
  assert.ok(/[.!?다요]$/.test(oneLine));
});

function mockSearch(t, repos) {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => ({ ok: true, async json() { return { items: repos }; } });
}

function mockGithubFiles(t, filesByRepo) {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url) => {
    const target = String(url);
    const repo = Object.keys(filesByRepo).find((fullName) => target.includes(`/repos/${fullName}`) || target.includes(`raw.githubusercontent.com/${fullName}/`));
    if (repo && target === `https://api.github.com/repos/${repo}`) {
      return { ok: true, async json() { return { default_branch: "main" }; } };
    }
    if (repo && target.endsWith("/main/README.md")) {
      return { ok: true, async text() { return filesByRepo[repo]; } };
    }
    return { ok: false, async text() { return ""; } };
  };
}

function approvedCandidate(overrides = {}) {
  return {
    id: "github:example/skill",
    name: "skill",
    fullName: "example/skill",
    plainTitle: "도구 후보",
    plainSummary: "요청을 처리하는 데 쓸 수 있는 후보입니다.",
    verdict: { label: "추천 후보", reason: "다음 단계에서 읽어볼 만합니다." },
    precheckLevel: "ok",
    canApprove: true,
    url: "https://github.com/example/skill",
    ...overrides
  };
}
