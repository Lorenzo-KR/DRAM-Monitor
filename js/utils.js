/**
 * utils.js
 * 순수 유틸리티 함수 — 사이드이펙트 없음, 테스트 가능
 *
 * 섹션:
 *   1. 숫자 파싱 & 포맷
 *   2. 날짜
 *   3. LOT 계산
 *   4. HTML 조각 생성 (badge, tag)
 *   5. 문자열 이스케이프
 */

// ─────────────────────────────────────────────────────────────
// 1. 숫자 파싱 & 포맷
// ─────────────────────────────────────────────────────────────

/**
 * 값을 숫자로 변환. null/빈문자열/날짜 문자열은 0 반환.
 * Google Sheets가 날짜 서식으로 반환하는 "2026-02-16" 형식 방어 처리 포함.
 */
function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) return 0;
  const cleaned = String(value).replace(/,/g, '').replace(/\s/g, '').trim();
  return Number(cleaned) || 0;
}

/** 숫자를 천 단위 콤마 표기로 */
function formatNumber(value) {
  return Number(value).toLocaleString();
}

/** 숫자를 약식(1.2M, 34.5K)으로 — 대시보드 KPI 카드용 */
function formatNumberShort(value) {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
  if (value >= 1_000)     return (value / 1_000).toFixed(1) + 'K';
  return value.toLocaleString();
}

/** 배열에서 특정 필드 합계 */
function sumField(array, field) {
  return array.reduce((total, row) => total + parseNumber(row[field]), 0);
}

// ─────────────────────────────────────────────────────────────
// 2. 날짜
// ─────────────────────────────────────────────────────────────

/** 오늘 날짜를 YYYY-MM-DD로 */
function today() {
  return new Date().toISOString().split('T')[0];
}

/** 이번 달을 YYYY-MM로 */
function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * 날짜에 N일 더하기
 * @param {string} dateStr - YYYY-MM-DD
 * @param {number} days
 * @returns {string} YYYY-MM-DD
 */
function addDays(dateStr, days) {
  // new Date("YYYY-MM-DD") 는 UTC 00:00 으로 파싱 → 한국에서 toISOString() 하면 하루 밀림
  // 로컬 타임존 안전하게 처리
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const dd   = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 두 날짜 사이의 일수 차이 (b - a)
 * @param {string} a - YYYY-MM-DD (시작)
 * @param {string} b - YYYY-MM-DD (끝)
 * @returns {number}
 */
function diffDays(a, b) {
  return Math.ceil((new Date(b) - new Date(a)) / (1000 * 86400));
}

/**
 * ISO 문자열 또는 Date-like 값에서 YYYY-MM-DD만 추출
 * ※ "2026-03-23T00:00:00.000Z" → UTC 기준 split → "2026-03-22" 오류 방지:
 *    Date 객체나 ISO Z문자열이 들어왔을 때 로컬 타임존 기준으로 보정
 */
function normalizeDate(value) {
  if (!value && value !== 0) return '';
  const s = String(value).trim();
  if (!s) return '';

  // 이미 YYYY-MM-DD 형태면 그대로 반환 (가장 흔한 케이스)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // ISO 문자열 (T 포함) — 로컬 타임존 기준 날짜 추출
  // "2026-03-22T15:00:00.000Z" → 한국(UTC+9)에서는 2026-03-23
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d)) {
      return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    }
    return s.slice(0, 10);
  }

  // "2026/03/23" 슬래시 형태
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, '-');

  // "Sat Mar 22 2026 ..." 등 Date.toString() 형태 — Date 생성 후 로컬 기준 추출
  // 숫자로만 된 타임스탬프(ms)도 처리
  if (/^[A-Z]/.test(s) || /^\d{10,}$/.test(s)) {
    const d = new Date(isNaN(s) ? s : Number(s));
    if (!isNaN(d)) {
      return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    }
  }

  // 그 외: T 앞부분만 (혹시라도 잘라낼 수 있는 경우)
  const cut = s.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(cut)) return cut;
  return '';
}

// ─────────────────────────────────────────────────────────────
// 3. LOT 계산
// ─────────────────────────────────────────────────────────────

/**
 * LOT 상태 반환
 * @param {Object} lot
 * @returns {'done'|'overdue'|'inprog'}
 */
function getLotStatus(lot) {
  if (lot.done === '1' || lot.done === 1) return 'done';
  if (lot.targetDate && lot.targetDate < today()) return 'overdue';
  return 'inprog';
}

/**
 * LOT의 누적 처리량 (dailies 기준)
 * @param {string|number} lotId
 * @param {Array} dailies
 * @returns {number}
 */
function getLotCumulative(lotId, dailies) {
  return dailies
    .filter(d => String(d.lotId) === String(lotId))
    .reduce((total, d) => total + parseNumber(d.proc), 0);
}

/**
 * LOT의 잔량
 * @param {Object} lot
 * @param {Array} dailies
 * @returns {number}
 */
function getLotRemaining(lot, dailies) {
  return Math.max(0, parseNumber(lot.qty) - getLotCumulative(lot.id, dailies));
}

/**
 * LOT 진행률 (0~100%)
 * @param {Object} lot
 * @param {Array} dailies
 * @returns {number}
 */
function getLotProgress(lot, dailies) {
  const cumulative = getLotCumulative(lot.id, dailies);
  const qty = parseNumber(lot.qty);
  return qty > 0 ? Math.min(100, Math.round(cumulative / qty * 100)) : 0;
}

// ─────────────────────────────────────────────────────────────
// 4. HTML 조각 생성 (badge, tag)
// ─────────────────────────────────────────────────────────────

/**
 * LOT 상태 배지 HTML
 * @param {'done'|'overdue'|'inprog'} status
 * @returns {string}
 */
function renderStatusBadge(status) {
  const map = {
    done:    '<span class="bdg b-done">완료</span>',
    overdue: '<span class="bdg b-over">지연</span>',
    inprog:  '<span class="bdg b-inprog">진행중</span>',
  };
  return map[status] || '';
}

/**
 * 인보이스 상태 배지 HTML
 * @param {Object} invoice
 * @returns {string}
 */
function renderInvoiceStatusBadge(invoice) {
  if (invoice.status === 'paid')    return '<span class="bdg b-ok">수금완료</span>';
  if (invoice.status === 'partial') return '<span class="bdg b-warn">부분수금</span>';
  return '<span class="bdg b-warn">미수금</span>';
}

/**
 * D-Day 배지 HTML
 * @param {string} dueDate - YYYY-MM-DD
 * @returns {string}
 */
function renderDDayBadge(dueDate) {
  if (!dueDate) return '';
  const days = Math.ceil((new Date(dueDate) - new Date(today())) / (1000 * 86400));
  if (days < 0)  return `<span class="bdg b-bad">D+${Math.abs(days)}</span>`;
  if (days === 0) return `<span class="bdg b-warn">D-Day</span>`;
  if (days <= 7)  return `<span class="bdg b-warn">D-${days}</span>`;
  return `<span style="font-size:12px;color:var(--tx3)">D-${days}</span>`;
}

/**
 * 사업 태그 HTML (tag-dram, tag-ssd, tag-mid)
 * @param {string} biz - 'DRAM'|'SSD'|'MID'
 * @returns {string}
 */
function renderBizTag(biz) {
  const label = CONFIG.BIZ_LABELS[biz] || biz;
  return `<span class="tag-${biz.toLowerCase()}">${label}</span>`;
}

/**
 * 국가 태그 HTML (tag-hk, tag-sg)
 * @param {string} country - 'HK'|'SG'
 * @returns {string}
 */
function renderCountryTag(country) {
  const label = CONFIG.COUNTRY_LABELS[country] || country;
  return `<span class="tag-${country.toLowerCase()}">${label}</span>`;
}

/**
 * KPI 메트릭 카드 HTML
 * @param {string} label
 * @param {string} value
 * @param {string} [sub]
 * @param {string} [color]
 * @returns {string}
 */
function renderMetricCard(label, value, sub = '', color = '') {
  const colorStyle = color ? `style="color:${color}"` : '';
  return `
    <div class="mc">
      <div class="mc-l">${label}</div>
      <div class="mc-v" ${colorStyle}>${value}</div>
      <div class="mc-s">${sub || '&nbsp;'}</div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// 5. 문자열 이스케이프
// ─────────────────────────────────────────────────────────────

/**
 * 엑셀 파일 내보내기 (XLSX 라이브러리 필요)
 * @param {Array<Object>} data
 * @param {string} filename
 * @param {string} sheetName
 */
function _xlsxExport(data, filename, sheetName) {
  if (!data.length) { UI.toast('데이터 없음', true); return; }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
  UI.toast('다운로드 완료');
}

/**
 * HTML 속성값 안전 이스케이프 (value="" 안에 쓸 때)
 * @param {*} value
 * @returns {string}
 */
function escapeAttr(value) {
  return String(value || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────────────────────
// 6. 인라인 편집 테이블 셀 헬퍼
// ─────────────────────────────────────────────────────────────

/**
 * 편집 가능한 input <td> 생성
 */
function makeEditableCell(value, className, onBlurHandler, extraAttrs = '') {
  return `<td><input class="ec ${className || ''}" value="${escapeAttr(value)}" onblur="${onBlurHandler}" ${extraAttrs}></td>`;
}

/**
 * 편집 가능한 select <td> 생성
 * @param {string} value - 현재 선택값
 * @param {Array<[string, string]>} options - [[value, label], ...]
 */
function makeEditableSelect(value, options, className, onChangeHandler) {
  const optionsHtml = options
    .map(([v, label]) => `<option value="${v}"${v === value ? ' selected' : ''}>${label}</option>`)
    .join('');
  return `<td><select class="ec ${className || ''}" onchange="${onChangeHandler}">${optionsHtml}</select></td>`;
}
