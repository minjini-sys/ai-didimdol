export function fallbackPlan(input, route, matches, safety) {
  if (safety.status === "block") {
    return {
      title: "요청을 안전하게 처리할 수 없습니다",
      plainAnswer: "이 요청은 개인정보, 불법 행위, 계정 보안 위험이 있어 실행하지 않습니다. 대신 안전한 공식 경로를 안내할 수 있습니다.",
      steps: [
        "민감정보를 입력하지 않습니다.",
        "공식 기관이나 서비스 고객센터를 직접 이용합니다.",
        "필요하면 보호자, 담당자, 전문가에게 확인합니다."
      ],
      deliverables: [
        {
          title: "안전 안내",
          items: [
            "비밀번호, 인증번호, 계좌번호는 AI나 낯선 링크에 입력하지 않습니다.",
            "급하게 송금을 요구하거나 링크 클릭을 재촉하면 먼저 멈춥니다."
          ]
        }
      ]
    };
  }

  if (route.capabilities.includes("홍보 문구 생성") || route.capabilities.includes("실행 계획 생성")) {
    return buildSmallBusinessPlan(input, route);
  }

  if (route.capabilities.includes("위험 신호 탐지")) {
    return buildSafetyCheckPlan();
  }

  if (route.capabilities.includes("아이디어 생성") || route.capabilities.includes("아이디어 검증")) {
    return buildIdeaValidationPlan();
  }

  return {
    title: route.riskLevel === "high" ? "안전 확인을 먼저 하는 실행 계획" : "바로 실행 가능한 AI 활용 계획",
    plainAnswer: "요청을 쉬운 말로 다시 정리하고, 필요한 AI 능력과 실행 순서를 안내합니다.",
    steps: [
      "사용자의 목표와 원하는 결과물을 한 문장으로 정리합니다.",
      ...route.capabilities.slice(0, 4).map((capability) => `${capability} 기능으로 요청을 처리합니다.`),
      "바로 쓸 수 있는 초안과 다음 행동을 함께 제공합니다."
    ],
    deliverables: [
      {
        title: "요청 정리",
        items: [`사용자가 원하는 일: ${route.intent}`]
      }
    ]
  };
}

export async function buildPlan(input, route, matches, safety, llm) {
  const fallback = fallbackPlan(input, route, matches, safety);
  const result = await llm.plan?.(input, route, matches, safety, fallback);
  return normalizePlan(result || fallback, fallback);
}

function buildSmallBusinessPlan() {
  return {
    title: "동네 카페 홍보 문구와 이번 주 실행 계획",
    plainAnswer: "AI 디딤돌은 이 요청을 단순한 질문으로 끝내지 않고, 홍보 문구 생성 스킬과 주간 실행 계획 스킬을 조합해 바로 사용할 수 있는 초안을 만듭니다.",
    steps: [
      "목적을 '동네 손님에게 방문 이유 만들기'로 정리합니다.",
      "소상공인 홍보 문구 스킬로 채널별 문구 후보를 만듭니다.",
      "Planner Agent로 이번 주 실행 순서를 만듭니다.",
      "반응을 확인할 지표를 정하고 다음 주에 문구를 개선합니다."
    ],
    deliverables: [
      {
        title: "홍보 문구 후보",
        items: [
          "이번 주, 동네 카페에서 따뜻한 커피 한 잔 쉬어가세요. 단골 손님께는 작은 쿠키를 함께 드립니다.",
          "퇴근길 10분, 조용한 카페에서 오늘 하루를 정리해보세요. 이번 주 추천 메뉴는 바닐라 라떼입니다.",
          "동네 손님을 위한 이번 주 이벤트: 친구와 함께 오시면 두 번째 음료 1,000원 할인."
        ]
      },
      {
        title: "이번 주 실행 계획",
        items: [
          "월요일: 이번 주 대표 메뉴와 혜택 하나를 정합니다.",
          "화요일: 매장 앞 안내판과 인스타그램에 같은 문구를 올립니다.",
          "수요일: 단골 손님에게 부담 없는 톤으로 이벤트를 직접 안내합니다.",
          "목요일: 가장 반응이 좋았던 문구를 짧게 수정해 다시 게시합니다.",
          "금요일: 퇴근 시간대 손님을 겨냥한 문구를 추가로 올립니다.",
          "주말: 방문 손님 수, 이벤트 사용 수, 많이 팔린 메뉴를 기록합니다."
        ]
      },
      {
        title: "확인할 지표",
        items: [
          "문구를 본 뒤 방문했다고 말한 손님 수",
          "이벤트 사용 횟수",
          "대표 메뉴 판매량",
          "다음 주에도 반복할 만한 문구 1개"
        ]
      }
    ]
  };
}

function buildSafetyCheckPlan() {
  return {
    title: "문자 안전 확인 절차",
    plainAnswer: "문자 내용을 바로 믿지 않고 위험 신호를 먼저 확인한 뒤 공식 경로로 확인하도록 돕습니다.",
    steps: [
      "문자에서 링크, 송금 요구, 인증번호 요구가 있는지 확인합니다.",
      "개인정보를 가리고 AI에게 위험 신호만 점검하게 합니다.",
      "병원이나 기관 대표번호를 직접 검색해 확인합니다.",
      "가족에게 보낼 짧은 확인 문장을 만듭니다."
    ],
    deliverables: [
      {
        title: "가족에게 보낼 문장",
        items: [
          "이 문자에 링크와 개인정보 요구가 있어서 바로 누르지 않고 확인하려고 해요. 병원 대표번호로 먼저 확인해도 될까요?"
        ]
      }
    ]
  };
}

function buildIdeaValidationPlan() {
  return {
    title: "아이디어 생성과 검증 계획",
    plainAnswer: "아이디어를 바로 확정하지 않고, 여러 방향으로 넓힌 뒤 필요성, 대체 가능성, 실제 도움 여부를 검증합니다.",
    steps: [
      "문제 상황과 대상 사용자를 분리합니다.",
      "Heuristic Ideation으로 아이디어 후보를 넓힙니다.",
      "Startup Validating으로 필요성, 대체 가능성, 실현 가능성을 검증합니다.",
      "시연 가능한 최소 기능을 정합니다."
    ],
    deliverables: [
      {
        title: "검증 질문",
        items: [
          "이 문제는 사용자가 실제로 자주 겪는가?",
          "기존 ChatGPT나 검색으로 쉽게 대체되는가?",
          "AI 디딤돌이 절차를 대신 설계해 주기 때문에 추가 가치가 있는가?"
        ]
      }
    ]
  };
}

function normalizePlan(plan, fallback) {
  return {
    title: plan.title || fallback.title,
    plainAnswer: plan.plainAnswer || fallback.plainAnswer,
    steps: Array.isArray(plan.steps) && plan.steps.length ? plan.steps : fallback.steps,
    deliverables: normalizeDeliverables(plan.deliverables, fallback.deliverables)
  };
}

function normalizeDeliverables(deliverables, fallbackDeliverables = []) {
  if (!Array.isArray(deliverables) || deliverables.length === 0) return fallbackDeliverables;
  return deliverables
    .map((section) => ({
      title: section.title || "결과",
      items: Array.isArray(section.items) ? section.items.filter(Boolean).map(String) : []
    }))
    .filter((section) => section.items.length > 0);
}
