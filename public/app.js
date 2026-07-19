const form = document.querySelector("#routeForm");
const input = document.querySelector("#userInput");
const resultBody = document.querySelector("#resultBody");
const routerDetails = document.querySelector("#routerDetails");
const routerTrace = document.querySelector("#routerTrace");

const session = {
  originalInput: "",
  answers: {},
  pendingQuestion: null
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (!value) return;

  if (session.pendingQuestion) {
    session.answers[session.pendingQuestion.id] = value;
    input.value = "";
    await submitRoute(session.originalInput, { answers: session.answers });
    return;
  }

  session.originalInput = value;
  session.answers = {};
  session.pendingQuestion = null;
  await submitRoute(value);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

async function submitRoute(value, extra = {}) {
  setLoading();

  const response = await fetch("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: value, ...extra })
  });
  const data = await response.json();

  if (!response.ok) {
    resultBody.innerHTML = `<p class="error">${escapeHtml(data.error || "처리 중 문제가 생겼습니다.")}</p>`;
    routerDetails.hidden = true;
    return;
  }

  render(data.userView);
}

function setLoading() {
  resultBody.innerHTML = "<p class=\"empty\">생각하고 있습니다.</p>";
  routerTrace.innerHTML = "";
  routerDetails.hidden = true;
}

function render(view) {
  if (view.mode === "clarify") {
    renderClarification(view);
    return;
  }

  if (view.mode === "skill-consent") {
    renderSkillConsent(view);
    return;
  }

  session.pendingQuestion = null;
  input.placeholder = "원하는 일을 한 문장으로 적어보세요.";
  renderAnswer(view);
}

function renderClarification(view) {
  session.pendingQuestion = view.question;
  resultBody.innerHTML = `
    <section class="question-panel">
      <p class="step-label">조금만 더 알려주세요</p>
      <h2>${escapeHtml(view.question.text)}</h2>
    </section>
  `;
  input.placeholder = view.question.placeholder || "답변을 입력해 주세요.";
  input.focus();
  routerDetails.hidden = true;
}

function renderSkillConsent(view) {
  session.pendingQuestion = null;
  input.placeholder = "승인 후 결과가 만들어집니다.";
  const skills = view.consent.skills || [];
  const cards = skills.map((skill) => `
    <article class="consent-card">
      <h3>${escapeHtml(skill.name)}</h3>
      <p>${escapeHtml(skill.reason)}</p>
      <p class="security-note">${escapeHtml(skill.securityNote)}</p>
      <p class="source-note">${escapeHtml(skill.source)}</p>
    </article>
  `).join("");

  resultBody.innerHTML = `
    <section class="question-panel">
      <p class="step-label">확인이 필요합니다</p>
      <h2>${escapeHtml(view.title)}</h2>
      <p>${escapeHtml(view.summary)}</p>
    </section>
    <div class="consent-list">${cards}</div>
    <div class="consent-actions">
      <button type="button" class="primary-action" id="approveSkills">네, 사용하고 결과 만들기</button>
      <button type="button" class="secondary-action" id="denySkills">아니요, 사용하지 않고 진행</button>
    </div>
  `;

  document.querySelector("#approveSkills").addEventListener("click", () => {
    submitRoute(session.originalInput, {
      answers: session.answers,
      skillConsent: "approved",
      approvedSkillIds: skills.map((skill) => skill.id)
    });
  });

  document.querySelector("#denySkills").addEventListener("click", () => {
    submitRoute(session.originalInput, {
      answers: session.answers,
      skillConsent: "denied",
      rejectedSkillIds: skills.map((skill) => skill.id)
    });
  });

  routerDetails.hidden = true;
}

function renderAnswer(view) {
  const warnings = view.warnings || [];
  resultBody.innerHTML = "";

  if (warnings.length > 0) {
    resultBody.insertAdjacentHTML(
      "beforeend",
      `<section class="warning-box">${warnings.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</section>`
    );
  }

  if (view.title) {
    resultBody.insertAdjacentHTML("beforeend", `<h2>${escapeHtml(view.title)}</h2>`);
  }

  if (view.summary) {
    resultBody.insertAdjacentHTML("beforeend", `<p class="answer-summary">${escapeHtml(view.summary)}</p>`);
  }

  renderDeliverables(view.deliverables || []);
  renderRouterTrace(view.routerTrace || []);
}

function renderDeliverables(sections) {
  if (!sections.length) {
    resultBody.insertAdjacentHTML("beforeend", "<p class=\"empty\">아직 생성된 결과물이 없습니다.</p>");
    return;
  }

  sections.forEach((section) => {
    const items = section.items
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
    resultBody.insertAdjacentHTML(
      "beforeend",
      `<section class="result-section"><h3>${escapeHtml(section.title)}</h3><ul>${items}</ul></section>`
    );
  });
}

function renderRouterTrace(stages) {
  routerTrace.innerHTML = "";
  routerDetails.hidden = stages.length === 0;

  stages.forEach((stage) => {
    const used = stage.used.map((item) => `<li>${linkify(escapeHtml(item))}</li>`).join("");
    routerTrace.insertAdjacentHTML(
      "beforeend",
      `<article class="trace-card">
        <h3>${escapeHtml(stage.title)}</h3>
        <p>${escapeHtml(stage.description)}</p>
        <ul>${used}</ul>
      </article>`
    );
  });
}

function linkify(value) {
  return value.replace(
    /(https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/g,
    '<a href="$1" target="_blank" rel="noreferrer">$1</a>'
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
