export const TASK_TYPES = [
  {
    id: "understand",
    label: "이해하기",
    description: "글, 문자, 문서, 안내 내용을 쉽게 이해한다.",
    keywords: ["이해", "설명", "무슨 뜻", "문자", "안내문", "쉽게", "요약"]
  },
  {
    id: "verify",
    label: "확인하기",
    description: "진짜인지, 맞는지, 위험한지 검증한다.",
    keywords: ["확인", "진짜", "가짜", "위험", "사기", "보이스피싱", "검증", "맞는지", "필요할까", "대체", "분류"]
  },
  {
    id: "create",
    label: "만들기",
    description: "글, 문서, 홍보 문구, 발표 자료, 아이디어, 자동화 흐름을 만든다.",
    keywords: ["만들", "작성", "생성", "홍보", "문구", "ppt", "발표", "아이디어", "초안", "카피", "도구 조합", "워크플로"]
  },
  {
    id: "compare",
    label: "비교하기",
    description: "선택지를 비교하고 기준에 따라 고른다.",
    keywords: ["비교", "고르", "추천", "선택", "뭐가 좋아", "장단점"]
  },
  {
    id: "plan",
    label: "계획하기",
    description: "일정, 신청 절차, 공부 계획, 실행 순서를 짠다.",
    keywords: ["계획", "일정", "순서", "절차", "로드맵", "준비", "이번 주", "실행", "저장"]
  },
  {
    id: "learn",
    label: "배우기",
    description: "개념 설명, 단계별 학습, 연습 문제로 배운다.",
    keywords: ["배우", "공부", "학습", "개념", "연습", "강의"]
  },
  {
    id: "organize",
    label: "정리하기",
    description: "내용을 요약, 표, 체크리스트로 정리한다.",
    keywords: ["정리", "요약", "표", "체크리스트", "분류", "목록", "분석", "받아쓰기", "전사"]
  },
  {
    id: "connect",
    label: "연결하기",
    description: "파일, 일정, GitHub, Google Sheets, Notion 같은 외부 서비스와 연결한다.",
    keywords: ["파일", "깃허브", "github", "캘린더", "구글시트", "구글 시트", "스프레드시트", "노션", "notion", "외부", "연결", "저장", "보내"]
  }
];

export const RISK_KEYWORDS = {
  high: ["주민번호", "계좌", "비밀번호", "인증번호", "송금", "대출", "병원", "진단", "법률", "소송", "보이스피싱", "사기", "계정"],
  medium: ["지원금", "신청", "계약", "민원", "정부", "공공기관", "금융", "병원 예약", "개인정보", "악성 댓글", "욕설", "혐오"],
  blocked: ["해킹", "불법", "몰래", "비밀번호 알려", "계정 탈취", "우회", "악용"]
};

export const CAPABILITY_RULES = [
  { capability: "쉬운 말 변환", keywords: ["이해", "쉽게", "설명", "어려운", "안내문", "문자"] },
  { capability: "위험 신호 탐지", keywords: ["위험", "사기", "보이스피싱", "진짜", "가짜", "문자"] },
  { capability: "공식 출처 확인", keywords: ["확인", "공식", "병원", "정부", "지원금", "링크"] },
  { capability: "개인정보 보호", keywords: ["개인정보", "주민번호", "계좌", "인증번호", "비밀번호", "문자"] },
  { capability: "다음 행동 안내", keywords: ["어떻게", "다음", "절차", "신청", "계획", "예약", "이번 주", "실행"] },
  { capability: "가족 공유 문장 생성", keywords: ["가족", "보호자", "어르신", "공유", "문자"] },
  { capability: "아이디어 생성", keywords: ["아이디어", "기획", "공모", "해커톤"] },
  { capability: "아이디어 검증", keywords: ["검증", "시장", "사업", "스타트업", "대체", "필요할까", "필요"] },
  { capability: "홍보 문구 생성", keywords: ["홍보", "카페", "소상공인", "문구", "블로그", "인스타", "손님", "카피"] },
  { capability: "실행 계획 생성", keywords: ["계획", "이번 주", "실행", "일정", "할 일", "체크리스트"] },
  { capability: "댓글 분석", keywords: ["댓글", "유튜브", "youtube", "악성 댓글", "댓글 분석"] },
  { capability: "악성 댓글 분류", keywords: ["악성", "욕설", "혐오", "분류", "댓글"] },
  { capability: "스프레드시트 저장", keywords: ["구글시트", "구글 시트", "스프레드시트", "시트", "저장"] },
  { capability: "회의 받아쓰기", keywords: ["회의", "음성", "받아쓰기", "녹음", "전사", "transcript"] },
  { capability: "회의 요약", keywords: ["회의", "요약", "정리", "할 일", "액션아이템"] },
  { capability: "Notion 정리", keywords: ["notion", "노션"] },
  { capability: "도구 조합 추천", keywords: ["도구 조합", "조합", "mcp", "agent", "에이전트", "찾고 싶어", "추천"] },
  { capability: "문서 작성", keywords: ["작성", "문서", "보고서", "발표", "ppt"] },
  { capability: "일정 관리", keywords: ["일정", "캘린더", "예약", "마감"] },
  { capability: "저장소 관리", keywords: ["깃허브", "github", "커밋", "푸시", "레포"] }
];
