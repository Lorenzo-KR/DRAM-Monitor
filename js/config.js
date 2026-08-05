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
  BIZ_LIST: ['DRAM', 'SSD', 'MID', 'SCR', 'RMA', 'SUS'],

  // 사업 표시명
  BIZ_LABELS: {
    DRAM: 'DRAM Test',
    SSD:  'SSD Test',
    MID:  'Mobile Ink Die',
    SCR:  'Scrap 자재',
    RMA:  'RMA 운영',
    SUS:  'Sustainability',
  },

  // 사업 색상
  BIZ_COLORS: {
    DRAM: '#1B4F8A',
    SSD:  '#0F6E56',
    MID:  '#6A3D7C',
    SCR:  '#B45309',
    RMA:  '#0C6B8A',
    SUS:  '#2D7D46',
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

  // 사업별 물량 단위 — 여기에 없는 사업은 DEFAULT_UNIT('개')
  // 단위가 다른 사업은 합계에서 섞이지 않도록 단위별로 나눠 집계됩니다.
  BIZ_UNITS: {
    SCR: '톤',
  },
  DEFAULT_UNIT: '개',

  // 국가별 취급 사업
  COUNTRY_BIZ_MAP: {
    HK: ['DRAM', 'SCR', 'RMA', 'SUS'],
    SG: ['DRAM', 'SSD', 'MID', 'SCR', 'RMA', 'SUS'],
    KR: ['SCR'],
    JP: [],                       // 모듈 세일즈 폐지로 현재 취급 사업 없음
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
 * 예) countriesForBiz('DRAM') → ['HK','SG']  (한국은 SCR만 취급)
 */
/** 사업의 물량 단위 (예: SCR → '톤', 그 외 → '개') */
function bizUnit(biz) {
  return CONFIG.BIZ_UNITS[biz] || CONFIG.DEFAULT_UNIT;
}

function countriesForBiz(biz) {
  if (!biz) return CONFIG.COUNTRY_LIST;
  return CONFIG.COUNTRY_LIST.filter(c => (CONFIG.COUNTRY_BIZ_MAP[c] || []).includes(biz));
}

/**
 * 해당 법인이 취급하는 사업 목록 (countriesForBiz의 반대 방향).
 * co가 비어 있으면 모든 사업을 반환합니다.
 */
function bizesForCountry(co) {
  if (!co) return CONFIG.BIZ_LIST;
  const allowed = CONFIG.COUNTRY_BIZ_MAP[co] || [];
  return CONFIG.BIZ_LIST.filter(b => allowed.includes(b));
}
