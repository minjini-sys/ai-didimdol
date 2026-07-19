const questionSets = [
  {
    id: "meeting-notion",
    match: (route) => route.capabilities.includes("회의 받아쓰기") || route.capabilities.includes("회의 요약") || route.capabilities.includes("Notion 정리"),
    questions: [
      {
        id: "meeting_source",
        text: "회의 음성은 어디에서 가져오나요?",
        placeholder: "예: 줌 녹화 파일, 휴대폰 녹음 파일, 유튜브 링크"
      },
      {
        id: "summary_style",
        text: "Notion에는 어떤 형태로 정리하면 좋을까요?",
        placeholder: "예: 핵심 요약 + 결정 사항 + 할 일 + 담당자 + 마감일"
      },
      {
        id: "notion_target",
        text: "Notion에는 새 페이지로 만들까요, 기존 데이터베이스에 넣을까요?",
        placeholder: "예: 회의록 데이터베이스에 새 항목으로 추가"
      }
    ]
  },
  {
    id: "youtube-sheets",
    match: (route) => route.capabilities.includes("댓글 분석") || route.capabilities.includes("스프레드시트 저장"),
    questions: [
      {
        id: "youtube_target",
        text: "분석할 댓글은 어떤 영상이나 채널의 댓글인가요?",
        placeholder: "예: 영상 URL 1개, 최근 영상 5개, 특정 채널 전체"
      },
      {
        id: "moderation_labels",
        text: "댓글을 어떤 기준으로 나누면 좋을까요?",
        placeholder: "예: 악성, 질문, 칭찬, 개선 요청, 광고"
      },
      {
        id: "sheet_output",
        text: "구글시트에는 어떤 항목이 꼭 들어가야 하나요?",
        placeholder: "예: 댓글 원문, 분류, 이유, 우선순위, 답변 초안"
      }
    ]
  },
  {
    id: "small-business",
    match: (route) => route.capabilities.includes("홍보 문구 생성") || route.capabilities.includes("실행 계획 생성"),
    questions: [
      {
        id: "target_customer",
        text: "주로 어떤 손님에게 보낼 문구인가요?",
        placeholder: "예: 동네 단골, 직장인, 학생, 가족 단위 손님"
      },
      {
        id: "offer",
        text: "이번 주에 강조하고 싶은 메뉴나 혜택이 있나요?",
        placeholder: "예: 바닐라 라떼, 쿠키 증정, 두 번째 음료 할인"
      }
    ]
  }
];

export function getNextClarification(route, answers = {}) {
  const set = questionSets.find((candidate) => candidate.match(route));
  if (!set) return null;
  const next = set.questions.find((question) => !String(answers[question.id] || "").trim());
  return next ? { ...next, setId: set.id } : null;
}

export function formatAnswerContext(answers = {}) {
  const entries = Object.entries(answers).filter(([, value]) => String(value || "").trim());
  if (entries.length === 0) return "";
  return entries.map(([key, value]) => `${key}: ${value}`).join("\n");
}
