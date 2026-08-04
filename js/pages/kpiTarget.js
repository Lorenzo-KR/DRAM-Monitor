/**
 * pages/kpiTarget.js
 * KPI 목표 설정 — 롤링 데이터 기반
 * 모드: 'kpi7' | 'kpi67' | 'kpi103' | 'ec'
 *
 * kpi7 = 2026-07 Revision 기준(KPI-7월, 기본값).
 *   이 기준만 이익 지표가 EBIT 대신 Material Profit이며,
 *   Factor(배율) 대신 사업×월별 Material Cost(USD)를 입력해
 *   Material Profit 실적 = 매출 실적 − Material Cost 로 계산합니다.
 */

Pages.KpiTarget = (() => {

  let _year        = new Date().getFullYear();
  let _bizSet      = new Set(['all']);
  let _rollingYear = new Date().getFullYear();
  let _rollingMode = 'kpi7'; // 'kpi7' | 'kpi67' | 'kpi103' | 'ec' — 기본은 7월 Revision 기준

  function _emptyYearData() {
    return CONFIG.BIZ_LIST.reduce((o, b) => { o[b] = Array(12).fill(0); return o; }, {});
  }
  function _emptyRolling() {
    const cur = new Date().getFullYear();
    const obj = {};
    for (let y = cur - 1; y <= cur + 2; y++) obj[y] = _emptyYearData();
    return obj;
  }

  // ── 롤링 데이터 저장소 3개 ─────────────────────────────────
  let _rolling67  = JSON.parse(localStorage.getItem('kpi_rolling')     || 'null') || _emptyRolling();
  let _rolling103 = JSON.parse(localStorage.getItem('kpi_rolling_103') || 'null') || _emptyRolling();
  let _rolling7   = JSON.parse(localStorage.getItem('kpi_rolling_7')   || 'null') || _emptyRolling();
  let _ecRolling  = JSON.parse(localStorage.getItem('ec_rolling')      || 'null') || _emptyRolling();

  function _getActiveRolling() {
    if (_rollingMode === 'ec')     return _ecRolling;
    if (_rollingMode === 'kpi103') return _rolling103;
    if (_rollingMode === 'kpi7')   return _rolling7;
    return _rolling67;
  }

  // ── Factor ────────────────────────────────────────────────
  let _factors = JSON.parse(localStorage.getItem('kpi_factors') || 'null') || {
    DRAM:1.0, SSD:1.0, MID:1.0, SCR:1.0, RMA:1.0, SUS:1.0, MOD:1.0,
  };
  function _getFactor(biz) { return parseFloat(_factors[biz] ?? 1.0); }
  function _saveFactors(data) {
    Object.assign(_factors, data);
    localStorage.setItem('kpi_factors', JSON.stringify(_factors));
    Api.setSetting('kpi_factors', JSON.stringify(_factors));
  }

  // ── 환율 ──────────────────────────────────────────────────
  let _exchangeRate = parseFloat(localStorage.getItem('kpi_exchange_rate') || '0') || 1395;

  // 엑셀 다운로드용 최근 렌더 데이터 캐시
  let _exportCache = null;
  function _saveExchangeRate(rate) {
    _exchangeRate = rate;
    localStorage.setItem('kpi_exchange_rate', String(rate));
    Api.setSetting('kpi_exchange_rate', String(rate));
  }
  function _loadExchangeRate() {
    const raw = Store.getSetting('kpi_exchange_rate');
    if (raw && raw.value) {
      const parsed = parseFloat(raw.value);
      if (parsed > 0) { _exchangeRate = parsed; localStorage.setItem('kpi_exchange_rate', String(_exchangeRate)); }
    }
    if (!_exchangeRate || _exchangeRate <= 0) _exchangeRate = 1395;
  }

  function _toKRW(usd) { return _exchangeRate > 0 ? usd * _exchangeRate : null; }

  function _loadFactors() {
    const raw = Store.getSetting('kpi_factors');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.assign(_factors, parsed);
        localStorage.setItem('kpi_factors', JSON.stringify(_factors));
      }
    } catch(e) {}
  }

  // ── Material Cost (KPI-7월 전용) ──────────────────────────
  // 구조: { 연도: { 사업: [12개월] } }, 단위 M USD (계획·제출 문서와 동일)
  // Material Profit 실적 = 매출 실적(USD) − Material Cost(USD)
  let _materialCost = JSON.parse(localStorage.getItem('kpi_material_cost') || 'null') || {};
  let _mcYear       = new Date().getFullYear();   // Material Cost 입력 패널의 대상 연도

  // ── KPI-7월 기준값 (2026-07 리비전) ───────────────────────
  // 출처: '반도체 Value Chain 협업과제_상반기 실적 및 연간 예상_20260701_1340.xlsx'
  // 단위 M USD. 1~6월은 문서상 확정 실적, 7~12월은 계획.
  // 저장된(입력한) 값이 있으면 항상 그쪽이 우선이고, 비어 있을 때만 이 값을 채운다.
  // 문서 합계: 매출 10.612 / Material Cost 0.338 / Material Profit 10.274 (U$M)
  // 이후 갱신분(RMA)을 반영한 현재 합계: 매출 10.633 / MP 10.295 (U$M)
  const _KPI7_BASE_YEAR = 2026;
  const _KPI7_BASELINE = {
    DRAM: { rev:  [0,0,0.0863,0.2096,0.8418,0.3045,0.2308,0.2308,0.2308,0.2308,0.2308,0.2308],
            ebit: [0,0,0.0863,0.2096,0.8418,0.3045,0.2308,0.2308,0.2308,0.2308,0.2308,0.2308] },
    SSD:  { rev:  [0.0613,0.0331,0,0.0404,0,0.0402,0.0402,0.0402,0.0402,0.0402,0.0402,0.0402],
            ebit: [0.0613,0.0331,0,0.0404,0,0.0402,0.0402,0.0402,0.0402,0.0402,0.0402,0.0402] },
    MID:  { rev:  [0,0,1.2604,1.2527,1.9514,0,1,0.95,0,0,0,0],
            ebit: [0,0,1.1314,1.1526,1.9514,0,0.95,0.9,0,0,0,0] },
    SCR:  { rev:  [0,0,0,0,0,0.2052,0.099,0.09,0.06,0,0,0],
            ebit: [0,0,0,0,0,0.2021,0.0972,0.087,0.0588,0,0,0] },
    // RMA는 7월 문서(7·8월 각 0.25) 이후 업데이트된 값으로 대체 —
    // 7~10월 각 $125,000 / 11월 0 / 12월 $20,833. MC가 0이라 MP도 동일.
    RMA:  { rev:  [0,0,0,0,0,0,0.125,0.125,0.125,0.125,0,0.020833],
            ebit: [0,0,0,0,0,0,0.125,0.125,0.125,0.125,0,0.020833] },
  };
  // 같은 문서의 Material Cost (M USD)
  const _KPI7_MC_BASELINE = {
    MID: [0,0,0.129,0.1001,0,0,0.05,0.05,0,0,0,0],
    SCR: [0,0,0,0,0,0.003,0.0018,0.003,0.0012,0,0,0],
  };

  /** 값이 하나도 없는 사업만 기준 문서 값으로 채운다 (입력값이 있으면 손대지 않음) */
  function _seedKpi7Baseline() {
    const y = _KPI7_BASE_YEAR;
    if (!_rolling7[y]) _rolling7[y] = {};
    Object.keys(_KPI7_BASELINE).forEach(biz => {
      const d = _rolling7[y][biz];
      const empty = !d || (Array.isArray(d)
        ? d.every(v => !parseFloat(v))
        : (!d.rev || d.rev.every(v => !parseFloat(v))) && (!d.ebit || d.ebit.every(v => !parseFloat(v))));
      if (empty) _rolling7[y][biz] = { rev: _KPI7_BASELINE[biz].rev.slice(), ebit: _KPI7_BASELINE[biz].ebit.slice() };
    });
    if (!_materialCost[y]) _materialCost[y] = {};
    Object.keys(_KPI7_MC_BASELINE).forEach(biz => {
      const arr = _materialCost[y][biz];
      if (!Array.isArray(arr) || arr.every(v => !parseFloat(v))) {
        _materialCost[y][biz] = _KPI7_MC_BASELINE[biz].slice();
      }
    });
  }

  // ── 전망(LE) — KPI-7월 기준 전용 ──────────────────────────
  // 베이스라인(롤링 계획)은 고정 벤치마크로 두고, 매달 제출하는 잔여기간 전망은
  // 제출 회차(vintage)별 스냅샷으로 따로 보관한다.
  //   구조: { 연도: { 'YYYY-MM'(제출 회차): { 사업: { rev:[12], ebit:[12] } } } }  단위 억원
  //   연말 추정 = 실적(1월~마감월) + 전망(마감월+1~12월), 전망 미입력 월은 베이스라인으로 폴백
  let _forecast   = JSON.parse(localStorage.getItem('kpi_forecast_7') || 'null') || {};
  let _leView     = false;   // 연말 추정(LE) 보기 토글
  let _fcVintage  = null;    // 화면에서 선택된 제출 회차
  let _fcYear     = new Date().getFullYear();
  let _fcEditVintage = null; // 입력 패널에서 편집 중인 회차

  _seedKpi7Baseline();

  /** 이번 달 제출 회차 키 (YYYY-MM) */
  function _thisVintage() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  /** 해당 연도의 제출 회차 목록 (최신순) */
  function _fcVintages(year) {
    return Object.keys(_forecast[year] || {}).sort().reverse();
  }
  function _latestVintage(year) { return _fcVintages(year)[0] || null; }
  /** 직전 회차 (비교용) */
  function _prevVintage(year, vintage) {
    const list = _fcVintages(year);
    const i = list.indexOf(vintage);
    return i >= 0 ? (list[i + 1] || null) : (list[0] || null);
  }
  /** 전망 12개월 배열 (억원). 없으면 null */
  function _getForecastArr(year, vintage, biz, type) {
    const d = _forecast[year]?.[vintage]?.[biz];
    if (!d) return null;
    const arr = d[type];
    if (!Array.isArray(arr)) return null;
    return Array.from({ length: 12 }, (_, i) => parseFloat(arr[i]) || 0);
  }
  function _saveForecast(year, vintage, data) {
    if (!_forecast[year]) _forecast[year] = {};
    _forecast[year][vintage] = { ...(_forecast[year][vintage] || {}), ...data };
    const json = JSON.stringify(_forecast);
    localStorage.setItem('kpi_forecast_7', json);
    Api.setSetting('kpi_forecast_7', json);
  }
  function _loadForecast() {
    const raw = Store.getSetting('kpi_forecast_7');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.keys(parsed).forEach(y => { _forecast[y] = { ...(_forecast[y] || {}), ...parsed[y] }; });
        localStorage.setItem('kpi_forecast_7', JSON.stringify(_forecast));
      }
    } catch(e) {}
  }
  /**
   * 실적/전망 경계 — '전월까지 자동 실적' 규칙.
   * 반환값은 마지막 실적 월의 0-based 인덱스 (과거 연도=11, 미래 연도=-1)
   */
  function _closedMonthIdx(year) {
    const now = new Date();
    const y = parseInt(year);
    if (y < now.getFullYear()) return 11;
    if (y > now.getFullYear()) return -1;
    return now.getMonth() - 1;   // 이번 달이 8월(getMonth()=7)이면 6 → 7월까지 실적
  }

  function _getMcMonths(year, biz) {
    const arr = _materialCost[year]?.[biz];
    if (!Array.isArray(arr)) return Array(12).fill(0);
    return Array.from({ length: 12 }, (_, i) => parseFloat(arr[i]) || 0);
  }
  function _getMcMonth(year, biz, month) { return _getMcMonths(year, biz)[month - 1] || 0; }
  function _getMcYear(year, biz)         { return _getMcMonths(year, biz).reduce((s, v) => s + v, 0); }
  /** 실적 차감용 — M USD → USD */
  function _getMcUsdMonth(year, biz, month) { return _getMcMonth(year, biz, month) * 1000000; }
  function _getMcUsdYear(year, biz)         { return _getMcYear(year, biz) * 1000000; }

  function _saveMaterialCost(year, data) {
    if (!_materialCost[year]) _materialCost[year] = {};
    Object.assign(_materialCost[year], data);
    const json = JSON.stringify(_materialCost);
    localStorage.setItem('kpi_material_cost', json);
    Api.setSetting('kpi_material_cost', json);
  }
  function _loadMaterialCost() {
    const raw = Store.getSetting('kpi_material_cost');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.keys(parsed).forEach(y => { _materialCost[y] = { ...(_materialCost[y] || {}), ...parsed[y] }; });
        localStorage.setItem('kpi_material_cost', JSON.stringify(_materialCost));
      }
    } catch(e) {}
  }

  // ── 이익 지표 (모드별) ────────────────────────────────────
  // kpi7 → Material Profit (매출 − Material Cost) / 그 외 → EBIT (매출 × Factor)
  function _isMpMode(mode)   { return (mode || _rollingMode) === 'kpi7'; }

  // ── 롤링 raw 저장 단위 ────────────────────────────────────
  // EC·KPI-7월 = M USD / 그 외 KPI = 억원.
  // KPI-7월 계획은 달러로 확정된 값이라 원화로 저장하면 환율이 바뀔 때마다
  // 계획 금액이 흔들리므로 M USD 원본 그대로 보관한다.
  function _isUsdRaw(mode) {
    const m = mode || _rollingMode;
    return m === 'ec' || m === 'kpi7';
  }
  /** 롤링 raw → USD */
  function _rawToUsd(raw, mode) {
    const n = parseFloat(raw) || 0;
    if (_isUsdRaw(mode)) return n * 1000000;
    return _exchangeRate > 0 ? n * 100000000 / _exchangeRate : 0;
  }
  /** 롤링 raw → 표시 단위 숫자 ('krw'=억원 | 'sgd'=M SGD | 그 외=M USD) */
  function _rawToDispUnit(raw, mode, tunit) {
    const n = parseFloat(raw) || 0;
    if (tunit === 'krw') {
      if (!_isUsdRaw(mode)) return n;                                   // 이미 억원
      return _exchangeRate > 0 ? n * 1000000 * _exchangeRate / 100000000 : null;
    }
    const usd = _rawToUsd(n, mode);
    if (!_isUsdRaw(mode) && _exchangeRate <= 0) return null;            // 환율 없으면 환산 불가
    const mUsd = usd / 1000000;
    return tunit === 'sgd' ? mUsd * _SGD_RATE : mUsd;
  }
  function _profitLabel(mode){ return _isMpMode(mode) ? 'Material Profit' : 'EBIT'; }

  /** 월별 이익 실적 (USD) */
  function _getActualProfitMonth(year, biz, month, mode) {
    const rev = _getActualMonth(year, biz, month);
    return _isMpMode(mode) ? rev - _getMcUsdMonth(year, biz, month) : rev * _getFactor(biz);
  }
  /** 연간 이익 실적 (USD) */
  function _getActualProfit(year, biz, mode) {
    if (_isMpMode(mode)) return _getActual(year, biz) - _getMcUsdYear(year, biz);
    return _getActual(year, biz) * _getFactor(biz);
  }

  // ── 롤링 목표 계산 ────────────────────────────────────────
  function _getRollingStore(mode) {
    if (mode === 'ec')     return _ecRolling;
    if (mode === 'kpi103') return _rolling103;
    if (mode === 'kpi7')   return _rolling7;
    return _rolling67;
  }

  // ── 롤링 raw값 접근 헬퍼 ─────────────────────────────────
  // 저장 구조가 두 가지:
  //   신규: { DRAM: { rev:[12], ebit:[12] } }
  //   구버전: { DRAM: [12] }  → ebit로 간주, rev는 0
  function _getRollingRevRaw(store, year, biz) {
    const d = store[year]?.[biz];
    if (!d) return Array(12).fill(0);
    if (Array.isArray(d)) return Array(12).fill(0);   // 구버전: rev 없음
    return (d.rev || Array(12).fill(0)).map(v => parseFloat(v) || 0);
  }
  function _getRollingEbitRaw(store, year, biz) {
    const d = store[year]?.[biz];
    if (!d) return Array(12).fill(0);
    if (Array.isArray(d)) return d.map(v => parseFloat(v) || 0);  // 구버전 호환
    return (d.ebit || Array(12).fill(0)).map(v => parseFloat(v) || 0);
  }

  function _getRollingMonths(year, biz, mode) {
    const store = _getRollingStore(mode);
    const ebitVals = _getRollingEbitRaw(store, year, biz);
    if (_isUsdRaw(mode)) return ebitVals.map(v => v * 1000000);       // M USD → USD (EC·KPI-7월)
    return ebitVals.map(v => v * 100000000);                           // 억원 → 원
  }

  function _getTarget(year, biz, mode) {
    return _getRollingMonths(year, biz, mode).reduce((s,v)=>s+v, 0);
  }
  function _getTotalTarget(year, mode) {
    return CONFIG.BIZ_LIST.reduce((s,b)=>s+_getTarget(year,b,mode), 0);
  }
  function _getMonthlyTarget(year, biz, month, mode) {
    return _getRollingMonths(year, biz, mode)[month-1] || 0;
  }

  // 매출 목표 (전 사업 × 12개월 합) — KPI 모드: 원, EC 모드: USD
  function _getTotalRevenueTarget(year, mode) {
    const store = _getRollingStore(mode);
    const sum = CONFIG.BIZ_LIST.reduce((s, b) => {
      return s + _getRollingRevRaw(store, year, b).reduce((a,v)=>a+v, 0);
    }, 0);
    return _isUsdRaw(mode) ? sum * 1000000 : sum * 100000000;
  }

  function _getActual(year, biz) {
    return Store.getInvoices()
      .filter(r => r.biz === biz && String(r.date||'').startsWith(String(year)))
      .reduce((s,r) => s + parseNumber(r.total || r.amount), 0);
  }
  function _getActualMonth(year, biz, month) {
    const prefix = `${year}-${String(month).padStart(2,'0')}`;
    return Store.getInvoices()
      .filter(r => (!biz||r.biz===biz) && String(r.date||'').startsWith(prefix))
      .reduce((s,r) => s + parseNumber(r.total || r.amount), 0);
  }

  // ── 롤링 저장 ─────────────────────────────────────────────
  const _ROLLING_META = {
    ec:     { key: 'ec_rolling',      store: () => _ecRolling  },
    kpi7:   { key: 'kpi_rolling_7',   store: () => _rolling7   },
    kpi103: { key: 'kpi_rolling_103', store: () => _rolling103 },
    kpi67:  { key: 'kpi_rolling',     store: () => _rolling67  },
  };

  function _saveRollingData(year, data) {
    const meta  = _ROLLING_META[_rollingMode] || _ROLLING_META.kpi67;
    const store = meta.store();
    if (!store[year]) store[year] = {};
    Object.assign(store[year], data);
    const json = JSON.stringify(store);
    localStorage.setItem(meta.key, json);
    Api.setSetting(meta.key, json);
  }

  // ── 서버 settings 동기화 ──────────────────────────────────
  function _loadFromSettings() {
    const sync = (key, store, setter) => {
      const raw = Store.getSetting(key);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach(y => { store[y] = {...(store[y]||{}), ...parsed[y]}; });
          localStorage.setItem(key, JSON.stringify(store));
        }
      } catch(e) {}
    };
    sync('kpi_rolling',     _rolling67,  null);
    sync('kpi_rolling_103', _rolling103, null);
    sync('kpi_rolling_7',   _rolling7,   null);
    sync('ec_rolling',      _ecRolling,  null);
    _loadFactors();
    _loadMaterialCost();
    _loadForecast();
    _loadExchangeRate();
    _seedKpi7Baseline();   // 서버 값 병합 후, 비어 있는 사업만 기준 문서 값으로 채움
  }

  function selectYear(year) { _year = year; Pages.KpiTarget.render(); }

  function switchBiz(biz) {
    if (biz === 'all') { _bizSet = new Set(['all']); }
    else {
      _bizSet.delete('all');
      if (_bizSet.has(biz)) { _bizSet.delete(biz); if (_bizSet.size===0) _bizSet=new Set(['all']); }
      else _bizSet.add(biz);
    }
    ['all','DRAM','SSD','MID'].forEach(b => {
      const btn = document.getElementById('kpi-biz-'+b); if (!btn) return;
      const color = b==='all' ? '#1B4F8A' : CONFIG.BIZ_COLORS[b];
      const on = _bizSet.has(b);
      btn.style.background=on?color:'none'; btn.style.color=on?'#fff':'var(--tx2)'; btn.style.borderColor=on?color:'var(--bd2)';
    });
    _renderTracking();
  }

  // ── 모드 헬퍼 ─────────────────────────────────────────────
  function _isKpi(mode) { return mode === 'kpi67' || mode === 'kpi103' || mode === 'kpi7'; }
  function _modeLabel(mode) {
    if (mode === 'kpi7')   return 'KPI-7월';
    if (mode === 'kpi67')  return 'KPI기준(67억)';
    if (mode === 'kpi103') return 'KPI기준(103억)';
    return 'EC 기준';
  }
  function _modeColor(mode) {
    if (mode === 'kpi7')   return '#1D1D1F';
    if (mode === 'kpi103') return '#B45309';
    if (mode === 'ec')     return '#0F6E56';
    return '#185FA5';
  }
  function _rollingLabel(mode) {
    if (mode === 'kpi7')   return 'KPI-7월 롤링 입력';
    if (mode === 'kpi103') return 'KPI롤링(103억)';
    if (mode === 'ec')     return 'EC 롤링 입력';
    return 'KPI롤링(67억)';
  }

  // ── 단위 상태 ─────────────────────────────────────────────
  // ── 단위 상태 ─────────────────────────────────────────────

  // ================================================================
  // 월별 트래킹 — 단위 상태
  // ================================================================
  let _trackingUnit = 'usd'; // 'usd' | 'krw' | 'sgd'
  let _tableView    = 'ebit'; // 'ebit' | 'rev'
  const _SGD_RATE   = 1.27;  // 사업계획 기준환율: 1 USD = 1.27 SGD (고정)

  // ================================================================
  // _renderTracking
  // 그래프 아래 두 개의 매트릭스 표를 렌더링
  //   - 상단: 계획(목표) Biz × 12개월
  //   - 하단: 실적      Biz × 12개월
  //   - 하단 요약 3행: 차이(월별) / 차이(누적) / 달성률(누적)
  // ================================================================
  function _renderTracking() {
    const el = document.getElementById('kpi-tracking-wrap');
    if (!el) return;

    try {
      _renderTrackingInner(el);
    } catch(err) {
      console.error('[KpiTarget] _renderTracking error:', err);
      el.innerHTML = '<div style="padding:20px;color:#A32D2D;font-family:Pretendard,sans-serif;font-size:12px">표 렌더링 오류: ' + err.message + '</div>';
    }
  }

  function _renderTrackingInner(el) {

    // ── 기본 컨텍스트 ────────────────────────────────────────
    const year      = _year;
    const mode      = _rollingMode;
    const isKpiMode = _isKpi(mode);          // KPI67 or KPI103
    const isEcMode  = mode === 'ec';
    const hasRate   = isKpiMode && _exchangeRate > 0;
    const useKrw    = _trackingUnit === 'krw' && isKpiMode;
    const useSgd    = _trackingUnit === 'sgd' && isKpiMode;

    const now       = new Date();
    const curMonIdx = now.getFullYear() === year
      ? now.getMonth()
      : (now.getFullYear() > year ? 11 : -1);

    const MONTHS    = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const isAll     = _bizSet.has('all');
    const bizList   = isAll ? CONFIG.BIZ_LIST : CONFIG.BIZ_LIST.filter(b => _bizSet.has(b));

    // ── 단위 설정 ────────────────────────────────────────────
    // KPI: 롤링 입력값은 '억원' 단위 → 표시도 억원(소수2자리) or M USD
    // EC:  롤링 입력값은 'Million USD' 단위 → 표시도 M USD(소수2자리)
    const UNIT = {
      // 계획(목표) 값 표시 — 롤링 원본값 그대로 사용
      // KPI: 억원 단위로 저장돼있음 (이미 소수)
      // EC:  Million USD 단위로 저장돼있음
      tgtLabel:   isEcMode ? 'M USD' : (useKrw ? '억원' : 'M USD'),
      actLabel:   isEcMode ? 'M USD' : (useKrw ? '억원' : 'M USD'),
      // 실적 변환 함수: USD 원본 → 표시 단위
      //   KPI+원화: USD 실적 × Factor × 환율 → 원 → 억원
      //   KPI+USD:  USD 실적 × Factor → M USD
      //   EC:       USD 실적 → M USD
    };

    // ── 표 스타일 상수 ───────────────────────────────────────
    // 모든 셀 테두리를 동일하게 통일 (1px solid #BFBFBF)
    const BD  = 'border:1px solid #BFBFBF';       // 기본 테두리
    const BDH = 'border:1px solid #999';           // 헤더/합계 테두리
    const TS = {
      th:    'padding:6px 4px;text-align:center;font-size:13px;font-weight:700;font-family:Pretendard,sans-serif;background:#D9D9D9;' + BDH + ';white-space:nowrap',
      thMon: 'padding:6px 4px;text-align:center;font-size:13px;font-weight:700;font-family:Pretendard,sans-serif;background:#D9D9D9;' + BDH + ';white-space:nowrap;width:65px',
      thBiz: 'padding:6px 6px;text-align:center;font-size:13px;font-weight:700;font-family:Pretendard,sans-serif;background:#D9D9D9;' + BDH + ';white-space:nowrap;width:100px',
      thSub: 'padding:6px 6px;text-align:center;font-size:13px;font-weight:700;font-family:Pretendard,sans-serif;background:#D9D9D9;' + BDH + ';white-space:nowrap;width:80px',
      thSum: 'padding:6px 6px;text-align:center;font-size:13px;font-weight:700;font-family:Pretendard,sans-serif;background:#D9D9D9;' + BDH + ';white-space:nowrap;width:74px',
      td:    'padding:5px 4px;text-align:right;font-size:13px;font-family:Pretendard,sans-serif;' + BD + ';width:65px',
      tdL:   'padding:5px 8px;text-align:left;font-size:13px;font-family:Pretendard,sans-serif;' + BD + ';white-space:nowrap;width:100px',
      tdSub: 'padding:5px 8px;text-align:left;font-size:13px;font-family:Pretendard,sans-serif;font-weight:400;color:#555;' + BD + ';white-space:nowrap;width:80px',
      tdSum: 'padding:5px 6px;text-align:right;font-size:13px;font-family:Pretendard,sans-serif;font-weight:600;' + BD + ';background:#F2F2F2;width:74px',
      tdCum: 'padding:5px 6px;text-align:right;font-size:13px;font-family:Pretendard,sans-serif;font-weight:600;' + BD + ';background:#E8E4D8;width:74px',
      tdCumL:'padding:5px 8px;text-align:left;font-size:13px;font-family:Pretendard,sans-serif;font-weight:400;color:#555;' + BD + ';background:#E8E4D8;white-space:nowrap;width:80px',
    };

    // 공통 헤더 (두 표 동일 → 컬럼 너비 자동 동기화)
    function buildHeader() {
      return '<thead><tr>'
        + '<th style="' + TS.thBiz + '">Biz</th>'
        + '<th style="' + TS.thSub + '">구분</th>'
        + MONTHS.map(function(m) { return '<th style="' + TS.thMon + '">' + m + '</th>'; }).join('')
        + '<th style="' + TS.thSum + '">합계</th>'
        + '</tr></thead>';
    }

    // 값 포맷 헬퍼
    function fmtRolling(v) {
      // 롤링 저장값(억원 or M USD) → 표시 단위
      if (v === null || v === undefined) return '—';
      const n = parseFloat(v) || 0;
      if (n === 0) return '—';
      const d = _rawToDispUnit(n, mode, useKrw ? 'krw' : useSgd ? 'sgd' : 'usd');
      return d === null ? '—' : d.toFixed(2);
    }

    function fmtActual(usdVal) {
      // 실적 USD 원본 → 표시 단위로 변환
      if (usdVal === null || usdVal === undefined) return null;
      if (isEcMode)  return (usdVal / 1000000).toFixed(2);              // M USD
      if (useKrw)    return (usdVal * _exchangeRate / 100000000).toFixed(2); // 억원
      if (useSgd)    return (usdVal * _SGD_RATE / 1000000).toFixed(2);  // M SGD
      return (usdVal / 1000000).toFixed(2);                              // M USD
    }

    function fmtDiff(v) {
      if (v === null || v === undefined || isNaN(parseFloat(v))) return '—';
      const n = parseFloat(v);
      // 부호를 여기서만 붙임 (호출부에서 sign 추가 금지)
      return (n > 0 ? '+' : '') + n.toFixed(2);
    }

    function fmtPct(p) {
      if (p === null) return '—';
      return Math.round(p) + '%';
    }

    // ── 롤링 raw값 읽기 ──────────────────────────────────────
    // KPI: rev=매출(억원), ebit=EBIT(억원)
    // EC:  rev=미사용, ebit=M USD
    function getRollingRevRaw(biz, mon) {
      if (!isKpiMode) return 0;
      const store = _getRollingStore(mode);
      return _getRollingRevRaw(store, year, biz)[mon] || 0;
    }
    function getRollingEbitRaw(biz, mon) {
      const store = _getRollingStore(mode);
      return _getRollingEbitRaw(store, year, biz)[mon] || 0;
    }

    // Biz별 12개월 데이터 빌드
    // revByBiz:  매출 계획 (KPI=억원, EC=M USD)
    // ebitByBiz: EBIT 계획 (KPI=억원, EC=미사용)
    // actRevByBiz:  실제 매출 USD
    // actEbitByBiz: 실제 EBIT USD (Factor 적용)
    const revByBiz      = {};
    const ebitByBiz     = {};
    const actRevByBiz   = {};
    const actEbitByBiz  = {};

    bizList.forEach(b => {
      if (isEcMode) {
        // EC: 저장값 = 매출(M USD) → revByBiz에 할당
        revByBiz[b]  = MONTHS.map((_, i) => getRollingEbitRaw(b, i)); // EC는 ebit키에 매출값 저장
        ebitByBiz[b] = MONTHS.map(() => 0); // EC는 EBIT 없음
      } else {
        revByBiz[b]  = MONTHS.map((_, i) => getRollingRevRaw(b, i));
        ebitByBiz[b] = MONTHS.map((_, i) => getRollingEbitRaw(b, i));
      }
      actRevByBiz[b]  = MONTHS.map((_, i) => {
        if (i > curMonIdx) return null;
        return _getActualMonth(year, b, i + 1); // 순수 매출 USD
      });
      actEbitByBiz[b] = MONTHS.map((_, i) => {
        if (i > curMonIdx) return null;
        // kpi7 → 매출 − Material Cost / 그 외 → 매출 × Factor
        return _getActualProfitMonth(year, b, i + 1, mode);
      });
    });

    // 월별 합계 (raw: KPI=억원, EC=M USD / 실적=USD)
    const revSumRaw     = MONTHS.map((_, i) => bizList.reduce((s, b) => s + revByBiz[b][i],  0));
    const ebitSumRaw    = MONTHS.map((_, i) => bizList.reduce((s, b) => s + ebitByBiz[b][i], 0));
    const actRevSumUsd  = MONTHS.map((_, i) => { if (i > curMonIdx) return null; return bizList.reduce((s, b) => s + (actRevByBiz[b][i]  || 0), 0); });
    const actEbitSumUsd = MONTHS.map((_, i) => { if (i > curMonIdx) return null; return bizList.reduce((s, b) => s + (actEbitByBiz[b][i] || 0), 0); });

    // 누적 — EBIT 기준 (요약 카드/달성률용)
    let cET = 0, cEA = 0;
    const ebitCumRaw = [], actEbitCumUsd = [];
    MONTHS.forEach((_, i) => {
      cET += ebitSumRaw[i]; ebitCumRaw.push(cET);
      if (i <= curMonIdx) { cEA += actEbitSumUsd[i] || 0; actEbitCumUsd.push(cEA); }
      else actEbitCumUsd.push(null);
    });

    // 누적 — 매출 기준 (매출 표용)
    let cRT = 0, cRA = 0;
    const revCumRaw = [], actRevCumUsd = [];
    MONTHS.forEach((_, i) => {
      cRT += revSumRaw[i]; revCumRaw.push(cRT);
      if (i <= curMonIdx) { cRA += actRevSumUsd[i] || 0; actRevCumUsd.push(cRA); }
      else actRevCumUsd.push(null);
    });

    // 요약카드/달성률 계산 기준
    //   EC: 항상 매출 / KPI: 표 보기 토글(EBIT·매출)에 따라 전환
    const showEbit  = isEcMode ? false : (_tableView === 'ebit');
    const tgtSumRaw = isEcMode ? revSumRaw    : (showEbit ? ebitSumRaw    : revSumRaw);
    const tgtCumRaw = isEcMode ? revCumRaw    : (showEbit ? ebitCumRaw    : revCumRaw);
    const actCumUsd = isEcMode ? actRevCumUsd : (showEbit ? actEbitCumUsd : actRevCumUsd);

    const totalTgtRaw = tgtSumRaw.reduce((s, v) => s + v, 0);
    if (totalTgtRaw === 0) {
      el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--tbl-tx-body);font-size:12px">롤링 데이터를 먼저 입력해주세요</div>';
      return;
    }

    // curMonIdx가 -1이면 미래 연도 — 실적 없음
    const safeMonIdx = Math.max(0, Math.min(curMonIdx, 11));

    // ── 요약 카드 계산 (모두 현재월 기준) ──────────────────
    // 실적 누적(USD) — 현재월까지
    const curActUsd    = curMonIdx >= 0 ? (actCumUsd[curMonIdx] ?? 0) : 0;
    // 목표 누적(raw: 억원 or M USD) — 현재월까지
    const curTgtRaw    = curMonIdx >= 0 ? (tgtCumRaw[curMonIdx] ?? 0) : 0;
    // 표시 단위로 변환
    const curActDisp   = parseFloat(fmtActual(curActUsd)) || 0;
    // fmtRolling으로 목표도 표시 단위로 변환 (동일 단위로 비교)
    const curTgtDisp   = parseFloat(fmtRolling(curTgtRaw)) || 0;
    const overallPct   = curTgtDisp > 0 ? curActDisp / curTgtDisp * 100 : 0;
    const diffCumFinal = curActDisp - curTgtDisp;
    const pctCumFinal  = curTgtDisp > 0 ? curActDisp / curTgtDisp * 100 : null;
    const periodLabel  = curMonIdx >= 0 ? '1~' + (curMonIdx + 1) + '월' : '—';
    const unitLabel    = isEcMode ? 'M USD' : (useKrw ? '억원' : useSgd ? 'M SGD' : 'M USD');

    // ── 색상 규칙 ────────────────────────────────────────────
    // 차이: 음수=파랑(목표초과), 양수=빨강(미달) — 요구사항 4번
    // 달성률: 100% 미만=파랑, 100% 이상=빨강
    const diffColor = d => {
      if (d === null || isNaN(d)) return 'inherit';
      return d < 0 ? '#1B4F8A' : (d > 0 ? '#dc2626' : 'inherit');
    };
    const pctColor = p => {
      if (p === null) return 'inherit';
      return p < 100 ? '#1B4F8A' : '#dc2626';
    };
    const pctBg = p => {
      if (p === null) return 'transparent';
      return p < 100 ? '#EBF2FB' : '#FEF2F2';
    };

    // ── 요약 카드 ────────────────────────────────────────────
    // 달성률 표현: 130% → +30%, 97% → -3%, 100% → ±0%
    function fmtPctDiff(pct) {
      if (pct === null || pct === undefined) return '—';
      var diff = pct - 100;
      return (diff > 0 ? '+' : '') + diff.toFixed(1) + '%';
    }

    // ── 연말 추정(LE) 계산 ───────────────────────────────────
    // 실적(1월~마감월) + 전망(마감월+1~12월, 미입력 시 베이스라인 폴백)
    // 모든 값을 '표시 단위 숫자'로 통일해서 더한다 (실적=USD, 계획/전망=억원)
    const isLe      = _isMpMode(mode) && _leView;
    const closedIdx = _closedMonthIdx(year);
    const leVintage = _fcVintage && _forecast[year]?.[_fcVintage] ? _fcVintage : _latestVintage(year);
    const lePrevVin = leVintage ? _prevVintage(year, leVintage) : null;
    const leType    = showEbit ? 'ebit' : 'rev';

    /** 롤링 raw(억원/M USD) → 표시 단위 숫자 */
    function rawToDisp(v) {
      return _rawToDispUnit(v, mode, useKrw ? 'krw' : useSgd ? 'sgd' : 'usd') || 0;
    }
    /** 실적 USD → 표시 단위 숫자 */
    function actToDispNum(usd) {
      const n = parseFloat(usd) || 0;
      if (isEcMode) return n / 1000000;
      if (useKrw)   return n * _exchangeRate / 100000000;
      if (useSgd)   return n * _SGD_RATE / 1000000;
      return n / 1000000;
    }
    /** 사업별 LE 월 배열 + 출처(act|fc|base) */
    function leMonthsOf(biz, vintage) {
      const fcArr   = vintage ? _getForecastArr(year, vintage, biz, leType) : null;
      const baseArr = showEbit ? ebitByBiz[biz] : revByBiz[biz];
      const actArr  = showEbit ? actEbitByBiz[biz] : actRevByBiz[biz];
      return MONTHS.map((_, i) => {
        if (i <= closedIdx) return { v: actToDispNum(actArr[i] || 0), src: 'act' };
        if (fcArr && fcArr[i] > 0) return { v: rawToDisp(fcArr[i]), src: 'fc' };
        return { v: rawToDisp(baseArr[i] || 0), src: 'base' };
      });
    }
    const leByBiz   = {};
    bizList.forEach(b => { leByBiz[b] = leMonthsOf(b, leVintage); });
    const leSum     = MONTHS.map((_, i) => bizList.reduce((s, b) => s + leByBiz[b][i].v, 0));
    const leTotal   = leSum.reduce((s, v) => s + v, 0);
    const leBaseTotal = (showEbit ? ebitSumRaw : revSumRaw).reduce((s, v) => s + rawToDisp(v), 0);
    const leDiff    = leTotal - leBaseTotal;
    const lePct     = leBaseTotal > 0 ? leTotal / leBaseTotal * 100 : null;
    // 직전 제출본 대비 변화
    const lePrevTotal = lePrevVin
      ? bizList.reduce((s, b) => s + leMonthsOf(b, lePrevVin).reduce((a, m) => a + m.v, 0), 0)
      : null;

    const mc = _modeColor(mode);
    const cards = isLe ? [
      { label: '연말 추정 (' + (leVintage || '전망 미입력') + ')', value: leTotal.toFixed(2) + ' ' + unitLabel,
        sub: '시스템 실적 ' + (closedIdx >= 0 ? (closedIdx + 1) + '월' : '없음') + '까지 + 잔여월 전망' },
      { label: '계획 (' + _modeLabel(mode) + ')', value: leBaseTotal.toFixed(2) + ' ' + unitLabel,
        sub: (showEbit ? _profitLabel(mode) : '매출') + ' 계획 · 고정' },
      { label: '계획 대비', value: fmtDiff(leDiff) + ' ' + unitLabel, color: diffColor(leDiff),
        sub: lePct === null ? '계획 미입력' : '추정 달성률 ' + lePct.toFixed(1) + '%' },
      { label: '직전 제출 대비', value: lePrevTotal === null ? '—' : fmtDiff(leTotal - lePrevTotal) + ' ' + unitLabel,
        color: lePrevTotal === null ? '' : diffColor(leTotal - lePrevTotal),
        sub: lePrevVin ? lePrevVin + ' 제출본 ' + lePrevTotal.toFixed(2) : '직전 제출본 없음' },
    ] : [
      { label: '연간 계획', value: fmtRolling(totalTgtRaw) + ' ' + unitLabel, sub: _modeLabel(mode) + ' · ' + (isEcMode ? '매출' : (showEbit ? _profitLabel(mode) : '매출')) + ' 기준' },
      { label: '누적 실적 (' + periodLabel + ')', value: curActDisp.toFixed(2) + ' ' + unitLabel, sub: '계획 ' + curTgtDisp.toFixed(2) + ' ' + unitLabel },
      { label: '누적 달성률 (' + periodLabel + ')', value: fmtPctDiff(overallPct), color: pctColor(Math.round(overallPct)), sub: '계획대비 · ' + unitLabel + ' 기준' },
      { label: '누적 차이 (' + periodLabel + ')', value: fmtDiff(diffCumFinal) + ' ' + unitLabel, color: diffColor(diffCumFinal), sub: diffCumFinal < 0 ? '계획 미달' : diffCumFinal > 0 ? '계획 초과' : '정확 달성' },
    ].map(c =>
      '<div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:13px 17px">'
      + '<div style="font-size:14px;color:var(--tbl-tx-body);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">' + c.label + '</div>'
      + '<div style="font-size:22px;font-weight:600;' + (c.color ? 'color:' + c.color : '') + '">' + c.value + '</div>'
      + '<div style="font-size:14px;color:var(--tbl-tx-body);margin-top:3px">' + c.sub + '</div>'
      + '</div>'
    ).join('');



    // ================================================================
    // 차트 HTML (EBIT 누적 1개만 유지)
    // ================================================================

    function makeChartCard(canvasId, title, legendItems) {
      var legendHtml = legendItems.map(function(item) {
        var lineStyle = item.dashed
          ? 'border-top:2px dashed ' + item.color + ';background:transparent'
          : 'background:' + item.color;
        return '<span style="display:flex;align-items:center;gap:5px">'
          + '<span style="width:12px;height:3px;display:inline-block;border-radius:2px;' + lineStyle + '"></span>'
          + '<span style="font-size:13px;font-family:Pretendard,sans-serif;color:var(--tx2)">' + item.label + '</span>'
          + '</span>';
      }).join('');
      return '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:16px;margin-bottom:14px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
        + '<span style="font-size:14px;font-weight:600;font-family:Pretendard,sans-serif;color:var(--tx)">' + title + '</span>'
        + '<div style="display:flex;gap:14px">' + legendHtml + '</div>'
        + '</div>'
        + '<div style="position:relative;height:240px"><canvas id="' + canvasId + '"></canvas></div>'
        + '</div>';
    }

    // showEbit은 요약카드 계산부에서 이미 선언됨 (EC=false, KPI=표 보기 토글)

    // 표/차트 레이블: EC=매출, KPI=EBIT or 매출
    var profitLabel = _profitLabel(mode);   // kpi7 → 'Material Profit' / 그 외 → 'EBIT'
    var planLabel  = isEcMode ? '매출(계획)' : (showEbit ? profitLabel + '(계획)' : '매출(계획)');
    var actLabel   = isEcMode ? '매출(실적)' : (showEbit ? profitLabel + '(실적)' : '매출(실적)');
    var chartLabel = isEcMode ? '매출' : (showEbit ? profitLabel : '매출');

    // 차트: EBIT 누적만 유지
    var chart1Title = _modeLabel(mode) + ' · ' + chartLabel + ' 누적 · ' + unitLabel;
    var chart1Html  = makeChartCard('cv-ebit-cum', chart1Title, [
      { label: chartLabel + ' 계획 누적', color: '#85B7EB', dashed: true  },
      { label: chartLabel + ' 실적 누적', color: '#1D9E75', dashed: false },
    ].concat(isLe ? [{ label: '연말 추정 누적', color: '#1D1D1F', dashed: true }] : []));

    // 단위/지표 토글은 상단(render)으로 이동됨 → _buildUnitBar()

    // ── 표: EBIT or 매출 선택 뷰 ─────────────────────────────
    // showEbit=true  → EBIT(계획)/EBIT(실적) 행만 표시
    // showEbit=false → 매출(계획)/매출(실적) 행만 표시
    // EC 모드는 항상 EBIT(=M USD) 표시

    // 계획 표 데이터 행
    var tgtDataRows = bizList.map(function(b) {
      var vals    = showEbit ? ebitByBiz[b] : revByBiz[b];
      var subLabel = showEbit ? profitLabel + '(계획)' : '매출(계획)';
      var subColor = showEbit ? '#0F6E56'    : '#185FA5';
      var cells = MONTHS.map(function(_, i) {
        var v   = vals[i];
        var dim = i > curMonIdx ? ';color:#BBB' : '';
        return '<td style="' + TS.td + dim + '">' + fmtRolling(v) + '</td>';
      }).join('');
      var total = vals.reduce(function(s, v) { return s + v; }, 0);
      return '<tr>'
        + '<td style="' + TS.tdL + ';font-weight:500">' + (CONFIG.BIZ_LABELS[b] || b) + '</td>'
        + '<td style="' + TS.tdSub + '">' + subLabel + '</td>'
        + cells
        + '<td style="' + TS.tdSum + '">' + fmtRolling(total) + '</td>'
        + '</tr>';
    }).join('');

    // 계획 합계행
    var tgtVals     = isEcMode ? revSumRaw  : (showEbit ? ebitSumRaw  : revSumRaw);
    var tgtCumVals  = isEcMode ? revCumRaw  : (showEbit ? ebitCumRaw  : revCumRaw);
    var tgtTotalAll = tgtVals.reduce(function(s, v) { return s + v; }, 0);
    var tgtSubLabel = isEcMode ? '매출' : (showEbit ? profitLabel : '매출');
    var tgtSubColor = isEcMode ? '#0F6E56' : (showEbit ? '#0F6E56' : '#185FA5');

    var tgtSumRow = '<tr style="background:#F2F2F2">'
      + '<td style="' + TS.tdSum + ';text-align:center">합계</td>'
      + '<td style="' + TS.tdSub + ';background:#F2F2F2">' + tgtSubLabel + '(계획)</td>'
      + tgtVals.map(function(v) { return '<td style="' + TS.tdSum + '">' + fmtRolling(v) + '</td>'; }).join('')
      + '<td style="' + TS.tdSum + '">' + fmtRolling(tgtTotalAll) + '</td>'
      + '</tr>';

    var tgtCumRow = '<tr style="background:#E8E4D8">'
      + '<td style="' + TS.tdCum + ';text-align:center">누적</td>'
      + '<td style="' + TS.tdCumL + '">' + tgtSubLabel + '(계획)</td>'
      + tgtCumVals.map(function(v) { return '<td style="' + TS.tdCum + '">' + fmtRolling(v) + '</td>'; }).join('')
      + '<td style="' + TS.tdCum + '">' + fmtRolling(tgtTotalAll) + '</td>'
      + '</tr>';

    // 실적 표 데이터 행
    // EC 모드: 매출 실적만 / KPI: showEbit에 따라 EBIT or 매출
    var actByBizView   = (isEcMode || !showEbit) ? actRevByBiz  : actEbitByBiz;
    var actSumUsdView  = (isEcMode || !showEbit) ? actRevSumUsd  : actEbitSumUsd;
    var actCumUsdView  = (isEcMode || !showEbit) ? actRevCumUsd  : actEbitCumUsd;
    var actSubLabel    = isEcMode ? '매출(실적)' : (showEbit ? profitLabel + '(실적)' : '매출(실적)');
    var actSubColor    = isEcMode ? '#6A3D7C' : (showEbit ? '#085041' : '#6A3D7C');

    var actDataRows = bizList.map(function(b) {
      var cells = MONTHS.map(function(_, i) {
        var v    = actByBizView[b][i];
        var d    = fmtActual(v);
        var isPast = i <= curMonIdx;
        var dim  = !isPast ? ';color:#BBB' : '';
        return '<td style="' + TS.td + dim + '">' + (d !== null && parseFloat(d) !== 0 ? d : (isPast ? '—' : '')) + '</td>';
      }).join('');
      var totalUsd  = MONTHS.reduce(function(s, _, i) { return s + (actByBizView[b][i] || 0); }, 0);
      var totalDisp = fmtActual(totalUsd);
      return '<tr>'
        + '<td style="' + TS.tdL + ';font-weight:500">' + (CONFIG.BIZ_LABELS[b] || b) + '</td>'
        + '<td style="' + TS.tdSub + '">' + actSubLabel + '</td>'
        + cells
        + '<td style="' + TS.tdSum + '">' + (parseFloat(totalDisp) > 0 ? totalDisp : '—') + '</td>'
        + '</tr>';
    }).join('');

    var actSumDispView  = MONTHS.map(function(_, i) { return fmtActual(actSumUsdView[i]); });
    var actCumDispView  = MONTHS.map(function(_, i) { return actCumUsdView[i] !== null ? fmtActual(actCumUsdView[i]) : null; });
    var actTotalDispView = fmtActual(MONTHS.reduce(function(s, _, i) { return s + (actSumUsdView[i] || 0); }, 0));

    var actSumRow = '<tr style="background:#F2F2F2">'
      + '<td style="' + TS.tdSum + ';text-align:center">합계</td>'
      + '<td style="' + TS.tdSub + ';background:#F2F2F2">' + actSubLabel + '</td>'
      + MONTHS.map(function(_, i) {
          var d = actSumDispView[i];
          return '<td style="' + TS.tdSum + '">' + (d !== null && parseFloat(d) !== 0 ? d : (i <= curMonIdx ? '—' : '')) + '</td>';
        }).join('')
      + '<td style="' + TS.tdSum + '">' + (parseFloat(actTotalDispView) > 0 ? actTotalDispView : '—') + '</td>'
      + '</tr>';

    var actCumRow = '<tr style="background:#E8E4D8">'
      + '<td style="' + TS.tdCum + ';text-align:center">누적</td>'
      + '<td style="' + TS.tdCumL + '">' + actSubLabel + '</td>'
      + MONTHS.map(function(_, i) {
          var d = actCumDispView[i];
          return '<td style="' + TS.tdCum + '">' + (d !== null ? d : '') + '</td>';
        }).join('')
      + '<td style="' + TS.tdCum + '">' + (actCumDispView[Math.max(0, curMonIdx)] || '—') + '</td>'
      + '</tr>';

    // ── 요약 3행 (선택된 뷰 기준) ──────────────────────────
    // 실적-계획 비교용: 목표를 표시 단위로 변환 (실적과 단위 통일)
    // fmtRolling: 억원 raw → 표시(억원 or M USD)
    var tgtSumFmt = tgtVals.map(function(v) { return parseFloat(fmtRolling(v)) || 0; });
    var tgtCumFmt = tgtCumVals.map(function(v) { return parseFloat(fmtRolling(v)) || 0; });
    var tgtSumDispArr = tgtSumFmt;
    var tgtCumDispArr = tgtCumFmt;
    var actSumRef     = actSumDispView;
    var actCumRef     = actCumDispView;

    // 합계 셀용 raw 누적 (오차 없이 raw로 합산 후 한 번만 포맷)
    var actSumRawTotal  = 0; // 현재월까지 실적 raw(USD) 합산
    var tgtSumRawTotal  = 0; // 현재월까지 목표 raw(억원/M USD) 합산
    for (var _i = 0; _i <= curMonIdx && _i < 12; _i++) {
      actSumRawTotal += actSumUsdView[_i] || 0;
      tgtSumRawTotal += tgtVals[_i] || 0;
    }
    var actSumTotalDisp = parseFloat(fmtActual(actSumRawTotal)) || 0;
    var tgtSumTotalDisp = parseFloat(fmtRolling(tgtSumRawTotal)) || 0;
    // 현재월 누적 raw
    var actCumRawCur = actCumUsdView[curMonIdx] !== null ? (actCumUsdView[curMonIdx] || 0) : 0;
    var tgtCumRawCur = tgtCumVals[curMonIdx] || 0;
    var actCumTotalDisp = parseFloat(fmtActual(actCumRawCur)) || 0;
    var tgtCumTotalDisp = parseFloat(fmtRolling(tgtCumRawCur)) || 0;

    // ── 달성률 전용: raw USD 기준으로 직접 계산 (단위 변환 오차 없음) ──
    // KPI: tgtCumRawCur = 억원 → USD 변환
    // EC:  tgtCumRawCur = M USD → USD 변환
    // 기준별 저장 단위(M USD | 억원)를 한 곳에서 USD로 변환 — 달성률 왜곡 방지
    var tgtCumUsd = _rawToUsd(tgtCumRawCur, mode);
    var pctCumForTable = (tgtCumUsd > 0 && actCumRawCur > 0)
      ? actCumRawCur / tgtCumUsd * 100
      : null;

    // 실적-계획 (월별)
    var diffMonRow = '<tr>'
      + '<td colspan="2" style="' + TS.tdL + '">실적-계획 (월별)</td>'
      + MONTHS.map(function(_, i) {
          if (i > curMonIdx) return '<td style="' + TS.td + '"></td>';
          var d = (parseFloat(actSumRef[i]) || 0) - tgtSumFmt[i];
          return '<td style="' + TS.td + ';color:' + diffColor(d) + ';font-weight:600">' + fmtDiff(d) + '</td>';
        }).join('')
      + (function() {
          // raw 합산 후 한 번만 포맷 → 0.01 오차 없음
          var d = actSumTotalDisp - tgtSumTotalDisp;
          return '<td style="' + TS.tdSum + ';color:' + diffColor(d) + '">' + fmtDiff(d) + '</td>';
        })()
      + '</tr>';

    // 실적-계획 (누적)
    var diffCumRow = '<tr>'
      + '<td colspan="2" style="' + TS.tdL + '">실적-계획 (누적)</td>'
      + MONTHS.map(function(_, i) {
          if (i > curMonIdx) return '<td style="' + TS.td + '"></td>';
          var d = (parseFloat(actCumRef[i]) || 0) - tgtCumFmt[i];
          return '<td style="' + TS.td + ';color:' + diffColor(d) + ';font-weight:600">' + fmtDiff(d) + '</td>';
        }).join('')
      + (function() {
          var d = actCumTotalDisp - tgtCumTotalDisp;
          return '<td style="' + TS.tdSum + ';color:' + diffColor(d) + '">' + fmtDiff(d) + '</td>';
        })()
      + '</tr>';

    // 달성률 (누적) — raw USD 기준으로 계산 → 단위 전환해도 동일한 값
    var pctCumRow = '<tr>'
      + '<td colspan="2" style="' + TS.tdL + '">달성률 (누적, 계획대비)</td>'
      + MONTHS.map(function(_, i) {
          if (i > curMonIdx || !tgtCumVals[i]) return '<td style="' + TS.td + '"></td>';
          // 목표 → USD, 실적 raw(USD) 직접 비율
          var tgtUsd = _rawToUsd(tgtCumVals[i], mode);
          var actUsd = actCumUsdView[i] || 0;
          if (!tgtUsd || tgtUsd <= 0) return '<td style="' + TS.td + '"></td>';
          var p    = actUsd / tgtUsd * 100;
          var disp = fmtPctDiff(p);
          var pRnd = Math.round(p);
          return '<td style="' + TS.td + ';color:' + pctColor(pRnd) + ';background:' + pctBg(pRnd) + ';font-weight:600">' + disp + '</td>';
        }).join('')
      + (function() {
          // 합계: pctCumForTable (raw USD 기반, 단위 무관)
          var p    = pctCumForTable;
          var pRnd = p !== null ? Math.round(p) : null;
          var disp = p !== null ? fmtPctDiff(p) : '—';
          return '<td style="' + TS.tdSum + ';color:' + pctColor(pRnd) + ';background:' + pctBg(pRnd) + '">' + disp + '</td>';
        })()
      + '</tr>';

    // ── 연간 달성률 행 ────────────────────────────────────────
    // 연간 총 계획 대비 현재까지 실적 (현재 뷰: showEbit=EBIT, !showEbit=매출)
    var annualPctRow = (function() {
      var tgtAnnualRaw = (showEbit ? ebitSumRaw : revSumRaw).reduce(function(s, v) { return s + v; }, 0);
      var tgtAnnualUsd = _rawToUsd(tgtAnnualRaw, mode);
      var actCumArr  = showEbit ? actEbitCumUsd : actRevCumUsd;
      var actAnnualUsd = curMonIdx >= 0 ? (actCumArr[curMonIdx] || 0) : 0;
      var rowLabel = isEcMode ? '연간 달성률 (매출 계획대비)' : (showEbit ? '연간 달성률 (' + profitLabel + ' 계획대비)' : '연간 달성률 (매출 계획대비)');

      if (!tgtAnnualUsd || tgtAnnualUsd <= 0) {
        return '<tr>'
          + '<td colspan="2" style="' + TS.tdL + ';font-weight:600">' + rowLabel + '</td>'
          + MONTHS.map(function() { return '<td style="' + TS.td + '"></td>'; }).join('')
          + '<td style="' + TS.tdSum + '">—</td>'
          + '</tr>';
      }

      var cells = MONTHS.map(function(_, i) {
        if (i > curMonIdx || actCumArr[i] === null) return '<td style="' + TS.td + '"></td>';
        var p    = (actCumArr[i] || 0) / tgtAnnualUsd * 100;
        var pRnd = Math.round(p);
        return '<td style="' + TS.td + ';color:' + pctColor(pRnd) + ';background:' + pctBg(pRnd) + ';font-weight:600">' + p.toFixed(1) + '%' + '</td>';
      }).join('');

      var p    = actAnnualUsd / tgtAnnualUsd * 100;
      var pRnd = Math.round(p);
      var sumCell = '<td style="' + TS.tdSum + ';color:' + pctColor(pRnd) + ';background:' + pctBg(pRnd) + ';font-weight:600">' + p.toFixed(1) + '%' + '</td>';

      return '<tr>'
        + '<td colspan="2" style="' + TS.tdL + ';font-weight:600">' + rowLabel + '</td>'
        + cells + sumCell + '</tr>';
    })();

        const colgroup = '<colgroup><col style="width:100px"><col style="width:80px">'
      + MONTHS.map(function() { return '<col style="width:65px">'; }).join('')
      + '<col style="width:74px"></colgroup>';

    const tgtTable = '<table style="border-collapse:collapse;width:100%;table-layout:fixed">'
      + colgroup + buildHeader()
      + '<tbody>' + tgtDataRows + tgtSumRow + tgtCumRow + '</tbody></table>';

    const actTable = '<table style="border-collapse:collapse;width:100%;table-layout:fixed">'
      + colgroup + buildHeader()
      + '<tbody>' + actDataRows + actSumRow + actCumRow + diffMonRow + diffCumRow + pctCumRow + annualPctRow + '</tbody></table>';

    // ── 표 ③: 사업별 월 진척률 (연간 계획 대비) ────────────
    // 셀 = 그 사업 그 월 실적(USD) / 그 사업 연간 계획(USD) × 100
    // 진척률 = 그 사업 누적 실적(USD) / 그 사업 연간 계획(USD) × 100
    // 계획대비 = 진척률 - 계획진척률(현재월까지 누적계획/연간계획). 신호등 ±2%p
    // 누적/연간목표금액 = 표시 단위(억원/M USD/M SGD)로 변환된 누적 실적 / 연간 목표
    const tgtByBizView = (isEcMode || !showEbit) ? revByBiz : ebitByBiz;
    function _tgtRawToUsd(raw) { return _rawToUsd(raw, mode); }
    var bizTgtAnnualRaw = {}, bizTgtAnnualUsd = {}, bizActCumUsd = {}, bizTgtCumUsd = {};
    var totalTgtAnnualRaw = 0, totalTgtAnnualUsd = 0, totalActCumUsd = 0, totalTgtCumUsd = 0;
    bizList.forEach(function(b) {
      var raw = (tgtByBizView[b] || []).reduce(function(s, v) { return s + (v || 0); }, 0);
      var usd = _tgtRawToUsd(raw);
      bizTgtAnnualRaw[b] = raw;
      bizTgtAnnualUsd[b] = usd;
      var cum = 0, tcum = 0;
      for (var i = 0; i <= curMonIdx && i < 12; i++) {
        cum  += (actByBizView[b][i] || 0);
        tcum += _tgtRawToUsd(tgtByBizView[b][i] || 0);
      }
      bizActCumUsd[b] = cum;
      bizTgtCumUsd[b] = tcum;
      totalTgtAnnualRaw += raw;
      totalTgtAnnualUsd += usd;
      totalActCumUsd   += cum;
      totalTgtCumUsd   += tcum;
    });

    // 계획대비 셀 HTML — 양수=빨강, 음수=파랑 (텍스트 색만)
    function _paceCell(diff) {
      if (diff === null) return '<td style="' + TS.tdSum + '">-</td>';
      var color = diff > 0 ? '#DC2626' : (diff < 0 ? '#1B4F8A' : '#222');
      var sign  = diff > 0 ? '+' : '';
      return '<td style="' + TS.tdSum + ';color:' + color + ';white-space:nowrap">' + sign + diff.toFixed(1) + '%p</td>';
    }

    var progressRows = bizList.map(function(b) {
      var tgtUsd = bizTgtAnnualUsd[b];
      var cells = MONTHS.map(function(_, i) {
        if (i > curMonIdx) return '<td style="' + TS.td + '">-</td>';
        var actUsd = actByBizView[b][i] || 0;
        if (actUsd <= 0) return '<td style="' + TS.td + '">-</td>';
        var disp = fmtActual(actUsd);
        return '<td style="' + TS.td + '">' + (disp || '-') + '</td>';
      }).join('');
      var pctCum     = tgtUsd > 0 ? bizActCumUsd[b] / tgtUsd * 100 : null;
      var pctExpect  = tgtUsd > 0 ? bizTgtCumUsd[b] / tgtUsd * 100 : null;
      var paceDiff   = (pctCum !== null && pctExpect !== null) ? (pctCum - pctExpect) : null;
      var actDisp = fmtActual(bizActCumUsd[b]);
      var tgtDisp = fmtRolling(bizTgtAnnualRaw[b]);
      return '<tr>'
        + '<td style="' + TS.tdL + ';font-weight:500">' + (CONFIG.BIZ_LABELS[b] || b) + '</td>'
        + cells
        + '<td style="' + TS.tdSum + '">' + (actDisp || '-') + ' / ' + (tgtDisp || '-') + '</td>'
        + '<td style="' + TS.tdSum + '">' + (pctCum !== null ? pctCum.toFixed(1) + '%' : '-') + '</td>'
        + _paceCell(paceDiff)
        + '</tr>';
    }).join('');

    var totalPctCum    = totalTgtAnnualUsd > 0 ? totalActCumUsd / totalTgtAnnualUsd * 100 : null;
    var totalPctExpect = totalTgtAnnualUsd > 0 ? totalTgtCumUsd / totalTgtAnnualUsd * 100 : null;
    var totalPaceDiff  = (totalPctCum !== null && totalPctExpect !== null) ? (totalPctCum - totalPctExpect) : null;

    var progressSumRow = '<tr style="background:#F2F2F2">'
      + '<td style="' + TS.tdSum + ';text-align:center">합계</td>'
      + MONTHS.map(function(_, i) {
          if (i > curMonIdx) return '<td style="' + TS.tdSum + '">-</td>';
          var monthActUsd = 0;
          bizList.forEach(function(b) { monthActUsd += actByBizView[b][i] || 0; });
          if (monthActUsd <= 0) return '<td style="' + TS.tdSum + '">-</td>';
          var disp = fmtActual(monthActUsd);
          return '<td style="' + TS.tdSum + '">' + (disp || '-') + '</td>';
        }).join('')
      + '<td style="' + TS.tdSum + '">' + (fmtActual(totalActCumUsd) || '-') + ' / ' + (fmtRolling(totalTgtAnnualRaw) || '-') + '</td>'
      + '<td style="' + TS.tdSum + '">' + (totalPctCum !== null ? totalPctCum.toFixed(1) + '%' : '-') + '</td>'
      + _paceCell(totalPaceDiff)
      + '</tr>';

    const progressColgroup = '<colgroup><col style="width:100px">'
      + MONTHS.map(function() { return '<col style="width:65px">'; }).join('')
      + '<col style="width:150px"><col style="width:74px"><col style="width:130px"></colgroup>';

    const progressHeader = '<thead><tr>'
      + '<th style="' + TS.thBiz + '">Biz</th>'
      + MONTHS.map(function(m) { return '<th style="' + TS.thMon + '">' + m + '</th>'; }).join('')
      + '<th style="' + TS.thSum + ';width:150px">누적 실적/연간계획 (' + unitLabel + ')</th>'
      + '<th style="' + TS.thSum + '">달성률</th>'
      + '<th style="' + TS.thSum + ';width:130px">달성률 Gap(실적-계획)</th>'
      + '</tr></thead>';

    const progressTable = '<table style="border-collapse:collapse;width:100%;table-layout:fixed">'
      + progressColgroup + progressHeader
      + '<tbody>' + progressRows + progressSumRow + '</tbody></table>';

    // ── 엑셀 내보내기 데이터 캐시 (raw 값 저장) ─────────────
    _exportCache = {
      year: _year, mode, isEcMode,
      hasRate: !!_exchangeRate,
      exchangeRate: _exchangeRate,
      curMonIdx,
      bizList: bizList.slice(),
      revByBiz:     Object.assign({}, revByBiz),
      ebitByBiz:    Object.assign({}, ebitByBiz),
      revSumRaw,  ebitSumRaw,
      revCumRaw,  ebitCumRaw,
      actRevByBiz:  Object.assign({}, actRevByBiz),
      actEbitByBiz: Object.assign({}, actEbitByBiz),
      actRevSumUsd,  actEbitSumUsd,
      actRevCumUsd,  actEbitCumUsd,
    };

    // ── 사업별 종합 표 (매출 · Material Cost · Material Profit) ──
    // KPI-7월 전용. 한 사업 블록에 3개 지표를 붙여 한눈에 보이게 한다.
    // 지난 달까지는 실적(진한 글씨), 이후는 계획(흐린 글씨) — 경계에 세로선.
    var comboTable = '';
    if (_isMpMode(mode)) {
      var CB = {
        wrap:   'border-collapse:collapse;table-layout:fixed;font-family:Pretendard,sans-serif',
        thMon:  'padding:6px 4px;text-align:center;font-size:12px;font-weight:600;color:#3A3A3C;background:#E8E8ED;border:1px solid #C7C7CC;width:66px;white-space:nowrap',
        thBiz:  'padding:6px 8px;text-align:left;font-size:12px;font-weight:600;color:#3A3A3C;background:#E8E8ED;border:1px solid #C7C7CC;width:132px;white-space:nowrap',
        thSum:  'padding:6px 6px;text-align:center;font-size:12px;font-weight:600;color:#3A3A3C;background:#DCDCE1;border:1px solid #C7C7CC;width:82px;white-space:nowrap',
        bizHd:  'padding:6px 10px;text-align:left;font-size:12.5px;font-weight:700;color:#1D1D1F;background:#F0F0F2;border:1px solid #C7C7CC;white-space:nowrap',
        lbl:    'padding:4px 10px;text-align:left;font-size:12px;border:1px solid #D8D8DC;white-space:nowrap;color:#3A3A3C',
        cell:   'padding:4px 5px;text-align:right;font-size:12px;font-family:var(--font-mono);border:1px solid #E3E3E6',
        sum:    'padding:4px 6px;text-align:right;font-size:12px;font-family:var(--font-mono);font-weight:600;border:1px solid #C7C7CC;background:#F5F5F7',
      };
      var edge = closedIdx >= 0 && closedIdx < 11 ? ';border-right:2px solid #8E8E93' : '';
      var fmtCell = function(v) { return v ? (Math.abs(v) < 0.005 ? '0.01' : v.toFixed(2)) : '—'; };

      // 지표 행 하나
      var metricRow = function(label, vals, opt) {
        opt = opt || {};
        var cells = vals.map(function(v, i) {
          var isAct = i <= curMonIdx;
          var style = CB.cell
            + (i === closedIdx ? edge : '')
            + (isAct ? ';color:#1D1D1F' : ';color:#A1A1A6')
            + (opt.strong ? ';font-weight:700' : '')
            + (opt.bg ? ';background:' + opt.bg : '');
          return '<td style="' + style + '">' + (opt.minus && v ? '−' : '') + fmtCell(v) + '</td>';
        }).join('');
        var total = vals.reduce(function(s, v) { return s + (v || 0); }, 0);
        return '<tr>'
          + '<td style="' + CB.lbl + (opt.strong ? ';font-weight:700;color:#1D1D1F' : '')
          + (opt.bg ? ';background:' + opt.bg : '') + '">' + label + '</td>'
          + cells
          + '<td style="' + CB.sum + (opt.strong ? ';font-weight:700' : '') + '">' + (opt.minus && total ? '−' : '') + fmtCell(total) + '</td>'
          + '<td style="' + CB.sum + '">' + (opt.plan === undefined ? '' : fmtCell(opt.plan)) + '</td>'
          + '<td style="' + CB.sum + (opt.diff !== undefined && opt.diff ? ';color:' + diffColor(opt.diff) : '') + '">'
          + (opt.diff === undefined ? '' : fmtDiff(opt.diff)) + '</td>'
          + '</tr>';
      };

      // 사업별 블록 — 매출 / Material Cost / Material Profit
      var comboBody = bizList.map(function(b) {
        var revVals = MONTHS.map(function(_, i) {
          return i <= curMonIdx ? actToDispNum(actRevByBiz[b][i] || 0) : rawToDisp(revByBiz[b][i]);
        });
        var mcVals  = _getMcMonths(year, b).map(function(v) { return rawToDisp(v); });
        var mpVals  = MONTHS.map(function(_, i) {
          return i <= curMonIdx ? actToDispNum(actEbitByBiz[b][i] || 0) : rawToDisp(ebitByBiz[b][i]);
        });
        var revPlan = revByBiz[b].reduce(function(s, v) { return s + rawToDisp(v); }, 0);
        var mpPlan  = ebitByBiz[b].reduce(function(s, v) { return s + rawToDisp(v); }, 0);
        var revTot  = revVals.reduce(function(s, v) { return s + v; }, 0);
        var mpTot   = mpVals.reduce(function(s, v) { return s + v; }, 0);
        if (!revTot && !mpTot && !revPlan && !mpPlan) return '';   // 실적·계획 모두 없는 사업은 숨김

        return '<tr><td colspan="' + (MONTHS.length + 4) + '" style="' + CB.bizHd + '">'
             + (CONFIG.BIZ_LABELS[b] || b)
             + '<span style="font-weight:400;color:#86868B;font-size:11.5px;margin-left:8px">MP ' + fmtCell(mpTot) + ' / 계획 ' + fmtCell(mpPlan) + ' ' + unitLabel + '</span>'
             + '</td></tr>'
          + metricRow('매출', revVals, { plan: revPlan, diff: revTot - revPlan })
          + metricRow('Material Cost', mcVals, { minus: true })
          + metricRow('Material Profit', mpVals, { strong: true, bg: '#F7F7F9', plan: mpPlan, diff: mpTot - mpPlan });
      }).join('');

      // 전체 합계 블록
      var sumOf = function(fn) { return MONTHS.map(function(_, i) { return bizList.reduce(function(s, b) { return s + fn(b, i); }, 0); }); };
      var tRev = sumOf(function(b, i) { return i <= curMonIdx ? actToDispNum(actRevByBiz[b][i] || 0) : rawToDisp(revByBiz[b][i]); });
      var tMc  = sumOf(function(b, i) { return rawToDisp(_getMcMonths(year, b)[i]); });
      var tMp  = sumOf(function(b, i) { return i <= curMonIdx ? actToDispNum(actEbitByBiz[b][i] || 0) : rawToDisp(ebitByBiz[b][i]); });
      var tRevPlan = bizList.reduce(function(s, b) { return s + revByBiz[b].reduce(function(a, v) { return a + rawToDisp(v); }, 0); }, 0);
      var tMpPlan  = bizList.reduce(function(s, b) { return s + ebitByBiz[b].reduce(function(a, v) { return a + rawToDisp(v); }, 0); }, 0);
      var tRevTot  = tRev.reduce(function(s, v) { return s + v; }, 0);
      var tMpTot   = tMp.reduce(function(s, v) { return s + v; }, 0);

      comboBody += '<tr><td colspan="' + (MONTHS.length + 4) + '" style="' + CB.bizHd + ';background:#DCDCE1">전체 합계</td></tr>'
        + metricRow('매출', tRev, { plan: tRevPlan, diff: tRevTot - tRevPlan, bg: '#FAFAFC' })
        + metricRow('Material Cost', tMc, { minus: true, bg: '#FAFAFC' })
        + metricRow('Material Profit', tMp, { strong: true, bg: '#EFEFF4', plan: tMpPlan, diff: tMpTot - tMpPlan });

      comboTable = '<div style="margin-bottom:14px">'
        + '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px;flex-wrap:wrap">'
        + '<div style="font-size:13px;font-weight:700;color:var(--tx2);font-family:Pretendard,sans-serif;padding:5px 2px;letter-spacing:.05em">'
        + '① 사업별 종합 — 매출 · Material Cost · Material Profit (' + unitLabel + ')</div>'
        + '<span style="font-size:11px;color:var(--tx3);font-family:Pretendard,sans-serif">'
        + '<b style="color:#1D1D1F">진한 값</b> = 실적(' + (curMonIdx >= 0 ? (curMonIdx + 1) + '월' : '없음') + '까지) · '
        + '<span style="color:#A1A1A6">흐린 값</span> = 계획 · 합계는 실적+잔여계획</span>'
        + '</div>'
        + '<div style="overflow-x:auto;border:1px solid #C7C7CC;border-radius:4px">'
        + '<table style="' + CB.wrap + '"><thead><tr>'
        + '<th style="' + CB.thBiz + '">사업 / 지표</th>'
        + MONTHS.map(function(m, i) { return '<th style="' + CB.thMon + (i === closedIdx ? edge : '') + '">' + m + '</th>'; }).join('')
        + '<th style="' + CB.thSum + '">합계</th><th style="' + CB.thSum + '">연간계획</th><th style="' + CB.thSum + '">차이</th>'
        + '</tr></thead><tbody>' + comboBody + '</tbody></table></div></div>';
    }

    // ── 연말 추정(LE) 표 ─────────────────────────────────────
    // 마감월까지 실적 / 이후 전망(없으면 베이스라인) — 출처를 셀 배경으로 구분
    var leTableHtml = '';
    if (isLe) {
      var SRC_BG = { act: '#FFFFFF', fc: '#EEF4FB', base: '#F7F7F7' };
      var leRows = bizList.map(function(b) {
        var ms = leByBiz[b];
        var cells = ms.map(function(m) {
          return '<td style="' + TS.td + ';background:' + SRC_BG[m.src] + '">'
            + (m.v ? m.v.toFixed(2) : '—') + '</td>';
        }).join('');
        var rowTotal = ms.reduce(function(s, m) { return s + m.v; }, 0);
        var baseTot  = (showEbit ? ebitByBiz[b] : revByBiz[b]).reduce(function(s, v) { return s + rawToDisp(v); }, 0);
        return '<tr>'
          + '<td style="' + TS.tdL + ';font-weight:500">' + (CONFIG.BIZ_LABELS[b] || b) + '</td>'
          + '<td style="' + TS.tdSub + '">연말 추정</td>'
          + cells
          + '<td style="' + TS.tdSum + '">' + rowTotal.toFixed(2) + '</td>'
          + '<td style="' + TS.tdSum + '">' + baseTot.toFixed(2) + '</td>'
          + '<td style="' + TS.tdSum + ';color:' + diffColor(rowTotal - baseTot) + '">' + fmtDiff(rowTotal - baseTot) + '</td>'
          + '</tr>';
      }).join('');
      var leSumCells = leSum.map(function(v, i) {
        return '<td style="' + TS.tdCum + '">' + (v ? v.toFixed(2) : '—') + '</td>';
      }).join('');
      leTableHtml = '<div style="margin-bottom:4px">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:5px;flex-wrap:wrap">'
        + '<div style="font-size:13px;font-weight:700;color:var(--tx2);font-family:Pretendard,sans-serif;padding:5px 2px;letter-spacing:.05em">'
        + '§LE§ 연말 추정 — 실적 ' + (closedIdx >= 0 ? (closedIdx + 1) + '월' : '없음') + '까지 + 잔여월 전망 (' + unitLabel + ')'
        + '</div>'
        + '<span style="font-size:11px;color:var(--tx3);font-family:Pretendard,sans-serif">'
        + '<span style="display:inline-block;width:9px;height:9px;background:#FFFFFF;border:1px solid #BFBFBF;vertical-align:-1px"></span> 실적 '
        + '<span style="display:inline-block;width:9px;height:9px;background:#EEF4FB;border:1px solid #BFBFBF;vertical-align:-1px;margin-left:8px"></span> 전망 '
        + '<span style="display:inline-block;width:9px;height:9px;background:#F7F7F7;border:1px solid #BFBFBF;vertical-align:-1px;margin-left:8px"></span> 전망 미입력(계획값 사용)</span>'
        + (leVintage
            ? '<span style="font-size:11px;color:var(--tx3);font-family:Pretendard,sans-serif">제출 회차 ' + leVintage + '</span>'
            : '<span style="font-size:11px;color:#B45309;font-family:Pretendard,sans-serif">전망 미입력 — 잔여월은 베이스라인 계획으로 표시됩니다</span>')
        + '</div>'
        + '<div style="overflow-x:auto;margin-bottom:8px;border:1px solid #999;border-radius:4px">'
        + '<table style="border-collapse:collapse;table-layout:fixed"><thead><tr>'
        + '<th style="' + TS.thBiz + '">Biz</th><th style="' + TS.thSub + '">구분</th>'
        + MONTHS.map(function(m) { return '<th style="' + TS.thMon + '">' + m + '</th>'; }).join('')
        + '<th style="' + TS.thSum + '">연말 추정</th><th style="' + TS.thSum + '">계획(기준)</th><th style="' + TS.thSum + '">차이</th>'
        + '</tr></thead><tbody>' + leRows
        + '<tr><td style="' + TS.tdCumL + ';font-weight:600">합계</td><td style="' + TS.tdCumL + '">연말 추정</td>'
        + leSumCells
        + '<td style="' + TS.tdCum + '">' + leTotal.toFixed(2) + '</td>'
        + '<td style="' + TS.tdCum + '">' + leBaseTotal.toFixed(2) + '</td>'
        + '<td style="' + TS.tdCum + ';color:' + diffColor(leDiff) + '">' + fmtDiff(leDiff) + '</td></tr>'
        + '</tbody></table></div></div>';
    }

    // ── 최종 렌더 ────────────────────────────────────────────
    // 표 번호는 표시되는 표 순서대로 자동 부여
    var _secNo = 0;
    var secN = function() { _secNo++; return ['①','②','③','④','⑤'][_secNo - 1] + ' '; };
    if (comboTable) secN();       // 종합표가 ① 을 이미 사용
    if (leTableHtml) secN();      // 연말 추정 표가 그 다음 번호 사용
    leTableHtml = leTableHtml.replace('§LE§', comboTable ? '②' : '①');
    el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">' + cards + '</div>'
      + chart1Html
      + comboTable
      + leTableHtml
      + '<div style="margin-bottom:4px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">'
      + '<div style="font-size:13px;font-weight:700;color:var(--tx2);font-family:Pretendard,sans-serif;padding:5px 2px;letter-spacing:.05em">'
      + secN() + (showEbit ? profitLabel + ' 계획 표' : '매출 계획 표') + ' — ' + _modeLabel(mode)
      + '</div>'
      + '<button onclick="Pages.KpiTarget.downloadTracking()" style="font-size:13px;font-family:Pretendard,sans-serif;cursor:pointer;padding:5px 14px;background:#1B4F8A;color:#fff;border:none;border-radius:4px;font-weight:600">↓ 엑셀 다운로드</button>'
      + '</div>'
      + '<div style="overflow-x:auto;margin-bottom:8px;border:1px solid #999;border-radius:4px">' + tgtTable + '</div>'
      + '</div>'
      + '<div style="margin-bottom:4px">'
      + '<div style="font-size:13px;font-weight:700;color:var(--tx2);font-family:Pretendard,sans-serif;padding:5px 2px;letter-spacing:.05em">'
      + secN() + (showEbit ? profitLabel + ' 실적 표' : '매출 실적 표') + ' (실적 · 달성률 포함)'
      + '</div>'
      + '<div style="overflow-x:auto;margin-bottom:8px;border:1px solid #999;border-radius:4px">' + actTable + '</div>'
      + '</div>'
      + '<div style="margin-bottom:4px">'
      + '<div style="font-size:13px;font-weight:700;color:var(--tx2);font-family:Pretendard,sans-serif;padding:5px 2px;letter-spacing:.05em">'
      + secN() + '사업별 월 실적 — ' + (showEbit ? profitLabel : '매출') + ' 기준 (' + unitLabel + ')'
      + '</div>'
      + '<div style="overflow-x:auto;margin-bottom:4px;border:1px solid #999;border-radius:4px">' + progressTable + '</div>'
      + '</div>';

    // ================================================================
    // 차트 렌더 — EBIT 누적 1개
    // ================================================================
    setTimeout(function() {

      // 값 → 표시단위 변환
      function toDisp(v) {
        if (v === null) return null;
        if (isEcMode) return v / 1000000;                            // M USD
        if (useKrw)   return v * _exchangeRate / 100000000;          // 억원
        if (useSgd)   return v * _SGD_RATE / 1000000;                // M SGD
        return v / 1000000;                                           // M USD
      }
      function fmtTick(v) {
        if (v === null || v === undefined || isNaN(v)) return '';
        if (useKrw)  return v.toFixed(1) + '억';
        if (useSgd)  return v.toFixed(1) + 'S';
        return v.toFixed(1) + 'M';
      }
      function fmtTooltip(v, label) {
        if (v === null || v === undefined) return null;
        var unit = isEcMode ? ' M USD' : (useKrw ? '억원' : useSgd ? ' M SGD' : ' M USD');
        return ' ' + label + ': ' + Number(v).toFixed(2) + unit;
      }
      function makeChartOptions(tooltipFn, tickFn, yMax) {
        var yOpts = { grid:{color:'rgba(0,0,0,0.05)'}, ticks:{color:'#9aa0ad',font:{size:13},callback:tickFn}, beginAtZero:true };
        if (yMax != null) yOpts.max = yMax;
        return {
          responsive:true, maintainAspectRatio:false,
          plugins:{
            legend:{display:false},
            tooltip:{mode:'index',intersect:false,callbacks:{label:tooltipFn}}
          },
          scales:{
            x:{grid:{display:false},ticks:{color:'#9aa0ad',font:{size:13},autoSkip:false}},
            y: yOpts
          },
          layout:{padding:{top:8}}
        };
      }
      function destroyAndCreate(id, config) {
        var key = '_chart_' + id;
        if (window[key]) { window[key].destroy(); window[key] = null; }
        var canvas = document.getElementById(id);
        if (!canvas) return;
        window[key] = new Chart(canvas, config);
      }

      // ── EBIT 누적 차트 ─────────────────────────────────────
      // 목표: 롤링 EBIT raw(억원 or M USD) → 표시 단위로 직접 변환
      // 실적: 매출(USD) × Factor = EBIT(USD) → 표시 단위로 변환
      // 표시 단위: KPI+억원 → 억원, KPI+M USD → M USD, EC → M USD
      var ebitTgtCum = [], ebitActCum = [];
      var et = 0, ea = 0;

      MONTHS.forEach(function(_, i) {
        // 목표 누적: EC=매출(revSumRaw), KPI+EBIT=ebitSumRaw, KPI+매출=revSumRaw
        var rawVal = isEcMode ? revSumRaw[i] : (!showEbit ? revSumRaw[i] : ebitSumRaw[i]);
        et += rawVal;
        var etDisp = _rawToDispUnit(et, mode, useKrw ? 'krw' : useSgd ? 'sgd' : 'usd');
        ebitTgtCum.push(etDisp === null ? et : etDisp);

        // 실적 누적: 표와 동일한 기준
        if (i <= curMonIdx) {
          var actUsd = bizList.reduce(function(s, b) {
            if (isEcMode || !showEbit) return s + _getActualMonth(year, b, i + 1);
            return s + _getActualProfitMonth(year, b, i + 1, mode);
          }, 0);
          ea += actUsd;
          if (isEcMode)    ebitActCum.push(ea / 1000000);
          else if (useKrw) ebitActCum.push(ea * _exchangeRate / 100000000);
          else if (useSgd) ebitActCum.push(ea * _SGD_RATE / 1000000);        // M SGD
          else             ebitActCum.push(ea / 1000000);
        } else {
          ebitActCum.push(null);
        }
      });

      // 연말 추정(LE) 누적 — 실적+전망을 이어붙인 한 줄
      var leCum = null;
      if (isLe) {
        var run = 0;
        leCum = leSum.map(function(v) { run += v; return run; });
      }

      // y축: 데이터 최대값 기준으로 적절한 최대값 설정
      var allVals = ebitTgtCum.concat(ebitActCum).concat(leCum || []).filter(function(v) { return v !== null && v > 0; });
      var dataMax = allVals.length > 0 ? Math.max.apply(null, allVals) : 10;
      var yMax    = dataMax * 1.3;

      destroyAndCreate('cv-ebit-cum', {
        type: 'line',
        data: { labels: MONTHS, datasets: [
          { label: chartLabel + ' 계획 누적', data:ebitTgtCum,
            borderColor:'#85B7EB', borderWidth:2, borderDash:[5,3],
            pointRadius:3, pointBackgroundColor:'#85B7EB', fill:false, tension:0 },
          { label: chartLabel + ' 실적 누적', data:ebitActCum,
            borderColor:'#1D9E75', borderWidth:2.5,
            pointRadius:ebitActCum.map(function(v){return v!==null?4:0;}),
            pointBackgroundColor:'#1D9E75',
            fill:{target:0,above:'rgba(29,158,117,0.08)',below:'rgba(226,75,74,0.08)'},
            tension:0.2 },
        ].concat(leCum ? [
          { label: '연말 추정 누적', data:leCum,
            borderColor:'#1D1D1F', borderWidth:2, borderDash:[2,2],
            pointRadius:2, pointBackgroundColor:'#1D1D1F', fill:false, tension:0 },
        ] : [])},
        options: makeChartOptions(
          function(ctx) { return fmtTooltip(ctx.raw, ctx.dataset.label); },
          function(v)   { return fmtTick(v); },
          yMax
        )
      });

    }, 50);
  }

  // ── 단위/지표 전역 토글 헬퍼 ─────────────────────────────
  function _unitCtx() {
    const mode    = _rollingMode;
    const isKpiM  = _isKpi(mode);
    const hasRate = isKpiM && _exchangeRate > 0;
    const tunit   = isKpiM ? _trackingUnit : 'usd';   // EC는 항상 M USD
    const useEbit = isKpiM && _tableView === 'ebit';  // EC는 항상 매출
    const unitLabel  = !isKpiM ? 'M USD'
      : (tunit === 'krw' ? '억원' : tunit === 'sgd' ? 'M SGD' : 'M USD');
    const basisLabel = useEbit ? _profitLabel(mode) : '매출';
    return { mode, isKpiM, hasRate, tunit, useEbit, unitLabel, basisLabel };
  }
  // 롤링 raw(억원/M USD) → 표시 단위 숫자
  function _tgtToDisp(raw, ctx) {
    return _rawToDispUnit(raw, ctx.mode, ctx.tunit);
  }
  // 실적 USD → 표시 단위 숫자
  function _actToDisp(usd, ctx) {
    if (!ctx.isKpiM)         return usd / 1000000;    // M USD
    if (ctx.tunit === 'krw') return ctx.hasRate ? usd * _exchangeRate / 100000000 : null;
    if (ctx.tunit === 'sgd') return usd * 1.27 / 1000000;
    return usd / 1000000;                              // M USD
  }
  // 롤링 raw → USD (달성률 계산용)
  function _tgtToUsd(raw, ctx) {
    return _rawToUsd(raw, ctx.mode);
  }
  // 상단 단위/지표 토글 바 (KPI 모드 전용)
  function _buildUnitBar() {
    const c = _unitCtx();
    if (!c.isKpiM) return '';
    const seg = (active, fn, label, disabled) =>
      '<button onclick="' + fn + '"' + (disabled ? ' disabled' : '')
      + ' style="padding:5px 16px;border:none;font-size:13px;font-weight:600;'
      + 'font-family:Pretendard,sans-serif;cursor:' + (disabled ? 'not-allowed' : 'pointer') + ';'
      + 'background:' + (active ? '#1D1D1F' : '#fff') + ';color:' + (active ? '#fff' : '#555') + ';'
      + (disabled ? 'opacity:0.4;' : '') + '">' + label + '</button>';
    return '<div style="display:flex;align-items:center;gap:18px;margin-bottom:16px;flex-wrap:wrap">'
      + '<div style="display:flex;align-items:center;gap:8px">'
      + '<span style="font-size:13px;color:var(--tx2);font-weight:500;font-family:Pretendard,sans-serif">단위:</span>'
      + '<div style="display:flex;border:1px solid #CCC;border-radius:6px;overflow:hidden">'
      + seg(c.tunit==='usd', "Pages.KpiTarget.setTrackingUnit('usd')", 'M USD', false)
      + seg(c.tunit==='krw', "Pages.KpiTarget.setTrackingUnit('krw')", '억원', !c.hasRate)
      + seg(c.tunit==='sgd', "Pages.KpiTarget.setTrackingUnit('sgd')", 'M SGD', false)
      + '</div>'
      + '<span style="font-size:13px;color:var(--tx3);font-family:Pretendard,sans-serif">'
      + c.unitLabel
      + (c.tunit==='krw' && c.hasRate ? ' · ₩' + _exchangeRate.toLocaleString() + '/USD' : '')
      + (c.tunit==='sgd' ? ' · 1.27 SGD/USD (계획환율)' : '')
      + '</span></div>'
      + '<div style="display:flex;align-items:center;gap:8px">'
      + '<span style="font-size:13px;color:var(--tx2);font-weight:500;font-family:Pretendard,sans-serif">지표:</span>'
      + '<div style="display:flex;border:1px solid #CCC;border-radius:6px;overflow:hidden">'
      + seg(c.useEbit,  "Pages.KpiTarget.setTableView('ebit')", _profitLabel(c.mode), false)
      + seg(!c.useEbit, "Pages.KpiTarget.setTableView('rev')",  '매출', false)
      + '</div></div>'
      + '</div>';
  }

  // ── 메인 렌더 ─────────────────────────────────────────────
  return {
    selectYear, switchBiz,

    getTarget:        (year,biz,mode='kpi67')        => _getTarget(year,biz,mode),
    getTotalTarget:   (year,mode='kpi67')            => _getTotalTarget(year,mode),
    getTotalRevenueTarget: (year,mode='kpi103')      => _getTotalRevenueTarget(year,mode),
    getMonthlyTarget: (year,biz,month,mode='kpi67')  => _getMonthlyTarget(year,biz,month,mode),
    getExchangeRate:  ()                             => _exchangeRate,
    getFactor:        (biz)                          => _getFactor(biz),
    getActualProfit:  (year,biz,mode)                => _getActualProfit(year,biz,mode),
    loadFromSettings: ()                             => _loadFromSettings(),

    getBizSummary(year, biz, mode='kpi67') {
      const hasRate = _exchangeRate > 0;
      const tgt = _getTarget(year, biz, mode);
      if (!tgt) return null;
      const actUsd = _getActualProfit(year, biz, mode);
      const actKrw = hasRate ? actUsd * _exchangeRate : null;
      // 계획 저장 단위와 실적 단위를 맞춘다 (EC·KPI-7월 = USD, 그 외 = 원)
      const actInTgtUnit = _isUsdRaw(mode) ? actUsd : (hasRate ? actKrw : actUsd);
      const pctRaw = tgt > 0 ? actInTgtUnit / tgt * 100 : 0;
      const pct = Math.min(100, Math.round(pctRaw));
      return { tgt, act: actInTgtUnit, actUsd, pct, pctRaw, hasRate };
    },

    getKpiSummary(year) {
      const hasRate = _exchangeRate > 0;
      const tgtRaw  = _getTotalTarget(year, 'kpi67');
      if (tgtRaw <= 0) return { tgt:null, act:null, pct:null, hasRate, unit:hasRate?'krw':'usd' };
      const actKrw = hasRate ? CONFIG.BIZ_LIST.reduce((s,b)=>s+_getActualProfit(year,b,'kpi67')*_exchangeRate,0) : null;
      const actUsd = CONFIG.BIZ_LIST.reduce((s,b)=>s+_getActualProfit(year,b,'kpi67'),0);
      const pct = tgtRaw > 0 ? Math.min(100,Math.round((hasRate?actKrw:actUsd)/tgtRaw*100)) : null;
      return { tgt:tgtRaw, act:hasRate?actKrw:actUsd, pct, hasRate, unit:hasRate?'krw':'usd' };
    },

    render() {
      const el = document.getElementById('kpitarget-body'); if (!el) return;
      const year = _year;
      const mode = _rollingMode;
      const isKpiM  = _isKpi(mode);
      const hasRate = isKpiM && _exchangeRate > 0;
      const mc      = _modeColor(mode);
      const ml      = _modeLabel(mode);

      // ── 단위/지표 컨텍스트 (전역 토글) ───────────────────
      const ctx    = _unitCtx();
      const uLabel = ctx.unitLabel;     // '억원' | 'M USD' | 'M SGD'
      const basis  = ctx.basisLabel;    // 'EBIT' | '매출'
      const _store = _getRollingStore(mode);

      // 사업별 목표 raw (KPI=억원 / EC=M USD)
      const _bizTgtRaw = b => {
        if (!isKpiM) return _getRollingEbitRaw(_store, year, b).reduce((s,v)=>s+v,0);
        const arr = ctx.useEbit ? _getRollingEbitRaw(_store, year, b)
                                : _getRollingRevRaw(_store, year, b);
        return arr.reduce((s,v)=>s+v,0);
      };
      // 사업별 실적 USD (이익 지표면 모드별 이익 계산 적용)
      const _bizActUsd = b => ctx.useEbit ? _getActualProfit(year, b, mode) : _getActual(year, b);
      const _fmtN = n => (n===null||n===undefined||isNaN(n)) ? '—' : Number(n).toFixed(2);

      const bizRows = CONFIG.BIZ_LIST.map(b => {
        const tgtRaw  = _bizTgtRaw(b);
        const actUsd  = _bizActUsd(b);
        const tgtDisp = _tgtToDisp(tgtRaw, ctx);
        const actDisp = _actToDisp(actUsd, ctx);
        const tgtUsd  = _tgtToUsd(tgtRaw, ctx);
        const pct     = tgtUsd>0 ? Math.min(100, Math.round(actUsd/tgtUsd*100)) : 0;
        const remDisp = (tgtDisp!==null && actDisp!==null) ? Math.max(0, tgtDisp-actDisp) : null;
        const factor  = _getFactor(b);
        const mcUsd   = _getMcUsdYear(year, b);   // kpi7 전용 표기
        const barClr  = '#4B5563';
        const canBar  = tgtRaw>0 && tgtDisp!==null && actDisp!==null;

        const fmtTgt = () => !tgtRaw
          ? '<span style="color:var(--tbl-tx-body);font-weight:400">미입력</span>'
          : `<div style="font-weight:600">${_fmtN(tgtDisp)}</div>`;
        const fmtAct = () => actUsd>0
          ? `<div style="font-weight:600">${_fmtN(actDisp)}</div><div style="font-size:10px;color:#aaa">$${formatNumber(Math.round(actUsd))}</div>`
          : '—';
        const fmtRem = () => !tgtRaw ? '—' : _fmtN(remDisp);

        return `<tr style="border-top:1px solid var(--tbl-row-bd)">
          <td style="padding:12px 14px;font-family:Pretendard,sans-serif;font-size:13px">
            <span style="font-size:13px;font-weight:500;color:var(--tx);font-family:Pretendard,sans-serif">${CONFIG.BIZ_LABELS[b]}</span>
            ${isKpiM&&ctx.useEbit?(_isMpMode(mode)
              ? `<span style="font-size:11px;color:var(--tx3);margin-left:5px;font-family:Pretendard,sans-serif">− MC $${formatNumber(Math.round(mcUsd))}</span>`
              : `<span style="font-size:11px;color:var(--tx3);margin-left:5px;font-family:Pretendard,sans-serif">×${factor}</span>`):''}
          </td>
          <td style="padding:12px 14px;text-align:right;font-family:Pretendard,sans-serif;font-size:13px">${fmtTgt()}</td>
          <td style="padding:12px 14px;text-align:right;font-family:Pretendard,sans-serif;font-size:13px;color:var(--tx)">${fmtAct()}</td>
          <td style="padding:12px 14px;min-width:160px">
            ${canBar?`<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:6px;background:var(--bd);border-radius:3px;overflow:hidden"><div style="height:100%;border-radius:3px;background:${barClr};width:${pct}%"></div></div><span style="font-size:13px;font-weight:600;color:${barClr};min-width:36px;text-align:right;font-family:Pretendard,sans-serif">${pct}%</span></div>`:isKpiM?'<span style="font-size:12px;color:#999;font-family:Pretendard,sans-serif">환율 입력 필요</span>':'<span style="font-size:13px;color:var(--tbl-tx-body);font-family:Pretendard,sans-serif">롤링 필요</span>'}
          </td>
          <td style="padding:12px 14px;text-align:right;font-family:Pretendard,sans-serif;font-size:13px;color:var(--tx)">${fmtRem()}</td>
        </tr>`;
      }).join('');

      const totalTgtRaw  = CONFIG.BIZ_LIST.reduce((s,b)=>s+_bizTgtRaw(b),0);
      const totalActUsd  = CONFIG.BIZ_LIST.reduce((s,b)=>s+_bizActUsd(b),0);
      const totalTgtUsd  = _tgtToUsd(totalTgtRaw, ctx);
      const totalTgtDisp = _tgtToDisp(totalTgtRaw, ctx);
      const totalActDisp = _actToDisp(totalActUsd, ctx);
      const totalTgt     = totalTgtRaw;
      const totalPct     = totalTgtUsd>0 ? Math.min(100, totalActUsd/totalTgtUsd*100) : 0;
      const totalPctFmt  = totalPct.toFixed(1) + '%';
      const totalRemDisp = (totalTgtDisp!==null && totalActDisp!==null) ? Math.max(0, totalTgtDisp-totalActDisp) : null;

      const yearTabs=[year-1,year,year+1].map(y=>{
        const active=y===year;
        return `<button onclick="Pages.KpiTarget.selectYear(${y})" style="padding:4px 14px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;border:1.5px solid;transition:.15s;${active?'background:#1D1D1F;color:#fff;border-color:#1D1D1F':'background:none;color:var(--tx2);border-color:var(--bd2)'}">${y}년</button>`;
      }).join('');

      const TH  = l=>`<th style="padding:10px 14px;text-align:center;font-size:13px;font-weight:600;font-family:Pretendard,sans-serif;color:var(--tbl-hd-tx);background:var(--tbl-hd-bg);border-bottom:1px solid var(--tbl-hd-bd);white-space:nowrap">${l}</th>`;
      const THR = l=>`<th style="padding:10px 14px;text-align:center;font-size:13px;font-weight:600;font-family:Pretendard,sans-serif;color:var(--tbl-hd-tx);background:var(--tbl-hd-bg);border-bottom:1px solid var(--tbl-hd-bd);white-space:nowrap">${l}</th>`;
      const tgtHeader = `계획 ${basis} (${uLabel})`;
      const actHeader = `누적 ${basis} (${uLabel})`;

      const bizBtns=[{key:'all',label:'전체',color:'#1B4F8A'},...CONFIG.BIZ_LIST.map(b=>({key:b,label:CONFIG.BIZ_LABELS[b],color:CONFIG.BIZ_COLORS[b]}))].map(({key,label,color})=>{
        const on=_bizSet.has(key);
        return `<button id="kpi-biz-${key}" onclick="Pages.KpiTarget.switchBiz('${key}')" style="padding:5px 14px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;border:1.5px solid ${color};background:${on?color:'none'};color:${on?'#fff':color};transition:.15s">${label}</button>`;
      }).join('');

      // 모드 버튼 색상
      // 기준 선택 버튼: 경계 구분, 폰트 검은색
      const mBtn = (m, label) => {
        const on = mode===m;
        return `<button onclick="Pages.KpiTarget.setMode('${m}')" style="padding:6px 16px;border-right:1px solid #CCC;border-top:none;border-bottom:none;border-left:none;font-size:13px;font-weight:${on?'700':'400'};cursor:pointer;font-family:Pretendard,sans-serif;background:${on?'#1D1D1F':'#fff'};color:${on?'#fff':'#333'};transition:.15s">${label}</button>`;
      };

      // 관리자 버튼 스타일 (심플)
      const adminBtnStyle = 'padding:5px 11px;border:1px solid #CCC;border-radius:4px;background:#FAFAFA;color:#555;font-size:12px;cursor:pointer;font-family:Pretendard,sans-serif';

      el.innerHTML=`<div style="max-width:1200px">
        <!-- ① 기준 선택 + 관리자 버튼 (심플) -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:13px;color:var(--tx2);font-weight:500;font-family:Pretendard,sans-serif">기준:</span>
              <div style="display:flex;border:1px solid #CCC;border-radius:6px;overflow:hidden">
                ${mBtn('kpi7','KPI-7월')}
                ${mBtn('kpi67','KPI(67억)')}
                ${mBtn('kpi103','KPI(103억)')}
                <button onclick="Pages.KpiTarget.setMode('ec')" style="padding:6px 14px;border:none;font-size:12px;font-weight:${mode==='ec'?'700':'400'};cursor:pointer;font-family:Pretendard,sans-serif;background:${mode==='ec'?'#1D1D1F':'#fff'};color:${mode==='ec'?'#fff':'#333'};transition:.15s">EC 기준</button>
              </div>
            </div>
            ${_isMpMode(mode)?`<div style="display:flex;border:1px solid #CCC;border-radius:6px;overflow:hidden">
              <button onclick="Pages.KpiTarget.setLeView(false)" style="padding:6px 14px;border:none;border-right:1px solid #CCC;font-size:12px;font-weight:${_leView?'400':'700'};cursor:pointer;font-family:Pretendard,sans-serif;background:${_leView?'#fff':'#1D1D1F'};color:${_leView?'#333':'#fff'}">계획 대비</button>
              <button onclick="Pages.KpiTarget.setLeView(true)" style="padding:6px 14px;border:none;font-size:12px;font-weight:${_leView?'700':'400'};cursor:pointer;font-family:Pretendard,sans-serif;background:${_leView?'#1D1D1F':'#fff'};color:${_leView?'#fff':'#333'}">연말 추정</button>
            </div>`:''}
            ${isKpiM?`<div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:12px;color:var(--tx2);font-weight:400;font-family:Pretendard,sans-serif">기준환율 $1 =</span>
              <input type="number" id="kpi-exchange-input" value="${_exchangeRate||1395}" placeholder="1395"
                style="width:75px;padding:4px 6px;border:1px solid #CCC;border-radius:4px;font-size:12px;text-align:right;font-family:'DM Mono',monospace;color:#1D1D1F"
                onkeydown="if(event.key==='Enter'){Pages.KpiTarget.updateExchangeRate(this.value);this.blur();}"
                onblur="Pages.KpiTarget.updateExchangeRate(this.value)">
              <span style="font-size:12px;color:#555;font-family:Pretendard,sans-serif">원${_exchangeRate>0?' (환산중)':''}</span>
            </div>`:''}`
          + `</div>
          <!-- 관리자 전용: 심플 -->
          <div style="display:flex;gap:5px;align-items:center;opacity:0.7">
            <button onclick="Pages.KpiTarget.openRolling('${mode}')" style="${adminBtnStyle}">${mode==='ec'?'롤링(EC)':mode==='kpi103'?'롤링(103)':mode==='kpi7'?'롤링(7월)':'롤링(67)'}</button>
            ${mode==='kpi67'?`<button onclick="Pages.KpiTarget.openRolling('kpi103')" style="${adminBtnStyle}">롤링(103)</button>`:''}
            ${_isMpMode(mode)?`<button onclick="Pages.KpiTarget.openForecastPanel()" style="${adminBtnStyle}">전망 입력</button>`:''}
            ${isKpiM?(_isMpMode(mode)
              ? `<button onclick="Pages.KpiTarget.openMaterialCostPanel()" style="${adminBtnStyle}">Material Cost</button>`
              : `<button onclick="Pages.KpiTarget.openFactorPanel()" style="${adminBtnStyle}">Factor</button>`):''}
          </div>
        </div>

        <!-- ② 단위/지표 토글 (전역) -->
        ${_buildUnitBar()}

        <!-- ③ 요약 카드 -->
        ${totalTgt>0?`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
          <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:13px 17px">
            <div style="font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:var(--tbl-tx-body);margin-bottom:5px">연간 계획 (${ml})</div>
            <div style="font-size:22px;font-weight:600;color:var(--tx)">${_fmtN(totalTgtDisp)} ${uLabel}</div>
            <div style="font-size:13px;color:var(--tbl-tx-body);margin-top:3px">${basis} 기준 · 롤링 합계</div>
          </div>
          <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:13px 17px">
            <div style="font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:var(--tbl-tx-body);margin-bottom:5px">누적 ${basis}</div>
            <div style="font-size:22px;font-weight:600;color:var(--tx)">${_fmtN(totalActDisp)} ${uLabel}</div>
            <div style="font-size:13px;color:var(--tbl-tx-body);margin-top:3px">$${formatNumber(Math.round(totalActUsd))}</div>
          </div>
          <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:13px 17px">
            <div style="font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:var(--tbl-tx-body);margin-bottom:5px">전체 달성률</div>
            <div style="font-size:22px;font-weight:600;color:var(--tx)">${totalPctFmt}</div>
            <div style="font-size:13px;color:var(--tbl-tx-body);margin-top:3px">${basis} · ${uLabel} 기준</div>
          </div>
        </div>`:`<div style="background:var(--tbl-sum-bg);border-left:3px solid var(--bd);padding:10px 14px;border-radius:var(--rs);margin-bottom:16px;font-size:12px;color:var(--tx)">
          롤링 데이터를 입력하면 계획이 자동으로 설정됩니다 →
          <button onclick="Pages.KpiTarget.openRolling('${mode}')" style="background:none;border:none;color:${mc};font-size:12px;font-weight:500;cursor:pointer;text-decoration:underline">${_rollingLabel(mode)} 입력</button>
        </div>`}

        <!-- ④ 사업별 표: [A] 연간 계획 달성 현황 -->
        <div style="font-size:13px;font-weight:700;color:var(--tx2);font-family:Pretendard,sans-serif;padding:5px 2px;letter-spacing:.05em;margin-bottom:6px">[A] 연간 계획 달성 현황</div>
        <div style="background:var(--tbl-bg);border:1px solid var(--tbl-wrap-bd);border-radius:10px;overflow:hidden;margin-bottom:20px">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr>${TH('사업')}${THR(tgtHeader)}${THR(actHeader)}${TH('달성률')}${THR('잔여')}</tr></thead>
            <tbody>${bizRows}</tbody>
            ${totalTgt>0?`<tfoot><tr style="background:var(--tbl-sum-bg)">
              <td style="padding:10px 14px;font-size:13px;font-weight:500;font-family:Pretendard,sans-serif;color:var(--tx2);border-top:0.5px solid var(--bd)">합계</td>
              <td style="padding:10px 14px;text-align:right;font-family:Pretendard,sans-serif;font-size:13px;font-weight:600;border-top:0.5px solid var(--bd)">${_fmtN(totalTgtDisp)}</td>
              <td style="padding:10px 14px;text-align:right;font-family:Pretendard,sans-serif;font-size:13px;font-weight:600;color:var(--tx);border-top:0.5px solid var(--bd)">${_fmtN(totalActDisp)}</td>
              <td style="padding:10px 14px;border-top:0.5px solid var(--bd)"><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:6px;background:var(--bd);border-radius:3px;overflow:hidden"><div style="height:100%;border-radius:3px;background:#4B5563;width:${Math.min(100,Math.round(totalPct))}%"></div></div><span style="font-size:13px;font-weight:600;color:var(--tx);min-width:36px;text-align:right">${totalPctFmt}</span></div></td>
              <td style="padding:10px 14px;text-align:right;font-family:Pretendard,sans-serif;font-size:13px;font-weight:600;color:var(--tx);border-top:0.5px solid var(--bd)">${_fmtN(totalRemDisp)}</td>
            </tr></tfoot>`:''}
          </table>
        </div>

        <!-- ⑤ 월별 트래킹 -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div style="display:flex;gap:6px;flex-wrap:wrap">${bizBtns}</div>
        </div>
        <div id="kpi-tracking-wrap"></div>
      </div>`;

      _renderTracking();
    },

    openRolling(mode) {
      _rollingYear = _year;
      _rollingMode = mode || 'kpi67';
      const el    = document.getElementById('kpi-rolling-panel');
      const ov    = document.getElementById('kpi-rolling-overlay');
      const title = document.getElementById('kpi-rolling-title');
      if (title) title.textContent = _rollingLabel(_rollingMode);
      const sel = document.querySelector('#kpi-rolling-panel select');
      if (sel) sel.value = String(_rollingYear);
      if (el) { el.style.display='block'; document.body.style.overflow='hidden'; }
      if (ov) ov.style.display='block';
      Pages.KpiTarget.renderRolling();
    },

    closeRolling() {
      const el=document.getElementById('kpi-rolling-panel');
      const ov=document.getElementById('kpi-rolling-overlay');
      if (el) el.style.display='none';
      if (ov) ov.style.display='none';
      document.body.style.overflow='';
    },

    setRollingYear(y) { _rollingYear=parseInt(y); Pages.KpiTarget.renderRolling(); },

    calcRollingRow(input) {
      const row    = input.closest('tr');
      const inputs = row.querySelectorAll('input[type=number]');
      let sum = 0; inputs.forEach(i => { sum += parseFloat(i.value) || 0; });
      const rt = row.querySelector('.rolling-rowtotal');
      const dp = _isUsdRaw(_rollingMode) ? 4 : 2;
      if (rt) rt.textContent = sum > 0 ? (+sum.toFixed(dp)) + '' : '—';
      Pages.KpiTarget.calcRollingAll();
    },

    calcRollingAll() {
      const body = document.getElementById('rolling-tbody'); if (!body) return;
      const rdp  = _isUsdRaw(_rollingMode) ? 4 : 2;
      const revSums  = Array(12).fill(0);
      const ebitSums = Array(12).fill(0);

      body.querySelectorAll('tr[data-type]').forEach(row => {
        const type   = row.getAttribute('data-type');
        const inputs = row.querySelectorAll('input[type=number]');
        let rowSum   = 0;
        inputs.forEach((inp, ci) => {
          const v = parseFloat(inp.value) || 0;
          rowSum += v;
          if (type === 'rev')  revSums[ci]  += v;
          if (type === 'ebit') ebitSums[ci] += v;
          if (type === 'ec')   ebitSums[ci] += v; // EC는 ebit 셀에 표시
        });
        const rt = row.querySelector('.rolling-rowtotal');
        if (rt) rt.textContent = rowSum > 0 ? (+rowSum.toFixed(rdp)) + '' : '—';
      });

      // EBIT 합계 (rs0~rs11 + rstotal)
      let grandEbit = 0;
      ebitSums.forEach((v, i) => {
        const el = document.getElementById('rs' + i);
        if (el) el.textContent = v > 0 ? (+v.toFixed(rdp)) + '' : '0';
        grandEbit += v;
      });
      const st = document.getElementById('rstotal');
      if (st) st.textContent = grandEbit > 0 ? (+grandEbit.toFixed(rdp)) + '' : '0';

      // 매출 합계 (rs-rev0~rs-rev11 + rstotal-rev) — KPI 모드에서만 존재
      let grandRev = 0;
      revSums.forEach((v, i) => {
        const el = document.getElementById('rs-rev' + i);
        if (el) el.textContent = v > 0 ? (+v.toFixed(rdp)) + '' : '0';
        grandRev += v;
      });
      const stRev = document.getElementById('rstotal-rev');
      if (stRev) stRev.textContent = grandRev > 0 ? (+grandRev.toFixed(rdp)) + '' : '0';
    },


    renderRolling() {
      const wrap  = document.getElementById('kpi-rolling-inner'); if (!wrap) return;
      const y     = _rollingYear;
      const store = _getActiveRolling();
      const yData = store[y] || {};
      const isKpi = _isKpi(_rollingMode);
      const dp    = _isUsdRaw(_rollingMode) ? 4 : 2;
      const mc    = _modeColor(_rollingMode);

      const ROWS = [
        { key:'DRAM', label:'DRAM Test' },
        { key:'SSD',  label:'SSD Test' },
        { key:'MID',  label:'Mobile Ink Die' },
        { key:'SCR',  label:'Scrap 자재 공급' },
        { key:'RMA',  label:'RMA 운영' },
        { key:'SUS',  label:'Sustainability 컨설팅' },
        { key:'MOD',  label:'모듈 세일즈' },
      ];
      const MO   = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
      const thS  = 'padding:6px 4px;text-align:center;font-size:11px;font-weight:500;color:var(--tbl-tx-body);background:var(--tbl-sum-bg);border:1px solid var(--bd);white-space:nowrap';
      const inpW = 'width:52px;padding:4px 3px;border:1px solid var(--bd2);border-radius:4px;font-size:12px;text-align:right;background:var(--card);color:var(--tx);font-family:var(--font-mono)';

      // 입력행 생성 (data-biz, data-type 속성 부여 → saveRolling에서 사용)
      function makeInputRow(biz, type, vals, labelText, labelColor) {
        const cells = vals.map(v =>
          '<td style="padding:3px 3px;border:1px solid var(--bd)">'
          + '<input type="number" value="' + (v || '') + '" placeholder="0" step="0.0001" style="' + inpW + '" oninput="Pages.KpiTarget.calcRollingRow(this)">'
          + '</td>'
        ).join('');
        const rowSum = vals.reduce((s, v) => s + (parseFloat(v) || 0), 0);
        return '<tr data-biz="' + biz + '" data-type="' + type + '">'
          + '<td style="padding:5px 8px;font-size:11px;font-weight:600;color:' + labelColor + ';border:1px solid var(--bd);white-space:nowrap;text-align:center;background:var(--tbl-sum-bg)">' + labelText + '</td>'
          + cells
          + '<td class="rolling-rowtotal" style="padding:5px 4px;text-align:right;font-size:12px;font-weight:500;color:var(--tx);background:var(--tbl-sum-bg);border:1px solid var(--bd);font-family:var(--font-mono)">'
          + (rowSum > 0 ? (+rowSum.toFixed(dp)) : '—')
          + '</td></tr>';
      }

      // 사업별 행 생성
      const tableRows = ROWS.map((r, i) => {
        const d = yData[r.key];
        // 저장 구조: 신규 { rev:[12], ebit:[12] } / 구버전 [12] (ebit로 간주)
        const revVals  = isKpi
          ? (d && !Array.isArray(d) ? (d.rev  || Array(12).fill(0)) : Array(12).fill(0))
          : null;
        const ebitVals = isKpi
          ? (d && !Array.isArray(d)
              ? (d.ebit || Array(12).fill(0))   // 신규: ebit 필드
              : (Array.isArray(d) ? d : Array(12).fill(0))) // 구버전: 배열 → ebit
          : null;
        const ecVals = !isKpi
          ? (Array.isArray(d) ? d : Array(12).fill(0)).map(v => parseFloat(v) || 0)
          : null;

        const bizHeader = '<tr><td colspan="' + (MO.length + 2) + '" '
          + 'style="padding:5px 10px;font-size:12px;font-weight:600;color:var(--tx);background:#EBEBEB;border:1px solid var(--bd)">'
          + (i + 1) + '. ' + r.label
          + '</td></tr>';

        if (isKpi) {
          return bizHeader
            + makeInputRow(r.key, 'rev',  revVals,  '매출(' + (_isUsdRaw(_rollingMode) ? 'M USD' : '억원') + ')',  '#185FA5')
            + makeInputRow(r.key, 'ebit', ebitVals, _profitLabel(_rollingMode) + '(' + (_isUsdRaw(_rollingMode) ? 'M USD' : '억원') + ')', '#0F6E56');
        } else {
          // EC 모드: 매출(M USD) 단일 입력, data-type='ec'
          return bizHeader
            + makeInputRow(r.key, 'ec', ecVals, '매출(M USD)', mc);
        }
      }).join('');

      // 합계행: 매출 + EBIT 두 줄 (KPI 모드), EC는 단일
      const colRevSums  = Array(12).fill(0);
      const colEbitSums = Array(12).fill(0);
      ROWS.forEach(r => {
        const d = yData[r.key];
        const rv = d && !Array.isArray(d) ? (d.rev  || []) : [];
        const ev = d ? (Array.isArray(d) ? d : (d.ebit || [])) : [];
        rv.forEach((v, i)  => { colRevSums[i]  += parseFloat(v) || 0; });
        ev.forEach((v, i)  => { colEbitSums[i] += parseFloat(v) || 0; });
      });
      const grandRev  = colRevSums.reduce((s, v) => s + v, 0);
      const grandEbit = colEbitSums.reduce((s, v) => s + v, 0);

      const sumCellsRev  = colRevSums.map((v, idx) =>
        '<td style="padding:6px 4px;text-align:right;font-size:12px;font-weight:500;background:#EBF2FB;border:1px solid var(--bd);font-family:var(--font-mono)">'
        + (v > 0 ? (+v.toFixed(dp)) : '0') + '</td>'
      ).join('');
      const sumCellsEbit = colEbitSums.map((v, idx) =>
        '<td id="rs' + idx + '" style="padding:6px 4px;text-align:right;font-size:12px;font-weight:500;background:#F1EFE8;border:1px solid var(--bd);font-family:var(--font-mono)">'
        + (v > 0 ? (+v.toFixed(dp)) : '0') + '</td>'
      ).join('');

      wrap.innerHTML = `
        <div style="font-size:12px;color:${mc};font-weight:500;margin-bottom:12px;display:flex;align-items:center;gap:16px">
          <span>단위: ${_isUsdRaw(_rollingMode) ? 'Million USD' : '억원'} &nbsp;·&nbsp; ${_modeLabel(_rollingMode)} · 저장하면 즉시 반영됩니다</span>
          ${isKpi ? (u => '<span style="display:flex;gap:10px"><span style="color:#185FA5;font-size:11px">■ 매출(' + u + ')</span><span style="color:#0F6E56;font-size:11px">■ ' + _profitLabel(_rollingMode) + '(' + u + ')</span></span>')(_isUsdRaw(_rollingMode) ? 'M USD' : '억원') : ''}
        </div>
        <div style="margin-bottom:14px;background:#F8F8F8;border:1px solid #DDD;border-radius:6px;padding:12px">
          <div style="font-size:12px;font-weight:600;color:#333;margin-bottom:8px;font-family:Pretendard,sans-serif">📋 엑셀에서 붙여넣기</div>

          <!-- 입력 포맷 가이드 -->
          <details style="margin-bottom:10px;border:1px solid #DDD;border-radius:5px;overflow:hidden">
            <summary style="padding:7px 12px;font-size:11px;font-weight:600;color:#555;background:#F5F5F5;cursor:pointer;font-family:Pretendard,sans-serif;list-style:none">
              📌 입력 포맷 가이드 (클릭하여 펼치기)
            </summary>
            <div style="padding:12px;font-size:11px;font-family:Pretendard,sans-serif;color:#444;background:#FAFAFA">
              <div style="margin-bottom:8px;font-weight:600">✅ 지원 형식</div>
              <div style="margin-bottom:6px">
                <span style="background:#E8F0FE;padding:2px 6px;border-radius:3px;font-weight:600">형식 1</span>
                &nbsp;엑셀에서 <b>사업명 + 구분 + 월별 값</b> 컬럼을 그대로 복사
              </div>
              <div style="background:#fff;border:1px solid #DDD;border-radius:4px;padding:8px;font-family:monospace;font-size:10px;margin-bottom:8px;overflow-x:auto">
                <div style="color:#888;margin-bottom:4px">【탭 구분 — 권장】</div>
                DRAM Test[TAB]매출[TAB]86,340[TAB]227,330[TAB]...<br>
                DRAM Test[TAB]에빗[TAB]10,000[TAB]25,000[TAB]...<br>
                SSD Test[TAB]매출[TAB]61,281[TAB]33,054[TAB]...
              </div>
              <div style="margin-bottom:6px">
                <span style="background:#E8F0FE;padding:2px 6px;border-radius:3px;font-weight:600">형식 2</span>
                &nbsp;사업명과 구분이 붙어있는 경우도 자동 인식
              </div>
              <div style="background:#fff;border:1px solid #DDD;border-radius:4px;padding:8px;font-family:monospace;font-size:10px;margin-bottom:10px;overflow-x:auto">
                <div style="color:#888;margin-bottom:4px">【공백 구분 — 자동 파싱】</div>
                비정품 DRAM Test매출 86,340 227,330 ...<br>
                Scrap 자재매출 200,000 300,000 ...
              </div>

              <div style="margin-bottom:8px;font-weight:600">📌 구분 키워드</div>
              <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">
                <span style="background:#EBF2FB;padding:2px 8px;border-radius:3px">매출 → 매출(계획) 행</span>
                <span style="background:#E8F5F0;padding:2px 8px;border-radius:3px">에빗 / EBIT / MP → ${_profitLabel(_rollingMode)} 행</span>
                <span style="background:#FFF3E0;padding:2px 8px;border-radius:3px">둘 다 가능 (각각 적용)</span>
              </div>

              <div style="margin-bottom:8px;font-weight:600">🔢 단위 자동 변환</div>
              <div style="margin-bottom:4px">• 값이 <b>10,000 이상</b>이면 <b>원 단위</b>로 판단 → 자동으로 억원 변환</div>
              <div style="margin-bottom:4px">• 값이 <b>10,000 미만</b>이면 <b>이미 억원</b>으로 판단 → 그대로 입력</div>
              <div>• <b>-</b> 값은 0으로 처리</div>

              <div style="margin-top:10px;margin-bottom:6px;font-weight:600">🏢 사업명 매핑</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px">
                <div>DRAM / 디램 / 비정품 DRAM → <b>DRAM</b></div>
                <div>SSD / 비정품 SSD → <b>SSD</b></div>
                <div>MID / Mobile / D-Die → <b>MID</b></div>
                <div>Scrap / 스크랩 → <b>SCR</b></div>
                <div>RMA / KLEW → <b>RMA</b></div>
                <div>컨설팅 / ITAD / SUS → <b>SUS</b></div>
              </div>
            </div>
          </details>

          <textarea id="rolling-paste-area" placeholder="엑셀에서 복사 후 여기에 붙여넣기 (Ctrl+V)" style="width:100%;height:90px;padding:8px;border:1px solid #CCC;border-radius:4px;font-size:11px;font-family:'DM Mono',monospace;resize:vertical;box-sizing:border-box;color:#333;background:#fff" onpaste="setTimeout(()=>Pages.KpiTarget.parsePasteRolling(),0)"></textarea>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
            <div id="rolling-paste-msg" style="font-size:11px;color:#888;font-family:Pretendard,sans-serif"></div>
            <div style="display:flex;gap:6px">
              <button onclick="Pages.KpiTarget.parsePasteRolling()" style="padding:4px 12px;border:1px solid ${mc};border-radius:4px;background:${mc};color:#fff;font-size:11px;cursor:pointer;font-family:Pretendard,sans-serif">적용</button>
              <button onclick="document.getElementById('rolling-paste-area').value='';document.getElementById('rolling-paste-msg').textContent=''" style="padding:4px 12px;border:1px solid #CCC;border-radius:4px;background:#fff;color:#555;font-size:11px;cursor:pointer;font-family:Pretendard,sans-serif">초기화</button>
            </div>
          </div>
        </div>
        <div style="overflow-x:auto">
          <table style="border-collapse:collapse;table-layout:auto">
            <thead><tr>
              <th style="${thS};min-width:80px">구분</th>
              ${MO.map(m => '<th style="' + thS + ';width:56px">' + m + '</th>').join('')}
              <th style="${thS};width:60px;background:#F1EFE8">합계</th>
            </tr></thead>
            <tbody id="rolling-tbody">${tableRows}</tbody>
            <tfoot>
              ${isKpi ? `<tr>
                <td style="padding:6px 10px;text-align:center;font-size:12px;font-weight:500;background:#EBF2FB;border:1px solid var(--bd)">매출 합계</td>
                ${sumCellsRev.replace(/id="rs(\d+)"/g, 'id="rs-rev$1"')}
                <td id="rstotal-rev" style="padding:6px 4px;text-align:right;font-size:12px;font-weight:600;color:var(--tx);background:#D6E4F7;border:1px solid var(--bd);font-family:var(--font-mono)">${grandRev > 0 ? (+grandRev.toFixed(dp)) : '0'}</td>
              </tr>
              <tr>
                <td style="padding:6px 10px;text-align:center;font-size:12px;font-weight:500;background:#F1EFE8;border:1px solid var(--bd)">${_profitLabel(_rollingMode)} 합계</td>
                ${sumCellsEbit}
                <td id="rstotal" style="padding:6px 4px;text-align:right;font-size:12px;font-weight:600;color:var(--tx);background:#E8E4D8;border:1px solid var(--bd);font-family:var(--font-mono)">${grandEbit > 0 ? (+grandEbit.toFixed(dp)) : '0'}</td>
              </tr>` : `<tr>
                <td style="padding:6px 10px;text-align:center;font-size:12px;font-weight:500;background:#F1EFE8;border:1px solid var(--bd)">합계</td>
                ${sumCellsEbit}
                <td id="rstotal" style="padding:6px 4px;text-align:right;font-size:12px;font-weight:600;color:var(--tx);background:#E8E4D8;border:1px solid var(--bd);font-family:var(--font-mono)">${grandEbit > 0 ? (+grandEbit.toFixed(dp)) : '0'}</td>
              </tr>`}
            </tfoot>
          </table>
        </div>`;
    },



    parsePasteRolling() {
      const ta  = document.getElementById('rolling-paste-area'); if (!ta) return;
      const msg = document.getElementById('rolling-paste-msg');
      const raw = ta.value.trim(); if (!raw) return;
      const isKpi = _isKpi(_rollingMode);
      const dp    = _isUsdRaw(_rollingMode) ? 4 : 2;

      // ── 값 파싱 유틸 ─────────────────────────────────────────
      function parseVal(s) {
        const t = String(s).replace(/,/g,'').trim();
        if (!t || /^[\-—\u2013\u2014]+$/.test(t)) return 0;
        const n = parseFloat(t);
        return isNaN(n) ? 0 : n;
      }

      // 원 단위 → 억원 자동 변환 (값이 10000 이상이면 원 단위로 판단)
      function toOkwon(nums) {
        const maxVal = Math.max.apply(null, nums.filter(v => v > 0));
        if (maxVal >= 10000) {
          // 원 단위 → 억원 (÷ 100000000)
          return nums.map(v => v > 0 ? +(v / 100000000).toFixed(4) : 0);
        }
        return nums; // 이미 억원
      }

      // 타입 인식: '매출' → 'rev', '에빗'/'EBIT' → 'ebit', EC 모드 → 'ec'
      function detectType(typeStr) {
        const t = typeStr.trim().toLowerCase().replace(/\s+/g, '');
        if (!isKpi) return 'ec';
        if (t === '매출' || t === 'rev' || t === 'revenue') return 'rev';
        if (t === '에빗' || t === 'ebit' || t === 'materialprofit' || t === 'mp' || t === '머티리얼프로핏') return 'ebit';
        return 'rev'; // 기본값: 매출
      }

      // 사업명 → BIZ KEY 매핑
      const BIZ_MAP = [
        { key:'DRAM', kw:['dram','디램'] },
        { key:'SSD',  kw:['ssd'] },
        { key:'MID',  kw:['mid','mobile ink','mobile','ink die','d-die','ddie'] },
        { key:'SCR',  kw:['scr','scrap','스크랩','자재'] },
        { key:'RMA',  kw:['rma','klew','rma 센터'] },
        { key:'SUS',  kw:['sus','sustainability','컨설팅','지속','itad'] },
        { key:'MOD',  kw:['mod','모듈','module'] },
      ];
      function matchBiz(name) {
        const lower = name.toLowerCase().replace(/\s+/g,' ').trim();
        for (const b of BIZ_MAP) {
          if (b.kw.some(k => lower.includes(k))) return b.key;
        }
        return null;
      }

      // ── 파싱 전략 ────────────────────────────────────────────
      // 1순위: 탭 구분자 있으면 탭 분리 (표준 엑셀 복사)
      // 2순위: '사업명 + 타입(매출|에빗) + 숫자들' 패턴 (공백 붙은 복사)

      const results = {}; // { BIZ: { rev:[12], ebit:[12] } }
      let matched = 0, skipped = 0;
      const BIZES = ['DRAM','SSD','MID','SCR','RMA','SUS','MOD'];

      if (raw.includes('\t')) {
        // ── 탭 구분 방식 ─────────────────────────────────────
        const lines = raw.split('\n').map(l => l.trimEnd()).filter(l => l.trim());
        for (const line of lines) {
          const cols = line.split('\t').map(c => c.trim());
          if (cols.length < 2) continue;

          // 헤더 행 스킵 (월, 사업계획 등)
          if (/^1?[0-9]월|^사업|^구분|^biz/i.test(cols[0])) { skipped++; continue; }

          // 첫 컬럼: 사업명
          // 두 번째 컬럼: 타입(매출/에빗) 또는 숫자
          let bizName, typeStr, numStart;
          if (/^(매출|에빗|ebit|rev)$/i.test(cols[1])) {
            bizName = cols[0]; typeStr = cols[1]; numStart = 2;
          } else if (/^(매출|에빗|ebit|rev)$/i.test(cols[0].split(/\s+/).pop())) {
            // 사업명과 타입이 첫 컬럼에 붙어있는 경우
            const parts = cols[0].match(/^(.*?)(매출|에빗|EBIT|Material\s*Profit|MP)$/i);
            bizName = parts ? parts[1] : cols[0]; typeStr = parts ? parts[2] : '매출'; numStart = 1;
          } else {
            bizName = cols[0]; typeStr = '매출'; numStart = 1;
          }

          const bizKey = matchBiz(bizName);
          if (!bizKey) { skipped++; continue; }

          const nums = [];
          for (let i = numStart; i < cols.length && nums.length < 12; i++) {
            nums.push(parseVal(cols[i]));
          }
          while (nums.length < 12) nums.push(0);

          const converted = toOkwon(nums);
          const type = detectType(typeStr);

          if (!results[bizKey]) results[bizKey] = { rev: null, ebit: null };
          results[bizKey][type === 'ec' ? 'ebit' : type] = converted;
          matched++;
        }
      } else {
        // ── 공백 붙은 방식: 사업명+타입+숫자 패턴 ─────────────
        // 사업명 키워드 기준으로 세그먼트 분리
        const BIZ_SPLIT_PATTERN = /(?=[가-힣A-Za-z].*?(?:매출|에빗|EBIT|Material\s*Profit))/;
        const TYPE_PATTERN = /^(.*?)(매출|에빗|EBIT|Material\s*Profit)([\d,\s\-—\u2013\u2014.]*?)$/;

        // 전체를 하나의 문자열로 보고, 사업명+타입 단위로 분리
        // 접근: 사업명 매핑 키워드로 직접 분리
        const splitParts = raw.split(/(비정품\s+DRAM|비정품\s+SSD|DRAM Test|SSD Test|D-Die|Scrap|KLEW|RMA\s*센터|컨설팅|ITAD|Mobile Ink|모듈)/i);

        let currentBizRaw = '';
        const segments = [];
        for (let i = 0; i < splitParts.length; i++) {
          if (i === 0) { currentBizRaw = splitParts[i]; continue; }
          if (i % 2 === 1) {
            // 사업명 키워드
            currentBizRaw = splitParts[i];
          } else {
            // 사업명 뒤 데이터
            segments.push(currentBizRaw + splitParts[i]);
          }
        }

        for (const seg of segments) {
          // 타입 키워드로 분리
          const typeMatch = seg.match(/(매출|에빗|EBIT|Material\s*Profit)/i);
          if (!typeMatch) { skipped++; continue; }

          const typeIdx = seg.indexOf(typeMatch[0]);
          const bizName = seg.slice(0, typeIdx).trim();
          const rest    = seg.slice(typeIdx + typeMatch[0].length);

          const bizKey = matchBiz(bizName || seg.slice(0, 20));
          if (!bizKey) { skipped++; continue; }

          const tokens = rest.match(/[\-—\u2013\u2014]+|[\d,]+/g) || [];
          const nums   = tokens.map(parseVal).slice(0, 12);
          while (nums.length < 12) nums.push(0);

          const converted = toOkwon(nums);
          const type = detectType(typeMatch[0]);

          if (!results[bizKey]) results[bizKey] = { rev: null, ebit: null };
          results[bizKey][type === 'ec' ? 'ebit' : type] = converted;
          matched++;
        }
      }

      // ── DOM에 값 입력 ─────────────────────────────────────────
      const body = document.getElementById('rolling-tbody'); if (!body) return;
      let applied = 0;

      for (const [bizKey, vals] of Object.entries(results)) {
        // rev 행 — vals.rev가 null이면 건드리지 않음 (기존값 유지)
        if (vals.rev !== null) {
          const revRow = body.querySelector('tr[data-biz="' + bizKey + '"][data-type="rev"]');
          if (revRow) {
            revRow.querySelectorAll('input[type=number]').forEach((inp, i) => {
              inp.value = vals.rev[i] > 0 ? vals.rev[i] : '';
            });
            applied++;
          }
        }

        // ebit 행 — vals.ebit가 null이면 건드리지 않음 (기존값 유지)
        if (vals.ebit !== null) {
          const ebitRow = body.querySelector('tr[data-biz="' + bizKey + '"][data-type="ebit"]');
          if (ebitRow) {
            ebitRow.querySelectorAll('input[type=number]').forEach((inp, i) => {
              inp.value = vals.ebit[i] > 0 ? vals.ebit[i] : '';
            });
            applied++;
          }
          // EC 행
          const ecRow = body.querySelector('tr[data-biz="' + bizKey + '"][data-type="ec"]');
          if (ecRow) {
            ecRow.querySelectorAll('input[type=number]').forEach((inp, i) => {
              inp.value = vals.ebit[i] > 0 ? vals.ebit[i] : '';
            });
            applied++;
          }
        }
      }

      Pages.KpiTarget.calcRollingAll();

      if (msg) {
        if (applied > 0) {
          msg.textContent = '✓ ' + applied + '개 항목 적용 (단위 자동 변환)';
          msg.style.color = '#1A6B3A';
        } else {
          msg.textContent = '매칭 실패 — 아래 가이드 형식을 확인해주세요.';
          msg.style.color = '#A32D2D';
        }
      }
    },


    saveRolling() {
      const body = document.getElementById('rolling-tbody'); if (!body) return;
      const y    = _rollingYear;
      const isEc = _rollingMode === 'ec';
      const rows = body.querySelectorAll('tr[data-biz]');
      const newData = {};

      rows.forEach(row => {
        const biz  = row.getAttribute('data-biz');
        const type = row.getAttribute('data-type'); // 'rev', 'ebit', or 'ec'
        if (!biz || !type) return;
        const inputs = row.querySelectorAll('input[type=number]');
        const vals   = Array.from(inputs).map(i => parseFloat(i.value) || 0);

        if (isEc) {
          // EC: 배열 그대로 저장 (매출 단일값)
          newData[biz] = vals;
        } else {
          // KPI: { rev, ebit } 구조
          if (!newData[biz]) newData[biz] = { rev: Array(12).fill(0), ebit: Array(12).fill(0) };
          newData[biz][type] = vals;
        }
      });

      _saveRollingData(y, newData);
      Pages.KpiTarget.closeRolling();
      Pages.KpiTarget.render();
      if (typeof Nav !== 'undefined' && Nav.current && Nav.current() === 'dash') Pages.Dashboard.render();
      UI.toast(`${y}년 ${_modeLabel(_rollingMode)} 롤링 데이터 저장됨`);
    },

    setMode(mode) { _rollingMode=mode; Pages.KpiTarget.render(); },

    setTrackingUnit(unit) { _trackingUnit = unit; Pages.KpiTarget.render(); },
    setTableView(view)    { _tableView    = view; Pages.KpiTarget.render(); },

    openFactorPanel() {
      const el=document.getElementById('kpi-factor-panel');
      const ov=document.getElementById('kpi-rolling-overlay');
      if (!el) return;
      const rows=CONFIG.BIZ_LIST.map(b=>{
        const f=_getFactor(b);
        return `<tr>
          <td style="padding:8px 12px;font-size:13px;font-weight:500;color:${CONFIG.BIZ_COLORS[b]};font-family:Pretendard,sans-serif;white-space:nowrap">${CONFIG.BIZ_LABELS[b]}</td>
          <td style="padding:8px 12px"><input type="number" id="factor-${b}" value="${f}" min="0" max="2" step="0.01" style="width:80px;padding:5px 8px;border:1px solid #CCC;border-radius:4px;font-size:13px;text-align:right;font-family:'DM Mono',monospace"></td>
          <td style="padding:8px 12px;font-size:12px;color:#888;font-family:Pretendard,sans-serif">매출 100 → 이익 <span id="preview-${b}" style="font-weight:600;color:#333">${(100*f).toFixed(1)}</span></td>
        </tr>`;
      }).join('');
      document.getElementById('kpi-factor-inner').innerHTML=`
        <div style="font-size:12px;color:#888;margin-bottom:14px;font-family:Pretendard,sans-serif">Factor = EBIT / 매출 · 예) 매출 100, Factor 0.9 → EBIT 90</div>
        <table style="border-collapse:collapse;width:100%">
          <thead><tr>
            <th style="padding:8px 12px;text-align:left;font-size:12px;font-weight:700;background:#F0F0F0;border-bottom:2px solid #CCC;font-family:Pretendard,sans-serif">사업</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;font-weight:700;background:#F0F0F0;border-bottom:2px solid #CCC;font-family:Pretendard,sans-serif">Factor</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;font-weight:700;background:#F0F0F0;border-bottom:2px solid #CCC;font-family:Pretendard,sans-serif">미리보기</th>
          </tr></thead>
          <tbody id="factor-tbody">${rows}</tbody>
        </table>`;
      CONFIG.BIZ_LIST.forEach(b=>{
        const inp=document.getElementById('factor-'+b);
        if (inp) inp.addEventListener('input',()=>{const prev=document.getElementById('preview-'+b); if (prev) prev.textContent=(100*(parseFloat(inp.value)||0)).toFixed(1);});
      });
      el.style.display='block';
      if (ov) ov.style.display='block';
      document.body.style.overflow='hidden';
    },

    closeFactorPanel() {
      const el=document.getElementById('kpi-factor-panel');
      const ov=document.getElementById('kpi-rolling-overlay');
      if (el) el.style.display='none';
      if (ov) ov.style.display='none';
      document.body.style.overflow='';
    },

    // ── Material Cost (KPI-7월 기준) ────────────────────────
    // 사업 × 12개월, 단위 USD. Material Profit 실적 = 매출 실적 − Material Cost
    openMaterialCostPanel() {
      _mcYear = _year;
      const sel = document.getElementById('kpi-mc-year');
      if (sel) sel.value = String(_mcYear);
      const el = document.getElementById('kpi-mc-panel');
      const ov = document.getElementById('kpi-rolling-overlay');
      if (el) { el.style.display='block'; document.body.style.overflow='hidden'; }
      if (ov) ov.style.display='block';
      Pages.KpiTarget.renderMaterialCost();
    },

    closeMaterialCostPanel() {
      const el = document.getElementById('kpi-mc-panel');
      const ov = document.getElementById('kpi-rolling-overlay');
      if (el) el.style.display='none';
      if (ov) ov.style.display='none';
      document.body.style.overflow='';
    },

    setMcYear(y) { _mcYear = parseInt(y); Pages.KpiTarget.renderMaterialCost(); },

    // ── 전망(LE) ────────────────────────────────────────────
    setLeView(on)      { _leView = !!on; Pages.KpiTarget.render(); },
    setLeVintage(v)    { _fcVintage = v || null; Pages.KpiTarget.render(); },

    openForecastPanel() {
      _fcYear = _year;
      // 편집 대상: 이번 달 회차 (없으면 새로 만들고, 직전 회차/베이스라인을 복사해 시작)
      _fcEditVintage = _thisVintage();
      const el = document.getElementById('kpi-fc-panel');
      const ov = document.getElementById('kpi-rolling-overlay');
      const sel = document.getElementById('kpi-fc-year');
      if (sel) sel.value = String(_fcYear);
      if (el) { el.style.display='block'; document.body.style.overflow='hidden'; }
      if (ov) ov.style.display='block';
      Pages.KpiTarget.renderForecast();
    },

    closeForecastPanel() {
      const el = document.getElementById('kpi-fc-panel');
      const ov = document.getElementById('kpi-rolling-overlay');
      if (el) el.style.display='none';
      if (ov) ov.style.display='none';
      document.body.style.overflow='';
    },

    setFcYear(y) { _fcYear = parseInt(y); Pages.KpiTarget.renderForecast(); },
    setFcEditVintage(v) { _fcEditVintage = v; Pages.KpiTarget.renderForecast(); },

    renderForecast() {
      const wrap = document.getElementById('kpi-fc-inner'); if (!wrap) return;
      const y        = _fcYear;
      const vintage  = _fcEditVintage || _thisVintage();
      const closed   = _closedMonthIdx(y);
      const prevVin  = _fcVintages(y).filter(v => v !== vintage)[0] || null;
      const baseStore = _getRollingStore('kpi7');
      const MO   = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
      const thS  = 'padding:6px 4px;text-align:center;font-size:11px;font-weight:500;color:var(--tbl-tx-body);background:var(--tbl-sum-bg);border:1px solid var(--bd);white-space:nowrap';
      const inpW = 'width:56px;padding:4px 3px;border:1px solid var(--bd2);border-radius:4px;font-size:12px;text-align:right;background:var(--card);color:var(--tx);font-family:var(--font-mono)';

      // 값 우선순위: 이번 회차 입력값 → 직전 회차 → 베이스라인 계획
      function seed(biz, type) {
        return _getForecastArr(y, vintage, biz, type)
            || (prevVin ? _getForecastArr(y, prevVin, biz, type) : null)
            || (type === 'rev' ? _getRollingRevRaw(baseStore, y, biz) : _getRollingEbitRaw(baseStore, y, biz));
      }

      function row(biz, type, label, color) {
        const vals = seed(biz, type);
        const cells = vals.map((v, i) => {
          // 마감월 이전은 실적 확정 구간 → 입력 비활성 (합계에서도 제외)
          if (i <= closed) {
            return '<td style="padding:3px 3px;border:1px solid var(--bd);background:#F2F2F2;text-align:right;font-size:11px;color:#999;font-family:var(--font-mono)">실적</td>';
          }
          return '<td style="padding:3px 3px;border:1px solid var(--bd)">'
            + '<input type="number" value="' + (v || '') + '" placeholder="0" step="0.01" style="' + inpW + '" oninput="Pages.KpiTarget.calcFcRow(this)">'
            + '</td>';
        }).join('');
        const sum = vals.reduce((s, v, i) => i > closed ? s + (parseFloat(v) || 0) : s, 0);
        return '<tr data-biz="' + biz + '" data-type="' + type + '">'
          + '<td style="padding:5px 8px;font-size:11px;font-weight:600;color:' + color + ';border:1px solid var(--bd);white-space:nowrap;background:var(--tbl-sum-bg)">' + label + '</td>'
          + cells
          + '<td class="fc-rowtotal" style="padding:5px 4px;text-align:right;font-size:12px;font-weight:600;color:var(--tx);background:var(--tbl-sum-bg);border:1px solid var(--bd);font-family:var(--font-mono)">'
          + (sum > 0 ? (+sum.toFixed(2)) : '—') + '</td></tr>';
      }

      const rows = CONFIG.BIZ_LIST.map((b, i) =>
        '<tr><td colspan="' + (MO.length + 2) + '" style="padding:5px 10px;font-size:12px;font-weight:600;color:var(--tx);background:#EBEBEB;border:1px solid var(--bd)">'
        + (i + 1) + '. ' + (CONFIG.BIZ_LABELS[b] || b) + '</td></tr>'
        + row(b, 'rev',  '매출(M USD)', '#185FA5')
        + row(b, 'ebit', 'Material Profit(M USD)', '#0F6E56')
      ).join('');

      const vintOptions = Array.from(new Set([vintage].concat(_fcVintages(y))))
        .map(v => '<option value="' + v + '"' + (v === vintage ? ' selected' : '') + '>' + v + (v === _thisVintage() ? ' (이번 달)' : '') + '</option>').join('');

      wrap.innerHTML =
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">'
        + '<span style="font-size:12px;color:var(--tx3);font-family:Pretendard,sans-serif">제출 회차</span>'
        + '<select onchange="Pages.KpiTarget.setFcEditVintage(this.value)" style="padding:4px 8px;border:1px solid var(--bd2);border-radius:4px;font-size:12px;background:var(--bg);color:var(--tx)">' + vintOptions + '</select>'
        + '<span style="font-size:12px;color:var(--tx3);font-family:Pretendard,sans-serif">'
        + '단위 M USD · ' + (closed >= 0 ? (closed + 1) + '월까지는 실적 확정이라 입력하지 않습니다' : '전 기간 입력 대상입니다')
        + (prevVin ? ' · 초기값은 ' + prevVin + ' 제출본에서 복사' : ' · 초기값은 계획에서 복사') + '</span>'
        + '</div>'
        + '<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%">'
        + '<thead><tr><th style="' + thS + '">구분</th>'
        + MO.map(m => '<th style="' + thS + '">' + m + '</th>').join('')
        + '<th style="' + thS + '">잔여 합계</th></tr></thead>'
        + '<tbody id="kpi-fc-tbody">' + rows + '</tbody></table></div>';
    },

    calcFcRow(inp) {
      const tr = inp && inp.closest ? inp.closest('tr') : null; if (!tr) return;
      const sum = Array.from(tr.querySelectorAll('input')).reduce((s, el) => s + (parseFloat(el.value) || 0), 0);
      const cell = tr.querySelector('.fc-rowtotal');
      if (cell) cell.textContent = sum > 0 ? (+sum.toFixed(2)) : '—';
    },

    saveForecast() {
      const tbody = document.getElementById('kpi-fc-tbody'); if (!tbody) return;
      const y       = _fcYear;
      const vintage = _fcEditVintage || _thisVintage();
      const closed  = _closedMonthIdx(y);
      const data    = {};
      tbody.querySelectorAll('tr[data-biz]').forEach(tr => {
        const biz  = tr.dataset.biz, type = tr.dataset.type;
        if (!data[biz]) data[biz] = { rev: Array(12).fill(0), ebit: Array(12).fill(0) };
        // 마감월 이전 칸은 input이 없으므로 셀 순서 기준으로 채운다
        const inputs = Array.from(tr.querySelectorAll('input'));
        const arr = Array(12).fill(0);
        for (let i = closed + 1, k = 0; i < 12; i++, k++) arr[i] = parseFloat(inputs[k]?.value) || 0;
        data[biz][type] = arr;
      });
      _saveForecast(y, vintage, data);
      _fcVintage = vintage;
      _leView = true;
      Pages.KpiTarget.closeForecastPanel();
      UI.toast(vintage + ' 전망 저장됨');
      Pages.KpiTarget.render();
    },

    renderMaterialCost() {
      const wrap = document.getElementById('kpi-mc-inner'); if (!wrap) return;
      const y    = _mcYear;
      const MO   = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
      const thS  = 'padding:6px 4px;text-align:center;font-size:11px;font-weight:500;color:var(--tbl-tx-body);background:var(--tbl-sum-bg);border:1px solid var(--bd);white-space:nowrap';
      const inpW = 'width:62px;padding:4px 3px;border:1px solid var(--bd2);border-radius:4px;font-size:12px;text-align:right;background:var(--card);color:var(--tx);font-family:var(--font-mono)';

      const rows = CONFIG.BIZ_LIST.map(b => {
        const vals  = _getMcMonths(y, b);
        const cells = vals.map(v =>
          '<td style="padding:3px 3px;border:1px solid var(--bd)">'
          + '<input type="number" value="' + (v || '') + '" placeholder="0" step="0.0001" style="' + inpW + '" oninput="Pages.KpiTarget.calcMcRow(this)">'
          + '</td>').join('');
        const sum = vals.reduce((s, v) => s + v, 0);
        return '<tr data-biz="' + b + '">'
          + '<td style="padding:5px 8px;font-size:12px;font-weight:600;color:var(--tx);border:1px solid var(--bd);white-space:nowrap;background:var(--tbl-sum-bg)">' + (CONFIG.BIZ_LABELS[b] || b) + '</td>'
          + cells
          + '<td class="mc-rowtotal" style="padding:5px 6px;text-align:right;font-size:12px;font-weight:600;color:var(--tx);background:var(--tbl-sum-bg);border:1px solid var(--bd);font-family:var(--font-mono)">'
          + (sum > 0 ? (+sum.toFixed(4)) : '—') + '</td></tr>';
      }).join('');

      wrap.innerHTML =
        '<div style="font-size:12px;color:var(--tx3);margin-bottom:12px;font-family:Pretendard,sans-serif">'
        + 'Material Profit = 매출 실적 − Material Cost · 단위 <b>M USD</b> (계획과 동일) · ' + y + '년'
        + '</div>'
        + '<div style="margin-bottom:14px;background:#F8F8F8;border:1px solid #DDD;border-radius:6px;padding:12px">'
        + '<div style="font-size:12px;font-weight:600;color:#333;margin-bottom:6px;font-family:Pretendard,sans-serif">📋 엑셀에서 붙여넣기</div>'
        + '<div style="font-size:11px;color:#777;margin-bottom:8px;font-family:Pretendard,sans-serif">'
        + '한 줄에 <b>사업명 + 12개월 값</b> — 예) <code>Mobile Ink Die&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;0.129&nbsp;…</code> · 값이 12개보다 적으면 앞에서부터 채웁니다</div>'
        + '<textarea id="kpi-mc-paste" placeholder="여기에 Ctrl+V" style="width:100%;height:70px;padding:8px;border:1px solid #CCC;border-radius:4px;font-family:var(--font-mono);font-size:11px;resize:vertical"></textarea>'
        + '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">'
        + '<button onclick="Pages.KpiTarget.applyMcPaste()" style="padding:5px 14px;font-size:12px;font-weight:600;border:1px solid #1D1D1F;background:#1D1D1F;color:#fff;border-radius:4px;cursor:pointer;font-family:Pretendard,sans-serif">표에 채우기</button>'
        + '<span id="kpi-mc-paste-msg" style="font-size:11px;color:#777;font-family:Pretendard,sans-serif"></span>'
        + '</div></div>'
        + '<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%">'
        + '<thead><tr><th style="' + thS + '">사업</th>'
        + MO.map(m => '<th style="' + thS + '">' + m + '</th>').join('')
        + '<th style="' + thS + '">합계</th></tr></thead>'
        + '<tbody id="kpi-mc-tbody">' + rows + '</tbody></table></div>';
    },

    /** 입력 시 해당 행 합계만 갱신 */
    calcMcRow(inp) {
      const tr = inp && inp.closest ? inp.closest('tr') : null; if (!tr) return;
      const sum = Array.from(tr.querySelectorAll('input')).reduce((s, el) => s + (parseFloat(el.value) || 0), 0);
      const cell = tr.querySelector('.mc-rowtotal');
      if (cell) cell.textContent = sum > 0 ? (+sum.toFixed(4)) : '—';
    },

    /** MC 붙여넣기 — '사업명 + 12개월' 형태의 줄을 표에 채운다 */
    applyMcPaste() {
      const ta  = document.getElementById('kpi-mc-paste');
      const msg = document.getElementById('kpi-mc-paste-msg');
      const tbody = document.getElementById('kpi-mc-tbody');
      if (!ta || !tbody) return;
      const raw = (ta.value || '').trim();
      if (!raw) { if (msg) msg.textContent = '붙여넣은 내용이 없습니다'; return; }

      const BIZ_KW = [
        { key:'DRAM', kw:['dram','디램'] },
        { key:'SSD',  kw:['ssd'] },
        { key:'MID',  kw:['mid','mobile ink','ink die','모바일'] },
        { key:'SCR',  kw:['scr','scrap','스크랩','자재'] },
        { key:'RMA',  kw:['rma'] },
        { key:'SUS',  kw:['sus','sustainability','컨설팅','지속'] },
        { key:'MOD',  kw:['mod','모듈'] },
      ];
      let applied = 0;
      raw.split(/\r?\n/).forEach(line => {
        if (!line.trim()) return;
        const cols = line.split(/\t|\s{2,}|,/).map(c => c.trim()).filter(c => c !== '');
        if (cols.length < 2) return;
        const lower = cols[0].toLowerCase();
        const hit = BIZ_KW.find(b => b.kw.some(k => lower.includes(k)));
        if (!hit) return;
        const nums = cols.slice(1)
          .map(c => parseFloat(String(c).replace(/[,\s$]/g, '')))
          .filter(v => !isNaN(v));
        const row = tbody.querySelector('tr[data-biz="' + hit.key + '"]');
        if (!row) return;
        const inputs = Array.from(row.querySelectorAll('input'));
        inputs.forEach((inp, i) => { inp.value = nums[i] ? nums[i] : ''; });
        Pages.KpiTarget.calcMcRow(inputs[0] || row.querySelector('input'));
        applied++;
      });
      if (msg) msg.textContent = applied ? applied + '개 사업 반영됨 — 확인 후 저장하세요' : '사업명을 인식하지 못했습니다';
    },

    saveMaterialCost() {
      const tbody = document.getElementById('kpi-mc-tbody'); if (!tbody) return;
      const data = {};
      tbody.querySelectorAll('tr[data-biz]').forEach(tr => {
        data[tr.dataset.biz] = Array.from(tr.querySelectorAll('input')).map(el => parseFloat(el.value) || 0);
      });
      _saveMaterialCost(_mcYear, data);
      Pages.KpiTarget.closeMaterialCostPanel();
      UI.toast('Material Cost 저장됨');
      Pages.KpiTarget.render();
    },

    downloadTracking() {
      if (!_exportCache) { alert('데이터를 먼저 불러오세요.'); return; }
      const {
        year, mode, isEcMode, hasRate, exchangeRate: rate, curMonIdx, bizList,
        revByBiz, ebitByBiz, revSumRaw, ebitSumRaw, revCumRaw, ebitCumRaw,
        actRevByBiz, actEbitByBiz, actRevSumUsd, actEbitSumUsd, actRevCumUsd, actEbitCumUsd,
      } = _exportCache;

      const SGD_RATE = 1.27;
      const MONS  = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
      const HDR   = ['구분', '구분2'].concat(MONS).concat(['연간합계']);
      const NCOLS = HDR.length; // 15 (구분 + 구분2 + 12개월 + 연간합계)
      const COL   = c => XLSX.utils.encode_col(c);     // 2 -> 'C'
      const R     = i => i + 1;                         // 0-based 행 -> 엑셀 행번호
      const cmIdx = curMonIdx;                          // 현재월 (0-based, -1=실적 없음)
      const cmCol = cmIdx >= 0 ? COL(cmIdx + 2) : null; // 현재월 컬럼 letter

      // 숫자 표시 형식 (수식 결과 셀에 적용)
      const Z_AMT  = '0.00;-0.00;"-"';                   // 금액 (0은 짧은 하이픈)
      const Z_DIFF = '+0.00;-0.00;0.00';                 // 실적-계획 차이
      const Z_PCTD = '+0.0%;-0.0%;0.0%';                 // 달성률(계획대비, 100% 기준 ±)
      const Z_PCT  = '0.0%';                             // 연간달성률 / 진척률
      const Z_PP   = '+0.0%"p";-0.0%"p";0.0%"p"';        // 계획대비 %p

      // ── 색상 팔레트 (AARRGGBB) ──────────────────────────────
      const C = {
        white:     'FFFFFFFF',
        hdrBg:     'FFF0F0F0',
        sumBg:     'FFF2F2F2',
        cumBg:     'FFE8E4D8',
        titleBg:   'FFD9E8F7',
        tx:        'FF222222',
        txSub:     'FF888888',
        red:       'FFA32D2D',
        pctBlueBg: 'FFEBF2FB',
        pctBlue:   'FF1B4F8A',
        pctRedBg:  'FFFEF2F2',
        pctRed:    'FFDC2626',
        bd:        'FFCCCCCC',
        bdDark:    'FF999999',
      };
      const thin = s => ({ style: 'thin', color: { rgb: s } });
      const bdr  = { top: thin(C.bd),     bottom: thin(C.bd),     left: thin(C.bd),     right: thin(C.bd)     };
      const bdrD = { top: thin(C.bdDark), bottom: thin(C.bdDark), left: thin(C.bdDark), right: thin(C.bdDark) };

      // 셀 값 v: 문자열=텍스트 / { v,f,z,str }=숫자·수식 셀
      function mkCell(v, bg, fg, bold, align, b) {
        const s = {
          fill:      { patternType: 'solid', fgColor: { rgb: bg || C.white } },
          font:      { name: 'Malgun Gothic', sz: 9, bold: !!bold, color: { rgb: fg || C.tx } },
          alignment: { horizontal: align || 'left', vertical: 'center' },
          border:    b || bdr,
        };
        if (v && typeof v === 'object') {
          // 숫자 또는 수식 셀
          const cell = { s: s };
          if (v.f !== undefined && v.f !== null && v.f !== '') {
            cell.f = v.f;
            cell.t = v.str ? 'str' : 'n';
            cell.v = (v.v !== undefined && v.v !== null) ? v.v : (v.str ? '' : 0);
          } else {
            cell.t = 'n';
            cell.v = (v.v === null || v.v === undefined || isNaN(v.v)) ? 0 : v.v;
          }
          if (v.z) { cell.z = v.z; s.numFmt = v.z; }   // z(SheetJS) + s.numFmt(스타일 포크) 둘 다
          return cell;
        }
        // 텍스트 셀
        return {
          v: (v === null || v === undefined) ? '' : String(v),
          t: 's',
          s: s,
        };
      }

      // Row objects → worksheet
      function buildWs(rows) {
        const ws = {};
        let maxC = 0;
        rows.forEach(function(row, r) {
          const { type, vals, nums, pcts, pace } = row;
          const last = vals.length - 1;
          if (last > maxC) maxC = last;
          vals.forEach(function(v, c) {
            const addr  = XLSX.utils.encode_cell({ r, c });
            const isLbl = c <= 1;
            const align = isLbl ? 'left' : 'right';

            if (type === 'title') {
              ws[addr] = mkCell(c === 0 ? v : '', C.titleBg, C.pctBlue, true, 'left', bdrD);
            } else if (type === 'blank') {
              ws[addr] = mkCell('', C.white, C.tx, false, 'left');
            } else if (type === 'header') {
              ws[addr] = mkCell(v, C.hdrBg, C.tx, true, 'center');
            } else if (type === 'sum') {
              ws[addr] = mkCell(v, C.sumBg, c === 1 ? C.txSub : C.tx, true,  c === 0 ? 'center' : align);
            } else if (type === 'cum') {
              ws[addr] = mkCell(v, C.cumBg, c === 1 ? C.txSub : C.tx, false, c === 0 ? 'center' : align);
            } else if (type === 'prog' || type === 'progSum') {
              const isSum = type === 'progSum';
              const bg = isSum ? C.sumBg : C.white;
              if (c === 0) {
                ws[addr] = mkCell(v, bg, C.tx, isSum, isSum ? 'center' : 'left');
              } else if (c === 1) {
                ws[addr] = mkCell(v, bg, C.txSub, false, 'left');
              } else if (c >= 2 && c <= 13) {
                // 월별 실적 금액
                ws[addr] = mkCell(v, bg, C.tx, isSum, 'right');
              } else if (c === 14) {
                // 누적실적/연간목표
                ws[addr] = mkCell(v, bg, C.tx, isSum, 'right');
              } else if (c === 15) {
                // 달성률
                ws[addr] = mkCell(v, bg, C.tx, isSum, 'right');
              } else if (c === 16) {
                // 목표대비 차이: + 빨강, - 파랑 (텍스트 색만)
                if (pace === null || pace === undefined || v === '') {
                  ws[addr] = mkCell(v, bg, C.tx, false, 'right');
                } else if (pace > 0) {
                  ws[addr] = mkCell(v, bg, C.pctRed,  true, 'right');
                } else if (pace < 0) {
                  ws[addr] = mkCell(v, bg, C.pctBlue, true, 'right');
                } else {
                  ws[addr] = mkCell(v, bg, C.tx, false, 'right');
                }
              }
            } else if (type === 'diff') {
              if (isLbl) {
                ws[addr] = mkCell(v, C.white, c === 1 ? C.txSub : C.tx, c === 0, 'left');
              } else {
                const n  = nums ? nums[c] : null;
                const fg = (n === null || n === undefined) ? C.tx : (n < 0 ? C.pctBlue : (n > 0 ? C.pctRed : C.tx));
                ws[addr] = mkCell(v, C.white, fg, n !== null && v !== '', 'right');
              }
            } else if (type === 'pct') {
              if (isLbl) {
                ws[addr] = mkCell(v, C.white, c === 1 ? C.txSub : C.tx, c === 0, 'left');
              } else {
                const p = pcts ? pcts[c] : null;
                if (p === null || p === undefined || v === '') {
                  ws[addr] = mkCell(v, C.white, C.tx, false, 'right');
                } else {
                  const under = p < 100;
                  ws[addr] = mkCell(v, under ? C.pctBlueBg : C.pctRedBg,
                                       under ? C.pctBlue   : C.pctRed, true, 'right');
                }
              }
            } else {
              // biz
              ws[addr] = mkCell(v, C.white, c === 1 ? C.txSub : C.tx, false, c === 0 ? 'left' : 'right');
            }
          });
        });
        ws['!ref']  = XLSX.utils.encode_range({ s: { r:0, c:0 }, e: { r: rows.length-1, c: maxC } });
        const colsArr = [];
        for (let c = 0; c <= maxC; c++) {
          if      (c === 0)  colsArr.push({ wch: 22 });
          else if (c === 1)  colsArr.push({ wch: 11 });
          else if (c === 14) colsArr.push({ wch: 22 });   // 연간합계 / 누적실적·연간목표
          else if (c === 15) colsArr.push({ wch: 11 });   // 달성률
          else if (c === 16) colsArr.push({ wch: 20 });   // 달성률 Gap(실적-계획)
          else               colsArr.push({ wch: 9  });
        }
        ws['!cols'] = colsArr;
        ws['!rows'] = rows.map(function() { return { hpt: 16 }; });
        return ws;
      }

      // 한 섹션(매출/EBIT) 행 생성 — 합계·누적·차이·달성률을 엑셀 수식으로.
      // rows: 누적 대상 배열 (이 함수가 직접 push). 본문값(계획/실적 월별)은
      // 편집 가능한 숫자 셀이고, 파생값은 본문 셀을 참조하는 수식 셀.
      function buildSection(rows, sectionLabel, planByBiz, planSumR, planCumR,
                            actByBiz, actSumUsd, actCumUsd, planConv, actConv, unitLabel) {
        const safe = v => (v === null || v === undefined) ? 0 : v;
        const nB   = bizList.length;
        const base = rows.length;                       // 섹션 시작 절대행 (title)

        // 섹션 내 절대 행 인덱스 (0-based)
        const planBiz0 = base + 2;
        const planBizL = planBiz0 + nB - 1;
        const planSumI = planBizL + 1;
        const planCumI = planSumI + 1;
        const actBiz0  = planCumI + 4;                  // +1 blank, +title, +header
        const actBizL  = actBiz0 + nB - 1;
        const actSumI  = actBizL + 1;
        const actCumI  = actSumI + 1;

        // 변환된 캐시값 (수식 결과 미리보기 — 엑셀 열 때 재계산됨)
        const planD = {}; bizList.forEach(b => { planD[b] = planByBiz[b].map(planConv); });
        const actD  = {}; bizList.forEach(b => { actD[b]  = actByBiz[b].map(v => v === null ? null : actConv(v)); });
        const planSumD = planSumR.map(planConv);
        const planCumD = planCumR.map(planConv);
        const actSumD  = actSumUsd.map(v => v === null ? null : actConv(v));
        const actCumD  = actCumUsd.map(v => v === null ? null : actConv(v));

        // 셀 헬퍼: num=숫자(편집가능), frm=숫자수식, frmS=문자열수식
        const num  = (v, z)    => ({ v: (v === null || v === undefined || isNaN(v)) ? 0 : v, z: z || Z_AMT });
        const frm  = (f, v, z) => ({ f: f, v: (v === null || v === undefined || isNaN(v)) ? 0 : v, z: z || Z_AMT });
        const frmS = (f, v)    => ({ f: f, v: v || '', str: true });

        // ── 계획표 ─────────────────────────────
        rows.push({ type: 'title',  vals: [sectionLabel + ' 계획'].concat(Array(NCOLS - 1).fill('')) });
        rows.push({ type: 'header', vals: HDR });
        bizList.forEach((b, k) => {
          const er = R(planBiz0 + k);
          const mv = planD[b];
          const cells = MONS.map((_, i) => num(mv[i]));
          cells.push(frm('SUM(C' + er + ':N' + er + ')', mv.reduce((s, v) => s + safe(v), 0)));
          rows.push({ type: 'biz', vals: [CONFIG.BIZ_LABELS[b] || b, '계획'].concat(cells) });
        });
        (function () {
          const cells = MONS.map((_, i) => {
            const cl = COL(i + 2);
            return frm('SUM(' + cl + R(planBiz0) + ':' + cl + R(planBizL) + ')', planSumD[i]);
          });
          cells.push(frm('SUM(O' + R(planBiz0) + ':O' + R(planBizL) + ')',
                         planSumD.reduce((s, v) => s + safe(v), 0)));
          rows.push({ type: 'sum', vals: ['합계', '계획'].concat(cells) });
        })();
        (function () {
          const er = R(planCumI), sEr = R(planSumI);
          const cells = MONS.map((_, i) => {
            const cl = COL(i + 2);
            if (i === 0) return frm(cl + sEr, planCumD[0]);
            return frm(COL(i + 1) + er + '+' + cl + sEr, planCumD[i]);
          });
          cells.push(frm('N' + er, planCumD[11]));
          rows.push({ type: 'cum', vals: ['누적', '계획'].concat(cells) });
        })();
        rows.push({ type: 'blank', vals: Array(NCOLS).fill('') });

        // ── 실적표 ─────────────────────────────
        rows.push({ type: 'title',  vals: [sectionLabel + ' 실적'].concat(Array(NCOLS - 1).fill('')) });
        rows.push({ type: 'header', vals: HDR });
        bizList.forEach((b, k) => {
          const er = R(actBiz0 + k);
          const mv = actD[b];
          const cells = MONS.map((_, i) => (i > cmIdx || mv[i] === null) ? '' : num(mv[i]));
          cells.push(frm('SUM(C' + er + ':N' + er + ')', mv.reduce((s, v) => s + safe(v), 0)));
          rows.push({ type: 'biz', vals: [CONFIG.BIZ_LABELS[b] || b, '실적'].concat(cells) });
        });
        (function () {
          const cells = MONS.map((_, i) => {
            if (i > cmIdx) return '';
            const cl = COL(i + 2);
            return frm('SUM(' + cl + R(actBiz0) + ':' + cl + R(actBizL) + ')', safe(actSumD[i]));
          });
          cells.push(frm('SUM(O' + R(actBiz0) + ':O' + R(actBizL) + ')',
                         actSumD.reduce((s, v) => s + safe(v), 0)));
          rows.push({ type: 'sum', vals: ['합계', '실적'].concat(cells) });
        })();
        (function () {
          const er = R(actCumI), sEr = R(actSumI);
          const cells = MONS.map((_, i) => {
            if (i > cmIdx) return '';
            const cl = COL(i + 2);
            if (i === 0) return frm(cl + sEr, safe(actCumD[0]));
            return frm(COL(i + 1) + er + '+' + cl + sEr, safe(actCumD[i]));
          });
          cells.push(cmIdx >= 0 ? frm(cmCol + er, safe(actCumD[cmIdx])) : '');
          rows.push({ type: 'cum', vals: ['누적', '실적'].concat(cells) });
        })();

        // ── 실적-계획 (월별) ───────────────────
        (function () {
          const aEr = R(actSumI), pEr = R(planSumI);
          const nums = [null, null], cells = [];
          MONS.forEach((_, i) => {
            if (i > cmIdx) { nums.push(null); cells.push(''); return; }
            const cl = COL(i + 2), v = safe(actSumD[i]) - safe(planSumD[i]);
            nums.push(v);
            cells.push(frm(cl + aEr + '-' + cl + pEr, v, Z_DIFF));
          });
          const tv = actSumD.reduce((s, v) => s + safe(v), 0) - planSumD.reduce((s, v) => s + safe(v), 0);
          nums.push(tv);
          cells.push(frm('O' + aEr + '-O' + pEr, tv, Z_DIFF));
          rows.push({ type: 'diff', nums: nums, vals: ['실적-계획 (월별)', ''].concat(cells) });
        })();

        // ── 실적-계획 (누적) ───────────────────
        (function () {
          const aEr = R(actCumI), pEr = R(planCumI);
          const nums = [null, null], cells = [];
          MONS.forEach((_, i) => {
            if (i > cmIdx) { nums.push(null); cells.push(''); return; }
            const cl = COL(i + 2), v = safe(actCumD[i]) - safe(planCumD[i]);
            nums.push(v);
            cells.push(frm(cl + aEr + '-' + cl + pEr, v, Z_DIFF));
          });
          if (cmIdx >= 0) {
            const v = safe(actCumD[cmIdx]) - safe(planCumD[cmIdx]);
            nums.push(v);
            cells.push(frm(cmCol + aEr + '-' + cmCol + pEr, v, Z_DIFF));
          } else { nums.push(null); cells.push(''); }
          rows.push({ type: 'diff', nums: nums, vals: ['실적-계획 (누적)', ''].concat(cells) });
        })();

        // ── 달성률 (누적, 계획대비) ────────────
        (function () {
          const aEr = R(actCumI), pEr = R(planCumI);
          const pcts = [null, null], cells = [];
          MONS.forEach((_, i) => {
            if (i > cmIdx || !planCumD[i]) { pcts.push(null); cells.push(''); return; }
            const cl = COL(i + 2), ratio = safe(actCumD[i]) / planCumD[i];
            pcts.push(ratio * 100);
            cells.push(frm('IF(' + cl + pEr + '=0,"",' + cl + aEr + '/' + cl + pEr + '-1)', ratio - 1, Z_PCTD));
          });
          if (cmIdx >= 0 && planCumD[cmIdx]) {
            const ratio = safe(actCumD[cmIdx]) / planCumD[cmIdx];
            pcts.push(ratio * 100);
            cells.push(frm('IF(' + cmCol + pEr + '=0,"",' + cmCol + aEr + '/' + cmCol + pEr + '-1)', ratio - 1, Z_PCTD));
          } else { pcts.push(null); cells.push(''); }
          rows.push({ type: 'pct', pcts: pcts, vals: ['달성률 (누적, 계획대비)', ''].concat(cells) });
        })();

        // ── 연간 달성률 (계획대비) ─────────────
        (function () {
          const aEr = R(actCumI), pSumEr = R(planSumI);
          const planTot = planSumD.reduce((s, v) => s + safe(v), 0);
          const pcts = [null, null], cells = [];
          MONS.forEach((_, i) => {
            if (i > cmIdx || !planTot) { pcts.push(null); cells.push(''); return; }
            const cl = COL(i + 2), p = safe(actCumD[i]) / planTot * 100;
            pcts.push(p);
            cells.push(frm('IF(O' + pSumEr + '=0,"",' + cl + aEr + '/O' + pSumEr + ')', p / 100, Z_PCT));
          });
          if (cmIdx >= 0 && planTot) {
            const p = safe(actCumD[cmIdx]) / planTot * 100;
            pcts.push(p);
            cells.push(frm('IF(O' + pSumEr + '=0,"",' + cmCol + aEr + '/O' + pSumEr + ')', p / 100, Z_PCT));
          } else { pcts.push(null); cells.push(''); }
          rows.push({ type: 'pct', pcts: pcts, vals: ['연간 달성률 (계획대비)', ''].concat(cells) });
        })();

        // ── ③ 사업별 월 실적 ───────────────────
        // 월 셀 = 실적표의 해당 월 실적, 우측 3열은 연간목표 대비 달성률·차이
        rows.push({ type: 'blank', vals: Array(NCOLS).fill('') });
        rows.push({ type: 'title', vals: [sectionLabel + ' 사업별 월 실적'].concat(Array(16).fill('')) });
        rows.push({ type: 'header', vals:
          ['사업', '구분'].concat(MONS).concat(['누적실적 / 연간계획 (' + (unitLabel || '') + ')', '달성률', '달성률 Gap(실적-계획)']) });

        bizList.forEach((b, k) => {
          const aEr = R(actBiz0 + k), pEr = R(planBiz0 + k);
          const cells = MONS.map((_, i) => {
            if (i > cmIdx) return '';
            const cl = COL(i + 2);
            return frm(cl + aEr, safe(actD[b][i]), Z_AMT);
          });
          let cumA = 0, cumP = 0, annP = 0;
          planD[b].forEach(v => annP += safe(v));
          for (let i = 0; i <= cmIdx && i < 12; i++) { cumA += safe(actD[b][i]); cumP += safe(planD[b][i]); }
          const pct  = annP > 0 ? cumA / annP : 0;
          const pace = annP > 0 ? (cumA - cumP) / annP * 100 : null;
          if (cmIdx >= 0) {
            cells.push(frmS('TEXT(SUM(C' + aEr + ':' + cmCol + aEr + '),"0.00")&" / "&TEXT(O' + pEr + ',"0.00")',
                            cumA.toFixed(2) + ' / ' + annP.toFixed(2)));
            cells.push(frm('IF(O' + pEr + '=0,"",SUM(C' + aEr + ':' + cmCol + aEr + ')/O' + pEr + ')', pct, Z_PCT));
            cells.push(frm('IF(O' + pEr + '=0,"",(SUM(C' + aEr + ':' + cmCol + aEr + ')-SUM(C' + pEr + ':' + cmCol + pEr + '))/O' + pEr + ')',
                           pace !== null ? pace / 100 : 0, Z_PP));
          } else { cells.push('', '', ''); }
          rows.push({ type: 'prog', pace: pace, vals: [CONFIG.BIZ_LABELS[b] || b, '실적'].concat(cells) });
        });

        (function () {
          const aSumEr = R(actSumI), pSumEr = R(planSumI);
          let tA = 0, tCP = 0;
          bizList.forEach(b => {
            for (let i = 0; i <= cmIdx && i < 12; i++) { tA += safe(actD[b][i]); tCP += safe(planD[b][i]); }
          });
          const tP   = planSumD.reduce((s, v) => s + safe(v), 0);
          const tPct = tP > 0 ? tA / tP : 0;
          const tPace = tP > 0 ? (tA - tCP) / tP * 100 : null;
          const cells = MONS.map((_, i) => {
            if (i > cmIdx) return '';
            const cl = COL(i + 2);
            return frm(cl + aSumEr, bizList.reduce((s, b) => s + safe(actD[b][i]), 0), Z_AMT);
          });
          if (cmIdx >= 0) {
            cells.push(frmS('TEXT(SUM(C' + aSumEr + ':' + cmCol + aSumEr + '),"0.00")&" / "&TEXT(O' + pSumEr + ',"0.00")',
                            tA.toFixed(2) + ' / ' + tP.toFixed(2)));
            cells.push(frm('IF(O' + pSumEr + '=0,"",SUM(C' + aSumEr + ':' + cmCol + aSumEr + ')/O' + pSumEr + ')', tPct, Z_PCT));
            cells.push(frm('IF(O' + pSumEr + '=0,"",(SUM(C' + aSumEr + ':' + cmCol + aSumEr + ')-SUM(C' + pSumEr + ':' + cmCol + pSumEr + '))/O' + pSumEr + ')',
                           tPace !== null ? tPace / 100 : 0, Z_PP));
          } else { cells.push('', '', ''); }
          rows.push({ type: 'progSum', pace: tPace, vals: ['합계', ''].concat(cells) });
        })();
      }

      // 한 단위 시트 = 매출 섹션 (+ KPI면 EBIT 섹션)
      function buildUnitSheet(planConv, actConv, unitLabel) {
        const rows = [];
        buildSection(rows, '매출', revByBiz, revSumRaw, revCumRaw,
                     actRevByBiz, actRevSumUsd, actRevCumUsd, planConv, actConv, unitLabel);
        if (!isEcMode) {
          rows.push({ type: 'blank', vals: Array(NCOLS).fill('') });
          rows.push({ type: 'blank', vals: Array(NCOLS).fill('') });
          buildSection(rows, 'EBIT', ebitByBiz, ebitSumRaw, ebitCumRaw,
                       actEbitByBiz, actEbitSumUsd, actEbitCumUsd, planConv, actConv, unitLabel);
        }
        return buildWs(rows);
      }

      const wb = XLSX.utils.book_new();
      wb.Workbook = { CalcPr: { fullCalcOnLoad: true } };   // 열 때 수식 자동 재계산

      if (isEcMode) {
        // EC mode: M USD only (plan already in M USD)
        XLSX.utils.book_append_sheet(wb, buildUnitSheet(v => v, v => v / 1e6, 'M USD'), 'M USD');
      } else if (hasRate) {
        // KPI mode: 3 sheets
        XLSX.utils.book_append_sheet(wb, buildUnitSheet(v => v * 1e8 / rate / 1e6, v => v / 1e6,                              'M USD'), 'M USD');
        XLSX.utils.book_append_sheet(wb, buildUnitSheet(v => v,                     v => v * rate / 1e8,                       '억원'),  '억원');
        XLSX.utils.book_append_sheet(wb, buildUnitSheet(v => v * 1e8 / rate * SGD_RATE / 1e6, v => v * SGD_RATE / 1e6, 'M SGD'), 'M SGD');
      } else {
        // KPI mode without exchange rate: 억원 plan only
        XLSX.utils.book_append_sheet(wb, buildUnitSheet(v => v, () => null, '억원'), '억원');
      }

      const _d = new Date();
      const _pad = n => String(n).padStart(2, '0');
      const _stamp = _d.getFullYear() + _pad(_d.getMonth() + 1) + _pad(_d.getDate()) + '_' + _pad(_d.getHours()) + _pad(_d.getMinutes());
      XLSX.writeFile(wb, 'KPI_' + year + '_' + _modeLabel(mode) + '_' + _stamp + '.xlsx');
    },

    updateExchangeRate(val) {
      const rate=parseFloat(val)||0;
      _saveExchangeRate(rate);
      Pages.KpiTarget.render();
    },

    saveFactors() {
      const newFactors={};
      CONFIG.BIZ_LIST.forEach(b=>{ const inp=document.getElementById('factor-'+b); newFactors[b]=parseFloat(inp?.value??1); });
      _saveFactors(newFactors);
      Pages.KpiTarget.closeFactorPanel();
      Pages.KpiTarget.render();
      UI.toast('Factor 저장 완료');
    },
  };

})();
