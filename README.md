# AI 디딤돌

AI 디딤돌은 사용자가 `Skill`, `MCP`, `AI Agent`를 몰라도 자연어로 목표를 입력하면 필요한 AI 활용 절차와 결과물을 자동으로 만들어 주는 포용적 AI 라우터입니다..

## 핵심 흐름

```text
사용자 입력
↓
Intent Split
자료(material)와 실제 명령(instruction)을 분리
↓
Router
분리된 명령을 기준으로 목적(intent)과 검색어 분류
↓
Remote Skill Search
GitHub에서 Skill 후보를 실시간으로 검색하고 위험 표현으로 사전 평가
↓
사용자 승인
후보를 고르기 전에는 다운로드하거나 저장하지 않음
↓
Skill Inspector
승인된 후보의 README/SKILL 파일만 임시로 읽고 위험 신호·관련성 재확인
↓
결과 생성
확인된 Skill 근거를 바탕으로 바로 쓸 수 있는 결과물 작성
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

Gemini, OpenAI, Ollama 호출이 실패하면 fallback 라우터와 fallback 결과 생성기가 계속 동작합니다.

## GitHub Skill 검색

```env
GITHUB_TOKEN=
```

토큰이 없어도 동작하지만, GitHub API 요청 한도를 늘리려면 설정하는 것이 좋습니다. 검색된 후보는 자동 실행하지 않습니다. 설명, 최근 업데이트, 별 수, 검색어 매칭을 기준으로 점수를 계산하고, 위험한 표현이 있으면 다운로드를 차단하거나 승인 후 파일을 한 번 더 확인합니다.

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
  pipeline.js                전체 파이프라인 조립
  router.js                  자료/명령 분리와 의도 분류
  remote-registry-search.js  GitHub 실시간 Skill 검색과 사전 위험 평가
  skill-inspector.js         승인된 Skill 파일 임시 확인
  llm-provider.js            OpenAI/Gemini/Ollama/fallback 어댑터
  config.js                  환경 변수 로딩
public/
  index.html
  styles.css
  app.js
```

<!-- contribution: 2026-07-20 -->
<!-- contribution: 2026-07-21 -->
