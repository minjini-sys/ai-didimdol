# AI 디딤돌 아키텍처

## 왜 기준표 하나가 아닌가

사용자의 질문은 ChatGPT처럼 매우 광범위합니다. 모든 주제를 고정 기준표로 관리하면 금방 커지고, 새로 생기는 Skill과 MCP 트렌드를 따라갈 수 없습니다.

AI 디딤돌은 주제를 모두 외우는 방식 대신 질문을 먼저 행동 목적과 필요한 능력으로 바꿉니다.

```text
사용자 입력
↓
8개 행동 목적 분류
↓
위험도 분류
↓
필요 능력 추출
↓
Skill / MCP / Agent 레지스트리 검색
↓
안전한 실행 계획 생성
```

## 8개 행동 목적

| ID | 이름 | 설명 |
|---|---|---|
| understand | 이해하기 | 어려운 글, 문자, 안내문을 쉽게 이해 |
| verify | 확인하기 | 진짜인지, 맞는지, 위험한지 검증 |
| create | 만들기 | 문서, 문구, 발표 자료, 아이디어 생성 |
| compare | 비교하기 | 선택지 장단점과 기준 비교 |
| plan | 계획하기 | 일정, 신청 절차, 실행 순서 설계 |
| learn | 배우기 | 개념 설명, 학습, 연습 |
| organize | 정리하기 | 요약, 표, 체크리스트 |
| connect | 연결하기 | 파일, GitHub, 캘린더, 공공데이터 연결 |

## 동적 레지스트리

새로운 Skill과 MCP는 다음처럼 능력 단위로 태깅됩니다.

```json
{
  "id": "phishing-check",
  "name": "보이스피싱 위험 신호 체크 스킬",
  "capabilities": ["위험 신호 탐지", "다음 행동 안내"],
  "taskTypes": ["verify"],
  "privacyRisk": "medium",
  "verified": true,
  "trustScore": 88
}
```

라우터는 모든 스킬 이름을 외우지 않습니다. 사용자 입력에서 필요한 능력을 뽑고, 그 능력을 가진 최신 레지스트리 항목을 검색합니다.

## 모델 전략

초기 MVP는 API 키 없이 `fallback` 규칙 기반 모드로 동작합니다. 나중에 `.env`에서 provider만 바꾸면 OpenAI, Gemini, Ollama로 교체할 수 있습니다.

```text
LLM_PROVIDER=fallback
LLM_PROVIDER=openai
LLM_PROVIDER=gemini
LLM_PROVIDER=ollama
```

고위험 요청은 모델이 답을 생성해도 Safety Gate가 먼저 개입합니다.

## 발표용 한 줄

AI 디딤돌은 고정된 매뉴얼이 아니라, 새로 생기는 Skill과 MCP를 능력 단위로 분류하고 검증해 연결하는 동적 라우터입니다.

