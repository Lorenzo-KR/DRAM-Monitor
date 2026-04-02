/**
 * pages/changelog.js
 * 업데이트 현황 — 앱 개발 이력 + 데이터 변경 로그
 */

Pages.Changelog = (() => {

  let _tab    = 'dev';   // 'dev' | 'data'
  let _filter = '';      // '' | 'LOT' | '인보이스' | '일별처리'
  let _logs   = null;    // 캐시

  // ── 앱 개발 이력 데이터 ────────────────────────────────────
  const VERSIONS = [
    {
      version: 'v0.9',
      date:    '2026-04-02',
      title:   '매출현황 개선 · 보고서 · 업데이트 현황',
      latest:  true,
      items: [
        { type: 'new',     text: '업데이트 현황 페이지 — 개발 이력 + 데이터 변경 로그 탭' },
        { type: 'new',     text: '보고서(테스트) 페이지 — 기준월별 국가별 LOT 현황 요약' },
        { type: 'new',     text: '매출현황 인보이스 청구 상태 3단계 구분 (작업진행중 · 입력대기 · 청구완료)' },
        { type: 'new',     text: '매출현황 금액 입력 시 청구일 함께 입력 가능' },
        { type: 'improve', text: '매출현황 표 — 평균단가 · 청구일 컬럼 추가, 사업/지역 배지 색상 구분' },
        { type: 'improve', text: 'LOT 진행현황 엑셀 다운로드 — 일별 처리 이력 시트 추가 (2시트)' },
        { type: 'improve', text: '바이위클리 월별 처리량 — 인보이스 청구일 기준으로 변경' },
      ],
    },
    {
      version: 'v0.8',
      date:    '2026-03-25',
      title:   '전체 디자인 리뉴얼 · 배지 개선',
      items: [
        { type: 'improve', text: '전체 페이지 배경 쿨그레이 (#F5F5F7) · 사이드바 딥블루 (#1B3A6B) 적용' },
        { type: 'improve', text: '표 디자인 체계 정비 — 헤더 #E8E8ED · 선색 #D2D2D7 통일' },
        { type: 'improve', text: '진행중 배지 그린 통일 · KPI/매출 활성 탭 차콜로 변경' },
        { type: 'fix',     text: '환율 적용 버튼 — Store.saveSetting → Store.setSetting 오타 수정' },
        { type: 'fix',     text: '바이위클리 월 헤더 colspan 누락 수정 · BIZ_LABELS 선언 누락 수정' },
      ],
    },
    {
      version: 'v0.7',
      date:    '2026-03-10',
      title:   'Apps Script v8 · 날짜 버그 전면 수정',
      items: [
        { type: 'fix',     text: 'Apps Script v8 — formatDateCell padStart 제거, 날짜 직렬화 완전 수정' },
        { type: 'fix',     text: 'today() · currentMonth() UTC → 로컬 타임존 수정 (한국 UTC+9)' },
        { type: 'fix',     text: 'normalizeDate 전면 재작성 — Sheets serial, ISO Z, 슬래시형 모두 처리' },
        { type: 'fix',     text: 'KpiTarget 로드 타이밍 오류 · Store.setSetting 오타 수정' },
        { type: 'improve', text: 'Apps Script — 빈 시트 자동생성 방지 (getSheetIfExists 분리)' },
      ],
    },
    {
      version: 'v0.6',
      date:    '2026-02-20',
      title:   'KPI 연동 · 대시보드 개선',
      items: [
        { type: 'improve', text: '대시보드 KPI 달성률 — KPI목표설정 탭 롤링 데이터 연동' },
        { type: 'new',     text: '대시보드 환율 입력 + 적용 버튼 — 원화 환산 즉시 반영' },
        { type: 'improve', text: '대시보드 Active Orders 표 — 진행중/입고예정/미수금 구분' },
      ],
    },
    {
      version: 'v0.5',
      date:    '2026-02-01',
      title:   '초기 배포 · 핵심 기능',
      items: [
        { type: 'new', text: '대시보드 · LOT 진행현황 · 바이위클리 · 매출현황 · KPI 목표설정' },
        { type: 'new', text: 'Google Apps Script 백엔드 연동 (Sheets DB)' },
      ],
    },
  ];

  // ── 배지 ────────────────────────────────────────────────────
  function _devBadge(type) {
    const map = {
      new:     { label: '신규', bg: '#F0FBF3', color: '#1A7F37', border: '#34C759' },
      improve: { label: '개선', bg: '#EFF6FF', color: '#185FA5', border: '#93C5FD' },
      fix:     { label: '수정', bg: '#FEF2F2', color: '#dc2626', border: '#FECACA' },
    };
    const s = map[type] || map.improve;
    return `<span style="flex:0 0 auto;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:600;background:${s.bg};color:${s.color};border:1px solid ${s.border};white-space:nowrap">${s.label}</span>`;
  }

  function _catBadge(cat) {
    const map = {
      'LOT':     { bg: '#F5F3FF', color: '#5B21B6', border: '#C4B5FD' },
      '인보이스': { bg: '#F0FBF3', color: '#1A7F37', border: '#34C759' },
      '일별처리': { bg: '#FFFBEB', color: '#92400E', border: '#FCD34D' },
    };
    const s = map[cat] || { bg: '#F5F5F7', color: '#6E6E73', border: '#D2D2D7' };
    return `<span style="padding:2px 8px;border-radius:3px;font-size:10px;font-weight:600;background:${s.bg};color:${s.color};border:1px solid ${s.border};white-space:nowrap">${cat}</span>`;
  }

  function _actBadge(act) {
    const map = {
      '등록': { bg: '#EFF6FF', color: '#185FA5', border: '#93C5FD' },
      '수정': { bg: '#FEF2F2', color: '#dc2626', border: '#FECACA' },
      '삭제': { bg: '#F5F5F7', color: '#6E6E73', border: '#D2D2D7' },
    };
    const s = map[act] || map['등록'];
    return `<span style="padding:2px 8px;border-radius:3px;font-size:10px;font-weight:600;background:${s.bg};color:${s.color};border:1px solid ${s.border};white-space:nowrap">${act}</span>`;
  }

  // ── ts 포맷 (ISO → "YYYY-MM-DD HH:MM") ────────────────────
  function _fmtTs(ts) {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      const y = d.getFullYear();
      const mo = String(d.getMonth()+1).padStart(2,'0');
      const dd = String(d.getDate()).padStart(2,'0');
      const h  = String(d.getHours()).padStart(2,'0');
      const mi = String(d.getMinutes()).padStart(2,'0');
      return `${y}-${mo}-${dd} ${h}:${mi}`;
    } catch(e) { return String(ts).slice(0,16); }
  }

  // ── 탭 헤더 렌더 ────────────────────────────────────────────
  function _tabStyle(active) {
    return active
      ? 'padding:9px 22px;font-size:13px;font-weight:600;color:#1D1D1F;background:none;border:none;border-bottom:2px solid #1D1D1F;cursor:pointer;margin-bottom:-1px'
      : 'padding:9px 22px;font-size:13px;font-weight:400;color:#86868B;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;margin-bottom:-1px';
  }

  // ── 개발 이력 패널 ──────────────────────────────────────────
  function _renderDev() {
    return VERSIONS.map((v, vi) => {
      const dotColor = v.latest ? '#1D1D1F' : '#D2D2D7';
      const verColor = v.latest ? '#1D1D1F' : '#6E6E73';
      const latestBadge = v.latest
        ? `<span style="display:inline-block;margin-top:5px;padding:1px 7px;background:#1D1D1F;color:#fff;font-size:10px;border-radius:4px">최신</span>`
        : '';
      const items = v.items.map(item =>
        `<div style="display:flex;gap:8px;align-items:flex-start">
          ${_devBadge(item.type)}
          <span style="font-size:12px;color:#3A3A3C;line-height:1.6">${item.text}</span>
        </div>`
      ).join('');
      return `
        <div style="display:flex;gap:20px;margin-bottom:${v.latest?32:24}px">
          <div style="flex:0 0 100px;text-align:right;padding-top:2px">
            <div style="font-size:13px;font-weight:600;color:${verColor}">${v.version}</div>
            <div style="font-size:11px;color:#86868B;margin-top:2px">${v.date}</div>
            ${latestBadge}
          </div>
          <div style="flex:0 0 16px;display:flex;flex-direction:column;align-items:center;padding-top:4px">
            <div style="width:8px;height:8px;border-radius:50%;background:${dotColor};flex-shrink:0"></div>
            ${vi < VERSIONS.length-1 ? `<div style="width:1px;flex:1;background:#E8E8ED;margin-top:4px"></div>` : ''}
          </div>
          <div style="flex:1;padding-top:2px">
            <div style="font-size:13px;font-weight:600;color:#1D1D1F;margin-bottom:10px">${v.title}</div>
            <div style="display:flex;flex-direction:column;gap:7px">${items}</div>
          </div>
        </div>`;
    }).join('');
  }

  // ── 데이터 로그 패널 ────────────────────────────────────────
  function _renderData(logs) {
    const filtered = _filter
      ? logs.filter(l => l.category === _filter)
      : logs;

    // 최신순 정렬
    const sorted = [...filtered].sort((a,b) => String(b.ts||'').localeCompare(String(a.ts||'')));
    const recent = sorted.slice(0, 100);

    const CATS = ['LOT','인보이스','일별처리'];
    const filterBtns = ['전체', ...CATS].map(cat => {
      const active = cat === '전체' ? _filter === '' : _filter === cat;
      const style = active
        ? 'padding:4px 14px;border-radius:20px;font-size:12px;border:1.5px solid #1D1D1F;background:#1D1D1F;color:#fff;cursor:pointer'
        : 'padding:4px 14px;border-radius:20px;font-size:12px;border:1.5px solid #D2D2D7;background:none;color:#6E6E73;cursor:pointer';
      const val = cat === '전체' ? '' : cat;
      return `<button onclick="Pages.Changelog.setFilter('${val}')" style="${style}">${cat}</button>`;
    }).join('');

    if (recent.length === 0) {
      return `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">${filterBtns}</div>
        <div style="padding:40px;text-align:center;color:#C7C7CC;font-size:13px">로그 데이터 없음</div>`;
    }

    const rows = recent.map((log, i) => {
      const rowBg = i % 2 === 1 ? 'background:#FAFAFA' : '';
      return `<tr style="${rowBg}">
        <td style="padding:9px 12px;border-top:1px solid #F2F2F7;color:#6E6E73;white-space:nowrap;font-family:var(--font-mono);font-size:11px">${_fmtTs(log.ts)}</td>
        <td style="padding:9px 12px;border-top:1px solid #F2F2F7;text-align:center">${_catBadge(log.category)}</td>
        <td style="padding:9px 12px;border-top:1px solid #F2F2F7;text-align:center">${_actBadge(log.action)}</td>
        <td style="padding:9px 12px;border-top:1px solid #F2F2F7;font-family:var(--font-mono);font-weight:500;color:#1D1D1F;white-space:nowrap">${log.lotNo || '—'}</td>
        <td style="padding:9px 12px;border-top:1px solid #F2F2F7;color:#3A3A3C;font-size:12px">${log.summary || '—'}</td>
      </tr>`;
    }).join('');

    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <span style="font-size:12px;color:#6E6E73">분류</span>
        ${filterBtns}
        <span style="flex:1"></span>
        <span style="font-size:11px;color:#C7C7CC">최근 ${recent.length}건</span>
      </div>
      <div style="border:1px solid #D2D2D7;border-radius:10px;overflow:hidden">
        <table style="border-collapse:collapse;width:100%;font-size:12px">
          <thead><tr>
            <th style="padding:9px 12px;background:#E8E8ED;border-bottom:1px solid #D2D2D7;color:#3A3A3C;font-size:11px;font-weight:600;white-space:nowrap;text-align:left">일시</th>
            <th style="padding:9px 12px;background:#E8E8ED;border-bottom:1px solid #D2D2D7;color:#3A3A3C;font-size:11px;font-weight:600;white-space:nowrap;text-align:center">분류</th>
            <th style="padding:9px 12px;background:#E8E8ED;border-bottom:1px solid #D2D2D7;color:#3A3A3C;font-size:11px;font-weight:600;white-space:nowrap;text-align:center">구분</th>
            <th style="padding:9px 12px;background:#E8E8ED;border-bottom:1px solid #D2D2D7;color:#3A3A3C;font-size:11px;font-weight:600;white-space:nowrap;text-align:left">LOT번호</th>
            <th style="padding:9px 12px;background:#E8E8ED;border-bottom:1px solid #D2D2D7;color:#3A3A3C;font-size:11px;font-weight:600;text-align:left">내용</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ── Public ─────────────────────────────────────────────────
  return {
    setFilter(f) {
      _filter = f;
      Pages.Changelog.render();
    },

    switchTab(tab) {
      _tab = tab;
      Pages.Changelog.render();
    },

    async render() {
      const el = document.getElementById('changelog-root'); if (!el) return;

      const isDev  = _tab === 'dev';
      const isData = _tab === 'data';

      // 데이터 탭이면 로그 로드
      if (isData && _logs === null) {
        el.innerHTML = `<div style="padding:40px;text-align:center;color:#C7C7CC;font-size:13px">로그 불러오는 중...</div>`;
        _logs = await Api.getLogs();
        // 렌더 다시 호출
        Pages.Changelog.render();
        return;
      }

      el.innerHTML = `
        <div style="max-width:780px">
          <!-- 헤더 -->
          <div style="margin-bottom:20px">
            <div style="font-size:15px;font-weight:600;color:#1D1D1F">업데이트 현황</div>
            <div style="font-size:12px;color:#86868B;margin-top:2px">Test Ops Monitor</div>
          </div>

          <!-- 탭 -->
          <div style="display:flex;border-bottom:1px solid #D2D2D7;margin-bottom:24px">
            <button onclick="Pages.Changelog.switchTab('dev')"  style="${_tabStyle(isDev)}">앱 개발 이력</button>
            <button onclick="Pages.Changelog.switchTab('data')" style="${_tabStyle(isData)}">데이터 변경 로그</button>
          </div>

          <!-- 패널 -->
          ${isDev ? _renderDev() : _renderData(_logs || [])}
        </div>`;
    },
  };

})();
