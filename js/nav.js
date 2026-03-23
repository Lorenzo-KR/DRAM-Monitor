/**
 * nav.js
 * 페이지 라우팅 — 사이드바 활성화 + 페이지 전환 + 렌더 호출
 *
 * 새 페이지 추가 시:
 *   1. PAGES 객체에 { index, render } 추가
 *   2. HTML에 <div class="pg" id="pg-{key}"> 추가
 *   3. 사이드바에 <button onclick="Nav.go('{key}')"> 추가
 */

const Nav = (() => {

  /**
   * 페이지 정의
   * key      : URL 식별자 (nav 함수 인자)
   * index    : 사이드바 .ni 버튼의 순서 (0부터)
   * render   : 페이지 진입 시 호출할 함수
   */
  const PAGES = {
    dash:       { index: 0, render: () => Pages.Dashboard.render() },
    progress:   { index: 1, render: () => { Pages.Progress.initYearTabs(); Pages.Progress.render(); Pages.Progress.renderChart(); } },
    revenue:    { index: 2, render: () => Pages.Revenue.render() },
    kpitarget:  { index: 3, render: () => Pages.KpiTarget.render() },
    country:    { index: 4, render: () => Pages.Country.render() },
    verify:     { index: 5, render: () => Pages.Verify.render() },
    customers:  { index: 6, render: () => Pages.Customers.render() },
  };

  let _current = null;

  return {
    /** 페이지 이동 */
    go(pageKey) {
      const page = PAGES[pageKey];
      if (!page) { console.warn(`[Nav] Unknown page: "${pageKey}"`); return; }

      // 모든 페이지 숨기기
      document.querySelectorAll('.pg').forEach(el => el.classList.remove('on'));
      // 모든 nav 버튼 비활성화
      document.querySelectorAll('.ni').forEach(el => el.classList.remove('on'));

      // 대상 페이지 표시
      const pageEl = document.getElementById(`pg-${pageKey}`);
      if (pageEl) pageEl.classList.add('on');

      // 대상 nav 버튼 활성화
      const navButtons = document.querySelectorAll('.ni');
      if (navButtons[page.index]) navButtons[page.index].classList.add('on');

      _current = pageKey;

      // 렌더 함수 호출
      if (page.render) page.render();
    },

    /** 현재 페이지 키 */
    current() { return _current; },
  };

})();
