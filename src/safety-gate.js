export function applySafetyGate(route, matches) {
  const warnings = [];
  const requiredConfirmations = [];
  let status = "allow";

  if (route.riskLevel === "blocked") {
    status = "block";
    warnings.push("불법, 계정 탈취, 비밀번호 요청처럼 지원할 수 없는 요청이 포함되어 있습니다.");
  }

  if (route.riskLevel === "high") {
    status = status === "block" ? status : "confirm";
    warnings.push("개인정보, 돈, 건강, 사기 가능성이 있어 확인이 필요합니다.");
    requiredConfirmations.push("주민번호, 계좌번호, 인증번호, 비밀번호는 입력하지 않거나 가려야 합니다.");
    requiredConfirmations.push("최종 판단은 공식 기관, 병원 대표번호, 보호자 확인을 거쳐야 합니다.");
  }

  if (matches.mcps.some((mcp) => mcp.privacyRisk === "high")) {
    requiredConfirmations.push("외부 도구 연결 전에 어떤 데이터가 전송되는지 확인해야 합니다.");
  }

  return {
    status,
    warnings,
    requiredConfirmations
  };
}
