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

  function _getRollingMonths(year, biz, mode) {
    const src  = _getRollingStore(mode);
    const vals = src[year]?.[biz] || Array(12).fill(0);
    if (mode === 'ec') return vals.map(v => (parseFloat(v)||0) * 1000000);
    return vals.map(v => (parseFloat(v)||0) * 100000000); // 억원 → 원
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

  // ── 월별 트래킹 렌더 ──────────────────────────────────────
  function _renderTracking() {
    const el = document.getElementById('kpi-tracking-wrap'); if (!el) return;
    const year    = _year;
    const isAll   = _bizSet.has('all');
    const bizList = isAll ? CONFIG.BIZ_LIST : CONFIG.BIZ_LIST.filter(b=>_bizSet.has(b));
    const mode    = _rollingMode;
    const isKpiM  = _isKpi(mode);
    const hasRateT = isKpiM && _exchangeRate > 0;

    const totalTgt = bizList.reduce((s,b)=>s+_getTarget(year,b,mode),0);
    if (totalTgt === 0) {
      el.innerHTML = `<div style="padding:20px;text-align:center;color:var(--tbl-tx-body);font-size:12px">롤링 데이터를 먼저 입력해주세요</div>`;
      return;
    }

    const now       = new Date();
    const curMonIdx = now.getFullYear()===year ? now.getMonth() : (now.getFullYear()>year?11:-1);
    const MONTHS    = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const fmtVal    = v => isKpiM
      ? (hasRateT ? (v/100000000).toFixed(2)+'억원' : '$'+formatNumber(Math.round(v)))
      : '$'+formatNumber(Math.round(v));

    const monthTargets = MONTHS.map((_,i)=>bizList.reduce((s,b)=>s+_getMonthlyTarget(year,b,i+1,mode),0));
    const monthActuals = MONTHS.map((_,i)=>{
      if (i>curMonIdx) return null;
      if (isKpiM && hasRateT) return bizList.reduce((s,b)=>s+_getActualMonth(year,b,i+1)*_getFactor(b)*_exchangeRate,0);
      return bizList.reduce((s,b)=>s+_getActualMonth(year,b,i+1),0);
    });

    let cumT=0, cumA=0;
    const cumTargets=[], cumActuals=[];
    MONTHS.forEach((_,i)=>{
      cumT+=monthTargets[i]; cumTargets.push(cumT);
      if (i<=curMonIdx) { cumA+=(monthActuals[i]||0); cumActuals.push(cumA); } else cumActuals.push(null);
    });

    const curCumA=cumActuals[curMonIdx]??0, curCumT=cumTargets[curMonIdx]??0;
    const overallPct=curCumT>0?Math.round(curCumA/curCumT*100):0;
    const diff=curCumA-curCumT;
    const bizLabel=isAll?'전체':bizList.map(b=>CONFIG.BIZ_LABELS[b]).join(' + ');
    const periodLabel=`1~${curMonIdx+1}월`;
    const mc = _modeColor(mode);

    const cards=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
      <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:11px 14px">
        <div style="font-size:12px;color:var(--tbl-tx-body);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">연간 목표 · ${bizLabel}</div>
        <div style="font-size:18px;font-weight:600">${fmtVal(totalTgt)}</div>
        <div style="font-size:12px;color:var(--tbl-tx-body);margin-top:2px">${isKpiM?'목표 매출이익':'롤링 데이터 기준'}</div>
      </div>
      <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:11px 14px">
        <div style="font-size:12px;color:var(--tbl-tx-body);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${isKpiM?'누적 매출이익':'누적 실적'} (${periodLabel})</div>
        <div style="font-size:18px;font-weight:600;color:var(--tx)">${fmtVal(curCumA)}</div>
        <div style="font-size:12px;color:var(--tbl-tx-body);margin-top:2px">목표 ${fmtVal(curCumT)}</div>
      </div>
      <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:11px 14px">
        <div style="font-size:12px;color:var(--tbl-tx-body);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">누적 달성률 (${periodLabel})</div>
        <div style="font-size:18px;font-weight:600;color:${overallPct>=100?'#085041':overallPct>=70?'#0C447C':'#A32D2D'}">${overallPct}%</div>
        <div style="font-size:12px;color:var(--tbl-tx-body);margin-top:2px">${isKpiM?(hasRateT?'원화 기준':'환율 미입력'):'USD 기준'}</div>
      </div>
      <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:11px 14px">
        <div style="font-size:12px;color:var(--tbl-tx-body);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">누적 차이 (${periodLabel})</div>
        <div style="font-size:18px;font-weight:600;color:${diff>=0?'#085041':'#A32D2D'}">${diff>=0?'+':'-'}${fmtVal(Math.abs(diff))}</div>
        <div style="font-size:12px;color:var(--tbl-tx-body);margin-top:2px">${diff>=0?'목표 초과':'목표 미달'}</div>
      </div>
    </div>`;

    const chartHtml=`<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px;margin-bottom:12px">
      <div style="display:flex;gap:16px;margin-bottom:10px;font-size:12px;align-items:center">
        <span style="display:flex;align-items:center;gap:5px"><span style="width:12px;height:3px;background:#85B7EB;display:inline-block;border-radius:2px;border-top:2px dashed #85B7EB"></span>목표 누적</span>
        <span style="display:flex;align-items:center;gap:5px"><span style="width:12px;height:3px;background:#1D9E75;display:inline-block;border-radius:2px"></span>실적 누적</span>
        <span style="font-size:12px;color:var(--tbl-tx-body);margin-left:auto">${_modeLabel(mode)}</span>
      </div>
      <div style="position:relative;height:210px"><canvas id="cv-kpi-monthly"></canvas></div>
    </div>`;

    const thS='padding:9px 12px;font-size:12px;font-weight:600;font-family:Pretendard,sans-serif;color:var(--tbl-tx-body);text-align:center;text-transform:uppercase;letter-spacing:.05em;background:var(--tbl-sum-bg);border-top:1px solid var(--tbl-row-bd)';
    let cumTA2=0, cumAA2=0;
    const tableRows=MONTHS.map((m,i)=>{
      cumTA2+=monthTargets[i];
      const isPast=i<=curMonIdx, isCur=i===curMonIdx;
      const act=isPast?(monthActuals[i]||0):null;
      if (isPast) cumAA2+=(monthActuals[i]||0);
      const cumAVal=isPast?cumAA2:null;
      const pct=cumTA2>0&&cumAVal!==null?Math.round(cumAVal/cumTA2*100):null;
      const dif=cumTA2>0&&cumAVal!==null?cumAVal-cumTA2:null;
      const barC=pct===null?'#e5e7eb':pct>=100?'#1D9E75':pct>=70?'#185FA5':'#E24B4A';
      const pctC=pct===null?'var(--tx3)':pct>=100?'#085041':pct>=70?'#0C447C':'#791F1F';
      const difBadge=dif===null?'—'
        :dif>=0?`<span style="display:inline-flex;font-size:12px;font-weight:500;padding:2px 7px;border-radius:3px;border:1px solid var(--bd);color:var(--tx2);background:transparent">+${fmtVal(dif)}</span>`
              :`<span style="display:inline-flex;font-size:12px;font-weight:500;padding:2px 7px;border-radius:3px;border:1px solid #FECACA;color:#dc2626;background:#FEF2F2">-${fmtVal(Math.abs(dif))}</span>`;
      return `<tr style="${isCur?'background:#F0F7FF':''}${!isPast?';opacity:0.38':''}">
        <td style="padding:9px 12px;font-weight:${isCur?'600':'400'};color:${isCur?'#0C447C':'var(--tx)'}">${m}${isCur?' ◀':''}</td>
        <td style="padding:9px 12px;text-align:right;font-family:Pretendard,sans-serif;font-size:12px;color:var(--tbl-tx-body)">${monthTargets[i]>0?fmtVal(monthTargets[i]):'—'}</td>
        <td style="padding:9px 12px;text-align:right;font-family:Pretendard,sans-serif;font-size:12px">${act!==null?fmtVal(act):'—'}</td>
        <td style="padding:9px 12px;text-align:right;font-family:Pretendard,sans-serif;font-size:12px;color:var(--tbl-tx-body)">${cumTA2>0?fmtVal(cumTA2):'—'}</td>
        <td style="padding:9px 12px;text-align:right;font-family:Pretendard,sans-serif;font-size:12px;font-weight:${isPast?'500':'400'};color:var(--tx)">${cumAVal!==null?fmtVal(cumAVal):'—'}</td>
        <td style="padding:9px 12px;min-width:130px">${pct!==null?`<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:5px;background:var(--bd);border-radius:3px;overflow:hidden"><div style="height:100%;border-radius:3px;background:${barC};width:${Math.min(100,pct)}%"></div></div><span style="font-size:12px;font-weight:500;color:${pctC};min-width:36px;text-align:right">${pct}%</span></div>`:`<span style="font-size:12px;color:var(--tbl-tx-body)">—</span>`}</td>
        <td style="padding:9px 12px;text-align:right">${difBadge}</td>
      </tr>`;
    }).join('');

    el.innerHTML=`${cards}${chartHtml}
      <div style="background:var(--tbl-bg);border:1px solid var(--tbl-wrap-bd);border-radius:10px;overflow:hidden;margin-bottom:8px">
        <table style="width:100%;border-collapse:collapse;font-size:12px;font-family:Pretendard,sans-serif">
          <thead><tr>
            <th style="${thS}">월</th><th style="${thS}">월 목표</th><th style="${thS}">월 실적</th>
            <th style="${thS}">누적 목표</th><th style="${thS}">누적 실적</th>
            <th style="${thS};min-width:130px">달성률</th><th style="${thS}">누적 차이</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;

    setTimeout(()=>{
      const canvas=document.getElementById('cv-kpi-monthly'); if (!canvas) return;
      if (window._kpiChart) { window._kpiChart.destroy(); window._kpiChart=null; }
      window._kpiChart=new Chart(canvas,{
        type:'line',
        data:{labels:MONTHS,datasets:[
          {label:'목표 누적',data:cumTargets,borderColor:'#85B7EB',borderWidth:2,borderDash:[5,3],pointRadius:3,pointBackgroundColor:'#85B7EB',fill:false,tension:0},
          {label:'실적 누적',data:cumActuals,borderColor:'#1D9E75',borderWidth:2.5,pointRadius:cumActuals.map(v=>v!==null?4:0),pointBackgroundColor:'#1D9E75',fill:{target:0,above:'rgba(29,158,117,0.08)',below:'rgba(226,75,74,0.08)'},tension:0.2},
        ]},
        options:{
          responsive:true,maintainAspectRatio:false,
          plugins:{
            legend:{display:false},
            tooltip:{mode:'index',intersect:false,callbacks:{label:ctx=>{
              const v=Math.round(ctx.raw||0);
              const disp=isKpiM&&hasRateT?(v/100000000).toFixed(2)+'억원':'$'+v.toLocaleString();
              return ` ${ctx.dataset.label}: ${disp}`;
            }}}
          },
          scales:{
            x:{grid:{display:false},ticks:{color:'#9aa0ad',font:{size:12},autoSkip:false}},
            y:{grid:{color:'rgba(0,0,0,0.05)'},ticks:{color:'#9aa0ad',font:{size:12},callback:v=>{
              if (isKpiM&&hasRateT) return (v/100000000).toFixed(1)+'억';
              return '$'+(v/1000).toFixed(0)+'K';
            }},beginAtZero:true},
          },
          layout:{padding:{top:10}}
        }
      });
    },50);
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
      _loadFromSettings();
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
      const actHeader = isKpiM ? '누적 매출이익 (억원)' : '누적 실적 (USD)';
      const tgtHeader = isKpiM ? '목표 매출이익 (억원)' : '목표 매출 (USD)';

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
            <div style="font-size:11px;color:var(--tbl-tx-body);margin-top:2px">${isKpiM?'목표 매출이익 (롤링 합계)':'롤링 데이터 합계'}</div>
          </div>
          <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:10px 14px">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--tbl-tx-body);margin-bottom:3px">${isKpiM?'누적 매출이익':'누적 달성'}</div>
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
      const row=input.closest('tr');
      const inputs=row.querySelectorAll('input[type=number]');
      let sum=0; inputs.forEach(i=>{sum+=parseFloat(i.value)||0;});
      const rt=row.querySelector('.rolling-rowtotal');
      const dp=_rollingMode==='ec'?4:2;
      if (rt) rt.textContent=sum>0?+sum.toFixed(dp)+''  :'—';
      Pages.KpiTarget.calcRollingAll();
    },

    calcRollingAll() {
      const body=document.getElementById('rolling-tbody'); if (!body) return;
      const rows=body.querySelectorAll('tr');
      const colSums=Array(12).fill(0);
      let grand=0;
      const rdp=_rollingMode==='ec'?4:2;
      rows.forEach(row=>{
        const inputs=row.querySelectorAll('input[type=number]');
        let rowSum=0;
        inputs.forEach((inp,ci)=>{const v=parseFloat(inp.value)||0; colSums[ci]+=v; rowSum+=v;});
        const rt=row.querySelector('.rolling-rowtotal');
        if (rt) rt.textContent=rowSum>0?+rowSum.toFixed(rdp)+''  :'—';
      });
      colSums.forEach((v,i)=>{ const el=document.getElementById('rs'+i); if (el) el.textContent=v>0?+v.toFixed(rdp)+''  :'0'; grand+=v; });
      const st=document.getElementById('rstotal');
      if (st) st.textContent=grand>0?+grand.toFixed(rdp)+''  :'0';
    },

    renderRolling() {
      const wrap=document.getElementById('kpi-rolling-inner'); if (!wrap) return;
      const y   = _rollingYear;
      const src = _getActiveRolling();
      const yData = src[y] || {};
      const ROWS=[
        {key:'DRAM',label:'DRAM Test',fixed:true},{key:'SSD',label:'SSD Test',fixed:true},
        {key:'MID',label:'Mobile Ink Die',fixed:true},{key:'SCR',label:'Scrap 자재 공급',fixed:true},
        {key:'RMA',label:'RMA 운영',fixed:true},{key:'SUS',label:'Sustainability 컨설팅',fixed:true},
        {key:'MOD',label:'모듈 세일즈',fixed:true},
      ];
      const MO=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
      const thS='padding:6px 6px;text-align:center;font-size:11px;font-weight:500;color:var(--tbl-tx-body);background:var(--tbl-sum-bg);border:1px solid var(--bd);white-space:nowrap';
      const inpW='width:52px;padding:4px 3px;border:1px solid var(--bd2);border-radius:4px;font-size:12px;text-align:right;background:var(--card);color:var(--tx);font-family:var(--font-mono)';
      const dp=_rollingMode==='ec'?4:2;
      const mc=_modeColor(_rollingMode);

      const tableRows=ROWS.map((r,i)=>{
        const vals=yData[r.key]||Array(12).fill(0);
        const cells=vals.map(v=>`<td style="padding:3px 3px;border:1px solid var(--bd)"><input type="number" value="${v||''}" placeholder="0" step="0.0001" style="${inpW}" oninput="Pages.KpiTarget.calcRollingRow(this)"></td>`).join('');
        const rowSum=vals.reduce((s,v)=>s+(parseFloat(v)||0),0);
        return `<tr>
          <td style="padding:6px 8px;text-align:center;font-size:12px;color:var(--tbl-tx-body);background:var(--tbl-sum-bg);border:1px solid var(--bd)">${i+1}</td>
          <td style="padding:6px 10px;font-size:12px;font-weight:${r.fixed?'500':'400'};color:${r.fixed?'var(--tx)':'var(--tx3)'};background:var(--tbl-sum-bg);border:1px solid var(--bd);white-space:nowrap;text-align:center">${r.label}</td>
          ${cells}
          <td class="rolling-rowtotal" style="padding:6px 6px;text-align:right;font-size:12px;font-weight:500;color:var(--tx);background:var(--tbl-sum-bg);border:1px solid var(--bd);font-family:var(--font-mono)">${rowSum>0?+rowSum.toFixed(dp):'—'}</td>
        </tr>`;
      }).join('');

      const colSums=Array(12).fill(0);
      ROWS.forEach(r=>{(yData[r.key]||[]).forEach((v,i)=>{colSums[i]+=parseFloat(v)||0;});});
      const grand=colSums.reduce((s,v)=>s+v,0);
      const sumCells=colSums.map((v,i)=>`<td id="rs${i}" style="padding:6px 6px;text-align:right;font-size:12px;font-weight:500;background:#F1EFE8;border:1px solid var(--bd);font-family:var(--font-mono)">${v>0?+v.toFixed(dp):'0'}</td>`).join('');

      wrap.innerHTML=`
        <div style="font-size:12px;color:${mc};font-weight:500;margin-bottom:12px">
          단위: ${_rollingMode==='ec'?'Million USD':'억원'} &nbsp;·&nbsp; ${_modeLabel(_rollingMode)} · 저장하면 즉시 반영됩니다
        </div>
        <div style="margin-bottom:14px;background:#F8F8F8;border:1px solid #DDD;border-radius:6px;padding:12px">
          <div style="font-size:12px;font-weight:600;color:#333;margin-bottom:6px;font-family:Pretendard,sans-serif">📋 엑셀에서 붙여넣기</div>
          <textarea id="rolling-paste-area" placeholder="엑셀 복사 후 붙여넣기" style="width:100%;height:90px;padding:8px;border:1px solid #CCC;border-radius:4px;font-size:11px;font-family:'DM Mono',monospace;resize:vertical;box-sizing:border-box;color:#333;background:#fff" onpaste="setTimeout(()=>Pages.KpiTarget.parsePasteRolling(),0)"></textarea>
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
              <th style="${thS};width:30px">No.</th>
              <th style="${thS};min-width:110px">구분</th>
              ${MO.map(m=>`<th style="${thS};width:56px">${m}</th>`).join('')}
              <th style="${thS};width:60px;background:#F1EFE8">합계</th>
            </tr></thead>
            <tbody id="rolling-tbody">${tableRows}</tbody>
            <tfoot><tr>
              <td colspan="2" style="padding:6px 10px;text-align:center;font-size:12px;font-weight:500;background:#F1EFE8;border:1px solid var(--bd)">합계</td>
              ${sumCells}
              <td id="rstotal" style="padding:6px 6px;text-align:right;font-size:12px;font-weight:600;color:var(--tx);background:#E8E4D8;border:1px solid var(--bd);font-family:var(--font-mono)">${grand>0?+grand.toFixed(dp):'0'}</td>
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

        // DOM에 값 입력
        const body = document.getElementById('rolling-tbody'); if (!body) continue;
        const rowIdx = ROWS.indexOf(bizKey); if (rowIdx < 0) continue;
        const tr = body.querySelectorAll('tr')[rowIdx]; if (!tr) continue;
        const inputs = tr.querySelectorAll('input[type=number]');
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
      const body=document.getElementById('rolling-tbody'); if (!body) return;
      const y=_rollingYear;
      const ROWS=['DRAM','SSD','MID','SCR','RMA','SUS','MOD'];
      const rows=body.querySelectorAll('tr');
      const newData={};
      rows.forEach((row,ri)=>{ const key=ROWS[ri]; if (!key) return; const inputs=row.querySelectorAll('input[type=number]'); newData[key]=Array.from(inputs).map(i=>parseFloat(i.value)||0); });
      _saveRollingData(y,newData);
      Pages.KpiTarget.closeRolling();
      Pages.KpiTarget.render();
      if (typeof Nav!=='undefined'&&Nav.current&&Nav.current()==='dash') Pages.Dashboard.render();
      UI.toast(`${y}년 ${_modeLabel(_rollingMode)} 롤링 데이터 저장됨`);
    },

    setMode(mode) { _rollingMode=mode; Pages.KpiTarget.render(); },

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
        <div style="font-size:12px;color:#888;margin-bottom:14px;font-family:Pretendard,sans-serif">Factor = 매출이익 / 매출 · 예) 매출 100, Factor 0.9 → 매출이익 90</div>
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
