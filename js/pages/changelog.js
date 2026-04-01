/**
 * pages/changelog.js
 * 업데이트 현황 — 버전별 기능/수정 이력
 */

Pages.Changelog = (() => {

  // ── 업데이트 데이터 (최신순) ────────────────────────────────
  // type: 'new' | 'improve' | 'fix'
  const VERSIONS = [
    {
      version: 'v0.9',
      date:    '2026-04-02',
      title:   '매출현황 개선 · 보고서 페이지 추가',
      latest:  true,
      items: [
        { type: 'new',     text: '보고서(테스트) 페이지 — 기준월별 국가/LOT 현황 요약 (인보이스 청구완료 · 청구예정 · 진행중)' },
        { type: 'new',     text: '매출현황 인보이스 청구 상태 3단계 구분 — 작업진행중 · 입력대기 · 청구완료' },
        { type: 'new',     text: '매출현황 금액 입력 시 청구일 함께 입력 가능' },
        { type: 'improve', text: '매출현황 표에 평균단가 · 청구일 컬럼 추가' },
        { type: 'improve', text: 'LOT 진행현황 엑셀 다운로드 — 일별 처리 이력 시트 추가 (2시트)' },
        { type: 'improve', text: '업데이트 현황 페이지 추가' },
      ],
    },
    {
      version: 'v0.8',
      date:    '2026-03-25',
      title:   '전체 디자인 리뉴얼 · 배지 개선',
      items: [
        { type: 'improve', text: '전체 페이지 배경 쿨그레이 (#F5F5F7) 적용' },
        { type: 'improve', text: '표 디자인 체계 정비 — 헤더 #E8E8ED · 선색 #D2D2D7 통일' },
        { type: 'improve', text: '사이드바 딥블루 (#1B3A6B) 적용' },
        { type: 'improve', text: '진행중 상태 배지 그린 (#34C759) 으로 통일 (대시보드 · 진행현황 · 매출현황)' },
        { type: 'improve', text: 'KPI 목표설정 · 매출현황 활성 탭 차콜 (#1D1D1F) 으로 변경 — 가시성 개선' },
        { type: 'improve', text: '바이위클리 표 선색 통일 · 월 헤더 colspan 수정' },
        { type: 'fix',     text: '환율 적용 버튼 — Store.saveSetting → Store.setSetting 오타 수정' },
      ],
    },
    {
      version: 'v0.7',
      date:    '2026-03-10',
      title:   'Apps Script v8 · 날짜 버그 수정',
      items: [
        { type: 'fix',     text: 'Apps Script v8 배포 — formatDateCell padStart 제거, 날짜 직렬화 완전 수정' },
        { type: 'fix',     text: 'today() · currentMonth() UTC→로컬 타임존 수정 (한국 UTC+9 기준)' },
        { type: 'fix',     text: 'normalizeDate 전면 재작성 — Sheets serial, ISO Z, 슬래시형 등 모든 형태 처리' },
        { type: 'fix',     text: 'KpiTarget 로드 타이밍 오류 수정 — loadAll 완료 후 render 호출' },
        { type: 'improve', text: 'Apps Script — 빈 시트 자동생성 방지 (getSheetIfExists 분리)' },
        { type: 'improve', text: 'weekly 시트 HEADERS에서 제거' },
      ],
    },
    {
      version: 'v0.6',
      date:    '2026-02-20',
      title:   'KPI 연동 · 대시보드 개선',
      items: [
        { type: 'improve', text: '대시보드 KPI 달성률 — KPI목표설정 탭 롤링 데이터 연동' },
        { type: 'new',     text: '대시보드 환율 입력 + 적용 버튼 — 원화 환산 즉시 반영' },
        { type: 'improve', text: '대시보드 Active Orders 표 — 진행중/입고예정/미수금 구분 표시' },
        { type: 'fix',     text: 'Store.saveSetting 오타 수정 (setSetting)' },
      ],
    },
    {
      version: 'v0.5',
      date:    '2026-02-01',
      title:   '초기 배포 · 핵심 기능',
      items: [
        { type: 'new', text: '대시보드 — KPI 카드 5개 · Active Orders 표' },
        { type: 'new', text: 'LOT 진행현황 — LOT 등록 · 일별 처리량 입력 · 엑셀 다운로드' },
        { type: 'new', text: '바이위클리 — 월별 처리량/매출액 표 · 현황 카드' },
        { type: 'new', text: '매출현황 — 인보이스 관리 · 차트' },
        { type: 'new', text: 'KPI 목표설정 — 연도별 사업별 목표 롤링 관리' },
        { type: 'new', text: 'Google Apps Script 백엔드 연동 (Sheets DB)' },
      ],
    },
  ];

  // ── 배지 ────────────────────────────────────────────────────
  function _badge(type) {
    const map = {
      new:     { label: '신규',  bg: '#F0FBF3', color: '#1A7F37', border: '#34C759' },
      improve: { label: '개선',  bg: '#EFF6FF', color: '#185FA5', border: '#93C5FD' },
      fix:     { label: '수정',  bg: '#FEF2F2', color: '#dc2626', border: '#FECACA' },
    };
    const s = map[type] || map.improve;
    return `<span style="flex:0 0 auto;margin-top:2px;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:600;background:${s.bg};color:${s.color};border:1px solid ${s.border};white-space:nowrap">${s.label}</span>`;
  }

  // ── 렌더 ────────────────────────────────────────────────────
  return {
    render() {
      const el = document.getElementById('changelog-root'); if (!el) return;

      const timeline = VERSIONS.map((v, vi) => {
        const dotColor  = v.latest ? '#1D1D1F' : '#D2D2D7';
        const verColor  = v.latest ? '#1D1D1F' : '#6E6E73';
        const latestBadge = v.latest
          ? `<span style="display:inline-block;margin-top:5px;padding:1px 7px;background:#1D1D1F;color:#fff;font-size:10px;border-radius:4px">최신</span>`
          : '';

        const items = v.items.map(item =>
          `<div style="display:flex;gap:8px;align-items:flex-start">
            ${_badge(item.type)}
            <span style="font-size:12px;color:#3A3A3C;line-height:1.6">${item.text}</span>
          </div>`
        ).join('');

        // 마지막 항목이면 세로선 짧게
        const lineStyle = vi === VERSIONS.length - 1
          ? 'height:24px'
          : 'flex:1;min-height:100%';

        return `
          <div style="display:flex;gap:20px;margin-bottom:${v.latest ? 32 : 24}px">
            <!-- 버전 + 날짜 -->
            <div style="flex:0 0 100px;text-align:right;padding-top:2px">
              <div style="font-size:13px;font-weight:600;color:${verColor}">${v.version}</div>
              <div style="font-size:11px;color:#86868B;margin-top:2px">${v.date}</div>
              ${latestBadge}
            </div>
            <!-- 타임라인 선 + 점 -->
            <div style="flex:0 0 16px;display:flex;flex-direction:column;align-items:center;padding-top:4px">
              <div style="width:8px;height:8px;border-radius:50%;background:${dotColor};flex-shrink:0"></div>
              ${vi < VERSIONS.length - 1 ? `<div style="width:1px;flex:1;background:#E8E8ED;margin-top:4px"></div>` : ''}
            </div>
            <!-- 내용 -->
            <div style="flex:1;padding-top:2px;padding-bottom:${vi < VERSIONS.length-1 ? 0 : 0}px">
              <div style="font-size:13px;font-weight:600;color:#1D1D1F;margin-bottom:10px">${v.title}</div>
              <div style="display:flex;flex-direction:column;gap:7px">${items}</div>
            </div>
          </div>`;
      }).join('');

      el.innerHTML = `
        <div style="max-width:720px">
          <div style="margin-bottom:28px">
            <div style="font-size:15px;font-weight:600;color:#1D1D1F">업데이트 현황</div>
            <div style="font-size:12px;color:#86868B;margin-top:2px">Test Ops Monitor 기능 변경 이력</div>
          </div>
          ${timeline}
        </div>`;
    },
  };

})();
