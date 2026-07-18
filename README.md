# AI 디딤돌

AI 디딤돌은 사용자가 `skills`, `MCP`, `AI agent`를 몰라도 생활 언어로 목표를 입력하면 적절한 AI 활용 구조를 자동 조합해 주는 포용적 AI 라우터입니다.

## 핵심 아이디어

사용자 질문을 바로 답하지 않고 다음 파이프라인으로 처리합니다.

```text
사용자 입력
↓
Router Model
목적 / 위험도 / 필요한 능력 분류
↓
Registry Search
Skill / MCP / Agent 후보 검색
↓
Planner Model
실행 순서 생성
↓
Safety Gate
위험한 요청 차단 또는 확인 요구
↓
사용자용 쉬운 결과
```

AI 디딤돌은 고정된 매뉴얼이 아니라, 새로 생기는 Skill과 MCP를 능력 단위로 분류하고 검증해 연결하는 동적 라우터입니다.

## 사용자 행동 8분류

1. 이해하기
2. 확인하기
3. 만들기
4. 비교하기
5. 계획하기
6. 배우기
7. 정리하기
8. 연결하기

## 실행

```bash
cp .env.example .env
npm start
```

브라우저에서 `http://127.0.0.1:3000`을 엽니다.

API 키가 없으면 `LLM_PROVIDER=fallback` 규칙 기반 모드로 동작합니다. 나중에 `.env`에 OpenAI, Gemini, Ollama 중 하나를 설정하면 Router/Planner 모델을 교체할 수 있습니다.

## API

```bash
curl -X POST http://127.0.0.1:3000/api/route \
  -H "Content-Type: application/json" \
  -d "{\"input\":\"동네 어르신들이 병원 예약 문자와 보이스피싱 문자를 구분하고 싶어\"}"
```

## 디렉터리

```text
src/
  server.js              HTTP 서버
  pipeline.js            전체 라우팅 파이프라인
  router.js              8개 행동 목적, 위험도, 능력 분류
  registry-search.js     Skill/MCP/Agent 레지스트리 검색
  planner.js             실행 순서 생성
  safety-gate.js         고위험 요청 차단/확인
  llm-provider.js        OpenAI/Gemini/Ollama/fallback 어댑터
data/
  skill-registry.json
  mcp-registry.json
  agent-registry.json
public/
  index.html
  styles.css
  app.js
```

