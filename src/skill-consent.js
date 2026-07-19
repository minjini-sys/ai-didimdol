export function buildSkillConsent(skills, approvedSkillIds = [], rejectedSkillIds = []) {
  const approved = new Set(approvedSkillIds);
  const rejected = new Set(rejectedSkillIds);
  const pending = skills.filter((skill) => !approved.has(skill.id) && !rejected.has(skill.id));

  if (pending.length === 0) return null;

  return {
    title: "도움 기능을 사용해도 될까요?",
    message: "결과를 더 잘 만들기 위해 아래 기능을 사용하려고 합니다. 보안상 사용 전에 먼저 확인을 받습니다.",
    skills: pending.map((skill) => ({
      id: skill.id,
      name: skill.name,
      reason: explainSkillReason(skill),
      source: skill.source?.locator || skill.source?.label || "출처 정보 없음",
      securityNote: skill.privacyRisk === "high"
        ? "회의 음성이나 파일처럼 민감한 내용이 포함될 수 있어 사용 전에 확인이 필요합니다."
        : "이 기능은 현재 요청의 결과를 만드는 데만 사용합니다."
    }))
  };
}

export function filterApprovedSkills(skills, approvedSkillIds = [], rejectedSkillIds = []) {
  const approved = new Set(approvedSkillIds);
  const rejected = new Set(rejectedSkillIds);
  if (approved.has("__all__")) return skills.filter((skill) => !rejected.has(skill.id));
  return skills.filter((skill) => approved.has(skill.id));
}

function explainSkillReason(skill) {
  if (skill.capabilities.includes("회의 받아쓰기")) return "회의 음성을 텍스트로 바꾸는 절차를 정확히 잡기 위해 필요합니다.";
  if (skill.capabilities.includes("회의 요약")) return "회의에서 결정된 내용과 할 일을 빠뜨리지 않고 정리하기 위해 필요합니다.";
  if (skill.capabilities.includes("Notion 정리")) return "요약한 내용을 Notion에 바로 붙여 넣거나 저장할 수 있는 형식으로 만들기 위해 필요합니다.";
  if (skill.capabilities.includes("댓글 분석")) return "댓글을 읽고 의미 있는 유형으로 나누기 위해 필요합니다.";
  if (skill.capabilities.includes("스프레드시트 저장")) return "분석 결과를 표 형태로 저장하기 위해 필요합니다.";
  if (skill.capabilities.includes("홍보 문구 생성")) return "손님에게 보낼 문구를 바로 쓸 수 있게 만들기 위해 필요합니다.";
  if (skill.capabilities.includes("실행 계획 생성")) return "이번 주에 할 일을 순서대로 정리하기 위해 필요합니다.";
  if (skill.capabilities.includes("아이디어 생성")) return "평범한 답을 넘어서 여러 관점의 아이디어 후보를 만들기 위해 필요합니다.";
  if (skill.capabilities.includes("아이디어 검증")) return "필요성, 대체 가능성, 실제 도움 여부를 따져보기 위해 필요합니다.";
  return `${skill.capabilities.join(", ")} 작업을 처리하기 위해 필요합니다.`;
}
