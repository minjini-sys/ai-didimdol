export function fallbackPlan(input, route, matches, safety) {
  if (safety.status === "block") {
    return {
      title: "도와줄 수 없는 요청입니다",
      plainAnswer: "",
      steps: ["안전하게 도와줄 수 없는 내용이 있어 실행하지 않았습니다."],
      deliverables: [
        {
          title: "대신 할 수 있는 일",
          items: [
            "민감정보를 빼고 상황만 다시 설명해 주세요.",
            "공식 기관이나 서비스 고객센터에서 확인할 수 있는 방법을 안내할 수 있습니다."
          ]
        }
      ]
    };
  }

  if (route.capabilities.includes("댓글 분석") || route.capabilities.includes("스프레드시트 저장")) {
    return buildCommentWorkflowPlan();
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

  return buildGeneralPlan(input, route, matches);
}

export async function buildPlan(input, route, matches, safety, llm) {
  const fallback = fallbackPlan(input, route, matches, safety);
  const result = await llm.plan?.(input, route, matches, safety, fallback);
  return normalizePlan(result || fallback, fallback);
}

function buildCommentWorkflowPlan() {
  return {
    title: "유튜브 댓글 분석과 구글시트 저장 자동화 설계",
    plainAnswer: "",
    steps: [
      "유튜브 댓글을 가져옵니다.",
      "댓글을 악성, 질문, 칭찬, 개선 요청, 기타로 분류합니다.",
      "분류 이유와 대응 우선순위를 붙입니다.",
      "결과를 구글시트에 자동 저장합니다."
    ],
    deliverables: [
      {
        title: "추천 도구 조합",
        items: [
          "YouTube Data MCP: 영상 URL이나 영상 ID를 기준으로 댓글을 가져옵니다.",
          "댓글 분석 스킬: 댓글을 악성, 질문, 칭찬, 개선 요청, 기타로 나눕니다.",
          "Moderation Analyst Agent: 악성 댓글 판단 이유와 대응 우선순위를 정합니다.",
          "Google Sheets MCP: 분석 결과를 구글시트에 행 단위로 저장합니다."
        ]
      },
      {
        title: "구글시트 컬럼 예시",
        items: [
          "수집일",
          "영상 제목",
          "댓글 원문",
          "분류: 악성 / 질문 / 칭찬 / 개선 요청 / 기타",
          "판단 이유",
          "대응 우선순위: 높음 / 보통 / 낮음",
          "추천 대응 문장",
          "처리 상태"
        ]
      },
      {
        title: "바로 만들 수 있는 실행 흐름",
        items: [
          "1단계: 사용자가 유튜브 영상 URL을 입력합니다.",
          "2단계: YouTube Data MCP가 최근 댓글을 가져옵니다.",
          "3단계: 댓글 분석 스킬이 댓글을 1차 분류합니다.",
          "4단계: Moderation Analyst Agent가 악성 댓글의 근거와 대응 우선순위를 붙입니다.",
          "5단계: Google Sheets MCP가 결과를 구글시트에 저장합니다.",
          "6단계: 사용자는 시트에서 악성 댓글만 필터링해 대응합니다."
        ]
      },
      {
        title: "예상 결과 예시",
        items: [
          "댓글: '이 채널 진짜 별로다' → 분류: 부정 의견 / 우선순위: 낮음 / 대응: 답변하지 않거나 의견으로 기록",
          "댓글: '사기꾼 아니냐, 신고한다' → 분류: 공격성 높음 / 우선순위: 높음 / 대응: 관리자 검토 필요",
          "댓글: '제품 가격이 얼마인가요?' → 분류: 질문 / 우선순위: 보통 / 대응: 가격 안내 댓글 작성"
        ]
      }
    ]
  };
}

function buildSmallBusinessPlan() {
  return {
    title: "동네 카페 홍보 문구와 이번 주 실행 계획",
    plainAnswer: "",
    steps: [
      "동네 손님에게 맞는 짧은 홍보 문구를 만들었습니다.",
      "이번 주에 바로 할 일을 날짜별로 나눴습니다."
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
      }
    ]
  };
}

function buildIdeaValidationPlan() {
  return {
    title: "포용적 AI 서비스 아이디어 검증",
    plainAnswer: "",
    steps: [
      "아이디어 후보를 넓혔습니다.",
      "필요성, 대체 가능성, 실제 도움 여부를 검증했습니다."
    ],
    deliverables: [
      {
        title: "아이디어 한 문장",
        items: [
          "AI 디딤돌은 사용자가 Skill, MCP, Agent를 몰라도 자연어 목표만 입력하면 상황에 맞는 AI 활용 절차와 결과물을 자동으로 만들어 주는 포용적 AI 라우터입니다."
        ]
      },
      {
        title: "반박 질문 대응",
        items: [
          "ChatGPT로 대체되지 않나요? 일반 답변이 아니라 상황에 맞는 도구 조합과 실행 과정을 자동 구성하는 점이 다릅니다.",
          "진짜 도움이 되나요? 사용자가 도구 이름을 몰라도 바로 결과물을 받기 때문에 진입 장벽을 낮춥니다.",
          "너무 광범위하지 않나요? 질문을 먼저 행동과 필요한 능력으로 나누기 때문에 주제가 달라도 처리 구조를 만들 수 있습니다."
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
      "문자에서 위험 신호를 확인합니다.",
      "공식 경로로 확인할 수 있게 안내합니다."
    ],
    deliverables: [
      {
        title: "먼저 확인할 것",
        items: [
          "링크를 누르라고 하거나 인증번호를 요구하면 바로 멈춥니다.",
          "문자에 있는 번호가 아니라 공식 대표번호로 직접 확인합니다.",
          "주민번호, 계좌번호, 인증번호는 입력하지 않습니다."
        ]
      },
      {
        title: "가족에게 보낼 문장",
        items: [
          "이 문자에 링크나 개인정보 요구가 있어서 바로 누르지 않고 확인하려고 해요. 공식 대표번호로 먼저 확인해도 될까요?"
        ]
      }
    ]
  };
}

function buildGeneralPlan(input, route, matches) {
  const skillNames = matches.skills?.map((skill) => skill.name).slice(0, 3) || [];
  const mcpNames = matches.mcps?.map((mcp) => mcp.name).slice(0, 3) || [];
  return {
    title: "요청에 맞춘 결과",
    plainAnswer: "",
    steps: [
      "요청을 읽고 필요한 결과 형태를 정했습니다.",
      "사용할 수 있는 도움 기능을 골랐습니다.",
      "바로 실행할 수 있는 초안으로 정리했습니다."
    ],
    deliverables: [
      {
        title: "바로 실행할 방향",
        items: [
          `${input}`,
          skillNames.length ? `먼저 사용할 기능: ${skillNames.join(", ")}` : "먼저 결과 초안을 만들고 필요한 정보를 추가로 정리합니다.",
          mcpNames.length ? `연결하면 좋은 외부 도구: ${mcpNames.join(", ")}` : "외부 도구 연결 없이도 초안 작성부터 시작할 수 있습니다."
        ]
      },
      {
        title: "다음에 입력하면 더 좋아지는 정보",
        items: [
          "대상 사용자",
          "원하는 분량",
          "결과를 어디에 사용할지",
          "반드시 포함하거나 제외할 내용"
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
