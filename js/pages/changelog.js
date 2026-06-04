/**
 * pages/changelog.js
 * 업데이트 현황 — 앱 개발 이력 + 데이터 변경 로그
 */

Pages.Changelog = (() => {

  let _tab    = 'data';  // 'dev' | 'data'
  let _filter = '';      // '' | 'LOT' | '인보이스' | '일별처리'
  let _logs   = null;    // 캐시 (null=미로드, []이상=로드됨)
  let _logsLoading = false;
  let _page = 1;         // 데이터 로그 현재 페이지 (1-base)
  const PAGE_SIZE = 30;

  // ── 앱 개발 이력 데이터 ────────────────────────────────────
  const VERSIONS = [
    {
      version: 'v85',
      date:    '2026-05-28 ~ 2026-05-29',
      title:   'LOT 간트차트 · 대시보드 KPI 표시 정리 · DRAM Price 차트 x축',
      latest:  true,
      items: [
        { type: 'new',     text: 'LOT 진행현황 — 간트차트 보기 모드 추가' },
        { type: 'improve', text: 'DRAM Price 차트 x축 날짜 표기 Apr.1 형식으로 변경' },
        { type: 'fix',     text: "대시보드 KPI 달성률 — '매출 / 103억' 부가 표시 제거" },
      ],
    },
    {
      version: 'v84',
      date:    '2026-05-27',
      title:   '인증 다중 토큰 · 대시보드 KPI 달성률(매출 목표) 카드',
      items: [
        { type: 'new',     text: '인증 — 다중 토큰 + localStorage로 빈번한 재로그인 해소' },
        { type: 'new',     text: '대시보드 KPI 달성률 — KPI103 매출 목표 + 억원 + 프로그레스바' },
      ],
    },
    {
      version: 'v83',
      date:    '2026-05-26',
      title:   '대시보드 SSD 세부 입력 · 사업장 단위 휴무 관리 · 비교 윈도우 슬라이더',
      items: [
        { type: 'new',     text: '대시보드 — 일별 처리 현황 비교 윈도우(7~30일) 슬라이더 실시간 조절' },
        { type: 'new',     text: '대시보드 — SSD 세부 입력(N/NB/AB) + 휴무 체크 누락 제외' },
        { type: 'improve', text: '대시보드 — LOT 셀에서도 사업장 휴무 지정 가능' },
        { type: 'improve', text: '휴무를 LOT 단위 → 사업장(HK/SG) 단위로 전환' },
      ],
    },
    {
      version: 'v82',
      date:    '2026-05-25',
      title:   '월별 처리량/매출액 — 사업별 표 분리 · 단위 정비',
      items: [
        { type: 'improve', text: '월별 처리량/매출액 — 표 2개 분리(Test 사업/기타 사업), 토글 제거' },
        { type: 'improve', text: '월별 처리량/매출액 — 이번달/지난달 현황 카드 제거' },
        { type: 'improve', text: "월별 표 — 수량 옆에 '개' 단위 표시 (처리량·미청구)" },
        { type: 'improve', text: '월별 처리량/매출액 — 기본 사업 선택을 DRAM/SSD/MID로 변경' },
        { type: 'fix',     text: '월별 표 — 평균단가 폰트 크기 명시 (매출액과 동일 10.5px)' },
      ],
    },
    {
      version: 'v81',
      date:    '2026-05-23',
      title:   '월별 처리량/매출액 피벗 · 대시보드 LOT 우측 팝업',
      items: [
        { type: 'new',     text: '대시보드 LOT 클릭 → 우측 오버레이 팝업으로 상세 표시' },
        { type: 'new',     text: '월별 처리량/매출액 표 — 미청구 수량(빨강) + 평균단가($/ea) 표시' },
        { type: 'new',     text: '월별 처리량/매출액 — 두 표를 한 표로 합치고 셀당 2줄 표시' },
        { type: 'new',     text: '월별 처리량/매출액 — 표 피벗(월=행, 사업=열) + 사업 선택 토글' },
        { type: 'improve', text: '월별 처리량/매출액 표 — 셀 패딩 축소로 촘촘한 레이아웃' },
        { type: 'fix',     text: '대시보드 LOT 상세 팝업 — 어두운 배경 클릭 시 닫히지 않던 버그' },
        { type: 'fix',     text: '대시보드 일별처리현황 — 토/일 포함 (캘린더 14일)' },
        { type: 'fix',     text: '대시보드 일별 처리현황 — LOT 정렬을 입고일 내림차순으로 단순화' },
      ],
    },
    {
      version: 'v80',
      date:    '2026-05-22',
      title:   'KPI목표설정 단위 토글 상단 이동 · 엑셀 수식화 · 매출현황 엑셀 복구',
      items: [
        { type: 'new',     text: 'KPI목표설정 — 단위/지표 토글 상단 이동, 페이지 전체 단위 통일' },
        { type: 'new',     text: 'KPI목표설정 엑셀 다운로드 — 파생값을 엑셀 수식으로 출력' },
        { type: 'new',     text: 'KPI목표설정 요약 카드 — 표 보기 토글(EBIT/매출) 연동' },
        { type: 'new',     text: 'KPI목표설정 연간 목표 카드 — 매출/EBIT 기준 표시' },
        { type: 'improve', text: "KPI목표설정 ③ 표 — '목표대비 차이' → '달성률 Gap(실적-계획)'" },
        { type: 'improve', text: 'KPI목표설정 엑셀 — 0값 표시를 긴 대시(—) → 짧은 하이픈(-)' },
        { type: 'fix',     text: 'KPI목표설정 연간 목표 카드 — 단위 변환 누락 수정' },
        { type: 'fix',     text: '매출 현황 엑셀 다운로드 작동 안 함 — exportExcel 미노출 수정' },
        { type: 'fix',     text: '대시보드 빠른 입력 — SSD 등 비DRAM은 Normal/NoBoot/Abnormal 제거' },
      ],
    },
    {
      version: 'v79',
      date:    '2026-05-20',
      title:   '대시보드 일별 처리현황 시각화 강화 · LOT 출고 프로세스 추가',
      items: [
        { type: 'new',     text: 'LOT 진행현황에 출고 프로세스 추가 — 출고준비 / 출고완료 단계' },
        { type: 'new',     text: '대시보드 일별 처리현황 — 모든 영업일 날짜(M/D)·요일 표시' },
        { type: 'new',     text: '대시보드 일별 처리현황 — 날짜 라벨 아래 요일 표시' },
        { type: 'improve', text: '대시보드 일별 처리현황 — 진행률을 그래프 옆에 크게 표시' },
        { type: 'improve', text: '대시보드 일별 처리현황 — 날짜·요일 폰트를 LOT 번호와 동일하게(12px)' },
      ],
    },
    {
      version: 'v78',
      date:    '2026-05-18',
      title:   '대시보드 대규모 개편 — Job Orders · 주간 보고 · 일별 처리 follow-up · 빠른 입력',
      items: [
        { type: 'new',     text: '대시보드 — Job Orders 국가별 진행중 / 주간 보고 / KPI 103억 ahead-behind' },
        { type: 'new',     text: '대시보드 주간 보고 — 2주 사이클 카드 (운영 + 수금 분리)' },
        { type: 'new',     text: '대시보드 주간 보고 — 페이지 폭 맞춤 + 지난달 표 추가' },
        { type: 'new',     text: '주간 보고 — 주단위(4주) 입고·인보이스 + 일별 처리 셀 통일' },
        { type: 'new',     text: '대시보드 — 일별 처리 follow-up (지역별, LOT별 mini bar 차트)' },
        { type: 'new',     text: '일별 처리 follow-up — 빈 칸 클릭으로 빠른 입력 모달' },
        { type: 'new',     text: '대시보드 빠른 입력 — Normal / NoBoot / Abnormal 3분류 입력' },
        { type: 'new',     text: 'KPI 목표 표③ — 실제 실적 표시 + 우측 컬럼 재정렬' },
        { type: 'improve', text: '대시보드 주간 보고 — 주차(세로) × 사업(가로) 전치' },
        { type: 'improve', text: '대시보드 — Active Orders 카드 제거 (Job Orders와 중복)' },
        { type: 'improve', text: '대시보드 — Revenue by business/region, KPI 목표 달성 카드 행 제거' },
        { type: 'improve', text: '대시보드 — Completed job orders 테이블 숨김' },
        { type: 'improve', text: '대시보드 — 완료 LOT(미수금 포함) Active 테이블에서 제외' },
        { type: 'fix',     text: "일별 처리 follow-up — 누락 기준 '직전 영업일' + 호버 툴팁" },
        { type: 'fix',     text: '일별 처리 누락 셀이 작게 표시되는 flexbox 사이징 버그' },
        { type: 'fix',     text: '대시보드 화면 안보임 — clickJs 중복 style 속성 제거' },
      ],
    },
    {
      version: 'v77',
      date:    '2026-05-17',
      title:   'LOT 진행현황 요약 카드 · 월별 차트 통합',
      items: [
        { type: 'new',     text: 'LOT 진행현황 — 싱가포르/홍콩 진행 중 작업 요약 카드 최상단 추가' },
        { type: 'new',     text: 'LOT 월별 차트 — 입고량/처리량 동시 표시 기본 활성화' },
        { type: 'improve', text: 'LOT 진행현황 월별 차트 — 필터 1줄 통합 + 요약 카드 표 그리드화' },
      ],
    },
    {
      version: 'v76',
      date:    '2026-05-14',
      title:   '사업별 히스토리 페이지 신설',
      items: [
        { type: 'new',     text: '사업별 히스토리 페이지 추가 — 세로 타임라인 + KPI/처리량/매출 요약' },
        { type: 'new',     text: '사업별 히스토리 — KPI 103억 기준 + 월마감 요약 + executive 레이아웃' },
        { type: 'new',     text: '사업별 히스토리 KPI 카드에 계획대비 페이스 차이 표시' },
      ],
    },
    {
      version: 'v75',
      date:    '2026-05-11 ~ 2026-05-12',
      title:   'KPI 매출 실적표 ③ 진척률 표 + 엑셀 다운로드 보강',
      items: [
        { type: 'new',     text: 'KPI 매출 실적표 하단에 사업별 월 진척률 표(③) 추가' },
        { type: 'new',     text: 'KPI 표③ 계획대비 컬럼 추가 — 신호등(±2%p) + 페이스 차이(%p)' },
        { type: 'new',     text: '엑셀 다운로드에 ③ 진척률 표 추가 + 색상 정비 (녹색 제거)' },
        { type: 'improve', text: 'KPI 표③ 헤더명 변경 — 누적진척률 / 누적·연간목표금액(단위 표기)' },
        { type: 'improve', text: '계획대비 색상 단순화 — 양수=빨강, 음수=파랑 텍스트 색만 (HTML+엑셀)' },
        { type: 'improve', text: 'KPI 엑셀 파일명에 다운로드 시각 추가 (YYYYMMDD_HHMM)' },
        { type: 'fix',     text: '엑셀 연간 달성률 값이 HTML과 다른 문제 — raw % 표시로 변경' },
        { type: 'fix',     text: '인보이스 청구 완료 LOT 셀 줄바꿈 — 옆 사업 칸 침범 방지' },
      ],
    },
    {
      version: 'v74',
      date:    '2026-05-06 ~ 2026-05-08',
      title:   '대시보드 Active/Upcoming 2줄 · LOT 월별 차트 다중선택 · 국가별 탭 제거',
      items: [
        { type: 'new',     text: '대시보드 Active & Upcoming 표 목표완료/실완료일 2줄 표시' },
        { type: 'new',     text: 'LOT 진행현황 월별 차트 입고/처리/잔량 토글 + 국가 분리' },
        { type: 'new',     text: 'LOT 진행현황 차트 다중선택 + 단일 차트 + 국가 선택' },
        { type: 'improve', text: 'LOT 차트 입고/처리 시각 구분 — 같은 BIZ 색 유지하며 채우기 패턴 차이로 구분' },
        { type: 'improve', text: 'LOT 차트 입고=솔리드, 처리=빗살무늬로 스왑' },
        { type: 'improve', text: 'LOT 진행현황 차트 기본값 변경 — 홍콩/입고량/DRAM' },
        { type: 'improve', text: '국가별 현황 탭 제거' },
        { type: 'fix',     text: 'LOT/일별처리 저장 동기화 및 진행중 수량 기준 수정' },
      ],
    },
    {
      version: 'v73',
      date:    '2026-04-28',
      title:   '매출현황 사업 필터 토글 해제 버그 수정',
      items: [
        { type: 'fix', text: '매출현황탭 사업 필터 버튼(SCR/RMA/SUS/MOD) 토글 해제 안 되던 문제 수정' },
      ],
    },
    {
      version: 'v72',
      date:    '2026-04-15 ~ 2026-04-16',
      title:   'KPI탭 폭·폰트 통일 · 엑셀 다운로드 강화 · DRAM Price 탭 개편',
      items: [
        { type: 'new',     text: 'KPI 계획표/실적표 엑셀 다운로드 버튼 추가 (v76)' },
        { type: 'new',     text: '엑셀 다운로드 셀 스타일 적용 — xlsx-js-style (v77)' },
        { type: 'new',     text: '엑셀 다운로드 3시트(M USD/억원/M SGD) 구조로 개편, 각 시트에 매출+EBIT 섹션 포함 (v82)' },
        { type: 'new',     text: 'DRAM Price 탭 버튼으로 카테고리 전환' },
        { type: 'improve', text: 'KPI탭 전체 약 20% 확대 — 폰트·컬럼·카드·차트 (v78)' },
        { type: 'improve', text: 'KPI탭 max-width 제거·폰트 전체 통일 13–14px (v80)' },
        { type: 'improve', text: 'KPI탭 표 컬럼·패딩 최적화 — 1280px 스크롤 제거 (v79)' },
        { type: 'improve', text: '대시보드·KPI탭 max-width 1200px 통일, 좌우 여백 36px' },
        { type: 'fix',     text: 'DRAM Price 크롤러/프론트 시트별 컬럼 구조 분리' },
        { type: 'fix',     text: 'KPI탭 page-wrap 너비 1200→1440px (20% 확장) / max-width 1440px 복원' },
        { type: 'fix',     text: 'KPI탭 패딩 축소 nav.js에서 처리 — report 탭과 동일 방식' },
      ],
    },
    {
      version: 'v71',
      date:    '2026-04-15',
      title:   '매출·EBIT 월 누적 달성률 행 추가 · SGD 단위 정확도 개선',
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

  // ── 페이지네이션 UI ─────────────────────────────────────────
  function _pager(page, totalPages, total) {
    if (totalPages <= 1) {
      return `<div style="display:flex;align-items:center;justify-content:flex-end;margin-top:12px">
        <span style="font-size:11px;color:#86868B">총 ${total}건</span>
      </div>`;
    }

    const btn = (label, target, disabled, active) => {
      if (disabled) {
        return `<span style="padding:4px 9px;border:1px solid #E8E8ED;border-radius:6px;font-size:11px;color:#C7C7CC;background:#FAFAFA;cursor:not-allowed">${label}</span>`;
      }
      const style = active
        ? 'padding:4px 9px;border:1px solid #1D1D1F;border-radius:6px;font-size:11px;color:#fff;background:#1D1D1F;cursor:pointer;font-weight:600'
        : 'padding:4px 9px;border:1px solid #D2D2D7;border-radius:6px;font-size:11px;color:#3A3A3C;background:#fff;cursor:pointer';
      return `<button onclick="Pages.Changelog.setPage(${target})" style="${style}">${label}</button>`;
    };

    // 페이지 번호: 현재 ±2 윈도우 + 처음/끝 + 줄임표
    const pageNums = [];
    const push = (n) => { if (!pageNums.includes(n)) pageNums.push(n); };
    push(1);
    for (let n = Math.max(2, page - 2); n <= Math.min(totalPages - 1, page + 2); n++) push(n);
    if (totalPages > 1) push(totalPages);
    pageNums.sort((a,b) => a - b);

    const numHtml = [];
    let prev = 0;
    for (const n of pageNums) {
      if (n - prev > 1) {
        numHtml.push(`<span style="padding:0 4px;color:#C7C7CC;font-size:11px">…</span>`);
      }
      numHtml.push(btn(String(n), n, false, n === page));
      prev = n;
    }

    return `
      <div style="display:flex;align-items:center;gap:6px;justify-content:center;margin-top:14px;flex-wrap:wrap">
        ${btn('‹ 이전', page - 1, page <= 1, false)}
        ${numHtml.join('')}
        ${btn('다음 ›', page + 1, page >= totalPages, false)}
        <span style="margin-left:10px;font-size:11px;color:#86868B">총 ${total}건 · ${page}/${totalPages}쪽</span>
      </div>`;
  }

  // ── 데이터 로그 패널 ────────────────────────────────────────
  function _renderData(logs) {
    const filtered = _filter
      ? logs.filter(l => l.category === _filter)
      : logs;

    // 최신순 정렬
    const sorted = [...filtered].sort((a,b) => String(b.ts||'').localeCompare(String(a.ts||'')));

    const total       = sorted.length;
    const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (_page > totalPages) _page = totalPages;
    if (_page < 1) _page = 1;
    const startIdx    = (_page - 1) * PAGE_SIZE;
    const pageRows    = sorted.slice(startIdx, startIdx + PAGE_SIZE);

    const CATS = ['LOT','인보이스','일별처리'];
    const filterBtns = ['전체', ...CATS].map(cat => {
      const active = cat === '전체' ? _filter === '' : _filter === cat;
      const style = active
        ? 'padding:4px 14px;border-radius:20px;font-size:12px;border:1.5px solid #1D1D1F;background:#1D1D1F;color:#fff;cursor:pointer'
        : 'padding:4px 14px;border-radius:20px;font-size:12px;border:1.5px solid #D2D2D7;background:none;color:#6E6E73;cursor:pointer';
      const val = cat === '전체' ? '' : cat;
      return `<button onclick="Pages.Changelog.setFilter('${val}')" style="${style}">${cat}</button>`;
    }).join('');

    if (pageRows.length === 0) {
      return `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">${filterBtns}</div>
        <div style="padding:40px;text-align:center;color:#C7C7CC;font-size:13px">로그 데이터 없음</div>`;
    }

    const rows = pageRows.map((log, i) => {
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
      </div>
      ${_pager(_page, totalPages, total)}`;
  }

  // ── Public ─────────────────────────────────────────────────
  return {
    refresh() {
      _logs = null;  // 캐시 초기화
      _page = 1;
      Pages.Changelog.render();
    },

    setFilter(f) {
      _filter = f;
      _page = 1;  // 필터 바뀌면 1쪽으로
      Pages.Changelog.render();
    },

    setPage(p) {
      _page = Math.max(1, p|0);
      Pages.Changelog.render();
      // 페이지 상단으로 스크롤
      const el = document.getElementById('changelog-root');
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
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
