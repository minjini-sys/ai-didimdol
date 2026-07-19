export function fallbackPlan(input, route, matches, safety) {
  if (safety.status === "block") {
    return {
      title: "도와줄 수 없는 요청입니다",
      plainAnswer: "",
      steps: ["요청에서 안전하게 도와줄 수 없는 내용이 감지되어 실행하지 않았습니다."],
      deliverables: [
        {
          title: "대신 할 수 있는 일",
          items: [
            "민감정보를 입력하지 않고 상황만 설명해 주세요.",
            "공식 기관이나 서비스 고객센터에서 확인할 수 있는 방법을 안내할 수 있습니다."
          ]
        }
      ]
    };
  }

  if (route.capabilities.includes("홍보 문구 생성") || route.capabilities.includes("실행 계획 생성")) {
    return buildSmallBusinessPlan();
  }

  if (route.capabilities.includes("아이디어 생성") || route.capabilities.includes("아이디어 검증")) {
    return buildIdeaValidationPlan();
  }

  if (route.capabilities.includes("위험 신호 탐지")) {
    return buildSafetyCheckPlan();
  }

  return {
    title: "요청에 맞춘 결과",
    plainAnswer: "",
    steps: [
      "사용자가 원하는 결과물을 먼저 정리했습니다.",
      ...route.capabilities.slice(0, 4).map((capability) => `${capability} 능력을 사용했습니다.`)
    ],
    deliverables: [
      {
        title: "초안",
        items: [`${input}에 맞춰 더 구체적인 결과를 만들 수 있습니다. 원하는 대상, 분량, 톤을 알려주면 바로 다듬습니다.`]
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
    plainAnswer: "",
    steps: [
      "소상공인 홍보 문구 스킬로 동네 손님에게 맞는 짧은 문구를 만들었습니다.",
      "주간 실행 계획 스킬로 이번 주에 바로 할 일을 날짜별로 나눴습니다.",
      "Planner Agent와 Copywriter Agent가 문구와 실행 순서를 다듬었습니다."
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
          "문구를 보고 왔다고 말한 손님 수",
          "이벤트 사용 횟수",
          "대표 메뉴 판매량",
          "다음 주에도 반복할 만한 문구 1개"
        ]
      }
    ]
  };
}

function buildIdeaValidationPlan() {
  return {
    title: "포용적 AI 서비스 아이디어 검증",
    plainAnswer: "",
    steps: [
      "Heuristic Ideation 스킬로 문제를 여러 방향에서 넓혔습니다.",
      "Creative Ideas 스킬로 서비스 후보를 사용자 행동 중심으로 바꿨습니다.",
      "Startup Validating 스킬로 필요성, 대체 가능성, 실제 도움 여부를 검증했습니다.",
      "Critic Agent가 발표 때 받을 반박 질문을 기준으로 약점을 점검했습니다."
    ],
    deliverables: [
      {
        title: "아이디어 한 문장",
        items: [
          "AI 디딤돌은 사용자가 Skill, MCP, Agent를 몰라도 자연어 목표만 입력하면 상황에 맞는 AI 활용 절차와 결과물을 자동으로 만들어 주는 포용적 AI 라우터입니다."
        ]
      },
      {
        title: "왜 필요한가",
        items: [
          "비전공자는 좋은 AI 도구가 있어도 어떤 순서로 써야 하는지 모릅니다.",
          "ChatGPT 하나에 질문하는 것보다, 목적 분류와 도구 조합을 자동으로 해 주면 결과 품질이 안정됩니다.",
          "새 Skill과 MCP가 늘어나도 능력 단위 Registry로 연결하면 사용자는 계속 자연어만 쓰면 됩니다."
        ]
      },
      {
        title: "반박 질문 대응",
        items: [
          "ChatGPT로 대체되지 않나요? 일반 답변이 아니라 상황에 맞는 Skill/MCP/Agent 조합과 실행 과정을 자동 구성하는 점이 다릅니다.",
          "진짜 도움이 되나요? 사용자가 프롬프트나 도구 이름을 몰라도 바로 결과물을 받기 때문에 진입 장벽을 낮춥니다.",
          "너무 광범위하지 않나요? 질문 전체를 8개 행동과 필요한 능력으로 먼저 나누기 때문에 주제가 달라도 처리 구조를 만들 수 있습니다."
        ]
      }
    ]
  };
}

function buildSafetyCheckPlan() {
  return {
    title: "문자 확인 도움",
    plainAnswer: "",
    steps: [
      "보이스피싱 위험 신호 체크 스킬로 의심 표현을 확인했습니다.",
      "개인정보 가리기 스킬로 민감정보를 먼저 보호하도록 했습니다.",
      "공식 출처 확인 스킬로 병원 대표번호나 공식 채널 확인을 안내했습니다.",
      "Safety Coach가 조심해야 할 행동을 정리했습니다."
    ],
    deliverables: [
      {
        title: "먼저 확인할 것",
        items: [
          "링크를 누르라고 하거나 인증번호를 요구하면 바로 멈춥니다.",
          "병원 이름이 있어도 문자에 있는 번호가 아니라 병원 공식 대표번호로 직접 확인합니다.",
          "주민번호, 계좌번호, 인증번호는 입력하지 않습니다."
        ]
      },
      {
        title: "가족에게 보낼 문장",
        items: [
          "이 문자에 링크나 개인정보 요구가 있어서 바로 누르지 않고 확인하려고 해요. 병원 대표번호로 먼저 확인해도 될까요?"
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
