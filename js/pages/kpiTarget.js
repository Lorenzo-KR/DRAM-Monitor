/**
 * pages/kpiTarget.js
 * KPI 목표 설정 — 롤링 데이터 기반
 * 모드: 'kpi67' | 'kpi103' | 'ec'
 */

Pages.KpiTarget = (() => {

  let _year        = new Date().getFullYear();
  let _bizSet      = new Set(['all']);
  let _rollingYear = new Date().getFullYear();
  let _rollingMode = 'kpi67'; // 'kpi67' | 'kpi103' | 'ec'

  const _emptyRolling = () => ({
    2026: {
      DRAM: [0,0,0.1,0.1556,0.1556,0.1556,0.1556,0.1556,0.1556,0.1556,0.1556,0.1556],
      SSD:  [0,0,0.1,0.0667,0.0667,0.0667,0.0667,0.0667,0.0667,0.0667,0.0667,0.0667],
      MID:  [0,0,1.2,0,0,1.2,0,0,1.2,0,0,1.2],
      SCR: Array(12).fill(0), RMA: Array(12).fill(0),
      SUS: Array(12).fill(0), MOD: Array(12).fill(0),
    },
    2027: { DRAM:Array(12).fill(0),SSD:Array(12).fill(0),MID:Array(12).fill(0),SCR:Array(12).fill(0),RMA:Array(12).fill(0),SUS:Array(12).fill(0),MOD:Array(12).fill(0) },
    2028: { DRAM:Array(12).fill(0),SSD:Array(12).fill(0),MID:Array(12).fill(0),SCR:Array(12).fill(0),RMA:Array(12).fill(0),SUS:Array(12).fill(0),MOD:Array(12).fill(0) },
  });

  // ── 롤링 데이터 저장소 3개 ─────────────────────────────────
  let _rolling67  = JSON.parse(localStorage.getItem('kpi_rolling')     || 'null') || _emptyRolling();
  let _rolling103 = JSON.parse(localStorage.getItem('kpi_rolling_103') || 'null') || _emptyRolling();
  let _ecRolling  = JSON.parse(localStorage.getItem('ec_rolling')      || 'null') || _emptyRolling();

  function _getActiveRolling() {
    if (_rollingMode === 'ec')     return _ecRolling;
    if (_rollingMode === 'kpi103') return _rolling103;
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

  function _getActualProfit(year, biz) { return _getActual(year, biz) * _getFactor(biz); }

  // ── 롤링 목표 계산 ────────────────────────────────────────
  function _getRollingStore(mode) {
    if (mode === 'ec')     return _ecRolling;
    if (mode === 'kpi103') return _rolling103;
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
    if (mode === 'ec') return ebitVals.map(v => v * 1000000);         // M USD → USD
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
  function _saveRollingData(year, data) {
    if (_rollingMode === 'ec') {
      if (!_ecRolling[year]) _ecRolling[year] = {};
      Object.assign(_ecRolling[year], data);
      localStorage.setItem('ec_rolling', JSON.stringify(_ecRolling));
      Api.setSetting('ec_rolling', JSON.stringify(_ecRolling));
    } else if (_rollingMode === 'kpi103') {
      if (!_rolling103[year]) _rolling103[year] = {};
      Object.assign(_rolling103[year], data);
      localStorage.setItem('kpi_rolling_103', JSON.stringify(_rolling103));
      Api.setSetting('kpi_rolling_103', JSON.stringify(_rolling103));
    } else {
      if (!_rolling67[year]) _rolling67[year] = {};
      Object.assign(_rolling67[year], data);
      localStorage.setItem('kpi_rolling', JSON.stringify(_rolling67));
      Api.setSetting('kpi_rolling', JSON.stringify(_rolling67));
    }
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
    sync('ec_rolling',      _ecRolling,  null);
    _loadFactors();
    _loadExchangeRate();
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
  function _isKpi(mode) { return mode === 'kpi67' || mode === 'kpi103'; }
  function _modeLabel(mode) {
    if (mode === 'kpi67')  return 'KPI기준(67억)';
    if (mode === 'kpi103') return 'KPI기준(103억)';
    return 'EC 기준';
  }
  function _modeColor(mode) {
    if (mode === 'kpi103') return '#B45309';
    if (mode === 'ec')     return '#0F6E56';
    return '#185FA5';
  }
  function _rollingLabel(mode) {
    if (mode === 'kpi103') return 'KPI롤링(103억)';
    if (mode === 'ec')     return 'EC 롤링 입력';
    return 'KPI롤링(67억)';
  }

  // ── 단위 상태 ─────────────────────────────────────────────
  // ── 단위 상태 ─────────────────────────────────────────────

  // ================================================================
  // 월별 트래킹 — 단위 상태
  // ================================================================
  let _trackingUnit = 'usd'; // 'usd' | 'krw'
  let _tableView    = 'ebit'; // 'ebit' | 'rev' — 표 보기 모드

  // ================================================================
  // _renderTracking
  // 그래프 아래 두 개의 매트릭스 표를 렌더링
  //   - 상단: 예상(목표) Biz × 12개월
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
    const useKrw    = _trackingUnit === 'krw' && isKpiMode;  // EC는 항상 USD

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
      // 예상(목표) 값 표시 — 롤링 원본값 그대로 사용
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
      th:    'padding:5px 4px;text-align:center;font-size:11px;font-weight:700;font-family:Pretendard,sans-serif;background:#D9D9D9;' + BDH + ';white-space:nowrap',
      thMon: 'padding:5px 4px;text-align:center;font-size:11px;font-weight:700;font-family:Pretendard,sans-serif;background:#D9D9D9;' + BDH + ';white-space:nowrap;width:62px',
      thBiz: 'padding:5px 6px;text-align:center;font-size:11px;font-weight:700;font-family:Pretendard,sans-serif;background:#D9D9D9;' + BDH + ';white-space:nowrap;width:100px',
      thSub: 'padding:5px 6px;text-align:center;font-size:11px;font-weight:700;font-family:Pretendard,sans-serif;background:#D9D9D9;' + BDH + ';white-space:nowrap;width:72px',
      thSum: 'padding:5px 6px;text-align:center;font-size:11px;font-weight:700;font-family:Pretendard,sans-serif;background:#D9D9D9;' + BDH + ';white-space:nowrap;width:70px',
      td:    'padding:4px 4px;text-align:right;font-size:11px;font-family:Pretendard,sans-serif;' + BD + ';width:62px',
      tdL:   'padding:4px 8px;text-align:left;font-size:11px;font-family:Pretendard,sans-serif;' + BD + ';white-space:nowrap;width:100px',
      tdSub: 'padding:4px 8px;text-align:left;font-size:11px;font-family:Pretendard,sans-serif;font-weight:400;color:#555;' + BD + ';white-space:nowrap;width:72px',
      tdSum: 'padding:4px 6px;text-align:right;font-size:11px;font-family:Pretendard,sans-serif;font-weight:600;' + BD + ';background:#F2F2F2;width:70px',
      tdCum: 'padding:4px 6px;text-align:right;font-size:11px;font-family:Pretendard,sans-serif;font-weight:600;' + BD + ';background:#E8E4D8;width:70px',
      tdCumL:'padding:4px 8px;text-align:left;font-size:11px;font-family:Pretendard,sans-serif;font-weight:400;color:#555;' + BD + ';background:#E8E4D8;white-space:nowrap;width:72px',
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
      // 롤링 저장값 표시:
      //   KPI+억원 모드: 억원 그대로 소수2자리
      //   KPI+USD  모드: 억원 → M USD 역환산 (÷환율÷1억 × 100만)
      //   EC        모드: M USD 그대로 소수2자리
      if (v === null || v === undefined) return '—';
      const n = parseFloat(v) || 0;
      if (n === 0) return '—';
      if (isKpiMode && !useKrw && hasRate) {
        // 억원 → USD → M USD: n억원 ÷ 환율 × 1억 ÷ 1백만
        const mUsd = (n * 100000000 / _exchangeRate) / 1000000;
        return mUsd.toFixed(2);
      }
      return n.toFixed(2);
    }

    function fmtActual(usdVal) {
      // 실적 USD 원본 → 표시 단위로 변환
      if (usdVal === null || usdVal === undefined) return null;
      if (isEcMode) {
        // EC: USD → M USD
        return (usdVal / 1000000).toFixed(2);
      }
      if (useKrw) {
        // KPI+원화: USD × 환율 → 원 → 억원
        return (usdVal * _exchangeRate / 100000000).toFixed(2);
      }
      // KPI+USD: USD → M USD
      return (usdVal / 1000000).toFixed(2);
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
        return _getActualMonth(year, b, i + 1) * _getFactor(b); // EBIT = 매출 × Factor
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

    // 호환성 alias (요약카드/달성률 계산은 EBIT 기준 유지)
    const tgtSumRaw = ebitSumRaw;
    const tgtCumRaw = ebitCumRaw;
    const actCumUsd = actEbitCumUsd;

    const totalTgtRaw = tgtSumRaw.reduce((s, v) => s + v, 0);
    if (totalTgtRaw === 0) {
      el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--tbl-tx-body);font-size:12px">롤링 데이터를 먼저 입력해주세요</div>';
      return;
    }

    // curMonIdx가 -1이면 미래 연도 — 실적 없음
    const safeMonIdx = Math.max(0, Math.min(curMonIdx, 11));

    // 요약 카드용 값
    const curActUsd    = curMonIdx >= 0 ? (actCumUsd[curMonIdx] ?? 0) : 0;
    const curTgtRaw    = tgtCumRaw[safeMonIdx] ?? 0;
    const curActDisp   = parseFloat(fmtActual(curActUsd)) || 0;
    const overallPct   = curTgtRaw > 0 ? Math.round(curActDisp / curTgtRaw * 100) : 0;
    const diffCumFinal = curActDisp - curTgtRaw;
    const pctCumFinal  = curTgtRaw > 0 ? curActDisp / curTgtRaw * 100 : null;  // ★ 먼저 선언
    const periodLabel  = '1~' + (curMonIdx + 1) + '월';
    const unitLabel    = isEcMode ? 'M USD' : (useKrw ? '억원' : 'M USD');

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
      var diff = Math.round(pct) - 100;
      return (diff > 0 ? '+' : '') + diff + '%';
    }

    const mc = _modeColor(mode);
    const cards = [
      { label: '연간 목표', value: totalTgtRaw.toFixed(2) + ' ' + unitLabel, sub: _modeLabel(mode) },
      { label: '누적 실적 (' + periodLabel + ')', value: (parseFloat(fmtActual(curActUsd))||0).toFixed(2) + ' ' + unitLabel, sub: '목표 ' + curTgtRaw.toFixed(2) + ' ' + unitLabel },
      { label: '누적 달성률 (' + periodLabel + ')', value: fmtPctDiff(overallPct), color: pctColor(overallPct), sub: '계획대비 · ' + unitLabel + ' 기준' },
      { label: '누적 차이 (' + periodLabel + ')', value: fmtDiff(diffCumFinal) + ' ' + unitLabel, color: diffColor(diffCumFinal), sub: diffCumFinal < 0 ? '목표 미달' : diffCumFinal > 0 ? '목표 초과' : '정확 달성' },
    ].map(c =>
      '<div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:11px 14px">'
      + '<div style="font-size:12px;color:var(--tbl-tx-body);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">' + c.label + '</div>'
      + '<div style="font-size:18px;font-weight:600;' + (c.color ? 'color:' + c.color : '') + '">' + c.value + '</div>'
      + '<div style="font-size:12px;color:var(--tbl-tx-body);margin-top:2px">' + c.sub + '</div>'
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
          + '<span style="font-size:11px;font-family:Pretendard,sans-serif;color:var(--tx2)">' + item.label + '</span>'
          + '</span>';
      }).join('');
      return '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px;margin-bottom:12px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
        + '<span style="font-size:12px;font-weight:600;font-family:Pretendard,sans-serif;color:var(--tx)">' + title + '</span>'
        + '<div style="display:flex;gap:12px">' + legendHtml + '</div>'
        + '</div>'
        + '<div style="position:relative;height:200px"><canvas id="' + canvasId + '"></canvas></div>'
        + '</div>';
    }

    // 차트: EBIT 누적만 유지
    var chart1Title = _modeLabel(mode) + ' · ' + chartLabel + ' 누적 · ' + unitLabel;
    var chart1Html  = makeChartCard('cv-ebit-cum', chart1Title, [
      { label: chartLabel + ' 목표 누적', color: '#85B7EB', dashed: true  },
      { label: chartLabel + ' 실적 누적', color: '#1D9E75', dashed: false },
    ]);

    // EC 모드는 항상 매출 뷰 (EBIT 없음)
    var showEbit = isEcMode ? false : (_tableView === 'ebit');

    // 표/차트 레이블: EC=매출, KPI=EBIT or 매출
    var planLabel = isEcMode ? '매출(계획)' : (showEbit ? 'EBIT(계획)' : '매출(계획)');
    var actLabel  = isEcMode ? '매출(실적)' : (showEbit ? 'EBIT(실적)' : '매출(실적)');
    var chartLabel = isEcMode ? '매출' : (showEbit ? 'EBIT' : '매출');

    var unitBtns = '<div style="display:flex;align-items:center;gap:16px;margin-bottom:10px;flex-wrap:wrap">'
      // 단위 전환
      + '<div style="display:flex;align-items:center;gap:8px">'
      + '<span style="font-size:11px;color:var(--tx2);font-weight:500;font-family:Pretendard,sans-serif">단위:</span>'
      + '<div style="display:flex;border:1.5px solid #CCC;border-radius:6px;overflow:hidden">'
      + '<button onclick="Pages.KpiTarget.setTrackingUnit(\'usd\')" style="padding:4px 14px;border:none;font-size:11px;font-weight:600;cursor:pointer;font-family:Pretendard,sans-serif;background:' + (!useKrw ? '#1D1D1F' : '#fff') + ';color:' + (!useKrw ? '#fff' : '#555') + '">M USD</button>'
      + (isKpiMode
        ? '<button onclick="Pages.KpiTarget.setTrackingUnit(\'krw\')" style="padding:4px 14px;border:none;font-size:11px;font-weight:600;cursor:pointer;font-family:Pretendard,sans-serif;background:' + (useKrw ? '#185FA5' : '#fff') + ';color:' + (useKrw ? '#fff' : '#555') + ';' + (!hasRate ? 'opacity:0.4;cursor:not-allowed;' : '') + '"' + (!hasRate ? ' disabled' : '') + '>억원 (₩)</button>'
        : '')
      + '</div>'
      + '<span style="font-size:11px;color:var(--tx3);font-family:Pretendard,sans-serif">' + unitLabel + (useKrw && hasRate ? ' · 환율 ' + _exchangeRate.toLocaleString() : '') + '</span>'
      + '</div>'
      // 표 뷰 전환 (KPI 모드에서만)
      + (isKpiMode
        ? '<div style="display:flex;align-items:center;gap:8px">'
          + '<span style="font-size:11px;color:var(--tx2);font-weight:500;font-family:Pretendard,sans-serif">표 보기:</span>'
          + '<div style="display:flex;border:1.5px solid #CCC;border-radius:6px;overflow:hidden">'
          + '<button onclick="Pages.KpiTarget.setTableView(\'ebit\')" style="padding:4px 14px;border:none;font-size:11px;font-weight:600;cursor:pointer;font-family:Pretendard,sans-serif;background:' + (showEbit ? '#0F6E56' : '#fff') + ';color:' + (showEbit ? '#fff' : '#555') + '">EBIT</button>'
          + '<button onclick="Pages.KpiTarget.setTableView(\'rev\')"  style="padding:4px 14px;border:none;font-size:11px;font-weight:600;cursor:pointer;font-family:Pretendard,sans-serif;background:' + (!showEbit ? '#185FA5' : '#fff') + ';color:' + (!showEbit ? '#fff' : '#555') + '">매출</button>'
          + '</div>'
          + '</div>'
        : '')
      + '</div>';

    // ── 표: EBIT or 매출 선택 뷰 ─────────────────────────────
    // showEbit=true  → EBIT(계획)/EBIT(실적) 행만 표시
    // showEbit=false → 매출(계획)/매출(실적) 행만 표시
    // EC 모드는 항상 EBIT(=M USD) 표시

    // 계획 표 데이터 행
    var tgtDataRows = bizList.map(function(b) {
      var vals    = showEbit ? ebitByBiz[b] : revByBiz[b];
      var subLabel = showEbit ? 'EBIT(계획)' : '매출(계획)';
      var subColor = showEbit ? '#0F6E56'    : '#185FA5';
      var cells = MONTHS.map(function(_, i) {
        var v   = vals[i];
        var dim = i > curMonIdx ? ';color:#BBB' : '';
        return '<td style="' + TS.td + dim + '">' + fmtRolling(v) + '</td>';
      }).join('');
      var total = vals.reduce(function(s, v) { return s + v; }, 0);
      return '<tr>'
        + '<td style="' + TS.tdL + ';font-weight:500">' + (CONFIG.BIZ_LABELS[b] || b) + '</td>'
        + '<td style="' + TS.tdSub + ';color:' + subColor + '">' + subLabel + '</td>'
        + cells
        + '<td style="' + TS.tdSum + ';color:' + subColor + '">' + fmtRolling(total) + '</td>'
        + '</tr>';
    }).join('');

    // 계획 합계행
    var tgtVals     = isEcMode ? revSumRaw  : (showEbit ? ebitSumRaw  : revSumRaw);
    var tgtCumVals  = isEcMode ? revCumRaw  : (showEbit ? ebitCumRaw  : revCumRaw);
    var tgtTotalAll = tgtVals.reduce(function(s, v) { return s + v; }, 0);
    var tgtSubLabel = isEcMode ? '매출' : (showEbit ? 'EBIT' : '매출');
    var tgtSubColor = isEcMode ? '#0F6E56' : (showEbit ? '#0F6E56' : '#185FA5');

    var tgtSumRow = '<tr style="background:#F2F2F2">'
      + '<td style="' + TS.tdSum + ';text-align:center">합계</td>'
      + '<td style="' + TS.tdSub + ';color:' + tgtSubColor + ';background:#F2F2F2">' + tgtSubLabel + '(계획)</td>'
      + tgtVals.map(function(v) { return '<td style="' + TS.tdSum + '">' + fmtRolling(v) + '</td>'; }).join('')
      + '<td style="' + TS.tdSum + '">' + fmtRolling(tgtTotalAll) + '</td>'
      + '</tr>';

    var tgtCumRow = '<tr style="background:#E8E4D8">'
      + '<td style="' + TS.tdCum + ';text-align:center">누적</td>'
      + '<td style="' + TS.tdCumL + ';color:' + tgtSubColor + '">' + tgtSubLabel + '(계획)</td>'
      + tgtCumVals.map(function(v) { return '<td style="' + TS.tdCum + '">' + fmtRolling(v) + '</td>'; }).join('')
      + '<td style="' + TS.tdCum + '">' + fmtRolling(tgtTotalAll) + '</td>'
      + '</tr>';

    // 실적 표 데이터 행
    // EC 모드: 매출 실적만 / KPI: showEbit에 따라 EBIT or 매출
    var actByBizView   = (isEcMode || !showEbit) ? actRevByBiz  : actEbitByBiz;
    var actSumUsdView  = (isEcMode || !showEbit) ? actRevSumUsd  : actEbitSumUsd;
    var actCumUsdView  = (isEcMode || !showEbit) ? actRevCumUsd  : actEbitCumUsd;
    var actSubLabel    = isEcMode ? '매출(실적)' : (showEbit ? 'EBIT(실적)' : '매출(실적)');
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
        + '<td style="' + TS.tdSub + ';color:' + actSubColor + '">' + actSubLabel + '</td>'
        + cells
        + '<td style="' + TS.tdSum + ';color:' + actSubColor + '">' + (parseFloat(totalDisp) > 0 ? totalDisp : '—') + '</td>'
        + '</tr>';
    }).join('');

    var actSumDispView  = MONTHS.map(function(_, i) { return fmtActual(actSumUsdView[i]); });
    var actCumDispView  = MONTHS.map(function(_, i) { return actCumUsdView[i] !== null ? fmtActual(actCumUsdView[i]) : null; });
    var actTotalDispView = fmtActual(MONTHS.reduce(function(s, _, i) { return s + (actSumUsdView[i] || 0); }, 0));

    var actSumRow = '<tr style="background:#F2F2F2">'
      + '<td style="' + TS.tdSum + ';text-align:center">합계</td>'
      + '<td style="' + TS.tdSub + ';color:' + actSubColor + ';background:#F2F2F2">' + actSubLabel + '</td>'
      + MONTHS.map(function(_, i) {
          var d = actSumDispView[i];
          return '<td style="' + TS.tdSum + '">' + (d !== null && parseFloat(d) !== 0 ? d : (i <= curMonIdx ? '—' : '')) + '</td>';
        }).join('')
      + '<td style="' + TS.tdSum + '">' + (parseFloat(actTotalDispView) > 0 ? actTotalDispView : '—') + '</td>'
      + '</tr>';

    var actCumRow = '<tr style="background:#E8E4D8">'
      + '<td style="' + TS.tdCum + ';text-align:center">누적</td>'
      + '<td style="' + TS.tdCumL + ';color:' + actSubColor + '">' + actSubLabel + '</td>'
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
    var tgtSumDispArr = tgtSumFmt;  // 달성률 계산에도 사용
    var tgtCumDispArr = tgtCumFmt;
    var actSumRef     = actSumDispView;
    var actCumRef     = actCumDispView;

    // 실적-계획 (월별)
    var diffMonRow = '<tr>'
      + '<td colspan="2" style="' + TS.tdL + '">실적-계획 (월별)</td>'
      + MONTHS.map(function(_, i) {
          if (i > curMonIdx) return '<td style="' + TS.td + '"></td>';
          var d = (parseFloat(actSumRef[i]) || 0) - tgtSumFmt[i];
          return '<td style="' + TS.td + ';color:' + diffColor(d) + ';font-weight:600">' + fmtDiff(d) + '</td>';
        }).join('')
      + (function() {
          var aSum = 0, tSum = 0;
          for (var i = 0; i <= curMonIdx && i < 12; i++) {
            aSum += parseFloat(actSumRef[i]) || 0;
            tSum += tgtSumFmt[i];
          }
          var d = aSum - tSum;
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
          var d = (parseFloat(actCumRef[curMonIdx]) || 0) - tgtCumFmt[curMonIdx];
          return '<td style="' + TS.tdSum + ';color:' + diffColor(d) + '">' + fmtDiff(d) + '</td>';
        })()
      + '</tr>';

    // 달성률 (누적) — 계획대비 +30%/-3% 표현
    var pctCumRow = '<tr>'
      + '<td colspan="2" style="' + TS.tdL + '">달성률 (누적, 계획대비)</td>'
      + MONTHS.map(function(_, i) {
          if (i > curMonIdx || !tgtCumDispArr[i]) return '<td style="' + TS.td + '"></td>';
          var p    = (parseFloat(actCumRef[i]) || 0) / tgtCumDispArr[i] * 100;
          var disp = fmtPctDiff(p);
          var pRnd = Math.round(p);
          return '<td style="' + TS.td + ';color:' + pctColor(pRnd) + ';background:' + pctBg(pRnd) + ';font-weight:600">' + disp + '</td>';
        }).join('')
      + (function() {
          var p    = pctCumFinal !== null ? pctCumFinal : null;
          var pRnd = p !== null ? Math.round(p) : null;
          var disp = p !== null ? fmtPctDiff(p) : '—';
          return '<td style="' + TS.tdSum + ';color:' + pctColor(pRnd) + ';background:' + pctBg(pRnd) + '">' + disp + '</td>';
        })()
      + '</tr>';

    // ── 표 조립 ───────────────────────────────────────────────
    const colgroup = '<colgroup><col style="width:100px"><col style="width:72px">'
      + MONTHS.map(function() { return '<col style="width:62px">'; }).join('')
      + '<col style="width:70px"></colgroup>';

    const tgtTable = '<table style="border-collapse:collapse;width:100%;table-layout:fixed">'
      + colgroup + buildHeader()
      + '<tbody>' + tgtDataRows + tgtSumRow + tgtCumRow + '</tbody></table>';

    const actTable = '<table style="border-collapse:collapse;width:100%;table-layout:fixed">'
      + colgroup + buildHeader()
      + '<tbody>' + actDataRows + actSumRow + actCumRow + diffMonRow + diffCumRow + pctCumRow + '</tbody></table>';

    // ── 최종 렌더 ────────────────────────────────────────────
    el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">' + cards + '</div>'
      + chart1Html
      + unitBtns
      + '<div style="margin-bottom:4px">'
      + '<div style="font-size:11px;font-weight:700;color:var(--tx2);font-family:Pretendard,sans-serif;padding:4px 2px;letter-spacing:.05em">'
      + '① ' + (showEbit ? 'EBIT 계획 표' : '매출 계획 표') + ' — ' + _modeLabel(mode)
      + '</div>'
      + '<div style="overflow-x:auto;margin-bottom:6px;border:1px solid #999;border-radius:4px">' + tgtTable + '</div>'
      + '</div>'
      + '<div style="margin-bottom:4px">'
      + '<div style="font-size:11px;font-weight:700;color:var(--tx2);font-family:Pretendard,sans-serif;padding:4px 2px;letter-spacing:.05em">'
      + '② ' + (showEbit ? 'EBIT 실적 표' : '매출 실적 표') + ' (실적 · 달성률 포함)'
      + '</div>'
      + '<div style="overflow-x:auto;margin-bottom:4px;border:1px solid #999;border-radius:4px">' + actTable + '</div>'
      + '</div>';

    // ================================================================
    // 차트 렌더 — EBIT 누적 1개
    // ================================================================
    setTimeout(function() {

      // 값 → 표시단위 변환
      function toDisp(v) {
        if (v === null) return null;
        if (isEcMode) return v / 1000000;
        if (useKrw)   return v * _exchangeRate / 100000000;
        return v / 1000000;
      }
      function fmtTick(v) {
        return isEcMode ? v.toFixed(1) + 'M' : (useKrw ? v.toFixed(1) + '억' : v.toFixed(1) + 'M');
      }
      function fmtTooltip(v, label) {
        var unit = (isEcMode || !useKrw) ? ' M USD' : '억원';
        return ' ' + label + ': ' + (v || 0).toFixed(2) + unit;
      }
      function makeChartOptions(tooltipFn, tickFn, yMax) {
        var yOpts = { grid:{color:'rgba(0,0,0,0.05)'}, ticks:{color:'#9aa0ad',font:{size:11},callback:tickFn}, beginAtZero:true };
        if (yMax != null) yOpts.max = yMax;
        return {
          responsive:true, maintainAspectRatio:false,
          plugins:{
            legend:{display:false},
            tooltip:{mode:'index',intersect:false,callbacks:{label:tooltipFn}}
          },
          scales:{
            x:{grid:{display:false},ticks:{color:'#9aa0ad',font:{size:11},autoSkip:false}},
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
        // 목표 누적: raw 단위(억원 or M USD)로 누적 후 표시
        et += ebitSumRaw[i]; // 억원 or M USD
        if (useKrw || isEcMode) {
          ebitTgtCum.push(et); // 억원(KPI+억원) or M USD(EC) 그대로
        } else {
          // KPI+M USD: 억원 → M USD 역환산
          ebitTgtCum.push(hasRate ? et * 100000000 / _exchangeRate / 1000000 : et);
        }

        // 실적 누적: USD → 표시 단위 변환
        if (i <= curMonIdx) {
          var actUsd = bizList.reduce(function(s, b) {
            return s + _getActualMonth(year, b, i + 1) * _getFactor(b);
          }, 0);
          ea += actUsd;
          // USD → 표시 단위
          if (isEcMode)   ebitActCum.push(ea / 1000000);                       // M USD
          else if (useKrw) ebitActCum.push(ea * _exchangeRate / 100000000);    // 억원
          else             ebitActCum.push(ea / 1000000);                       // M USD
        } else {
          ebitActCum.push(null);
        }
      });

      // y축: 데이터 최대값 기준으로 적절한 최대값 설정
      var allVals = ebitTgtCum.concat(ebitActCum).filter(function(v) { return v !== null && v > 0; });
      var dataMax = allVals.length > 0 ? Math.max.apply(null, allVals) : 10;
      var yMax    = dataMax * 1.3;

      destroyAndCreate('cv-ebit-cum', {
        type: 'line',
        data: { labels: MONTHS, datasets: [
          { label: chartLabel + ' 목표 누적', data:ebitTgtCum,
            borderColor:'#85B7EB', borderWidth:2, borderDash:[5,3],
            pointRadius:3, pointBackgroundColor:'#85B7EB', fill:false, tension:0 },
          { label: chartLabel + ' 실적 누적', data:ebitActCum,
            borderColor:'#1D9E75', borderWidth:2.5,
            pointRadius:ebitActCum.map(function(v){return v!==null?4:0;}),
            pointBackgroundColor:'#1D9E75',
            fill:{target:0,above:'rgba(29,158,117,0.08)',below:'rgba(226,75,74,0.08)'},
            tension:0.2 },
        ]},
        options: makeChartOptions(
          function(ctx) { return fmtTooltip(ctx.raw, ctx.dataset.label); },
          function(v)   { return fmtTick(v); },
          yMax
        )
      });

    }, 50);
  }

  // ── 메인 렌더 ─────────────────────────────────────────────
  return {
    selectYear, switchBiz,

    getTarget:        (year,biz)        => _getTarget(year,biz,'kpi67'),
    getTotalTarget:   (year)            => _getTotalTarget(year,'kpi67'),
    getMonthlyTarget: (year,biz,month)  => _getMonthlyTarget(year,biz,month,'kpi67'),
    loadFromSettings: ()                => _loadFromSettings(),

    getBizSummary(year, biz) {
      const hasRate = _exchangeRate > 0;
      const tgt = _getTarget(year, biz, 'kpi67');
      if (!tgt) return null;
      const actUsd = _getActualProfit(year, biz);
      const actKrw = hasRate ? actUsd * _exchangeRate : null;
      const pct = tgt > 0 ? Math.min(100, Math.round((hasRate ? actKrw : actUsd) / tgt * 100)) : 0;
      return { tgt, act: hasRate ? actKrw : actUsd, pct, hasRate };
    },

    getKpiSummary(year) {
      const hasRate = _exchangeRate > 0;
      const tgtRaw  = _getTotalTarget(year, 'kpi67');
      if (tgtRaw <= 0) return { tgt:null, act:null, pct:null, hasRate, unit:hasRate?'krw':'usd' };
      const actKrw = hasRate ? CONFIG.BIZ_LIST.reduce((s,b)=>s+_getActualProfit(year,b)*_exchangeRate,0) : null;
      const actUsd = CONFIG.BIZ_LIST.reduce((s,b)=>s+_getActualProfit(year,b),0);
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

      const bizRows = CONFIG.BIZ_LIST.map(b => {
        const tgtRaw = _getTarget(year, b, mode);
        const rawAct = _getActual(year, b);
        const tgtKrw = tgtRaw;
        const actKrw = hasRate ? _getActualProfit(year,b)*_exchangeRate : null;
        const tgtUsd = tgtRaw;
        const actUsd = rawAct;
        const tgt = isKpiM ? tgtKrw : tgtUsd;
        const act = isKpiM ? (hasRate ? actKrw : _getActualProfit(year,b)) : actUsd;
        const pct   = tgt>0&&act!==null ? Math.min(100,Math.round(act/tgt*100)) : 0;
        const rem   = tgt>0&&act!==null ? Math.max(0,tgt-act) : 0;
        const color = CONFIG.BIZ_COLORS[b];
        const factor= _getFactor(b);
        const barClr= pct>=100?'#1D9E75':pct>=70?color:'#EF9F27';

        const fmtTgt=()=>{
          if (!tgt) return '<span style="color:var(--tbl-tx-body);font-weight:400">미입력</span>';
          if (isKpiM) return `<div style="font-weight:600">${(tgt/100000000).toFixed(2)}억원</div>`;
          return '$'+formatNumber(Math.round(tgt));
        };
        const fmtAct=()=>{
          if (isKpiM) {
            if (hasRate&&actKrw>0) return `<div style="font-weight:600">${(actKrw/100000000).toFixed(2)}억원</div><div style="font-size:10px;color:#888">$${formatNumber(Math.round(_getActualProfit(year,b)))} × ${_exchangeRate.toLocaleString()}</div><div style="font-size:10px;color:#aaa">매출 $${formatNumber(Math.round(rawAct))}</div>`;
            if (rawAct>0) return `<div style="color:#888">환율 미입력</div><div style="font-size:10px;color:#aaa">매출 $${formatNumber(Math.round(rawAct))}</div>`;
            return '—';
          }
          return actUsd>0?'$'+formatNumber(Math.round(actUsd)):'—';
        };
        const fmtRem=()=>{
          if (!tgt) return '—';
          if (isKpiM&&hasRate) return `<div>${(rem/100000000).toFixed(2)}억원</div>`;
          if (isKpiM) return `${(rem/100000000).toFixed(2)}억원`;
          return '$'+formatNumber(Math.round(rem));
        };

        return `<tr style="border-top:1px solid var(--tbl-row-bd)">
          <td style="padding:12px 14px;font-family:Pretendard,sans-serif;font-size:12px">
            <span style="font-size:12px;font-weight:500;color:${color};font-family:Pretendard,sans-serif">${CONFIG.BIZ_LABELS[b]}</span>
            ${isKpiM?`<span style="font-size:10px;color:#888;margin-left:5px;font-family:Pretendard,sans-serif">×${factor}</span>`:''}
          </td>
          <td style="padding:12px 14px;text-align:right;font-family:Pretendard,sans-serif;font-size:12px">${fmtTgt()}</td>
          <td style="padding:12px 14px;text-align:right;font-family:Pretendard,sans-serif;font-size:12px;color:var(--tx)">${fmtAct()}</td>
          <td style="padding:12px 14px;min-width:160px">
            ${tgt>0&&(hasRate||!isKpiM)?`<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:6px;background:var(--bd);border-radius:3px;overflow:hidden"><div style="height:100%;border-radius:3px;background:${barClr};width:${pct}%"></div></div><span style="font-size:12px;font-weight:600;color:${barClr};min-width:32px;text-align:right;font-family:Pretendard,sans-serif">${pct}%</span></div>`:isKpiM?'<span style="font-size:11px;color:#999;font-family:Pretendard,sans-serif">환율 입력 필요</span>':'<span style="font-size:12px;color:var(--tbl-tx-body);font-family:Pretendard,sans-serif">롤링 필요</span>'}
          </td>
          <td style="padding:12px 14px;text-align:right;font-family:Pretendard,sans-serif;font-size:12px;color:${rem>0?'#BA7517':'var(--tx3)'}">${fmtRem()}</td>
        </tr>`;
      }).join('');

      const totalTgtRaw = _getTotalTarget(year, mode);
      const totalActKrw = hasRate ? CONFIG.BIZ_LIST.reduce((s,b)=>s+_getActualProfit(year,b)*_exchangeRate,0) : CONFIG.BIZ_LIST.reduce((s,b)=>s+_getActualProfit(year,b),0);
      const totalActUsd = CONFIG.BIZ_LIST.reduce((s,b)=>s+_getActual(year,b),0);
      const totalTgt = totalTgtRaw;
      const totalAct = isKpiM ? totalActKrw : totalActUsd;
      const totalPct = totalTgt>0 ? Math.min(100,Math.round(totalAct/totalTgt*100)) : 0;
      const totalRem = Math.max(0,totalTgt-totalAct);
      const totalClr = totalPct>=100?'#1D9E75':totalPct>=70?'var(--navy)':'#EF9F27';

      const yearTabs=[year-1,year,year+1].map(y=>{
        const active=y===year;
        return `<button onclick="Pages.KpiTarget.selectYear(${y})" style="padding:4px 14px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;border:1.5px solid;transition:.15s;${active?'background:#1D1D1F;color:#fff;border-color:#1D1D1F':'background:none;color:var(--tx2);border-color:var(--bd2)'}">${y}년</button>`;
      }).join('');

      const TH  = l=>`<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:600;font-family:Pretendard,sans-serif;color:var(--tbl-hd-tx);background:var(--tbl-hd-bg);border-bottom:1px solid var(--tbl-hd-bd);white-space:nowrap">${l}</th>`;
      const THR = l=>`<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:600;font-family:Pretendard,sans-serif;color:var(--tbl-hd-tx);background:var(--tbl-hd-bg);border-bottom:1px solid var(--tbl-hd-bd);white-space:nowrap">${l}</th>`;
      const actHeader = isKpiM ? '누적 EBIT (억원)' : '누적 실적 (USD)';
      const tgtHeader = isKpiM ? '목표 EBIT (억원)' : '목표 매출 (USD)';

      const bizBtns=[{key:'all',label:'전체',color:'#1B4F8A'},...CONFIG.BIZ_LIST.map(b=>({key:b,label:CONFIG.BIZ_LABELS[b],color:CONFIG.BIZ_COLORS[b]}))].map(({key,label,color})=>{
        const on=_bizSet.has(key);
        return `<button id="kpi-biz-${key}" onclick="Pages.KpiTarget.switchBiz('${key}')" style="padding:5px 14px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;border:1.5px solid ${color};background:${on?color:'none'};color:${on?'#fff':color};transition:.15s">${label}</button>`;
      }).join('');

      // 모드 버튼 색상
      const mBtn = (m, label) => {
        const on = mode===m;
        const c  = _modeColor(m);
        return `<button onclick="Pages.KpiTarget.setMode('${m}')" style="padding:6px 16px;border:none;font-size:12px;font-weight:600;cursor:pointer;font-family:Pretendard,sans-serif;background:${on?c:'#fff'};color:${on?'#fff':c};transition:.15s">${label}</button>`;
      };

      el.innerHTML=`<div style="max-width:1000px">
        <!-- ① 기준 선택 + 롤링 입력 버튼 -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:12px;color:var(--tx2);font-weight:500;font-family:Pretendard,sans-serif">기준 선택:</span>
              <div style="display:flex;border:1.5px solid #CCC;border-radius:7px;overflow:hidden">
                ${mBtn('kpi67','KPI기준(67억)')}
                ${mBtn('kpi103','KPI기준(103억)')}
                ${mBtn('ec','EC 기준')}
              </div>
            </div>
            ${isKpiM?`<div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:12px;color:var(--tx2);font-weight:500;font-family:Pretendard,sans-serif">사업계획 기준환율:</span>
              <div style="display:flex;align-items:center;gap:4px">
                <span style="font-size:12px;color:#555;font-family:Pretendard,sans-serif">$1 =</span>
                <input type="number" id="kpi-exchange-input" value="${_exchangeRate||1395}" placeholder="예: 1395"
                  style="width:90px;padding:5px 8px;border:1.5px solid ${mc};border-radius:6px;font-size:13px;text-align:right;font-family:'DM Mono',monospace;color:#1D1D1F"
                  onkeydown="if(event.key==='Enter'){Pages.KpiTarget.updateExchangeRate(this.value);this.blur();}"
                  onblur="Pages.KpiTarget.updateExchangeRate(this.value)">
                <span style="font-size:12px;color:#555;font-family:Pretendard,sans-serif">원</span>
              </div>
              ${_exchangeRate>0?`<span style="font-size:11px;color:${mc};font-weight:600;padding:2px 7px;border:1px solid ${mc};border-radius:4px">₩ 환산 적용중</span>`:`<span style="font-size:11px;color:#999;font-family:Pretendard,sans-serif">입력하면 원화 환산 표시</span>`}
            </div>`:''}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button onclick="Pages.KpiTarget.openRolling('kpi67')" style="display:flex;align-items:center;gap:5px;padding:6px 12px;border:1.5px solid #185FA5;border-radius:7px;background:none;color:#185FA5;font-size:12px;font-weight:500;cursor:pointer">
              <svg width="12" height="12" fill="none" viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 8h6M8 5v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              KPI롤링(67억)
            </button>
            <button onclick="Pages.KpiTarget.openRolling('kpi103')" style="display:flex;align-items:center;gap:5px;padding:6px 12px;border:1.5px solid #B45309;border-radius:7px;background:none;color:#B45309;font-size:12px;font-weight:500;cursor:pointer">
              <svg width="12" height="12" fill="none" viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 8h6M8 5v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              KPI롤링(103억)
            </button>
            <button onclick="Pages.KpiTarget.openRolling('ec')" style="display:flex;align-items:center;gap:5px;padding:6px 12px;border:1.5px solid #0F6E56;border-radius:7px;background:none;color:#0F6E56;font-size:12px;font-weight:500;cursor:pointer">
              <svg width="12" height="12" fill="none" viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 8h6M8 5v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              EC 롤링 입력
            </button>
            ${isKpiM?`<button onclick="Pages.KpiTarget.openFactorPanel()" style="display:flex;align-items:center;gap:5px;padding:6px 12px;border:1.5px solid #6A3D7C;border-radius:7px;background:none;color:#6A3D7C;font-size:12px;font-weight:500;cursor:pointer">
              <svg width="12" height="12" fill="none" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              Factor 설정
            </button>`:''}
          </div>
        </div>

        <!-- ② 연도 탭 -->
        <div style="display:flex;gap:6px;margin-bottom:16px">${yearTabs}</div>

        <!-- ③ 요약 카드 -->
        ${totalTgt>0?`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
          <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:10px 14px">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--tbl-tx-body);margin-bottom:3px">연간 목표 (${ml})</div>
            <div style="font-size:18px;font-weight:600;color:${mc}">${isKpiM?(totalTgt/100000000).toFixed(2)+'억원':'$'+formatNumber(Math.round(totalTgt))}</div>
            <div style="font-size:11px;color:var(--tbl-tx-body);margin-top:2px">${isKpiM?'목표 EBIT (롤링 합계)':'롤링 데이터 합계'}</div>
          </div>
          <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:10px 14px">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--tbl-tx-body);margin-bottom:3px">${isKpiM?'누적 EBIT':'누적 달성'}</div>
            <div style="font-size:18px;font-weight:600;color:var(--tx)">${isKpiM&&hasRate?(totalActKrw/100000000).toFixed(2)+'억원':isKpiM?'$'+formatNumber(Math.round(totalActKrw)):'$'+formatNumber(Math.round(totalActUsd))}</div>
            ${isKpiM&&hasRate?`<div style="font-size:11px;color:var(--tbl-tx-body);margin-top:2px">$${formatNumber(Math.round(CONFIG.BIZ_LIST.reduce((s,b)=>s+_getActualProfit(year,b),0)))} × ${_exchangeRate.toLocaleString()}원</div>`:''}
          </div>
          <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:10px 14px">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--tbl-tx-body);margin-bottom:3px">전체 달성률</div>
            <div style="font-size:18px;font-weight:600;color:${totalClr}">${totalPct}%</div>
            <div style="font-size:11px;color:var(--tbl-tx-body);margin-top:2px">${isKpiM?(hasRate?'원화 기준':'환율 미입력'):'USD 기준'}</div>
          </div>
        </div>`:`<div style="background:#FFF3E0;border-left:3px solid #EF9F27;padding:10px 14px;border-radius:var(--rs);margin-bottom:16px;font-size:12px;color:#633806">
          롤링 데이터를 입력하면 목표가 자동으로 설정됩니다 →
          <button onclick="Pages.KpiTarget.openRolling('${mode}')" style="background:none;border:none;color:${mc};font-size:12px;font-weight:500;cursor:pointer;text-decoration:underline">${_rollingLabel(mode)} 입력</button>
        </div>`}

        <!-- ④ 사업별 표 -->
        <div style="background:var(--tbl-bg);border:1px solid var(--tbl-wrap-bd);border-radius:10px;overflow:hidden;margin-bottom:20px">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr>${TH('사업')}${THR(tgtHeader)}${THR(actHeader)}${TH('달성률')}${THR('잔여')}</tr></thead>
            <tbody>${bizRows}</tbody>
            ${totalTgt>0?`<tfoot><tr style="background:var(--tbl-sum-bg)">
              <td style="padding:10px 14px;font-size:12px;font-weight:500;font-family:Pretendard,sans-serif;color:var(--tx2);border-top:0.5px solid var(--bd)">합계</td>
              <td style="padding:10px 14px;text-align:right;font-family:Pretendard,sans-serif;font-size:12px;font-weight:600;border-top:0.5px solid var(--bd)">${isKpiM?(totalTgt/100000000).toFixed(2)+'억원':'$'+formatNumber(Math.round(totalTgt))}</td>
              <td style="padding:10px 14px;text-align:right;font-family:Pretendard,sans-serif;font-size:12px;font-weight:600;color:var(--tx);border-top:0.5px solid var(--bd)">${isKpiM&&hasRate?(totalAct/100000000).toFixed(2)+'억원':'$'+formatNumber(Math.round(totalAct))}</td>
              <td style="padding:10px 14px;border-top:0.5px solid var(--bd)"><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:6px;background:var(--bd);border-radius:3px;overflow:hidden"><div style="height:100%;border-radius:3px;background:${totalClr};width:${totalPct}%"></div></div><span style="font-size:12px;font-weight:600;color:${totalClr};min-width:32px;text-align:right">${totalPct}%</span></div></td>
              <td style="padding:10px 14px;text-align:right;font-family:Pretendard,sans-serif;font-size:12px;font-weight:600;color:${totalRem>0?'#BA7517':'var(--tx3)'};border-top:0.5px solid var(--bd)">${isKpiM?(totalRem/100000000).toFixed(2)+'억원':'$'+formatNumber(Math.round(totalRem))}</td>
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
      const dp = _rollingMode === 'ec' ? 4 : 2;
      if (rt) rt.textContent = sum > 0 ? (+sum.toFixed(dp)) + '' : '—';
      Pages.KpiTarget.calcRollingAll();
    },

    calcRollingAll() {
      // 합계행(footer)은 EBIT 행만 합산
      const body = document.getElementById('rolling-tbody'); if (!body) return;
      const rdp  = _rollingMode === 'ec' ? 4 : 2;
      const colSums = Array(12).fill(0);
      let grand = 0;

      body.querySelectorAll('tr[data-type]').forEach(row => {
        const type   = row.getAttribute('data-type');
        const inputs = row.querySelectorAll('input[type=number]');
        let rowSum   = 0;
        inputs.forEach((inp, ci) => {
          const v = parseFloat(inp.value) || 0;
          rowSum += v;
          if (type === 'ebit') colSums[ci] += v; // footer는 EBIT만
        });
        const rt = row.querySelector('.rolling-rowtotal');
        if (rt) rt.textContent = rowSum > 0 ? (+rowSum.toFixed(rdp)) + '' : '—';
      });

      colSums.forEach((v, i) => {
        const el = document.getElementById('rs' + i);
        if (el) el.textContent = v > 0 ? (+v.toFixed(rdp)) + '' : '0';
        grand += v;
      });
      const st = document.getElementById('rstotal');
      if (st) st.textContent = grand > 0 ? (+grand.toFixed(rdp)) + '' : '0';
    },


    renderRolling() {
      const wrap  = document.getElementById('kpi-rolling-inner'); if (!wrap) return;
      const y     = _rollingYear;
      const store = _getActiveRolling();
      const yData = store[y] || {};
      const isKpi = _isKpi(_rollingMode);
      const dp    = _rollingMode === 'ec' ? 4 : 2;
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
        // EC: 배열로 저장됨 / KPI: { rev, ebit } 객체로 저장됨
        const revVals  = isKpi
          ? (d && !Array.isArray(d) ? (d.rev  || Array(12).fill(0)) : Array(12).fill(0))
          : null;
        const ebitVals = isKpi
          ? (d && !Array.isArray(d) ? (d.ebit || Array(12).fill(0)) : Array(12).fill(0))
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
            + makeInputRow(r.key, 'rev',  revVals,  '매출(억원)',  '#185FA5')
            + makeInputRow(r.key, 'ebit', ebitVals, 'EBIT(억원)', '#0F6E56');
        } else {
          // EC 모드: 매출(M USD) 단일 입력, data-type='ec'
          return bizHeader
            + makeInputRow(r.key, 'ec', ecVals, '매출(M USD)', mc);
        }
      }).join('');

      // 합계행 (EBIT 기준)
      const colSums = Array(12).fill(0);
      ROWS.forEach(r => {
        const d = yData[r.key];
        const ebitVals = d ? (Array.isArray(d) ? d : (d.ebit || [])) : [];
        ebitVals.forEach((v, i) => { colSums[i] += parseFloat(v) || 0; });
      });
      const grand    = colSums.reduce((s, v) => s + v, 0);
      const sumCells = colSums.map((v, idx) =>
        '<td id="rs' + idx + '" style="padding:6px 4px;text-align:right;font-size:12px;font-weight:500;background:#F1EFE8;border:1px solid var(--bd);font-family:var(--font-mono)">'
        + (v > 0 ? (+v.toFixed(dp)) : '0') + '</td>'
      ).join('');

      wrap.innerHTML = `
        <div style="font-size:12px;color:${mc};font-weight:500;margin-bottom:12px;display:flex;align-items:center;gap:16px">
          <span>단위: ${_rollingMode === 'ec' ? 'Million USD' : '억원'} &nbsp;·&nbsp; ${_modeLabel(_rollingMode)} · 저장하면 즉시 반영됩니다</span>
          ${isKpi ? '<span style="display:flex;gap:10px"><span style="color:#185FA5;font-size:11px">■ 매출(억원)</span><span style="color:#0F6E56;font-size:11px">■ EBIT(억원)</span></span>' : ''}
        </div>
        <div style="margin-bottom:14px;background:#F8F8F8;border:1px solid #DDD;border-radius:6px;padding:12px">
          <div style="font-size:12px;font-weight:600;color:#333;margin-bottom:6px;font-family:Pretendard,sans-serif">📋 엑셀에서 붙여넣기</div>
          <textarea id="rolling-paste-area" placeholder="엑셀 복사 후 붙여넣기" style="width:100%;height:80px;padding:8px;border:1px solid #CCC;border-radius:4px;font-size:11px;font-family:'DM Mono',monospace;resize:vertical;box-sizing:border-box;color:#333;background:#fff" onpaste="setTimeout(()=>Pages.KpiTarget.parsePasteRolling(),0)"></textarea>
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
            <tfoot><tr>
              <td style="padding:6px 10px;text-align:center;font-size:12px;font-weight:500;background:#F1EFE8;border:1px solid var(--bd)">EBIT 합계</td>
              ${sumCells}
              <td id="rstotal" style="padding:6px 4px;text-align:right;font-size:12px;font-weight:600;color:var(--tx);background:#E8E4D8;border:1px solid var(--bd);font-family:var(--font-mono)">${grand > 0 ? (+grand.toFixed(dp)) : '0'}</td>
            </tr></tfoot>
          </table>
        </div>`;
    },


    parsePasteRolling() {
      const ta  = document.getElementById('rolling-paste-area'); if (!ta) return;
      const msg = document.getElementById('rolling-paste-msg');
      const raw = ta.value.trim(); if (!raw) return;

      // 숫자 또는 '-' 변환 (-, —, ― 모두 0)
      function parseVal(s) {
        const t = String(s).replace(/,/g,'').trim();
        if (!t || /^[-—―\u2013\u2014]+$/.test(t)) return 0;
        const n = parseFloat(t); return isNaN(n) ? 0 : n;
      }

      const BIZ_MAP = [
        { key:'DRAM', pattern:'DRAM Test',            keywords:['dram'] },
        { key:'SSD',  pattern:'SSD Test',             keywords:['ssd'] },
        { key:'MID',  pattern:'Mobile Ink Die',       keywords:['mobile ink','mobile','ink die','mid'] },
        { key:'SCR',  pattern:'Scrap\\s*자재',        keywords:['scrap','자재','scr'] },
        { key:'RMA',  pattern:'RMA\\s*운영',          keywords:['rma'] },
        { key:'SUS',  pattern:'Sustainability',       keywords:['sustainability','컨설팅','sus'] },
        { key:'MOD',  pattern:'모듈\\s*세일즈',       keywords:['모듈','module','mod'] },
      ];

      function matchBizByName(name) {
        const lower = name.toLowerCase().replace(/\s+/g,' ').trim();
        for (const b of BIZ_MAP) {
          if (b.keywords.some(k => lower.includes(k))) return b.key;
        }
        return null;
      }

      // 사업명 패턴으로 분리 (한 줄로 붙어있는 경우 대응)
      const splitPattern = new RegExp(
        '(?=' + BIZ_MAP.map(b => b.pattern).join('|') + ')', 'i'
      );

      // 줄바꿈이 있으면 줄로, 없으면 패턴으로 분리
      const rawLines = raw.split('\n').map(l => l.trim()).filter(Boolean);
      let segments = [];

      if (rawLines.length >= 2) {
        // 여러 줄인 경우: 각 줄을 세그먼트로
        segments = rawLines;
      } else {
        // 한 줄로 붙어있는 경우: 사업명 패턴으로 분리
        segments = raw.split(splitPattern).filter(s => s.trim());
      }

      const ROWS = ['DRAM','SSD','MID','SCR','RMA','SUS','MOD'];
      let matched = 0, skipped = 0;

      for (const seg of segments) {
        const trimmed = seg.trim();
        if (!trimmed) continue;

        // 헤더 행 스킵 (월로 시작)
        if (/^[0-9]월|^1[0-2]월/.test(trimmed)) { skipped++; continue; }

        // 사업명 추출: 첫 번째 숫자/- 나오기 전까지
        const nameMatch = trimmed.match(/^([A-Za-z가-힣\s]+?)(?=\s{2,}|\s+[-—―\d])/);
        const name = nameMatch ? nameMatch[1].trim() : '';

        if (!name) { skipped++; continue; }

        const bizKey = matchBizByName(name);
        if (!bizKey) { skipped++; continue; }

        // 사업명 이후의 숫자/-  추출 (최대 12개)
        const dataStr = trimmed.slice(name.length);
        const tokens  = dataStr.match(/[-—―]+|[\d]+\.?[\d]*/g) || [];
        const nums    = tokens.slice(0,12).map(parseVal);
        while (nums.length < 12) nums.push(0);

        // DOM에 값 입력 — data-biz & data-type="ebit" 행에 입력 (붙여넣기는 EBIT)
        const body = document.getElementById('rolling-tbody'); if (!body) continue;
        const targetRow = body.querySelector('tr[data-biz="' + bizKey + '"][data-type="ebit"]');
        if (!targetRow) continue;
        const inputs = targetRow.querySelectorAll('input[type=number]');
        inputs.forEach((inp, i) => { inp.value = nums[i] > 0 ? nums[i] : ''; });
        matched++;
      }

      Pages.KpiTarget.calcRollingAll();
      if (msg) {
        if (matched > 0) {
          msg.textContent = `✓ ${matched}개 사업 적용 완료${skipped>0?` (${skipped}행 스킵)`:''}`;
          msg.style.color = '#1A6B3A';
        } else {
          msg.textContent = '매칭 실패. 사업명이 포함된 데이터를 붙여넣어 주세요.';
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

    setTrackingUnit(unit) { _trackingUnit = unit; _renderTracking(); },
    setTableView(view)    { _tableView    = view; _renderTracking(); },

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
