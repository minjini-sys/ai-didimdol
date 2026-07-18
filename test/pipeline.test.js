import assert from "node:assert/strict";
import test from "node:test";
import { runDidimdolPipeline } from "../src/pipeline.js";

const config = { provider: "fallback" };

test("routes phishing-like message to safety workflow", async () => {
  const result = await runDidimdolPipeline(
    "동네 어르신들이 병원 예약 문자와 보이스피싱 문자를 구분하고, 가족에게 묻기 전에 AI로 먼저 확인할 수 있게 돕고 싶어.",
    config
  );

  assert.equal(result.route.riskLevel, "high");
  assert.ok(result.route.taskTypes.includes("verify"));
  assert.ok(result.route.capabilities.includes("위험 신호 탐지"));
  assert.ok(result.route.capabilities.includes("개인정보 보호"));
  assert.equal(result.safety.status, "confirm");
  assert.ok(result.userView.recommendedSkills.includes("보이스피싱 위험 신호 체크 스킬"));
  assert.ok(result.userView.recommendedAgents.includes("Safety Coach"));
});

test("routes hackathon idea request to ideation and validation workflow", async () => {
  const result = await runDidimdolPipeline(
    "해커톤 포용적 AI 아이디어를 만들고 이게 필요할까 대체되지 않을까 검증하고 싶어.",
    config
  );

  assert.ok(result.route.taskTypes.includes("create"));
  assert.ok(result.route.taskTypes.includes("verify"));
  assert.ok(result.route.capabilities.includes("아이디어 생성"));
  assert.ok(result.route.capabilities.includes("아이디어 검증"));
  assert.ok(result.userView.recommendedSkills.includes("Heuristic Ideation 스킬"));
  assert.ok(result.userView.recommendedSkills.includes("Startup Validating 스킬"));
});

