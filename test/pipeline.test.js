import assert from "node:assert/strict";
import test from "node:test";
import { runDidimdolPipeline } from "../src/pipeline.js";

const config = { provider: "fallback", dynamicRegistry: false };

test("asks meeting users one question at a time before using skills", async () => {
  const result = await runDidimdolPipeline(
    "AI로 회의 음성을 자동으로 받아쓰고 요약한 다음 Notion에 정리하는 도구 조합을 찾고 싶어.",
    config
  );

  assert.equal(result.userView.mode, "clarify");
  assert.equal(result.userView.question.id, "meeting_source");
  assert.equal(result.userView.warnings.length, 0);
});

test("asks for skill consent after clarification is complete", async () => {
  const result = await runDidimdolPipeline(
    "AI로 회의 음성을 자동으로 받아쓰고 요약한 다음 Notion에 정리하는 도구 조합을 찾고 싶어.",
    config,
    {
      answers: {
        meeting_source: "줌 녹화 파일",
        summary_style: "핵심 요약 + 결정 사항 + 할 일",
        notion_target: "회의록 데이터베이스에 새 항목으로 추가"
      }
    }
  );

  assert.equal(result.userView.mode, "skill-consent");
  assert.ok(result.userView.consent.skills.some((skill) => skill.id === "meeting-transcription"));
  assert.ok(result.userView.consent.skills.some((skill) => skill.id === "notion-formatter"));
});

test("creates meeting and Notion result after approved skills", async () => {
  const result = await runDidimdolPipeline(
    "AI로 회의 음성을 자동으로 받아쓰고 요약한 다음 Notion에 정리하는 도구 조합을 찾고 싶어.",
    config,
    {
      answers: {
        meeting_source: "줌 녹화 파일",
        summary_style: "핵심 요약 + 결정 사항 + 할 일",
        notion_target: "회의록 데이터베이스에 새 항목으로 추가"
      },
      skillConsent: "approved",
      approvedSkillIds: ["meeting-transcription", "meeting-summary", "notion-formatter"]
    }
  );

  assert.equal(result.userView.mode, "answer");
  assert.ok(result.matches.skills.some((skill) => skill.name === "회의 받아쓰기 스킬"));
  assert.ok(result.matches.mcps.some((mcp) => mcp.name === "Notion MCP"));
  assert.ok(result.userView.deliverables.some((section) => section.title.includes("Notion 회의록 템플릿")));
  assert.equal(result.userView.warnings.length, 0);
});

test("continues without skills when the user denies consent", async () => {
  const result = await runDidimdolPipeline(
    "AI로 회의 음성을 자동으로 받아쓰고 요약한 다음 Notion에 정리하는 도구 조합을 찾고 싶어.",
    config,
    {
      answers: {
        meeting_source: "휴대폰 녹음 파일",
        summary_style: "핵심 요약 + 할 일",
        notion_target: "새 페이지"
      },
      skillConsent: "denied",
      rejectedSkillIds: ["meeting-transcription", "meeting-summary", "notion-formatter"]
    }
  );

  assert.equal(result.userView.mode, "answer");
  assert.equal(result.matches.skills.length, 0);
  assert.ok(result.userView.deliverables.some((section) => section.items.some((item) => item.includes("승인된 Skill 없이"))));
});

test("creates usable copy and weekly plan for a small cafe request", async () => {
  const result = await runDidimdolPipeline(
    "작은 카페를 운영하는데 동네 손님에게 보낼 홍보 문구와 이번 주 실행 계획을 만들고 싶어.",
    config,
    {
      answers: {
        target_customer: "동네 단골 손님",
        offer: "바닐라 라떼와 쿠키 증정"
      },
      skillConsent: "approved",
      approvedSkillIds: ["small-business-copy", "weekly-action-plan"]
    }
  );

  assert.ok(result.route.taskTypes.includes("create"));
  assert.ok(result.route.taskTypes.includes("plan"));
  assert.ok(result.matches.skills.some((skill) => skill.name === "소상공인 홍보 문구 스킬"));
  assert.equal(result.matches.mcps.length, 0);
  assert.ok(result.userView.deliverables.some((section) => section.title.includes("홍보 문구")));
  assert.equal(result.userView.warnings.length, 0);
});

test("shows remote candidates only when the user explicitly asks for GitHub/latest search", async (t) => {
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
            name: "copywriting-agent-tool",
            full_name: "example/copywriting-agent-tool",
            description: "Marketing copywriting agent for small business",
            html_url: "https://github.com/example/copywriting-agent-tool",
            stargazers_count: 240,
            updated_at: new Date().toISOString(),
            owner: { login: "example" }
          }
        ]
      };
    }
  });

  const result = await runDidimdolPipeline(
    "GitHub에서 작은 카페 홍보를 위한 최신 copywriting agent 후보를 찾아서 추천해줘.",
    {
      provider: "fallback",
      dynamicRegistry: true,
      dynamicRegistryLimit: 3,
      dynamicRegistryPerQuery: 1,
      dynamicRegistryMaxQueries: 1,
      dynamicRegistryMinTrust: 35,
      dynamicRegistryTimeoutMs: 1000
    },
    {
      answers: {
        target_customer: "동네 단골",
        offer: "아메리카노 할인"
      },
      skillConsent: "approved",
      approvedSkillIds: ["small-business-copy", "weekly-action-plan"]
    }
  );

  assert.equal(result.matches.remote.enabled, true);
  assert.equal(result.matches.remote.status, "ok");
  assert.ok(result.matches.remote.candidates.some((candidate) => candidate.url.includes("github.com/example/copywriting-agent-tool")));
  assert.ok(result.userView.routerTrace.some((stage) => stage.title.includes("실시간 후보 검색")));
});
