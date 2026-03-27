/**
 * app.js
 * 앱 진입점 — 가장 마지막에 로드됩니다.
 *
 * 역할:
 *   - 전역 에러 핸들링
 *   - 인증 확인 후 앱 부팅
 */

// ── 전역 에러 핸들러 ─────────────────────────────────────────
window.addEventListener('error', (event) => {
  // 외부 스크립트 cross-origin 에러는 무시
  if (event.message === 'Script error.' || event.message === 'Script error') return;
  console.error('[App Error]', event.message, event.filename, event.lineno);
});

// ── 앱 부팅 ─────────────────────────────────────────────────
(async function boot() {
  if (Auth.isLoggedIn()) {
    // 이미 로그인된 상태 — 바로 데이터 로드
    document.getElementById('login-screen').style.display = 'none';
    await DataLoader.loadAll();
    // kpiTarget.js는 dataLoader보다 나중에 로드되므로 여기서 동기화
    if (Pages.KpiTarget?.loadFromSettings) Pages.KpiTarget.loadFromSettings();
    Nav.go('dash');
  } else {
    // 로그인 화면 표시
    setTimeout(() => {
      const input = document.getElementById('login-pw');
      if (input) input.focus();
    }, 100);
  }
})();
