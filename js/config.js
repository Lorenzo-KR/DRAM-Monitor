/**
 * config.js
 * 앱 전역 상수 — URL, 색상, 레이블 등
 * 값을 바꿀 때 이 파일 하나만 수정하면 됩니다.
 */

const CONFIG = {
  // Google Apps Script 배포 URL
  API_URL: 'https://script.google.com/macros/s/AKfycbyJ-Sld6avN2T45XpshCUFa3KRQ9i8QWlFXJ1VnZjZawtcoN7eeP2tq6oYnMCkU-yB1/exec',

  // 로그인 비밀번호는 Apps Script 서버에서만 관리됩니다.
  // 코드에 비밀번호를 저장하지 않습니다.

  // Session storage key
  AUTH_KEY: 'tom_auth',

  // Google Sheets 시트 이름
  SHEETS: {
    CUSTOMERS: 'customers',
    LOTS:      'lots',
    DAILY:     'daily',
    INVOICES:  'invoices',
    SHIPMENTS: 'shipments',
    TARGETS:   'targets',
  },

  // 사업 목록
  BIZ_LIST: ['DRAM', 'SSD', 'MID'],

  // 사업 표시명
  BIZ_LABELS: {
    DRAM: 'DRAM Test',
    SSD:  'SSD Test',
    MID:  'Mobile Ink Die',
  },

  // 사업 색상
  BIZ_COLORS: {
    DRAM: '#1B4F8A',
    SSD:  '#0F6E56',
    MID:  '#6A3D7C',
  },

  // 국가 목록
  COUNTRY_LIST: ['HK', 'SG'],

  // 국가 표시명
  COUNTRY_LABELS: {
    HK: '홍콩',
    SG: '싱가포르',
  },

  // 국가 색상
  COUNTRY_COLORS: {
    HK: '#B45309',
    SG: '#0F6E56',
  },

  // 국가별 취급 사업
  COUNTRY_BIZ_MAP: {
    HK: ['DRAM'],
    SG: ['DRAM', 'SSD', 'MID'],
  },

  // KPI 차트 시작 연도
  CHART_START_YEAR: 2026,

  // LOT 기본 목표 완료일 (입고일 + N일)
  LOT_DEFAULT_TARGET_DAYS: 14,
};
