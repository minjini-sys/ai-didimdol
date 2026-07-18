const examples = {
  hackathon: "해커톤 지정공모 포용적 AI 주제에 맞는 아이디어를 만들고, 이게 필요할까 대체되지 않을까 진짜 도움이 될까 질문에 답할 수 있게 검증하고 싶어.",
  business: "작은 카페를 운영하는데 동네 손님에게 보낼 홍보 문구와 이번 주 실행 계획을 만들고 싶어."
};

const form = document.querySelector("#routeForm");
const input = document.querySelector("#userInput");
const statusLabel = document.querySelector("#statusLabel");
const summary = document.querySelector("#summary");
const routeBox = document.querySelector("#routeBox");
const capabilityList = document.querySelector("#capabilityList");
const skillList = document.querySelector("#skillList");
const mcpList = document.querySelector("#mcpList");
const agentList = document.querySelector("#agentList");
const stepList = document.querySelector("#stepList");
const safetyList = document.querySelector("#safetyList");

document.querySelector("#hackathonExample").addEventListener("click", () => {
  input.value = examples.hackathon;
});

document.querySelector("#businessExample").addEventListener("click", () => {
  input.value = examples.business;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoading();
  const response = await fetch("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: input.value })
  });
  const data = await response.json();
  if (!response.ok) {
    statusLabel.textContent = "오류";
    summary.textContent = data.error || "처리 중 문제가 생겼습니다.";
    return;
  }
  render(data);
});

function setLoading() {
  statusLabel.textContent = "분석 중";
  summary.textContent = "목적, 위험도, 필요한 능력을 분류하고 있습니다.";
}

function render(data) {
  const view = data.userView;
  statusLabel.textContent = view.statusLabel;
  summary.textContent = view.summary;

  routeBox.innerHTML = "";
  addDefinition("의도", data.route.intent);
  addDefinition("행동", view.taskLabels.join(", "));
  addDefinition("위험도", data.route.riskLevel);
  addDefinition("지원", data.route.supported);
  addDefinition("모델", data.route.model);

  renderChips(capabilityList, view.capabilities);
  renderList(skillList, data.matches.skills);
  renderList(mcpList, data.matches.mcps);
  renderList(agentList, data.matches.agents);
  renderSteps(stepList, view.steps);

  const safetyItems = [...view.warnings, ...view.confirmations];
  safetyList.innerHTML = "";
  if (safetyItems.length === 0) {
    safetyList.innerHTML = "<li>추가 차단 조건이 없습니다.</li>";
  } else {
    safetyItems.forEach((item) => safetyList.insertAdjacentHTML("beforeend", `<li>${escapeHtml(item)}</li>`));
  }
}

function addDefinition(term, value) {
  routeBox.insertAdjacentHTML(
    "beforeend",
    `<dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd>`
  );
}

function renderChips(target, items) {
  target.innerHTML = "";
  items.forEach((item) => target.insertAdjacentHTML("beforeend", `<span class="chip">${escapeHtml(item)}</span>`));
}

function renderList(target, items) {
  target.innerHTML = "";
  if (!items.length) {
    target.innerHTML = "<li>추천 항목 없음</li>";
    return;
  }
  items.forEach((item) => {
    target.insertAdjacentHTML(
      "beforeend",
      `<li><strong>${escapeHtml(item.name)}</strong><br />${escapeHtml(item.description)}</li>`
    );
  });
}

function renderSteps(target, items) {
  target.innerHTML = "";
  items.forEach((item) => target.insertAdjacentHTML("beforeend", `<li>${escapeHtml(item)}</li>`));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

form.dispatchEvent(new Event("submit"));

