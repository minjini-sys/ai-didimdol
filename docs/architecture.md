# AI 디딤돌 아키텍처

## 왜 고정 매뉴얼이 아닌가

비전공자의 요청은 형태가 정해져 있지 않습니다. 긴 공모전 안내문을 붙여넣고 "요약해줘"라고 한 줄만 덧붙이는 경우도 있고, 짧게 목적만 말하는 경우도 있습니다. 고정된 카테고리 표 하나로는 이런 입력을 안정적으로 다루기 어렵고, 새로 나오는 Skill 트렌드도 따라가지 못합니다.

AI 디딤돌은 두 가지로 이 문제를 풉니다. 첫째, 입력을 그대로 분류하지 않고 "자료"와 "명령"으로 먼저 분리합니다. 둘째, 내장된 Skill 목록을 외우는 대신 GitHub를 실시간으로 검색해 후보를 찾고, 사용자 승인 없이는 절대 다운로드하지 않습니다.

```text
사용자 입력
↓
Intent Split
마지막 문장의 실제 명령을 찾고, 나머지를 처리 대상 자료로 분리
↓
Router
분리된 명령을 기준으로 intent, 필요 능력, GitHub 검색어 결정
↓
Remote Skill Search
GitHub Search API로 후보를 찾고 이름/설명에서 위험 표현을 미리 평가
↓
사용자 승인
후보를 고르기 전까지는 파일을 읽지도, 저장하지도 않음
↓
Skill Inspector
승인된 후보의 README/SKILL 파일만 임시로 읽어 관련성과 위험 신호 재확인
↓
결과 생성
확인된 근거를 바탕으로 바로 쓸 수 있는 결과물 작성
```

## Intent Split: 자료에 끌려가지 않기

사용자가 "MCP, 자동화, RAG..." 같은 단어가 잔뜩 들어간 긴 자료를 붙여넣고 마지막에 "이거 요약해줘"라고만 덧붙이면, 자료 속 단어에 라우터가 끌려가 "자동화 워크플로"로 잘못 분류하기 쉽습니다.

`src/router.js`의 `splitInputIntent`는 입력 마지막에 있는 명령 문장을 우선 찾고, 그 명령만으로 라우팅합니다. LLM이 있으면 LLM이 `material` / `instruction` / `outputType`을 나누고, 없으면 정규식 기반 fallback이 같은 역할을 합니다.

## Remote Skill Search: 승인 전에는 아무것도 하지 않는다

`src/remote-registry-search.js`는 라우터가 만든 검색어로 GitHub 저장소를 찾고, 이름·설명에 담긴 표현을 세 단계로 나눕니다.

| 단계 | 의미 |
|---|---|
| blocked | 브라우저/터미널 조작, 비밀번호 처리 같은 표현이 있어 승인해도 다운로드하지 않음 |
| review | 자동화·외부 연결 표현이 있어 승인 후 파일을 한 번 더 확인 |
| ok | 큰 권한 표현이 보이지 않음 |

이 단계에서는 저장소 설명만 보고 판단하며, 실제 파일은 절대 읽지 않습니다.

## Skill Inspector: 승인 후 임시 확인

사용자가 후보를 승인하면 `src/skill-inspector.js`가 README/SKILL 파일을 그때 처음 읽습니다. 위험 패턴(`rm -rf`, `sudo`, `password`, `shell` 등)이 있으면 사용을 보류하고, 요청과 관련된 단서가 부족해도 보류로 표시합니다. 읽은 내용은 그 요청의 결과를 만드는 데만 쓰이고 로컬에 저장하지 않습니다.

## 모델 전략

API 키가 없어도 `LLM_PROVIDER=fallback` 규칙 기반 모드로 전체 흐름이 동작합니다. `.env`에서 provider만 바꾸면 OpenAI, Gemini, Ollama로 교체할 수 있고, 호출이 실패해도 fallback이 이어받습니다.

```text
LLM_PROVIDER=fallback
LLM_PROVIDER=openai
LLM_PROVIDER=gemini
LLM_PROVIDER=ollama
```

## 발표용 한 줄

AI 디딤돌은 사용자의 명령을 자료와 분리해 정확히 읽고, 필요한 Skill을 실시간으로 찾아 승인받은 뒤에만 임시로 확인해 쓰는 포용적 AI 라우터입니다.
