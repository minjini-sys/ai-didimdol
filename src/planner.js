export function fallbackPlan(input, route, matches, safety, answers = {}) {
  if (safety.status === "block") {
    return {
      title: "지원할 수 없는 요청입니다",
      plainAnswer: "",
      steps: ["안전하게 도와줄 수 없는 내용이 있어 실행하지 않습니다."],
      deliverables: [
        {
          title: "대신 가능한 방향",
          items: [
            "민감정보를 빼고 상황만 다시 설명해 주세요.",
            "공식 기관이나 서비스 고객센터에서 확인할 수 있는 방법은 안내할 수 있습니다."
          ]
        }
      ]
    };
  }

  if (route.capabilities.includes("회의 받아쓰기") || route.capabilities.includes("회의 요약") || route.capabilities.includes("Notion 정리")) {
    return buildMeetingNotionPlan(answers, matches);
  }

  if (route.capabilities.includes("댓글 분석") || route.capabilities.includes("스프레드시트 저장")) {
    return buildCommentWorkflowPlan(answers);
  }

  if (route.capabilities.includes("홍보 문구 생성") || route.capabilities.includes("실행 계획 생성")) {
    return buildSmallBusinessPlan(answers);
  }

  if (route.capabilities.includes("아이디어 생성") || route.capabilities.includes("아이디어 검증")) {
    return buildIdeaValidationPlan();
  }

  if (route.capabilities.includes("위험 신호 탐지")) {
    return buildSafetyCheckPlan();
  }

  return buildGeneralPlan(input, route, matches);
}

export async function buildPlan(input, route, matches, safety, llm, answers = {}) {
  const fallback = fallbackPlan(input, route, matches, safety, answers);
  const result = await llm.plan?.(input, route, matches, safety, fallback);
  return normalizePlan(result || fallback, fallback);
}

function buildMeetingNotionPlan(answers, matches) {
  const source = answers.meeting_source || "회의 음성 파일";
  const style = answers.summary_style || "핵심 요약 + 결정 사항 + 할 일 + 담당자 + 마감일";
  const target = answers.notion_target || "Notion 회의록 페이지";
  const usesSkills = matches.skills?.length > 0;

  return {
    title: "회의 음성을 Notion 회의록으로 정리하는 자동화 설계",
    plainAnswer: "",
    steps: [
      `${source}를 텍스트로 바꿉니다.`,
      `${style} 형식으로 회의 내용을 요약합니다.`,
      `${target}에 붙여 넣기 쉬운 구조로 정리합니다.`
    ],
    deliverables: [
      {
        title: "추천 도구 조합",
        items: [
          "Audio Transcription MCP: 회의 음성을 텍스트로 바꾸는 연결 도구입니다.",
          usesSkills ? "회의 요약 스킬: 긴 회의록에서 핵심 내용, 결정 사항, 할 일을 뽑습니다." : "회의 요약 단계: 승인된 Skill 없이 기본 요약 규칙으로 핵심 내용과 할 일을 뽑습니다.",
          usesSkills ? "Notion 정리 스킬: Notion에 맞는 회의록 템플릿으로 바꿉니다." : "Notion 정리 단계: 승인된 Skill 없이 기본 템플릿으로 정리합니다.",
          "Notion MCP: 사용자가 허용하면 완성된 회의록을 Notion 페이지나 데이터베이스에 저장합니다."
        ]
      },
      {
        title: "Notion 회의록 템플릿",
        items: [
          "회의 제목: [자동 추출 또는 직접 입력]",
          "회의 날짜: [녹음 날짜]",
          "한 줄 요약: 오늘 회의에서 가장 중요한 결론 1문장",
          "핵심 요약: 논의된 내용 3~5개",
          "결정 사항: 누가 무엇을 하기로 했는지",
          "할 일: 담당자 / 마감일 / 상태",
          "후속 질문: 다음 회의 전에 확인할 내용"
        ]
      },
      {
        title: "자동화 흐름",
        items: [
          `1단계: 사용자가 ${source}를 올립니다.`,
          "2단계: 받아쓰기 도구가 음성을 텍스트로 바꿉니다.",
          "3단계: 회의 요약 단계가 긴 문장을 결정 사항과 할 일로 줄입니다.",
          `4단계: ${style} 형식에 맞게 정리합니다.`,
          `5단계: 사용자가 허용하면 ${target}에 저장합니다.`
        ]
      },
      {
        title: "예시 결과",
        items: [
          "한 줄 요약: 이번 주 홍보 콘텐츠 제작과 고객 응대 기준을 정했습니다.",
          "결정 사항: 금요일까지 홍보 문구 3개를 만들고, 반응이 좋은 문구를 다음 주에도 사용합니다.",
          "할 일: 민지 - 인스타 문구 작성 - 수요일 / 현우 - Notion 회의록 확인 - 오늘"
        ]
      }
    ]
  };
}

function buildCommentWorkflowPlan(answers) {
  const target = answers.youtube_target || "분석할 유튜브 영상";
  const labels = answers.moderation_labels || "악성, 질문, 칭찬, 개선 요청, 광고";
  const output = answers.sheet_output || "댓글 원문, 분류, 이유, 우선순위, 답변 초안";

  return {
    title: "유튜브 댓글 분석과 구글시트 저장 자동화 설계",
    plainAnswer: "",
    steps: ["댓글을 가져옵니다.", "댓글을 분류합니다.", "결과를 구글시트에 저장합니다."],
    deliverables: [
      {
        title: "추천 도구 조합",
        items: [
          `YouTube Data MCP: ${target}의 댓글을 가져옵니다.`,
          `댓글 분석 스킬: 댓글을 ${labels} 기준으로 나눕니다.`,
          "Moderation Analyst Agent: 악성 댓글 판단 이유와 우선순위를 붙입니다.",
          "Google Sheets MCP: 분석 결과를 구글시트에 행 단위로 저장합니다."
        ]
      },
      {
        title: "구글시트 컬럼 예시",
        items: output.split(",").map((item) => item.trim()).filter(Boolean)
      },
      {
        title: "예상 결과 예시",
        items: [
          "댓글: '영상 좋네요' / 분류: 칭찬 / 우선순위: 낮음 / 답변 초안: 감사합니다.",
          "댓글: '이건 사기 아닌가요?' / 분류: 질문 / 우선순위: 보통 / 답변 초안: 어떤 부분이 궁금한지 확인합니다.",
          "댓글: '채널 망해라' / 분류: 악성 / 우선순위: 높음 / 답변 초안: 대응하지 않고 숨김 또는 검토로 표시합니다."
        ]
      }
    ]
  };
}

function buildSmallBusinessPlan(answers) {
  const target = answers.target_customer || "동네 단골 손님";
  const offer = answers.offer || "이번 주 추천 메뉴";

  return {
    title: "동네 카페 홍보 문구와 이번 주 실행 계획",
    plainAnswer: "",
    steps: ["손님에게 보낼 문구를 만듭니다.", "이번 주에 바로 할 일을 날짜별로 정리합니다."],
    deliverables: [
      {
        title: "홍보 문구 후보",
        items: [
          `${target}에게 보내기 좋은 문구: 이번 주 ${offer} 준비했어요. 잠깐 쉬어가고 싶을 때 편하게 들러주세요.`,
          `짧은 문자용: 이번 주 ${offer} 이벤트 중입니다. 오늘도 따뜻하게 준비해둘게요.`,
          `인스타용: 동네에서 조용히 쉬어갈 곳이 필요하다면 이번 주 ${offer}를 만나보세요.`
        ]
      },
      {
        title: "이번 주 실행 계획",
        items: [
          "월요일: 이번 주에 밀고 싶은 메뉴와 혜택을 1개로 정합니다.",
          "화요일: 문자, 매장 안내문, 인스타에 같은 메시지를 올립니다.",
          "수요일: 단골 손님에게 부담 없는 톤으로 직접 안내합니다.",
          "목요일: 반응이 좋은 문구를 짧게 고쳐 다시 게시합니다.",
          "금요일: 퇴근 시간대 손님에게 맞는 문구를 추가로 올립니다.",
          "주말: 가장 많이 팔린 메뉴와 반응 좋은 문구를 기록합니다."
        ]
      }
    ]
  };
}

function buildIdeaValidationPlan() {
  return {
    title: "포용적 AI 서비스 아이디어 검증",
    plainAnswer: "",
    steps: ["아이디어 후보를 넓힙니다.", "필요성, 대체 가능성, 실제 도움 여부를 검증합니다."],
    deliverables: [
      {
        title: "아이디어 한 문장",
        items: [
          "AI 디딤돌은 사용자가 Skill, MCP, Agent를 몰라도 목표만 입력하면 상황에 맞는 AI 사용 절차와 결과물을 자동으로 만들어주는 포용적 AI 라우터입니다."
        ]
      },
      {
        title: "반박 질문 대응",
        items: [
          "ChatGPT로도 답을 받을 수 있지만, 이 서비스는 어떤 기능을 언제 써야 하는지 모르는 사람에게 절차, 도구 승인, 결과 형식을 함께 제공합니다.",
          "모르는 도구를 몰래 쓰지 않고 이유와 보안 주의점을 설명한 뒤 승인받기 때문에 비전공자에게 더 신뢰감을 줄 수 있습니다.",
          "질문 주제가 넓어도 목적을 먼저 분류하고 필요한 정보만 한 번에 하나씩 물어보므로 사용자가 복잡한 설정을 직접 고를 필요가 없습니다."
        ]
      }
    ]
  };
}

function buildSafetyCheckPlan() {
  return {
    title: "문자 확인 안내",
    plainAnswer: "",
    steps: ["문자에서 위험 신호를 확인합니다.", "공식 경로로 확인할 수 있게 안내합니다."],
    deliverables: [
      {
        title: "먼저 확인할 점",
        items: [
          "링크를 누르라고 하거나 인증번호를 요구하면 바로 멈춥니다.",
          "문자에 있는 번호가 아니라 공식 대표번호로 직접 확인합니다.",
          "주민번호, 계좌번호, 인증번호는 입력하지 않습니다."
        ]
      },
      {
        title: "가족에게 보낼 문장",
        items: [
          "이 문자에 링크와 개인정보 요구가 있어서 바로 누르지 않고 확인하려고 해요. 공식 대표번호로 먼저 확인해도 될까요?"
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
    steps: ["요청을 읽고 필요한 결과 형태를 정했습니다.", "바로 실행할 수 있는 초안으로 정리했습니다."],
    deliverables: [
      {
        title: "바로 실행할 방향",
        items: [
          input,
          skillNames.length ? `사용한 도움 기능: ${skillNames.join(", ")}` : "기본 생성 흐름으로 초안을 만들었습니다.",
          mcpNames.length ? `연결할 외부 도구: ${mcpNames.join(", ")}` : "외부 도구 연결 없이 먼저 초안을 만들 수 있습니다."
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
