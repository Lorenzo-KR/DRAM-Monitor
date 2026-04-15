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
    dash:       { render: () => Pages.Dashboard.render() },
    biweekly:   { render: () => Pages.Biweekly.render() },
    progress:   { render: () => { Pages.Progress.initYearTabs(); Pages.Progress.render(); Pages.Progress.renderChart(); } },
    revenue:    { render: () => { Pages.Revenue.setMode('year'); } },
    kpitarget:  { render: () => Pages.KpiTarget.render() },
    country:    { render: () => Pages.Country.render() },
    verify:     { render: () => Pages.Verify.render() },
    customers:  { render: () => Pages.Customers.render() },
    report:     { render: () => Pages.Report.render() },
    changelog:  { render: () => Pages.Changelog.render() },
    dramprice:  { render: () => Pages.DramPrice.render() },
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
      // 보고서·KPI 탭은 좌우 패딩 최소화 (표 너비 확보)
      const mainEl = document.querySelector('.main');
      if (mainEl) mainEl.style.padding =
        (pageKey === 'report' || pageKey === 'kpitarget') ? '28px 12px' : '';

      // 대상 페이지 표시
      const pageEl = document.getElementById(`pg-${pageKey}`);
      if (pageEl) pageEl.classList.add('on');

      // 대상 nav 버튼 활성화
      const navBtn = document.querySelector(`.ni[data-page="${pageKey}"]`);
      if (navBtn) navBtn.classList.add('on');

      _current = pageKey;

      // 렌더 함수 호출
      if (page.render) page.render();
    },

    /** 현재 페이지 키 */
    current() { return _current; },
  };

})();
