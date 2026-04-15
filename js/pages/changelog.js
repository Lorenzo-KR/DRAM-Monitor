/**
 * pages/changelog.js
 * 업데이트 현황 — 앱 개발 이력 + 데이터 변경 로그
 */

Pages.Changelog = (() => {

  let _tab    = 'data';  // 'dev' | 'data'
  let _filter = '';      // '' | 'LOT' | '인보이스' | '일별처리'
  let _logs   = null;    // 캐시 (null=미로드, []이상=로드됨)
  let _logsLoading = false;

  // ── 앱 개발 이력 데이터 ────────────────────────────────────
  const VERSIONS = [
    {
      version: 'v71',
      date:    '2026-04-15',
      title:   '매출·EBIT 월 누적 달성률 행 추가 · SGD 단위 정확도 개선',
      latest:  true,
      items: [
        { type: 'new',     text: '실적표에 "매출 달성률(월 누적기준)" 행 추가 — KPI/EC 모두 적용' },
        { type: 'new',     text: '실적표에 "EBIT 달성률(월 누적기준)" 행 추가 — KPI 전용 (EC는 제외)' },
        { type: 'improve', text: '달성률 계산: raw USD 기준 통일 → MUSD/억원/MSGD 전환해도 동일한 값' },
        { type: 'fix',     text: 'SGD 변환 경로 수정 — M USD × 1.27 = M SGD (환율 이중 적용 오류 해결)' },
      ],
    },
    {
      version: 'v56~v70',
      date:    '2026-04-11 ~ 2026-04-15',
      title:   'KPI목표설정 대규모 개편 연속 패치',
      items: [
        { type: 'new',     text: 'SGD 단위 추가 (1.27 SGD/USD 계획환율)' },
        { type: 'new',     text: 'EC 기준 매출 계획/실적 표 추가, 차트 레이블 "매출"로 표시' },
        { type: 'new',     text: '표 뷰 전환 버튼: EBIT/매출 선택 표시' },
        { type: 'new',     text: '롤링창 붙여넣기 파싱 개선 — 탭/공백 자동 인식, 매출/EBIT 타입 자동 구분, 원단위 억원 자동 변환' },
        { type: 'new',     text: '붙여넣기 가이드 UI 추가 (형식/단위/사업명 매핑 안내)' },
        { type: 'new',     text: '롤링창 합계행: 매출 합계(파란색) + EBIT 합계(베이지) 두 줄 표시' },
        { type: 'new',     text: '[A] 연간 목표 달성 현황 소제목 추가, ① 계획표 ② 실적표 표 이름 추가' },
        { type: 'improve', text: '달성률: 130% → +30%, 97% → -3% 표현 (fmtPctDiff), 카드에도 "계획대비" 표기' },
        { type: 'improve', text: '기준 선택 버튼 경계선 추가, 관리자 버튼 심플화 (롤링(67)/롤링(103)/Factor)' },
        { type: 'improve', text: '표 폰트 컬러 검은색 통일, 테두리 1px solid #BFBFBF 통일' },
        { type: 'improve', text: '진행률 바 단색(#4B5563) 심플화, 잔여/사업명 색상 제거' },
        { type: 'improve', text: '차트 실적 showEbit 기준 분기 — 매출/EBIT 뷰와 그래프 일치' },
        { type: 'improve', text: '달성률 합계 셀 현재월 기준 표시, 0.01 오차 raw 합산으로 해결' },
        { type: 'improve', text: '누적 달성률 카드 현재월 기준, raw USD 비교로 단위 오차 제거' },
        { type: 'fix',     text: 'EC 모드 롤링 저장: 배열 형태 유지(data-type=ec), 기존 데이터 손실 방지' },
        { type: 'fix',     text: 'KPI 롤링창 구버전 배열 데이터 호환 복구 (EBIT로 간주)' },
        { type: 'fix',     text: '차트 tooltip undefined 제거 (null 월 skip)' },
        { type: 'fix',     text: '붙여넣기 선택적 업데이트 — 매출만/EBIT만/둘다 개별 적용 (null 타입 기존값 유지)' },
        { type: 'fix',     text: 'DRAM Price 크롤러 탭 클릭 방식으로 수정 (3개 탭만 파싱)' },
      ],
    },
    {
      version: 'v55',
      date:    '2026-04-11',
      title:   'KPI목표설정 전면 개편 — 매출+EBIT 이중입력, 표/차트 구조화',
      latest:  false,
      items: [
        { type: 'new',     text: 'KPI롤링 입력: 매출(억원) + EBIT(억원) 두 항목 동시 입력 가능' },
        { type: 'new',     text: '트래킹 표: 매출(계획)/EBIT(계획)/매출(실적)/EBIT(실적) 4행 구조로 개편' },
        { type: 'new',     text: '차트 3개 추가 — EBIT 누적(라인), EBIT 월별(바), 매출 월별(바)' },
        { type: 'new',     text: 'KPI기준(103억) 모드 추가 — 총 3개 기준(67억/103억/EC)' },
        { type: 'improve', text: '단위 전환 버튼: USD(M USD) ↔ 원화(억원), 기준환율 역환산 적용' },
        { type: 'improve', text: '매출이익 → EBIT 전체 용어 통일' },
        { type: 'fix',     text: '롤링 저장 후 loadFromSettings() 덮어씌우는 버그 수정' },
        { type: 'fix',     text: '붙여넣기 파싱 개선 — 한줄 공백구분, 대시(-) 0 처리, EBIT행 자동 입력' },
      ],
    },
    {
      version: 'v54',
      date:    '2026-04-09',
      title:   '대시보드 개선 · KPI탭 표 정비 · DRAM Price 수정 · 탭 이름 변경',
      items: [
        { type: 'fix',     text: 'DRAM Price 탭 데이터 표시 안 되는 버그 수정 (C.cat undefined 필터 오류)' },
        { type: 'fix',     text: 'DRAM Price 크롤러 누적 저장 보호 — 헤더 불일치 시 ws.clear() 제거, 1행만 수정으로 변경' },
        { type: 'improve', text: 'DRAM Price GitHub Actions 스케줄 자동 중지 방지 — 매 실행마다 .last_crawl 커밋' },
        { type: 'improve', text: '대시보드 Active 표 입고일 역순 정렬 (최신 입고일이 위)' },
        { type: 'improve', text: '대시보드 지연 상태 배지 — 진행중(초록) + 지연(빨강) 두 개 표시' },
        { type: 'improve', text: '대시보드 KPI 달성률 카드 — KPI목표설정탭과 동일한 계산값 연동 (원화 단위)' },
        { type: 'improve', text: '대시보드 KPI 목표달성 바 차드 — 사업별 달성률 getBizSummary 기반으로 KPI탭과 통일' },
        { type: 'fix',     text: '대시보드 Completed 표 합계 행 테두리 두께 통일 (border-top: 2px), Pretendard 폰트 적용' },
        { type: 'improve', text: 'KPI 목표설정 차트 y축/tooltip 달러 → 원화(억원) 표시로 변경' },
        { type: 'improve', text: 'KPI 목표설정 사업별 합계 행 달러 → KPI/EC 분기 원화 표시' },
        { type: 'improve', text: 'KPI 목표설정 표 헤더 전부 가운데 정렬, Pretendard 폰트 통일' },
        { type: 'fix',     text: 'KPI 목표설정 헤더 (USD) 중복 제거 — 목표 매출이익 (억원)(USD) → (억원)' },
        { type: 'improve', text: 'KPI 목표설정 금액 열 오른쪽 정렬 (회계 기준)' },
        { type: 'improve', text: '월별 처리량/매출액 탭 이름 변경 (Bi-Weekly → 월별 처리량/매출액)' },
      ],
    },
    {
      version: 'v53',
      date:    '2026-04-05',
      title:   'Pretendard 폰트 · 엑셀 표 스타일 · 셀 너비 최적화',
      items: [
        { type: 'improve', text: 'Pretendard 폰트 전체 적용 (LOT진행현황, 매출현황)' },
        { type: 'improve', text: 'LOT 진행현황 엑셀 기본 표 스타일 적용 — 헤더 #D9D9D9, 테두리 #999, 짝수행 #F2F2F2' },
        { type: 'improve', text: 'LOT 진행현황 헤더 텍스트 가운데 정렬' },
        { type: 'improve', text: 'LOT 진행현황 고객사 열 70px, LOT번호 열 110px으로 축소' },
        { type: 'improve', text: '매출현황 엑셀 기본 표 스타일 적용 — 진행중/지연 볼드만 유지' },
        { type: 'improve', text: '매출현황 진행률 칸 너비 최적화, 오버랩 제거' },
        { type: 'improve', text: '매출현황 매출액 셀 280px → 120px 축소, 청구일 분리 열로 독립' },
        { type: 'improve', text: '매출현황 수정 버튼 표 테두리 안으로 통합 (헤더 "수정" 표시)' },
        { type: 'improve', text: '앱 개발 이력 버전 체계 v51/v52/v53으로 날짜별 관리 시작' },
      ],
    },
    {
      version: 'v52',
      date:    '2026-04-02',
      title:   '보고서 강화 · LOT UI 개선',
      items: [
        { type: 'improve', text: '보고서 전월/기준월 섹션별 좌우 나란히 비교 레이아웃' },
        { type: 'improve', text: '보고서 청구예정 조건 강화 — 진행률 100% AND 완료일 기준월 이하' },
        { type: 'improve', text: '보고서 청구예정 이월 미청구 누적 표시 및 구분 배지' },
        { type: 'improve', text: '보고서 전월 작업진행중 진행률 — 전월 말일 기준 처리량으로 계산' },
        { type: 'improve', text: '보고서 좌우 스크롤 제거 — max-width 해제, 패딩 최소화' },
        { type: 'improve', text: 'LOT 진행현황 입고일·완료예정일·완료일 3열 분리 표시' },
        { type: 'improve', text: 'LOT 진행현황 진행중·지연 행 강조 — 파란/빨간 라인, 배경, 볼드' },
        { type: 'improve', text: 'LOT 진행현황 테이블 가독성 개선 및 입력행 컴팩트화' },
      ],
    },
    {
      version: 'v51',
      date:    '2026-04-02',
      title:   'GitHub 자동배포 · 데이터 변경 로그 전면 완성',
      items: [
        { type: 'new',     text: 'GitHub Actions 자동배포 — main push 시 GitHub Pages 자동 배포' },
        { type: 'new',     text: '데이터 변경 로그 전면 완성 — LOT/일별처리/인보이스 등록·수정·삭제 전체 기록' },
        { type: 'new',     text: '일별처리 로그 상세화 — DRAM N/NB/AB 분류, 누적/잔량 포함' },
        { type: 'fix',     text: '업데이트 현황 데이터 로그 무한로딩 완전 수정' },
        { type: 'fix',     text: 'LOT 삭제 로그 누락 수정 — confirmDelete lot 변수 미선언 버그' },
        { type: 'fix',     text: 'lotRegister/invoice/progress/dailyInput Api.log 전체 누락 추가' },
      ],
    },
    {
      version: 'v0.9',
      date:    '2026-04-02',
      title:   '매출현황 개선 · 보고서 · 업데이트 현황',
      latest:  false,
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
        <button onclick="Pages.Changelog.refresh()" style="padding:4px 12px;border:1px solid #D2D2D7;border-radius:6px;font-size:11px;background:none;color:#6E6E73;cursor:pointer">↻ 새로고침</button>
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
    refresh() {
      _logs = null;  // 캐시 초기화
      Pages.Changelog.render();
    },

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

      const _paint = (loading) => {
        const body = loading
          ? '<div style="padding:40px;text-align:center;color:#C7C7CC;font-size:13px">로그 불러오는 중...</div>'
          : (isDev ? _renderDev() : _renderData(_logs || []));
        el.innerHTML = `
          <div style="max-width:780px">
            <div style="margin-bottom:20px">
              <div style="font-size:15px;font-weight:600;color:#1D1D1F">업데이트 현황</div>
              <div style="font-size:12px;color:#86868B;margin-top:2px">Test Ops Monitor</div>
            </div>
            <div style="display:flex;border-bottom:1px solid #D2D2D7;margin-bottom:24px">
              <button onclick="Pages.Changelog.switchTab('data')" style="${_tabStyle(isData)}">데이터 변경 로그</button>
              <button onclick="Pages.Changelog.switchTab('dev')"  style="${_tabStyle(isDev)}">앱 개발 이력</button>
            </div>
            ${body}
          </div>`;
      };

      if (isData && _logs === null && !_logsLoading) {
        _logsLoading = true;
        _paint(true);
        try {
          _logs = await Api.getLogs();
        } catch(e) {
          _logs = [];
          console.warn('[Changelog] 로그 로드 실패:', e);
        }
        _logsLoading = false;
      }

      if (_logsLoading) return;

      _paint(false);
    },
  };

})();
