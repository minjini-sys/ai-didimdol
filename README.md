# AI 디딤돌

AI 디딤돌은 사용자가 `Skill`, `MCP`, `AI Agent`를 몰라도 자연어로 목표를 입력하면 필요한 AI 활용 절차와 결과물을 자동으로 만들어 주는 포용적 AI 라우터입니다.

## 핵심 흐름

```text
사용자 입력
↓
Router Model
목적 / 위험도 / 필요한 능력 분류
↓
Registry Search
내장 Skill / MCP / Agent 검색
선택 사항: GitHub 실시간 후보 검색
↓
Planner Model
결과물과 실행 과정 생성
↓
Safety Gate
위험 요청만 확인 또는 차단
↓
사용자가 바로 볼 수 있는 결과
```

## 실행

```bash
cp .env.example .env
npm start
```

브라우저에서 `http://127.0.0.1:3000`을 엽니다.

## LLM 설정

API 키가 없으면 `LLM_PROVIDER=fallback` 규칙 기반 모드로 동작합니다.

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Gemini, OpenAI, Ollama 호출이 실패하면 fallback 라우터와 fallback 플래너가 계속 동작합니다.

## Dynamic Registry Search

기본값은 안전을 위해 꺼져 있습니다.

```env
DYNAMIC_REGISTRY=false
```

켜면 GitHub Search API를 사용해 새 Skill, MCP, Agent 후보를 실시간으로 찾습니다.

```env
DYNAMIC_REGISTRY=true
GITHUB_TOKEN=
```

실시간 후보는 자동 실행하지 않습니다. 설명, 최근 업데이트, 별 수, 능력 매칭을 기준으로 신뢰도 점수를 계산하고, `AI 라우터가 사용한 단계 보기`에 후보로만 표시합니다.

## API

```bash
curl -X POST http://127.0.0.1:3000/api/route \
  -H "Content-Type: application/json" \
  -d "{\"input\":\"작은 카페를 운영하는데 동네 손님에게 보낼 홍보 문구와 이번 주 실행 계획을 만들고 싶어.\"}"
```

## 디렉터리

```text
src/
  server.js                  HTTP 서버
  pipeline.js                전체 라우팅 파이프라인
  router.js                  8개 행동 목적, 위험도, 능력 분류
  registry-search.js         내장 Registry 검색
  remote-registry-search.js  GitHub 실시간 후보 검색
  planner.js                 결과물 생성
  safety-gate.js             고위험 요청 확인/차단
  llm-provider.js            OpenAI/Gemini/Ollama/fallback 어댑터
data/
  skill-registry.json
  mcp-registry.json
  agent-registry.json
public/
  index.html
  styles.css
  app.js
```
