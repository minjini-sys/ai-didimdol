import assert from "node:assert/strict";
import test from "node:test";
import { runDidimdolPipeline } from "../src/pipeline.js";

const mockRepo = {
  name: "comment-moderation-agent",
  full_name: "example/comment-moderation-agent",
  description: "AI agent workflow for comment moderation and classification",
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

test("explains internet skill candidates in plain Korean", async (t) => {
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
  assert.ok(candidate.plainSummary.includes("댓글") || candidate.plainSummary.includes("문제"));
  assert.ok(candidate.helpsWith.some((item) => item.includes("댓글")));
  assert.ok(candidate.caution.length > 0);
  assert.equal(candidate.downloadPolicy, "승인 전에는 다운로드하지 않고, 로컬에도 저장하지 않습니다.");
});

test("marks broad desktop automation tools as hold candidates", async (t) => {
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
            name: "desktop-agent",
            full_name: "example/desktop-agent",
            description: "Personal AI desktop agent with browser automation and terminal commands",
            html_url: "https://github.com/example/desktop-agent",
            stargazers_count: 500,
            updated_at: new Date().toISOString(),
            owner: { login: "example" }
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
  assert.equal(candidate.verdict.label, "추천 보류");
  assert.equal(candidate.riskLevel, "보류");
  assert.ok(candidate.caution.some((item) => item.includes("바로 사용하면 위험")));
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
    verdict: { label: "검토 추천", reason: "다음 단계에서 읽어볼 만합니다." },
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
