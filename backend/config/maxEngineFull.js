const { signingKey } = require('./maxEngine');

module.exports = {
  signingKey, issuer: 'paca-max-engine', audience: 'max-engine-full',
  scope: 'business:read business:confirmed-write', tokenSeconds: 3600,
  // ChatGPT MCP 위임 전용(요청 purpose='mcp'). 매 요청 authenticate 가 활성·승인·교육원·비밀번호 변경을 다시 확인하므로
  // 퇴사·삭제·비밀번호 변경 시 즉시 무효. 원장 편의를 위해 30일(사장님 결정 2026-09-29).
  mcpTokenSeconds: 30 * 24 * 3600,
  previewSeconds: 600, pageSize: 100,
  dataKey: () => process.env.DATA_ENCRYPTION_KEY,
};
