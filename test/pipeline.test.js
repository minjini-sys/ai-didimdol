import assert from "node:assert/strict";
import test from "node:test";
import { runDidimdolPipeline } from "../src/pipeline.js";

const mockRepo = {
  name: "comment-moderation-agent",
  full_name: "example/comment-moderation-agent",
  description: "AI workflow for comment moderation and classification",
  html_url: "https://github.com/example/comment-moderation-agent",
  stargazers_count: 120,
  updated_at: new Date().toISOString(),
  owner: { login: "example" }
};

test("detects user intent before searching for skills", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => ({ ok: true, async json() { return { items: [mockRepo] }; } });

  const result = await runDidimdolPipeline(
    "유튜브 댓글을 분석해서 악성 댓글을 분류하고 싶어.",
    { provider: "fallback", dynamicRegistryLimit: 3, dynamicRegistryPerQuery: 1, dynamicRegistryMaxQueries: 1 }
  );

  assert.equal(result.userView.mode, "skill-approval");
  assert.equal(result.userView.intent.label, "댓글 분석과 악성 댓글 분류");
  assert.ok(result.userView.intent.needs.includes("댓글 분석과 악성 댓글 분류"));
});

test("explains internet skill candidates with filled user-facing sections", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => ({ ok: true, async json() { return { items: [mockRepo] }; } });

  const result = await runDidimdolPipeline(
    "유튜브 댓글을 분석해서 악성 댓글을 분류하고 싶어.",
    { provider: "fallback", dynamicRegistryLimit: 3, dynamicRegistryPerQuery: 1, dynamicRegistryMaxQueries: 1 }
  );

  const candidate = result.userView.candidates[0];
  assert.equal(result.userView.search.source, "GitHub 실시간 검색");
  assert.equal(candidate.fullName, "example/comment-moderation-agent");
  assert.ok(candidate.plainTitle.includes("댓글"));
  assert.ok(candidate.helpsWith.length > 0);
  assert.ok(candidate.intentFit.includes("댓글 분석과 악성 댓글 분류"));
  assert.equal(candidate.downloadPolicy, "승인 전에는 다운로드하지 않고, 로컬에도 저장하지 않습니다.");
});

test("fallback candidate explanations stay different per repository", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        items: [
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
        ]
      };
    }
  });

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

test("selection step keeps risk wording internal and uses verdict instead", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => ({ ok: true, async json() { return { items: [mockRepo] }; } });

  const result = await runDidimdolPipeline(
    "유튜브 댓글을 분석해서 악성 댓글을 분류하고 싶어.",
    { provider: "fallback", dynamicRegistryLimit: 3, dynamicRegistryPerQuery: 1, dynamicRegistryMaxQueries: 1 }
  );

  const viewText = JSON.stringify(result.userView);
  assert.ok(result.userView.candidates[0].verdict.label);
  assert.equal(viewText.includes(`위험${"도:"}`), false);
  assert.equal(viewText.includes(`확인 ${"필요"}`), false);
  assert.equal(viewText.includes(`검토 ${"필요"}`), false);
});

test("blocked candidates cannot be approved or downloaded", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        items: [
          {
            name: "browserwing",
            full_name: "browserwing/browserwing",
            description: "Browser automation agent that can run terminal commands and control a browser",
            html_url: "https://github.com/browserwing/browserwing",
            stargazers_count: 1377,
            updated_at: new Date().toISOString(),
            owner: { login: "browserwing" }
          }
        ]
      };
    }
  });

  const result = await runDidimdolPipeline(
    "반복 업무를 자동화하는 Skill을 찾고 싶어.",
    { provider: "fallback", dynamicRegistryLimit: 3, dynamicRegistryPerQuery: 1, dynamicRegistryMaxQueries: 1 }
  );

  const candidate = result.userView.candidates[0];
  assert.equal(candidate.canApprove, false);
  assert.equal(candidate.verdict.label, "다운로드 차단");
  assert.equal(candidate.precheckLevel, "blocked");
});

test("routes contest notices to document requirement extraction", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        items: [
          {
            name: "document-summary-skill",
            full_name: "example/document-summary-skill",
            description: "Document summarization and requirement extraction checklist generator",
            html_url: "https://github.com/example/document-summary-skill",
            stargazers_count: 80,
            updated_at: new Date().toISOString(),
            owner: { login: "example" }
          }
        ]
      };
    }
  });

  const result = await runDidimdolPipeline(
    "긴 공모전 안내문을 읽고 핵심 조건과 제출물을 정리하는 데 도움이 되는 AI Skill을 찾고 싶어.",
    { provider: "fallback", dynamicRegistryLimit: 3, dynamicRegistryPerQuery: 1, dynamicRegistryMaxQueries: 1 }
  );

  const candidate = result.userView.candidates[0];
  assert.equal(result.userView.intent.label, "문서 읽기와 핵심 조건 정리");
  assert.ok(candidate.plainTitle.includes("긴 문서"));
  assert.ok(candidate.helpsWith.some((item) => item.includes("제출물") || item.includes("조건")));
});

test("approval reads candidate files temporarily and builds a review", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target === "https://api.github.com/repos/example/comment-moderation-agent") {
      return { ok: true, async json() { return { default_branch: "main" }; } };
    }
    if (target.endsWith("/main/README.md")) {
      return { ok: true, async text() { return "Comment moderation skill. Classify comments and detect toxicity."; } };
    }
    return { ok: false, async text() { return ""; } };
  };

  const candidate = {
    id: "github:example/comment-moderation-agent",
    name: "comment-moderation-agent",
    fullName: "example/comment-moderation-agent",
    plainTitle: "댓글을 분류하거나 문제 댓글을 찾는 도구 후보",
    plainSummary: "댓글을 읽고 유형별로 나누는 데 쓰일 수 있는 후보입니다.",
    verdict: { label: "추천 후보", reason: "다음 단계에서 읽어볼 만합니다." },
    precheckLevel: "ok",
    canApprove: true,
    url: "https://github.com/example/comment-moderation-agent"
  };

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
  assert.ok(result.userView.result.body.includes("사용자 요청"));
});

test("approval can inspect multiple selected skills", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.startsWith("https://api.github.com/repos/example/")) {
      return { ok: true, async json() { return { default_branch: "main" }; } };
    }
    if (target.includes("/comment-moderation-agent/") && target.endsWith("/README.md")) {
      return { ok: true, async text() { return "Comment moderation and classification workflow."; } };
    }
    if (target.includes("/classification-workflow/") && target.endsWith("/README.md")) {
      return { ok: true, async text() { return "Classification workflow for analysis tasks."; } };
    }
    return { ok: false, async text() { return ""; } };
  };

  const candidates = [
    {
      id: "github:example/comment-moderation-agent",
      name: "comment-moderation-agent",
      fullName: "example/comment-moderation-agent",
      plainTitle: "댓글을 분류하거나 문제 댓글을 찾는 도구 후보",
      plainSummary: "댓글을 읽고 유형별로 나누는 데 쓰일 수 있는 후보입니다.",
      verdict: { label: "추천 후보", reason: "다음 단계에서 읽어볼 만합니다." },
      precheckLevel: "ok",
      canApprove: true,
      url: "https://github.com/example/comment-moderation-agent"
    },
    {
      id: "github:example/classification-workflow",
      name: "classification-workflow",
      fullName: "example/classification-workflow",
      plainTitle: "분류 기준을 잡아주는 도구 후보",
      plainSummary: "여러 문장을 기준별로 나누는 데 쓰일 수 있는 후보입니다.",
      verdict: { label: "관련 후보", reason: "파일 내용을 한 번 더 확인합니다." },
      precheckLevel: "review",
      canApprove: true,
      url: "https://github.com/example/classification-workflow"
    }
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
