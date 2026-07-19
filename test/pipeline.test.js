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

test("uses internet skill candidates instead of local registry entries", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => ({ ok: true, async json() { return { items: [mockRepo] }; } });

  const result = await runDidimdolPipeline(
    "유튜브 댓글을 분석해서 악성 댓글을 분류하고 싶어.",
    { provider: "fallback", dynamicRegistryLimit: 3, dynamicRegistryPerQuery: 1, dynamicRegistryMaxQueries: 1 }
  );

  assert.equal(result.userView.search.source, "GitHub 실시간 검색");
  assert.equal(result.userView.candidates.length, 1);
  assert.equal(result.userView.candidates[0].fullName, "example/comment-moderation-agent");
  assert.equal(result.userView.candidates[0].downloadPolicy, "승인 전에는 다운로드하지 않고, 로컬에도 저장하지 않습니다.");
});

test("approval does not store the skill locally in this step", async () => {
  const candidate = {
    id: "github:example/comment-moderation-agent",
    name: "comment-moderation-agent",
    fullName: "example/comment-moderation-agent",
    description: "AI agent workflow for comment moderation and classification",
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
