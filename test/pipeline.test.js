import assert from "node:assert/strict";
import test from "node:test";
import { runDidimdolPipeline } from "../src/pipeline.js";

const config = { provider: "fallback", dynamicRegistry: false };

test("routes phishing-like message to safety workflow without exposing admin labels", async () => {
  const result = await runDidimdolPipeline(
    "동네 어르신들이 병원 예약 문자와 보이스피싱 문자를 구분하고, 가족에게 묻기 전에 AI로 먼저 확인할 수 있게 돕고 싶어.",
    config
  );

  assert.equal(result.route.riskLevel, "high");
  assert.ok(result.route.taskTypes.includes("verify"));
  assert.ok(result.route.capabilities.includes("위험 신호 탐지"));
  assert.ok(result.route.capabilities.includes("개인정보 보호"));
  assert.ok(result.userView.warnings.length > 0);
  assert.ok(result.userView.deliverables.some((section) => section.title.includes("가족")));
});

test("routes hackathon idea request to installed ideation and validation skills", async () => {
  const result = await runDidimdolPipeline(
    "해커톤 지정공모 포용적 AI 아이디어를 만들고 이게 필요할까 대체되지 않을까 검증하고 싶어.",
    config
  );

  assert.ok(result.route.taskTypes.includes("create"));
  assert.ok(result.route.taskTypes.includes("verify"));
  assert.ok(result.route.capabilities.includes("아이디어 생성"));
  assert.ok(result.route.capabilities.includes("아이디어 검증"));
  assert.ok(result.matches.skills.some((skill) => skill.name === "Heuristic Ideation 스킬"));
  assert.ok(result.matches.skills.some((skill) => skill.name === "Startup Validating 스킬"));
});

test("creates usable copy and weekly plan for a small cafe request without showing unused MCP", async () => {
  const result = await runDidimdolPipeline(
    "작은 카페를 운영하는데 동네 손님에게 보낼 홍보 문구와 이번 주 실행 계획을 만들고 싶어.",
    config
  );

  assert.ok(result.route.taskTypes.includes("create"));
  assert.ok(result.route.taskTypes.includes("plan"));
  assert.ok(result.route.capabilities.includes("홍보 문구 생성"));
  assert.ok(result.route.capabilities.includes("실행 계획 생성"));
  assert.ok(result.matches.skills.some((skill) => skill.name === "소상공인 홍보 문구 스킬"));
  assert.ok(result.matches.skills.some((skill) => skill.name === "주간 실행 계획 스킬"));
  assert.equal(result.matches.mcps.length, 0);
  assert.ok(result.matches.agents.some((agent) => agent.name === "Planner Agent"));
  assert.ok(result.matches.agents.some((agent) => agent.name === "Copywriter Agent"));
  assert.ok(result.userView.deliverables.some((section) => section.title.includes("홍보 문구")));
  assert.ok(result.userView.deliverables.some((section) => section.title.includes("실행 계획")));
  assert.equal(result.userView.warnings.length, 0);
});

test("creates concrete tool workflow for youtube comment analysis and sheet storage", async () => {
  const result = await runDidimdolPipeline(
    "유튜브 댓글을 분석해서 악성 댓글을 분류하고 결과를 구글시트에 저장하는 AI 도구 조합을 찾고 싶어.",
    config
  );

  assert.ok(result.route.taskTypes.includes("connect"));
  assert.ok(result.route.capabilities.includes("댓글 분석"));
  assert.ok(result.route.capabilities.includes("악성 댓글 분류"));
  assert.ok(result.route.capabilities.includes("스프레드시트 저장"));
  assert.ok(result.matches.mcps.some((mcp) => mcp.name === "YouTube Data MCP"));
  assert.ok(result.matches.mcps.some((mcp) => mcp.name === "Google Sheets MCP"));
  assert.ok(result.userView.deliverables.some((section) => section.title.includes("추천 도구 조합")));
  assert.ok(result.userView.deliverables.some((section) => section.title.includes("구글시트 컬럼")));
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
    "GitHub에서 작은 카페 홍보에 쓸 최신 copywriting agent 후보를 찾아서 추천해줘.",
    {
      provider: "fallback",
      dynamicRegistry: true,
      dynamicRegistryLimit: 3,
      dynamicRegistryPerQuery: 1,
      dynamicRegistryMaxQueries: 1,
      dynamicRegistryMinTrust: 35,
      dynamicRegistryTimeoutMs: 1000
    }
  );

  assert.equal(result.matches.remote.enabled, true);
  assert.equal(result.matches.remote.status, "ok");
  assert.ok(result.matches.remote.candidates.some((candidate) => candidate.url.includes("github.com/example/copywriting-agent-tool")));
  assert.ok(result.userView.routerTrace.some((stage) => stage.title.includes("실시간 후보 검색")));
});
