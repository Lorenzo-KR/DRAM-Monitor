/**
 * auth.js
 * 로그인 / 인증 처리 — 서버 토큰 기반
 *
 * 비밀번호는 Apps Script 서버에만 저장됨 (코드에 노출 안 됨)
 * POST 방식으로 전송 — URL/히스토리/로그에 비밀번호 안 남음
 */

const Auth = {

  _TOKEN_KEY: 'tom_token',

  /** 저장된 토큰 반환 */
  getToken() {
    return sessionStorage.getItem(this._TOKEN_KEY);
  },

  /** 현재 로그인 상태 확인 */
  isLoggedIn() {
    return !!this.getToken();
  },

  /** 로그인 시도 — POST로 전송하여 URL에 비밀번호 노출 방지 */
  async login() {
    const input = document.getElementById('login-pw');
    const errEl = document.getElementById('login-err');
    const btnEl = document.getElementById('login-btn');

    if (!input?.value) return;
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = '확인 중...'; }
    if (errEl) errEl.style.display = 'none';

    try {
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auth', pw: input.value }),
      });
      const data = await res.json();

      if (data.token) {
        sessionStorage.setItem(this._TOKEN_KEY, data.token);
        document.getElementById('login-screen').style.display = 'none';
        await DataLoader.loadAll();
        Nav.go('dash');
      } else {
        if (errEl) {
          errEl.textContent = data.error === 'WRONG_PASSWORD' ? '비밀번호가 올바르지 않습니다.' : '로그인 실패. 다시 시도해 주세요.';
          errEl.style.display = 'block';
        }
        input.value = '';
        input.focus();
      }
    } catch (err) {
      if (errEl) {
        errEl.textContent = '서버 연결 오류. 잠시 후 다시 시도해 주세요.';
        errEl.style.display = 'block';
      }
    } finally {
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = '로그인'; }
    }
  },

  /** 로그아웃 */
  logout() {
    sessionStorage.removeItem(this._TOKEN_KEY);
    location.reload();
  },
};
