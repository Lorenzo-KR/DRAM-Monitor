/**
 * auth.js
 * 로그인 / 인증 처리
 *
 * 비밀번호 변경 방법:
 *   브라우저 콘솔에서 btoa('새비밀번호') 실행 후
 *   CONFIG.PASSWORD_B64 값을 교체하세요.
 */

const Auth = {

  /** 현재 로그인 상태 확인 */
  isLoggedIn() {
    return sessionStorage.getItem(CONFIG.AUTH_KEY) === '1';
  },

  /** 로그인 시도 */
  async login() {
    const input = document.getElementById('login-pw');
    const errEl = document.getElementById('login-err');

    if (btoa(input.value) === CONFIG.PASSWORD_B64) {
      sessionStorage.setItem(CONFIG.AUTH_KEY, '1');
      document.getElementById('login-screen').style.display = 'none';
      await DataLoader.loadAll();
      Nav.go('dash');
    } else {
      if (errEl) errEl.style.display = 'block';
      input.value = '';
      input.focus();
    }
  },

  /** 로그아웃 */
  logout() {
    sessionStorage.removeItem(CONFIG.AUTH_KEY);
    location.reload();
  },
};
