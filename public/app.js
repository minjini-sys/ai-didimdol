const form = document.querySelector("#routeForm");
const input = document.querySelector("#userInput");
const resultBody = document.querySelector("#resultBody");

let lastCandidates = [];
let lastInput = "";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  lastInput = value;
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

async function approveSkill(candidateId) {
  const candidate = lastCandidates.find((item) => item.id === candidateId);
  if (!candidate || candidate.canApprove === false) return;

  setLoading("승인 내용을 확인하고 있습니다.");

  const response = await fetch("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: lastInput,
      approvedSkillIds: [candidateId],
      candidates: lastCandidates
    })
  });
  const data = await response.json();

  if (!response.ok) {
    renderError(data.error || "승인 처리 중 문제가 생겼습니다.");
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

  if (view.mode === "approved") {
    renderApproved(view);
    return;
  }

  renderError("알 수 없는 응답입니다.");
}

function renderSkillApproval(view) {
  lastCandidates = view.candidates || [];

  const candidates = lastCandidates.length
    ? lastCandidates.map(renderCandidateCard).join("")
    : `<p class="empty">${escapeHtml(view.emptyMessage)}</p>`;

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
  `;

  document.querySelectorAll("[data-approve-skill]").forEach((button) => {
    button.addEventListener("click", () => approveSkill(button.dataset.approveSkill));
  });
}

function renderCandidateCard(candidate) {
  const helps = candidate.helpsWith?.length ? candidate.helpsWith : ["이 요청에 도움이 될 가능성이 있는 AI 작업 보조"];
  const intentFit = candidate.intentFit || "검색어와 저장소 설명이 일부 맞아 후보로 가져왔습니다.";
  const approval = candidate.canApprove === false
    ? `<div class="blocked-box">권한이 큰 도구일 수 있어 이 후보는 다운로드하지 않습니다.</div>`
    : `<div class="approval-box">
        <p>이 후보를 다음 단계에서 임시로 읽어봐도 될까요?</p>
        <p class="privacy-note">승인하면 파일 내용을 읽고 실제 사용해도 되는지 확인합니다. 이 단계에서는 로컬에 저장하지 않습니다.</p>
        <button type="button" class="primary-action" data-approve-skill="${escapeHtml(candidate.id)}">승인하기</button>
      </div>`;

  return `
    <article class="candidate-card">
      <div class="candidate-head">
        <span class="verdict ${verdictClass(candidate.verdict?.label)}">${escapeHtml(candidate.verdict?.label || "검토 필요")}</span>
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

function renderApproved(view) {
  const approved = view.approved || [];
  resultBody.innerHTML = `
    <section class="intent-panel">
      <p class="step-label">승인 완료</p>
      <h2>${escapeHtml(view.title)}</h2>
      <p>${escapeHtml(view.message)}</p>
    </section>
    <div class="candidate-list">
      ${approved.map((candidate) => `
        <article class="candidate-card">
          <span class="verdict ${verdictClass(candidate.verdict?.label)}">${escapeHtml(candidate.verdict?.label || "검토 필요")}</span>
          <h3>${escapeHtml(candidate.plainTitle || candidate.name)}</h3>
          <p>${escapeHtml(candidate.plainSummary || "")}</p>
          <div class="source-line">
            <span>출처</span>
            <a href="${escapeHtml(candidate.url)}" target="_blank" rel="noreferrer">${escapeHtml(candidate.fullName)}</a>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function verdictClass(label) {
  if (label === "검토 추천") return "good";
  if (label === "다운로드 차단") return "block";
  if (label === "검토 필요") return "hold";
  return "weak";
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
