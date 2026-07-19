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

test("approval does not store the skill locally in this step", async () => {
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

  assert.equal(result.userView.mode, "approved");
  assert.equal(result.userView.approved.length, 1);
  assert.ok(result.userView.message.includes("로컬에 저장하지 않았습니다"));
});

test("approval can include multiple selected skills", async () => {
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

  assert.equal(result.userView.mode, "approved");
  assert.equal(result.userView.approved.length, 2);
  assert.deepEqual(result.userView.approved.map((candidate) => candidate.id), candidates.map((candidate) => candidate.id));
});
