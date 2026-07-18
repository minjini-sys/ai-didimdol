export function fallbackPlan(route, matches, safety) {
  if (safety.status === "block") {
    return {
      title: "이 요청은 안전하게 처리할 수 없습니다",
      plainAnswer: "이 요청은 개인정보, 불법 행위, 계정 보안 위험이 있어 실행하지 않습니다. 대신 안전한 공식 경로를 안내할 수 있습니다.",
      steps: [
        "민감정보를 입력하지 않습니다.",
        "공식 기관이나 서비스 고객센터를 직접 이용합니다.",
        "필요하면 보호자, 담당자, 전문가에게 확인합니다."
      ]
    };
  }

  const steps = [
    "사용자 입력에서 개인정보와 민감한 내용을 먼저 가립니다.",
    ...route.capabilities.slice(0, 4).map((capability) => `${capability} 기능을 사용해 요청을 처리합니다.`),
    "AI 판단의 불확실성과 공식 확인 방법을 함께 제시합니다.",
    "사용자가 바로 따라 할 수 있는 다음 행동을 쉬운 말로 정리합니다."
  ];

  return {
    title: route.riskLevel === "high" ? "안전 확인을 먼저 하는 실행 계획" : "바로 실행 가능한 AI 활용 계획",
    plainAnswer: buildPlainAnswer(route),
    steps
  };
}

export async function buildPlan(input, route, matches, safety, llm) {
  const fallback = fallbackPlan(route, matches, safety);
  const result = await llm.plan?.(input, route, matches, safety, fallback);
  return normalizePlan(result || fallback, fallback);
}

function buildPlainAnswer(route) {
  if (route.capabilities.includes("위험 신호 탐지")) {
    return "문자나 안내 내용의 위험 신호를 먼저 확인하고, 공식 경로로 검증한 뒤 다음 행동을 안내합니다.";
  }
  if (route.capabilities.includes("아이디어 검증")) {
    return "아이디어를 바로 확정하지 않고 필요성, 대체 가능성, 실현 가능성을 나눠 검증합니다.";
  }
  if (route.capabilities.includes("홍보 문구 생성")) {
    return "대상 고객과 채널을 정한 뒤 홍보 문구 후보와 작은 실험 계획을 만듭니다.";
  }
  return "요청을 쉬운 말로 다시 정리하고, 필요한 AI 기능과 실행 순서를 안내합니다.";
}

function normalizePlan(plan, fallback) {
  return {
    title: plan.title || fallback.title,
    plainAnswer: plan.plainAnswer || fallback.plainAnswer,
    steps: Array.isArray(plan.steps) && plan.steps.length ? plan.steps : fallback.steps
  };
}

