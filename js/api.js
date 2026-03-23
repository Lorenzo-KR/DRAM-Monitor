/**
 * api.js
 * Google Apps Script 통신 레이어
 *
 * 모든 서버 통신은 이 파일을 통해서만 합니다.
 * 페이지/컴포넌트는 직접 fetch를 호출하지 않습니다.
 *
 * 주요 함수:
 *   Api.getAll(sheet)          — 시트 전체 행 가져오기
 *   Api.append(sheet, data)    — 새 행 추가
 *   Api.update(sheet, id, data)— 기존 행 수정
 *   Api.delete(sheet, id)      — 행 삭제
 *   Api.setupSheets()          — 시트 헤더 자동 설정
 */

const Api = (() => {

  // ── Save queue (debounced batch) ────────────────────────────
  let _queue   = [];
  let _timer   = null;
  let _saving  = false;

  // ── Status indicator ────────────────────────────────────────
  function _setStatus(status) {
    const dot  = document.getElementById('sdot');
    const text = document.getElementById('stext');
    const bar  = document.getElementById('ss-bar');

    if (!dot || !text) return;

    const states = {
      ok:      { dot: '',      text: '연결됨',    bar: 'ok' },
      saving:  { dot: ' spin', text: '저장 중...', bar: 'saving' },
      loading: { dot: ' spin', text: '로딩 중...', bar: 'saving' },
      err:     { dot: ' err',  text: '저장 오류', bar: 'err' },
    };

    const s = states[status] || states.ok;
    dot.className  = 'sdot' + s.dot;
    text.textContent = s.text;
    if (bar) bar.className = s.bar;

    // 저장 완료 후 2초 뒤 "연결됨"으로 복귀
    if (status === 'ok') {
      setTimeout(() => {
        if (text.textContent === '저장됨') text.textContent = '연결됨';
      }, 2000);
    }
  }

  // ── Flush queue (sequential, stable) ───────────────────────
  async function _flush() {
    if (_saving || _queue.length === 0) return;
    _saving = true;
    _setStatus('saving');

    while (_queue.length > 0) {
      const body = _queue.shift();
      try {
        const res  = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify(body) });
        const data = await res.json();
        if (data?.error) console.warn('[Api] Save error:', data.error);
      } catch (err) {
        console.warn('[Api] Network error:', err.message);
        // 1회 재시도
        try { await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify(body) }); } catch (_) {}
      }
    }

    _setStatus('ok');
    _saving = false;
  }

  // ── Optimistic write (enqueue + debounce 300ms) ─────────────
  function _enqueue(body) {
    _queue.push(body);
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(_flush, 300);
    // 즉시 성공으로 반환 — UI는 낙관적으로 먼저 업데이트
    return Promise.resolve({ success: true, optimistic: true });
  }

  // ── Public API ──────────────────────────────────────────────
  return {

    /**
     * 시트의 모든 행 가져오기
     * @param {string} sheet - CONFIG.SHEETS 의 값
     * @returns {Promise<Array>}
     */
    async getAll(sheet) {
      _setStatus('loading');
      try {
        const token = Auth.getToken();
        const res  = await fetch(`${CONFIG.API_URL}?action=getAll&sheet=${sheet}&token=${token}`);
        const data = await res.json();
        if (data?.error === 'UNAUTHORIZED') {
          sessionStorage.removeItem(Auth._TOKEN_KEY);
          location.reload();
          return [];
        }
        _setStatus('ok');
        return Array.isArray(data) ? data : [];
      } catch (err) {
        _setStatus('err');
        UI.toast('서버 연결 오류', true);
        return [];
      }
    },

    /**
     * 새 행 추가
     */
    append(sheet, data) {
      return _enqueue({ action: 'append', sheet, data, token: Auth.getToken() });
    },

    /**
     * 기존 행 수정
     */
    update(sheet, id, data) {
      return _enqueue({ action: 'update', sheet, id, data, token: Auth.getToken() });
    },

    /**
     * 행 삭제
     */
    delete(sheet, id) {
      return _enqueue({ action: 'delete', sheet, id, token: Auth.getToken() });
    },

    /**
     * 모든 시트 헤더 자동 설정 (앱 최초 로드 시 1회)
     */
    async setupSheets() {
      const token = Auth.getToken();
      await fetch(`${CONFIG.API_URL}?action=setupAll&token=${token}`).catch(() => {});
    },

  };

})();

// ─────────────────────────────────────────────────────────────
// UI 유틸 (toast, save status)
// api.js 에 같이 있는 이유: api.js 가 toast 를 호출해야 하기 때문
// ─────────────────────────────────────────────────────────────
const UI = {
  /**
   * Toast 알림
   * @param {string} message
   * @param {boolean} [isError=false]
   */
  toast(message, isError = false) {
    const wrap = document.getElementById('tw-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'tw-item';
    el.style.background = isError ? '#dc2626' : '#1e293b';
    el.textContent = message;
    wrap.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 2500);
  },
};
