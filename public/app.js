const form = document.querySelector("#routeForm");
const input = document.querySelector("#userInput");
const resultBody = document.querySelector("#resultBody");
const routerDetails = document.querySelector("#routerDetails");
const routerTrace = document.querySelector("#routerTrace");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (!value) return;

  setLoading();

  const response = await fetch("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: value })
  });
  const data = await response.json();

  if (!response.ok) {
    resultBody.innerHTML = `<p class="error">${escapeHtml(data.error || "처리 중 문제가 생겼습니다.")}</p>`;
    routerDetails.hidden = true;
    return;
  }

  render(data.userView);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

function setLoading() {
  resultBody.innerHTML = "<p class=\"empty\">결과를 만들고 있습니다.</p>";
  routerTrace.innerHTML = "";
  routerDetails.hidden = true;
}

function render(view) {
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
    const used = stage.used.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
