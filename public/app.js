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
  if (!candidate) return;

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
      <h2>이 의도에 맞는 Skill 후보입니다</h2>
      <p>아래 후보는 GitHub에서 실시간으로 찾았습니다. 아직 다운로드하지 않았고, 로컬에도 저장하지 않았습니다.</p>
      <div class="query-list">
        ${(view.search.queries || []).map((query) => `<span>${escapeHtml(query.replace(" in:name,description,readme", ""))}</span>`).join("")}
      </div>
    </section>

    <div class="candidate-list">${candidates}</div>
  `;

  document.querySelectorAll("[data-approve-skill]").forEach((button) => {
    button.addEventListener("click", () => approveSkill(button.dataset.approveSkill));
  });
}

function renderCandidateCard(candidate) {
  return `
    <article class="candidate-card">
      <div>
        <h3>${escapeHtml(candidate.name)}</h3>
        <p>${escapeHtml(candidate.description)}</p>
        <p class="why">${escapeHtml(candidate.whyMatched)}</p>
        <a href="${escapeHtml(candidate.url)}" target="_blank" rel="noreferrer">${escapeHtml(candidate.fullName)}</a>
      </div>
      <div class="candidate-meta">
        <span>★ ${Number(candidate.stars || 0).toLocaleString("ko-KR")}</span>
        <span>점수 ${candidate.score}</span>
      </div>
      <div class="approval-box">
        <p>이 Skill 후보를 내려받아 임시로 확인해도 될까요?</p>
        <p class="privacy-note">승인 전에는 다운로드하지 않습니다. 승인해도 이 단계에서는 로컬에 저장하지 않습니다.</p>
        <button type="button" class="primary-action" data-approve-skill="${escapeHtml(candidate.id)}">승인하기</button>
      </div>
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
          <h3>${escapeHtml(candidate.name)}</h3>
          <p>${escapeHtml(candidate.description)}</p>
          <a href="${escapeHtml(candidate.url)}" target="_blank" rel="noreferrer">${escapeHtml(candidate.fullName)}</a>
        </article>
      `).join("")}
    </div>
  `;
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
