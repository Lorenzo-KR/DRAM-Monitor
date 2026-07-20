/**
 * config.js
 * 앱 전역 상수 — URL, 색상, 레이블 등
 * 값을 바꿀 때 이 파일 하나만 수정하면 됩니다.
 */

const CONFIG = {
  // Google Apps Script 배포 URL
  API_URL: 'https://script.google.com/macros/s/AKfycbyoyZClwnBKsDYC9Wdoq22ko6bERKY_dRfDIoRPpPm8I2UWwYTur9O_B49gAFmZJ_2O/exec',

  // 로그인 비밀번호는 Apps Script 서버에서만 관리됩니다.
  // 코드에 비밀번호를 저장하지 않습니다.

  // Session storage key
  AUTH_KEY: 'tom_auth',

  // Google Sheets 시트 이름
  SHEETS: {
    CUSTOMERS: 'customers',
    LOTS:      'lots',
    DAILY:     'daily',
    MOS:       'mos',
    INVOICES:  'invoices',
    SHIPMENTS: 'shipments',
    TARGETS:   'targets',
  },

  // 사업 목록
  BIZ_LIST: ['DRAM', 'SSD', 'MID', 'SCR', 'RMA', 'SUS', 'MOD'],

  // 사업 표시명
  BIZ_LABELS: {
    DRAM: 'DRAM Test',
    SSD:  'SSD Test',
    MID:  'Mobile Ink Die',
    SCR:  'Scrap 자재',
    RMA:  'RMA 운영',
    SUS:  'Sustainability',
    MOD:  '모듈 세일즈',
  },

  // 사업 색상
  BIZ_COLORS: {
    DRAM: '#1B4F8A',
    SSD:  '#0F6E56',
    MID:  '#6A3D7C',
    SCR:  '#B45309',
    RMA:  '#0C6B8A',
    SUS:  '#2D7D46',
    MOD:  '#8B3A3A',
  },

  // 국가(판매 법인) 목록
  COUNTRY_LIST: ['HK', 'SG', 'KR', 'JP'],

  // 국가 표시명
  COUNTRY_LABELS: {
    HK: '홍콩',
    SG: '싱가포르',
    KR: '한국',
    JP: '일본TES',
  },

  // 국가 색상
  COUNTRY_COLORS: {
    HK: '#B45309',
    SG: '#0F6E56',
    KR: '#1B4F8A',
    JP: '#6A3D7C',
  },

  // 국가별 취급 사업
  COUNTRY_BIZ_MAP: {
    HK: ['DRAM', 'SCR', 'RMA', 'SUS', 'MOD'],
    SG: ['DRAM', 'SSD', 'MID', 'SCR', 'RMA', 'SUS', 'MOD'],
    KR: ['MOD'],
    JP: ['MOD'],
  },

  // KPI 차트 시작 연도
  CHART_START_YEAR: 2026,

  // DRAM Price Tracking Google Sheet ID
  DRAM_PRICE_SHEET_ID: '1B46Hj-5u0ikoGBm56PBvq8BIJhi5zDgsSlPE-tDM0BA',

  // LOT 기본 목표 완료일 (입고일 + N일)
  LOT_DEFAULT_TARGET_DAYS: 14,
};

/**
 * 해당 사업을 취급하는 판매 법인 목록.
 * biz가 비어 있으면(전체) 모든 법인을 반환합니다.
 * 예) countriesForBiz('DRAM') → ['HK','SG']  (한국·일본TES는 MOD 전용)
 */
function countriesForBiz(biz) {
  if (!biz) return CONFIG.COUNTRY_LIST;
  return CONFIG.COUNTRY_LIST.filter(c => (CONFIG.COUNTRY_BIZ_MAP[c] || []).includes(biz));
}
