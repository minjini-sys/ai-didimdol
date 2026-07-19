const form = document.querySelector("#routeForm");
const input = document.querySelector("#userInput");
const resultBody = document.querySelector("#resultBody");

let lastCandidates = [];
let lastInput = "";
let approvedSkillIds = new Set();
let lastSkillApprovalView = null;
let lastSkillReviewView = null;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  lastInput = value;
  approvedSkillIds = new Set();
  await submitPrompt(value);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

async function submitPrompt(value) {
  setLoading("의도를 파악하고 인터넷에서 Skill 후보를 찾고 있습니다.");

  const response = await fetch("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: value })
  });
  const data = await response.json();

  if (!response.ok) {
    renderError(data.error || "처리 중 문제가 생겼습니다.");
    return;
  }

  render(data.userView);
}

function toggleSkillApproval(candidateId) {
  const candidate = lastCandidates.find((item) => item.id === candidateId);
  if (!candidate || candidate.canApprove === false) return;

  if (approvedSkillIds.has(candidateId)) {
    approvedSkillIds.delete(candidateId);
  } else {
    approvedSkillIds.add(candidateId);
  }

  renderSkillApproval(lastSkillApprovalView || currentApprovalView());
}

async function proceedWithApprovedSkills() {
  const approvedIds = [...approvedSkillIds];
  if (!approvedIds.length) return;

  setLoading("선택한 Skill 파일을 임시로 읽고 있습니다. 로컬에는 저장하지 않습니다.");

  const response = await fetch("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: lastInput,
      approvedSkillIds: approvedIds,
      candidates: lastCandidates
    })
  });
  const data = await response.json();

  if (!response.ok) {
    renderError(data.error || "Skill 확인 중 문제가 생겼습니다.");
    return;
  }

  render(data.userView);
}

function setLoading(message) {
  resultBody.innerHTML = `<p class="empty">${escapeHtml(message)}</p>`;
}

function render(view) {
  if (view.mode === "skill-approval") {
    renderSkillApproval(view);
    return;
  }

  if (view.mode === "skill-review") {
    renderSkillReview(view);
    return;
  }

  if (view.mode === "generated-result") {
    renderGeneratedResult(view.result);
    return;
  }

  renderError("알 수 없는 응답입니다.");
}

function renderSkillApproval(view) {
  lastSkillApprovalView = view;
  lastCandidates = view.candidates || [];

  const candidates = lastCandidates.length
    ? lastCandidates.map(renderCandidateCard).join("")
    : `<p class="empty">${escapeHtml(view.emptyMessage)}</p>`;
  const selected = lastCandidates.filter((candidate) => approvedSkillIds.has(candidate.id));
  const selectedSummary = selected.length
    ? `<section class="selected-panel">
        <p class="step-label">선택한 Skill</p>
        <h2>${selected.length}개를 임시 확인 대상으로 골랐습니다</h2>
        <p>아직 다운로드하거나 로컬에 저장하지 않았습니다. 원하면 각 후보에서 승인 취소를 누를 수 있습니다.</p>
        <ul>${selected.map((candidate) => `<li>${escapeHtml(candidate.plainTitle || candidate.name)}</li>`).join("")}</ul>
        <button type="button" class="primary-action next-action" data-proceed-skills>다음 단계로</button>
      </section>`
    : "";

  resultBody.innerHTML = `
    <section class="intent-panel">
      <p class="step-label">1. 의도 파악</p>
      <h2>${escapeHtml(view.intent.label)}</h2>
      <p>${escapeHtml(view.intent.summary)}</p>
      <div class="tag-row">
        ${(view.intent.needs || []).map((need) => `<span>${escapeHtml(need)}</span>`).join("")}
      </div>
    </section>

    <section class="search-panel">
      <p class="step-label">2. 인터넷 Skill 검색</p>
      <h2>찾은 후보를 쉬운 말로 풀어봤습니다</h2>
      <p>아래 후보는 GitHub에서 실시간으로 찾았습니다. 아직 다운로드하지 않았고, 로컬에도 저장하지 않았습니다.</p>
    </section>

    <div class="candidate-list">${candidates}</div>

    ${selectedSummary}
  `;

  document.querySelectorAll("[data-toggle-skill]").forEach((button) => {
    button.addEventListener("click", () => toggleSkillApproval(button.dataset.toggleSkill));
  });
  document.querySelector("[data-proceed-skills]")?.addEventListener("click", proceedWithApprovedSkills);
}

function renderCandidateCard(candidate) {
  const candidateName = candidate.plainTitle || candidate.name || "이 후보";
  const helps = candidate.helpsWith?.length ? candidate.helpsWith : [`${candidateName}가 요청에 맞는지 확인하는 작업`];
  const intentFit = candidate.intentFit || `${candidate.fullName || candidateName} 저장소가 검색 결과에 포함되어 후보로 가져왔습니다.`;
  const isApproved = approvedSkillIds.has(candidate.id);
  const approval = candidate.canApprove === false
    ? `<div class="blocked-box">권한이 큰 도구일 수 있어 이 후보는 다운로드하지 않습니다.</div>`
    : `<div class="approval-box ${isApproved ? "approved" : ""}">
        <p>이 후보를 다음 단계에서 임시로 읽어봐도 될까요?</p>
        <p class="privacy-note">승인하면 파일 내용을 읽고 실제 사용해도 되는지 확인합니다. 이 단계에서는 로컬에 저장하지 않습니다.</p>
        <button type="button" class="${isApproved ? "secondary-action" : "primary-action"}" data-toggle-skill="${escapeHtml(candidate.id)}">
          ${isApproved ? "승인 취소" : "승인하기"}
        </button>
      </div>`;
  const approvedBadge = isApproved ? `<span class="approved-badge">승인됨</span>` : "";

  return `
    <article class="candidate-card">
      <div class="candidate-head">
        <span class="verdict ${verdictClass(candidate.verdict?.label)}">${escapeHtml(displayVerdictLabel(candidate.verdict?.label))}</span>
        ${approvedBadge}
      </div>
      <h3>${escapeHtml(candidate.plainTitle || candidate.name)}</h3>
      <p class="plain-summary">${escapeHtml(candidate.plainSummary || "이 후보가 어떤 일을 하는지 추가 확인이 필요합니다.")}</p>

      <section class="explain-block">
        <h4>무엇을 도와줄 수 있나요?</h4>
        <ul>${helps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>

      <section class="explain-block">
        <h4>왜 후보로 골랐나요?</h4>
        <p>${escapeHtml(intentFit)}</p>
      </section>

      <p class="verdict-reason">${escapeHtml(candidate.verdict?.reason || "")}</p>

      <div class="source-line">
        <span>출처</span>
        <a href="${escapeHtml(candidate.url)}" target="_blank" rel="noreferrer">${escapeHtml(candidate.fullName)}</a>
        <span>별 ${Number(candidate.stars || 0).toLocaleString("ko-KR")}</span>
      </div>

      ${approval}
    </article>
  `;
}

function renderSkillReview(view) {
  lastSkillReviewView = view;
  const inspected = view.inspected || [];
  const usable = view.usable || [];
  resultBody.innerHTML = `
    <section class="search-panel">
      <p class="step-label">3. Skill 임시 확인</p>
      <h2>${escapeHtml(view.title || "Skill 내용을 확인했습니다")}</h2>
      <p>${escapeHtml(view.summary || "")}</p>
      <p>읽은 파일은 분석에만 사용했고, 로컬에 저장하지 않았습니다.</p>
    </section>

    <div class="candidate-list">
      ${inspected.map(renderInspectedSkill).join("")}
    </div>

    <section class="selected-panel">
      <p class="step-label">결과물 생성</p>
      <h2>${usable.length ? `${usable.length}개 Skill로 결과물을 만들 수 있습니다` : "사용 가능한 Skill이 없습니다"}</h2>
      <p>${usable.length ? "아래 버튼을 누르면 확인된 Skill을 바탕으로 바로 쓸 결과물을 만듭니다." : "다른 후보를 선택하거나 다시 검색해야 합니다."}</p>
      ${usable.length ? `<button type="button" class="primary-action next-action" data-generate-result>결과물 생성</button>` : ""}
    </section>
  `;
  document.querySelector("[data-generate-result]")?.addEventListener("click", generateResult);
}

async function generateResult() {
  const usableSkills = lastSkillReviewView?.usable || [];
  if (!usableSkills.length) return;

  setLoading("확인된 Skill을 바탕으로 결과물을 만들고 있습니다.");

  const response = await fetch("/api/generate-result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: lastInput,
      usableSkills
    })
  });
  const data = await response.json();

  if (!response.ok) {
    renderError(data.error || "결과물 생성 중 문제가 생겼습니다.");
    return;
  }

  render(data.userView);
}

function renderGeneratedResult(result = {}) {
  resultBody.innerHTML = `
    <section class="result-panel">
      <p class="step-label">4. 결과물</p>
      <h2>${escapeHtml(result.title || "바로 쓸 결과물")}</h2>
      <pre>${escapeHtml(result.body || "결과물을 만들지 못했습니다.")}</pre>
    </section>
  `;
}

function renderInspectedSkill(candidate) {
  const files = candidate.checkedFiles?.length ? candidate.checkedFiles.join(", ") : "읽은 파일 없음";
  const flags = candidate.flags?.length
    ? `<ul>${candidate.flags.map((flag) => `<li>${escapeHtml(flag)}</li>`).join("")}</ul>`
    : "<p>큰 문제 신호는 보이지 않았습니다.</p>";
  return `
    <article class="candidate-card">
      <div class="candidate-head">
        <span class="verdict ${decisionClass(candidate.decision)}">${escapeHtml(candidate.decision || "보류")}</span>
      </div>
      <h3>${escapeHtml(candidate.plainTitle || candidate.name)}</h3>
      <p>${escapeHtml(candidate.reason || "")}</p>
      <section class="explain-block">
        <h4>임시로 읽은 파일</h4>
        <p>${escapeHtml(files)}</p>
      </section>
      <section class="explain-block">
        <h4>확인한 내용</h4>
        <p>${escapeHtml(candidate.evidence || "")}</p>
      </section>
      <section class="explain-block">
        <h4>주의할 점</h4>
        ${flags}
      </section>
      <div class="source-line">
        <span>출처</span>
        <a href="${escapeHtml(candidate.url)}" target="_blank" rel="noreferrer">${escapeHtml(candidate.fullName)}</a>
      </div>
    </article>
  `;
}

function currentApprovalView() {
  return {
    mode: "skill-approval",
    intent: {
      label: "현재 선택",
      summary: lastInput,
      needs: []
    },
    candidates: lastCandidates,
    emptyMessage: "조건에 맞는 Skill 후보를 찾지 못했습니다."
  };
}

function verdictClass(label) {
  if (label === "추천 후보") return "good";
  if (label === "다운로드 차단") return "block";
  if (label === "관련 후보") return "hold";
  return "weak";
}

function decisionClass(label) {
  if (label === "사용 가능") return "good";
  if (label === "사용 보류") return "block";
  return "hold";
}

function displayVerdictLabel(label) {
  return label || "후보";
}

function renderError(message) {
  resultBody.innerHTML = `<p class="error">${escapeHtml(message)}</p>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
