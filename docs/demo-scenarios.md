# 데모 시나리오

## 1. 보이스피싱 문자 확인

입력:

```text
동네 어르신들이 병원 예약 문자와 보이스피싱 문자를 구분하고, 가족에게 묻기 전에 AI로 먼저 확인할 수 있게 돕고 싶어.
```

예상 결과:

- 행동 목적: 이해하기, 확인하기
- 위험도: high
- 지원 상태: 부분 지원, 확인 필요
- 필요한 능력: 쉬운 말 변환, 위험 신호 탐지, 공식 출처 확인, 개인정보 보호, 다음 행동 안내, 가족 공유 문장 생성
- Skill: 보이스피싱 위험 신호 체크, 개인정보 가리기, 공식 출처 확인, 가족 공유 요약
- MCP: Web Search, Public Data, File Reader
- Agent: Safety Coach, Plain Language Helper, Verification Agent

핵심 답변:

AI가 문자 진위를 최종 판정하는 것이 아니라, 개인정보를 가리고 위험 신호를 확인한 뒤 공식 경로로 확인하도록 돕습니다.

## 2. 해커톤 아이디어 검증

입력:

```text
해커톤 지정공모 포용적 AI 주제에 맞는 아이디어를 만들고, 이게 필요할까 대체되지 않을까 진짜 도움이 될까 질문에 답할 수 있게 검증하고 싶어.
```

예상 결과:

- 행동 목적: 만들기, 확인하기, 계획하기
- 위험도: low
- Skill: Heuristic Ideation, Startup Validating
- MCP: GitHub, Web Search
- Agent: Explorer, Critic, Planner

핵심 답변:

아이디어를 바로 만들고 끝내지 않고, 필요성, 대체 가능성, 실제 도움, 실행 가능성을 비판적으로 검증합니다.

