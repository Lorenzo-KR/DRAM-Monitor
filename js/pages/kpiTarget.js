/**
 * pages/kpiTarget.js
 * KPI 목표 설정 — 롤링 데이터 기반 (직접 입력/수정 버튼 없음)
 */

Pages.KpiTarget = (() => {

  let _year        = new Date().getFullYear();
  let _bizSet      = new Set(['all']);
  let _rollingYear = new Date().getFullYear();
  let _rollingMode = 'kpi'; // 'kpi' | 'ec'

  // ── 롤링 데이터 저장소 ─────────────────────────────────────
  let _rolling = JSON.parse(localStorage.getItem('kpi_rolling') || 'null') || {
    2026: {
      DRAM: [0,0,0.1,0.1556,0.1556,0.1556,0.1556,0.1556,0.1556,0.1556,0.1556,0.1556],
      SSD:  [0,0,0.1,0.0667,0.0667,0.0667,0.0667,0.0667,0.0667,0.0667,0.0667,0.0667],
      MID:  [0,0,1.2,0,0,1.2,0,0,1.2,0,0,1.2],
      SCR:  Array(12).fill(0), RMA:  Array(12).fill(0),
      SUS:  Array(12).fill(0), MOD:  Array(12).fill(0),
    },
    2027: {
      DRAM: Array(12).fill(0), SSD: Array(12).fill(0), MID: Array(12).fill(0),
      SCR:  Array(12).fill(0), RMA:  Array(12).fill(0),
      SUS:  Array(12).fill(0), MOD:  Array(12).fill(0),
    },
    2028: {
      DRAM: Array(12).fill(0), SSD: Array(12).fill(0), MID: Array(12).fill(0),
      SCR:  Array(12).fill(0), RMA:  Array(12).fill(0),
      SUS:  Array(12).fill(0), MOD:  Array(12).fill(0),
    },
  };

  const BIZ_KEY = { DRAM: 'DRAM', SSD: 'SSD', MID: 'MID', SCR: 'SCR', RMA: 'RMA', SUS: 'SUS', MOD: 'MOD' };

  // ── EC 롤링 저장소 (Expected Cost 기준) ───────────────────
  let _ecRolling = JSON.parse(localStorage.getItem('ec_rolling') || 'null') || {
    2026: { DRAM: Array(12).fill(0), SSD: Array(12).fill(0), MID: Array(12).fill(0),
            SCR:  Array(12).fill(0), RMA:  Array(12).fill(0),
            SUS:  Array(12).fill(0), MOD:  Array(12).fill(0) },
    2027: { DRAM: Array(12).fill(0), SSD: Array(12).fill(0), MID: Array(12).fill(0),
            SCR:  Array(12).fill(0), RMA:  Array(12).fill(0),
            SUS:  Array(12).fill(0), MOD:  Array(12).fill(0) },
    2028: { DRAM: Array(12).fill(0), SSD: Array(12).fill(0), MID: Array(12).fill(0),
            SCR:  Array(12).fill(0), RMA:  Array(12).fill(0),
            SUS:  Array(12).fill(0), MOD:  Array(12).fill(0) },
  };

  function _getActiveRolling() { return _rollingMode === 'ec' ? _ecRolling : _rolling; }

  // ── 사업별 Factor (KPI 기준 매출이익 계산용) ─────────────
  // Factor: 매출이익 = 매출 × Factor
  let _factors = JSON.parse(localStorage.getItem('kpi_factors') || 'null') || {
    DRAM: 1.0, SSD: 1.0, MID: 1.0, SCR: 1.0, RMA: 1.0, SUS: 1.0, MOD: 1.0,
  };

  function _getFactor(biz) { return parseFloat(_factors[biz] ?? 1.0); }

  function _saveFactors(data) {
    Object.assign(_factors, data);
    localStorage.setItem('kpi_factors', JSON.stringify(_factors));
    Api.setSetting('kpi_factors', JSON.stringify(_factors));
  }

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

  // KPI 기준 매출이익 = 실제매출 × Factor
  function _getActualProfit(year, biz) {
    return _getActual(year, biz) * _getFactor(biz);
  }

  // ── 롤링 기반 목표 계산 ─────────────────────────────────────
  function _getRollingMonths(year, biz, mode) {
    const src = (mode === 'ec') ? _ecRolling : _rolling;
    return (src[year]?.[biz] || Array(12).fill(0)).map(v => (parseFloat(v)||0) * 1000000);
  }

  function _getTarget(year, biz, mode) {
    return _getRollingMonths(year, biz, mode).reduce((s,v) => s+v, 0);
  }

  function _getTotalTarget(year, mode) {
    return CONFIG.BIZ_LIST.reduce((s, b) => s + _getTarget(year, b, mode), 0);
  }

  function _getMonthlyTarget(year, biz, month, mode) {
    return _getRollingMonths(year, biz, mode)[month - 1] || 0;
    // month: 1~12
    return _getRollingMonths(year, biz)[month - 1] || 0;
  }

  // ── 실적 헬퍼 ──────────────────────────────────────────────
  function _getActual(year, biz) {
    return Store.getInvoices()
      .filter(r => r.biz === biz && String(r.date || '').startsWith(String(year)))
      .reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
  }

  function _getActualMonth(year, biz, month) {
    const prefix = `${year}-${String(month).padStart(2,'0')}`;
    return Store.getInvoices()
      .filter(r => (!biz || r.biz === biz) && String(r.date || '').startsWith(prefix))
      .reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
  }

  // ── 롤링 저장 ──────────────────────────────────────────────
  function _saveRollingData(year, data) {
    if (_rollingMode === 'ec') {
      if (!_ecRolling[year]) _ecRolling[year] = {};
      Object.assign(_ecRolling[year], data);
      localStorage.setItem('ec_rolling', JSON.stringify(_ecRolling));
      Api.setSetting('ec_rolling', JSON.stringify(_ecRolling));
    } else {
      if (!_rolling[year]) _rolling[year] = {};
      Object.assign(_rolling[year], data);
      localStorage.setItem('kpi_rolling', JSON.stringify(_rolling));
      Api.setSetting('kpi_rolling', JSON.stringify(_rolling));
    }
  }

  // ── 서버 settings에서 rolling 데이터 동기화 ───────────────
  function _loadFromSettings() {
    const raw = Store.getSetting('kpi_rolling');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach(y => {
            _rolling[y] = { ...(_rolling[y] || {}), ...parsed[y] };
          });
          localStorage.setItem('kpi_rolling', JSON.stringify(_rolling));
        }
      } catch(e) { /* ignore */ }
    }
    const rawEc = Store.getSetting('ec_rolling');
    if (rawEc) {
      try {
        const parsed = JSON.parse(rawEc);
        if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach(y => {
            _ecRolling[y] = { ...(_ecRolling[y] || {}), ...parsed[y] };
          });
          localStorage.setItem('ec_rolling', JSON.stringify(_ecRolling));
        }
      } catch(e) {}
    }
    _loadFactors();
  }

  function selectYear(year) { _year = year; Pages.KpiTarget.render(); }

  function switchBiz(biz) {
    if (biz === 'all') {
      _bizSet = new Set(['all']);
    } else {
      _bizSet.delete('all');
      if (_bizSet.has(biz)) {
        _bizSet.delete(biz);
        if (_bizSet.size === 0) _bizSet = new Set(['all']);
      } else {
        _bizSet.add(biz);
      }
    }
    ['all','DRAM','SSD','MID'].forEach(b => {
      const btn = document.getElementById('kpi-biz-' + b); if (!btn) return;
      const color = b === 'all' ? '#1B4F8A' : CONFIG.BIZ_COLORS[b];
      const on = _bizSet.has(b);
      btn.style.background  = on ? color : 'none';
      btn.style.color       = on ? '#fff' : 'var(--tx2)';
      btn.style.borderColor = on ? color  : 'var(--bd2)';
    });
    _renderTracking();
  }

  // ── 월별 트래킹 렌더 ───────────────────────────────────────
  function _renderTracking() {
    const el = document.getElementById('kpi-tracking-wrap'); if (!el) return;
    const year    = _year;
    const isAll   = _bizSet.has('all');
    const bizList = isAll ? CONFIG.BIZ_LIST : CONFIG.BIZ_LIST.filter(b => _bizSet.has(b));

    const mode = _rollingMode;
    const totalTgt = bizList.reduce((s, b) => s + _getTarget(year, b, mode), 0);
    if (totalTgt === 0) {
      el.innerHTML = `<div style="padding:20px;text-align:center;color:var(--tbl-tx-body);font-size:12px">롤링 데이터를 먼저 입력해주세요</div>`;
      return;
    }

    const now       = new Date();
    const curMonIdx = now.getFullYear() === year ? now.getMonth() : (now.getFullYear() > year ? 11 : -1);
    const MONTHS    = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

    // 롤링 기반 월별 목표 (합산)
    const monthTargets = MONTHS.map((_, i) =>
      bizList.reduce((s, b) => s + _getMonthlyTarget(year, b, i+1), 0)
    );
    const monthActuals = MONTHS.map((_, i) => {
      if (i > curMonIdx) return null;
      return bizList.reduce((s, b) => s + _getActualMonth(year, b, i+1), 0);
    });

    // 누적
    let cumT = 0, cumA = 0;
    const cumTargets = [], cumActuals = [];
    MONTHS.forEach((_, i) => {
      cumT += monthTargets[i];
      cumTargets.push(cumT);
      if (i <= curMonIdx) { cumA += (monthActuals[i] || 0); cumActuals.push(cumA); }
      else cumActuals.push(null);
    });

    const curCumA    = cumActuals[curMonIdx] ?? 0;
    const curCumT    = cumTargets[curMonIdx] ?? 0;
    const overallPct = curCumT > 0 ? Math.round(curCumA / curCumT * 100) : 0;
    const diff       = curCumA - curCumT;
    const bizLabel   = isAll ? '전체' : bizList.map(b => CONFIG.BIZ_LABELS[b]).join(' + ');

    const periodLabel = `1~${curMonIdx + 1}월`;
    const cards = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
        <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:11px 14px">
          <div style="font-size:12px;color:var(--tbl-tx-body);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">연간 목표 · ${bizLabel}</div>
          <div style="font-size:18px;font-weight:600">$${formatNumber(Math.round(totalTgt))}</div>
          <div style="font-size:12px;color:var(--tbl-tx-body);margin-top:2px">롤링 데이터 기준</div>
        </div>
        <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:11px 14px">
          <div style="font-size:12px;color:var(--tbl-tx-body);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">누적 실적 (${periodLabel})</div>
          <div style="font-size:18px;font-weight:600;color:var(--tx)">$${formatNumber(Math.round(curCumA))}</div>
          <div style="font-size:12px;color:var(--tbl-tx-body);margin-top:2px">목표 $${formatNumber(Math.round(curCumT))}</div>
        </div>
        <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:11px 14px">
          <div style="font-size:12px;color:var(--tbl-tx-body);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">누적 달성률 (${periodLabel})</div>
          <div style="font-size:18px;font-weight:600;color:${overallPct>=100?'#085041':overallPct>=70?'#0C447C':'#A32D2D'}">${overallPct}%</div>
          <div style="font-size:12px;color:var(--tbl-tx-body);margin-top:2px">목표 대비</div>
        </div>
        <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:11px 14px">
          <div style="font-size:12px;color:var(--tbl-tx-body);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">누적 차이 (${periodLabel})</div>
          <div style="font-size:18px;font-weight:600;color:${diff>=0?'#085041':'#A32D2D'}">${diff>=0?'+':'-'}$${formatNumber(Math.round(Math.abs(diff)))}</div>
          <div style="font-size:12px;color:var(--tbl-tx-body);margin-top:2px">${diff>=0?'목표 초과':'목표 미달'}</div>
        </div>
      </div>`;

    const chartHtml = `
      <div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px;margin-bottom:12px">
        <div style="display:flex;gap:16px;margin-bottom:10px;font-size:12px;align-items:center">
          <span style="display:flex;align-items:center;gap:5px"><span style="width:12px;height:3px;background:#85B7EB;display:inline-block;border-radius:2px;border-top:2px dashed #85B7EB"></span>목표 누적</span>
          <span style="display:flex;align-items:center;gap:5px"><span style="width:12px;height:3px;background:#1D9E75;display:inline-block;border-radius:2px"></span>실적 누적</span>
          <span style="font-size:12px;color:var(--tbl-tx-body);margin-left:auto">롤링 데이터 기준</span>
        </div>
        <div style="position:relative;height:210px"><canvas id="cv-kpi-monthly"></canvas></div>
      </div>`;

    const thS = 'padding:9px 12px;font-size:12px;font-weight:500;color:var(--tbl-tx-body);text-transform:uppercase;letter-spacing:.05em;background:var(--tbl-sum-bg);border-top:1px solid var(--tbl-row-bd)';
    let cumTA2 = 0, cumAA2 = 0;
    const tableRows = MONTHS.map((m, i) => {
      cumTA2 += monthTargets[i];
      const isPast = i <= curMonIdx;
      const isCur  = i === curMonIdx;
      const act    = isPast ? (monthActuals[i] || 0) : null;
      if (isPast) cumAA2 += (monthActuals[i] || 0);
      const cumAVal = isPast ? cumAA2 : null;
      const pct  = cumTA2 > 0 && cumAVal !== null ? Math.round(cumAVal / cumTA2 * 100) : null;
      const dif  = cumTA2 > 0 && cumAVal !== null ? cumAVal - cumTA2 : null;
      const barC = pct === null ? '#e5e7eb' : pct >= 100 ? '#1D9E75' : pct >= 70 ? '#185FA5' : '#E24B4A';
      const pctC = pct === null ? 'var(--tx3)' : pct >= 100 ? '#085041' : pct >= 70 ? '#0C447C' : '#791F1F';
      const difBadge = dif === null ? '—'
        : dif >= 0 ? `<span style="display:inline-flex;font-size:12px;font-weight:500;padding:2px 7px;border-radius:3px;border:1px solid var(--bd);color:var(--tx2);background:transparent">+$${Math.round(dif).toLocaleString()}</span>`
                   : `<span style="display:inline-flex;font-size:12px;font-weight:500;padding:2px 7px;border-radius:3px;border:1px solid #FECACA;color:#dc2626;background:#FEF2F2">-$${Math.round(Math.abs(dif)).toLocaleString()}</span>`;
      return `<tr style="${isCur?'background:#F0F7FF':''}${!isPast?';opacity:0.38':''}">
        <td style="padding:9px 12px;font-weight:${isCur?'600':'400'};color:${isCur?'#0C447C':'var(--tx)'}">${m}${isCur?' ◀':''}</td>
        <td style="padding:9px 12px;text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--tbl-tx-body)">${monthTargets[i]>0?'$'+formatNumber(Math.round(monthTargets[i])):'—'}</td>
        <td style="padding:9px 12px;text-align:right;font-family:var(--font-mono);font-size:12px">${act!==null?'$'+Math.round(act).toLocaleString():'—'}</td>
        <td style="padding:9px 12px;text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--tbl-tx-body)">${cumTA2>0?'$'+Math.round(cumTA2).toLocaleString():'—'}</td>
        <td style="padding:9px 12px;text-align:right;font-family:var(--font-mono);font-size:12px;font-weight:${isPast?'500':'400'};color:var(--tx)">${cumAVal!==null?'$'+Math.round(cumAVal).toLocaleString():'—'}</td>
        <td style="padding:9px 12px;min-width:130px">
          ${pct!==null?`<div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;height:5px;background:var(--bd);border-radius:3px;overflow:hidden">
              <div style="height:100%;border-radius:3px;background:${barC};width:${Math.min(100,pct)}%"></div>
            </div>
            <span style="font-size:12px;font-weight:500;color:${pctC};min-width:36px;text-align:right">${pct}%</span>
          </div>`:`<span style="font-size:12px;color:var(--tbl-tx-body)">${isPast?'—':'—'}</span>`}
        </td>
        <td style="padding:9px 12px;text-align:right">${difBadge}</td>
      </tr>`;
    }).join('');

    el.innerHTML = `
      ${cards}
      ${chartHtml}
      <div style="background:var(--tbl-bg);border:1px solid var(--tbl-wrap-bd);border-radius:10px;overflow:hidden;margin-bottom:8px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr>
            <th style="${thS};text-align:left">월</th>
            <th style="${thS};text-align:right">월 목표</th>
            <th style="${thS};text-align:right">월 실적</th>
            <th style="${thS};text-align:right">누적 목표</th>
            <th style="${thS};text-align:right">누적 실적</th>
            <th style="${thS};min-width:130px">달성률</th>
            <th style="${thS};text-align:right">누적 차이</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;

    setTimeout(() => {
      const canvas = document.getElementById('cv-kpi-monthly'); if (!canvas) return;
      if (window._kpiChart) { window._kpiChart.destroy(); window._kpiChart = null; }
      window._kpiChart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: MONTHS,
          datasets: [
            { label:'목표 누적', data:cumTargets, borderColor:'#85B7EB', borderWidth:2, borderDash:[5,3],
              pointRadius:3, pointBackgroundColor:'#85B7EB', fill:false, tension:0 },
            { label:'실적 누적', data:cumActuals, borderColor:'#1D9E75', borderWidth:2.5,
              pointRadius:cumActuals.map(v=>v!==null?4:0), pointBackgroundColor:'#1D9E75',
              fill:{target:0, above:'rgba(29,158,117,0.08)', below:'rgba(226,75,74,0.08)'}, tension:0.2 },
          ]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins: {
            legend:{display:false},
            tooltip:{mode:'index',intersect:false,callbacks:{label:ctx=>` ${ctx.dataset.label}: $${Math.round(ctx.raw||0).toLocaleString()}`}}
          },
          scales: {
            x:{grid:{display:false},ticks:{color:'#9aa0ad',font:{size:12},autoSkip:false}},
            y:{grid:{color:'rgba(0,0,0,0.05)'},ticks:{color:'#9aa0ad',font:{size:12},callback:v=>'$'+(v/1000).toFixed(0)+'K'},beginAtZero:true},
          },
          layout:{padding:{top:10}}
        }
      });
    }, 50);
  }

  // ── 메인 렌더 ──────────────────────────────────────────────
  return {
    selectYear, switchBiz,

    // ── 외부 참조용 (dashboard 등) ─────────────────────────
    /** 연간 목표 합계 (USD) — 롤링 기반 */
    getTarget:        (year, biz)        => _getTarget(year, biz),
    /** 전 사업 연간 목표 합계 (USD) */
    getTotalTarget:   (year)             => _getTotalTarget(year),
    /** 월별 목표 (USD, month: 1~12) */
    getMonthlyTarget: (year, biz, month) => _getMonthlyTarget(year, biz, month),
    /** 앱 로드 후 서버 settings → _rolling 동기화 */
    loadFromSettings: ()                 => _loadFromSettings(),

    render() {
      _loadFromSettings();
      const el = document.getElementById('kpitarget-body'); if (!el) return;
      const year = _year;
      const mode = _rollingMode;

      // 롤링 데이터 기반 연간 목표 (KPI=매출이익 / EC=매출 기준)
      const isKpi = mode === 'kpi';
      const bizRows = CONFIG.BIZ_LIST.map(b => {
        const tgt    = _getTarget(year, b, mode);
        const rawAct = _getActual(year, b);
        // KPI 기준: 실적도 매출이익(×Factor)으로 환산
        const act    = isKpi ? _getActualProfit(year, b) : rawAct;
        const factor = _getFactor(b);
        const pct    = tgt > 0 ? Math.min(100, Math.round(act / tgt * 100)) : 0;
        const rem    = Math.max(0, tgt - act);
        const color  = CONFIG.BIZ_COLORS[b];
        const barClr = pct >= 100 ? '#1D9E75' : pct >= 70 ? color : '#EF9F27';

        return `
          <tr style="border-top:1px solid var(--tbl-row-bd)">
            <td style="padding:12px 14px">
              <span style="font-size:12px;font-weight:500;color:${color}">${CONFIG.BIZ_LABELS[b]}</span>
              ${isKpi ? `<span style="font-size:10px;color:#888;margin-left:6px">×${factor}</span>` : ''}
            </td>
            <td style="padding:12px 14px;font-family:var(--font-mono);font-size:12px;font-weight:600">
              ${tgt > 0 ? '$' + formatNumber(Math.round(tgt)) : '<span style="color:var(--tbl-tx-body);font-weight:400">미입력</span>'}
            </td>
            <td style="padding:12px 14px;text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--tx)">
              ${act > 0 ? '$' + formatNumber(Math.round(act)) : '—'}
              ${isKpi && rawAct > 0 ? `<div style="font-size:10px;color:#888">매출 $${formatNumber(Math.round(rawAct))}</div>` : ''}
            </td>
            <td style="padding:12px 14px;min-width:160px">
              ${tgt>0?`<div style="display:flex;align-items:center;gap:8px">
                <div style="flex:1;height:6px;background:var(--bd);border-radius:3px;overflow:hidden">
                  <div style="height:100%;border-radius:3px;background:${barClr};width:${pct}%"></div>
                </div>
                <span style="font-size:12px;font-weight:600;color:${barClr};min-width:32px;text-align:right">${pct}%</span>
              </div>`:'<span style="font-size:12px;color:var(--tbl-tx-body)">롤링 필요</span>'}
            </td>
            <td style="padding:12px 14px;text-align:right;font-family:var(--font-mono);font-size:12px;color:${rem>0?'#BA7517':'var(--tx3)'}">
              ${tgt>0?'$'+formatNumber(Math.round(rem)):'—'}
            </td>
          </tr>`;
      }).join('');

      const totalTgt = _getTotalTarget(year, mode);
      const totalAct = isKpi
        ? CONFIG.BIZ_LIST.reduce((s, b) => s + _getActualProfit(year, b), 0)
        : CONFIG.BIZ_LIST.reduce((s, b) => s + _getActual(year, b), 0);
      const totalPct = totalTgt > 0 ? Math.min(100, Math.round(totalAct / totalTgt * 100)) : 0;
      const totalRem = Math.max(0, totalTgt - totalAct);
      const totalClr = totalPct >= 100 ? '#1D9E75' : totalPct >= 70 ? 'var(--navy)' : '#EF9F27';

      const yearTabs = [year-1, year, year+1].map(y => {
        const active = y === year;
        return `<button onclick="Pages.KpiTarget.selectYear(${y})"
          style="padding:4px 14px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;border:1.5px solid;transition:.15s;
          ${active?'background:#1D1D1F;color:#fff;border-color:#1D1D1F':'background:none;color:var(--tx2);border-color:var(--bd2)'}">${y}년</button>`;
      }).join('');

      const TH  = l => `<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--tbl-hd-tx);background:var(--tbl-hd-bg);border-bottom:1px solid var(--tbl-hd-bd)">${l}</th>`;
      const THR = l => `<th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:var(--tbl-hd-tx);background:var(--tbl-hd-bg);border-bottom:1px solid var(--tbl-hd-bd)">${l}</th>`;
      const actHeader = isKpi ? '누적 매출이익' : '누적 실적';
      const tgtHeader = isKpi ? '목표 매출이익' : '목표 매출';

      const bizBtns = [
        {key:'all', label:'전체', color:'#1B4F8A'},
        ...CONFIG.BIZ_LIST.map(b => ({key:b, label:CONFIG.BIZ_LABELS[b], color:CONFIG.BIZ_COLORS[b]}))
      ].map(({key, label, color}) => {
        const on = _bizSet.has(key);
        return `<button id="kpi-biz-${key}" onclick="Pages.KpiTarget.switchBiz('${key}')"
          style="padding:5px 14px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;border:1.5px solid ${color};
          background:${on?color:'none'};color:${on?'#fff':color};transition:.15s">${label}</button>`;
      }).join('');

      const modeLabel = mode === 'ec' ? 'EC 기준' : 'KPI 기준';
      const modeColor = mode === 'ec' ? '#0F6E56' : '#185FA5';

      el.innerHTML = `
        <div style="max-width:1000px">

          <!-- ① KPI/EC 기준 선택 + 롤링 입력 버튼 (최상단) -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:12px;color:var(--tx2);font-weight:500">기준 선택:</span>
              <div style="display:flex;border:1.5px solid #CCC;border-radius:7px;overflow:hidden">
                <button id="kpi-mode-kpi" onclick="Pages.KpiTarget.setMode('kpi')"
                  style="padding:6px 16px;border:none;font-size:12px;font-weight:600;cursor:pointer;
                         background:${mode==='kpi'?'#1D1D1F':'#fff'};color:${mode==='kpi'?'#fff':'#555'};
                         font-family:Pretendard,sans-serif">KPI 기준</button>
                <button id="kpi-mode-ec" onclick="Pages.KpiTarget.setMode('ec')"
                  style="padding:6px 16px;border:none;font-size:12px;font-weight:600;cursor:pointer;
                         background:${mode==='ec'?'#0F6E56':'#fff'};color:${mode==='ec'?'#fff':'#555'};
                         font-family:Pretendard,sans-serif">EC 기준</button>
              </div>
              <span style="font-size:11px;color:${modeColor};font-weight:600;padding:3px 8px;border:1px solid ${modeColor};border-radius:4px">${modeLabel}</span>
            </div>
            <div style="display:flex;gap:6px">
              <button onclick="Pages.KpiTarget.openRolling('kpi')"
                style="display:flex;align-items:center;gap:5px;padding:6px 12px;border:1.5px solid #185FA5;border-radius:7px;background:none;color:#185FA5;font-size:12px;font-weight:500;cursor:pointer">
                <svg width="12" height="12" fill="none" viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 8h6M8 5v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                KPI 롤링 입력
              </button>
              <button onclick="Pages.KpiTarget.openRolling('ec')"
                style="display:flex;align-items:center;gap:5px;padding:6px 12px;border:1.5px solid #0F6E56;border-radius:7px;background:none;color:#0F6E56;font-size:12px;font-weight:500;cursor:pointer">
                <svg width="12" height="12" fill="none" viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 8h6M8 5v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                EC 롤링 입력
              </button>
              ${isKpi ? `
              <button onclick="Pages.KpiTarget.openFactorPanel()"
                style="display:flex;align-items:center;gap:5px;padding:6px 12px;border:1.5px solid #6A3D7C;border-radius:7px;background:none;color:#6A3D7C;font-size:12px;font-weight:500;cursor:pointer">
                <svg width="12" height="12" fill="none" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                Factor 설정
              </button>` : ''}
            </div>
          </div>

          <!-- ② 연도 탭 -->
          <div style="display:flex;gap:6px;margin-bottom:16px">${yearTabs}</div>

          <!-- ③ 요약 카드 -->
          ${totalTgt > 0 ? `
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
            <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:10px 14px">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--tbl-tx-body);margin-bottom:3px">연간 목표 (${modeLabel})</div>
              <div style="font-size:18px;font-weight:600;color:${modeColor}">$${formatNumber(Math.round(totalTgt))}</div>
              <div style="font-size:11px;color:var(--tbl-tx-body);margin-top:2px">롤링 데이터 합계</div>
            </div>
            <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:10px 14px">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--tbl-tx-body);margin-bottom:3px">누적 달성</div>
              <div style="font-size:18px;font-weight:600;color:var(--tx)">$${formatNumber(Math.round(totalAct))}</div>
            </div>
            <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:10px 14px">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--tbl-tx-body);margin-bottom:3px">전체 달성률</div>
              <div style="font-size:18px;font-weight:600;color:${totalClr}">${totalPct}%</div>
            </div>
          </div>` : `
          <div style="background:#FFF3E0;border-left:3px solid #EF9F27;padding:10px 14px;border-radius:var(--rs);margin-bottom:16px;font-size:12px;color:#633806">
            롤링 데이터를 입력하면 목표가 자동으로 설정됩니다 →
            <button onclick="Pages.KpiTarget.openRolling('kpi')" style="background:none;border:none;color:#185FA5;font-size:12px;font-weight:500;cursor:pointer;text-decoration:underline">KPI 롤링 데이터 입력</button>
          </div>`}

          <div style="background:var(--tbl-bg);border:1px solid var(--tbl-wrap-bd);border-radius:10px;overflow:hidden;margin-bottom:20px">
            <table style="width:100%;border-collapse:collapse">
              <thead><tr>${TH('사업')}${TH(tgtHeader + ' (USD)')}${THR(actHeader)}${TH('달성률')}${THR('잔여')}</tr></thead>
              <tbody>${bizRows}</tbody>
              ${totalTgt > 0 ? `
              <tfoot><tr style="background:var(--tbl-sum-bg)">
                <td style="padding:10px 14px;font-size:12px;font-weight:500;color:var(--tx2);border-top:0.5px solid var(--bd)">합계</td>
                <td style="padding:10px 14px;font-family:var(--font-mono);font-size:12px;font-weight:600;border-top:0.5px solid var(--bd)">$${formatNumber(Math.round(totalTgt))}</td>
                <td style="padding:10px 14px;text-align:right;font-family:var(--font-mono);font-size:12px;font-weight:600;color:var(--tx);border-top:0.5px solid var(--bd)">$${formatNumber(Math.round(totalAct))}</td>
                <td style="padding:10px 14px;border-top:0.5px solid var(--bd)">
                  <div style="display:flex;align-items:center;gap:8px">
                    <div style="flex:1;height:6px;background:var(--bd);border-radius:3px;overflow:hidden">
                      <div style="height:100%;border-radius:3px;background:${totalClr};width:${totalPct}%"></div>
                    </div>
                    <span style="font-size:12px;font-weight:600;color:${totalClr};min-width:32px;text-align:right">${totalPct}%</span>
                  </div>
                </td>
                <td style="padding:10px 14px;text-align:right;font-family:var(--font-mono);font-size:12px;font-weight:600;color:${totalRem>0?'#BA7517':'var(--tx3)'};border-top:0.5px solid var(--bd)">$${formatNumber(Math.round(totalRem))}</td>
              </tr></tfoot>` : ''}
            </table>
          </div>

          <!-- 월별 트래킹 -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <div style="display:flex;gap:6px;flex-wrap:wrap">${bizBtns}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap"></div>
          </div>
          <div id="kpi-tracking-wrap"></div>
        </div>`;

      _renderTracking();
    },

    openRolling(mode) {
      _rollingYear = _year;
      _rollingMode = mode || 'kpi';
      const el = document.getElementById('kpi-rolling-panel');
      const ov = document.getElementById('kpi-rolling-overlay');
      // 패널 제목 업데이트
      const title = document.getElementById('kpi-rolling-title');
      if (title) title.textContent = _rollingMode === 'ec' ? 'EC 롤링 데이터 입력' : 'KPI 롤링 데이터 입력';
      const sel = document.querySelector('#kpi-rolling-panel select');
      if (sel) sel.value = String(_rollingYear);
      if (el) { el.style.display = 'block'; document.body.style.overflow = 'hidden'; }
      if (ov) ov.style.display = 'block';
      Pages.KpiTarget.renderRolling();
    },

    closeRolling() {
      const el = document.getElementById('kpi-rolling-panel');
      const ov = document.getElementById('kpi-rolling-overlay');
      if (el) el.style.display = 'none';
      if (ov) ov.style.display = 'none';
      document.body.style.overflow = '';
    },

    setRollingYear(y) {
      _rollingYear = parseInt(y);
      Pages.KpiTarget.renderRolling();
    },

    calcRollingRow(input) {
      const row = input.closest('tr');
      const inputs = row.querySelectorAll('input[type=number]');
      let sum = 0;
      inputs.forEach(i => { sum += parseFloat(i.value)||0; });
      const rt = row.querySelector('.rolling-rowtotal');
      if (rt) rt.textContent = sum > 0 ? +sum.toFixed(4)+'' : '—';
      Pages.KpiTarget.calcRollingAll();
    },

    calcRollingAll() {
      const body = document.getElementById('rolling-tbody'); if (!body) return;
      const rows = body.querySelectorAll('tr');
      const colSums = Array(12).fill(0);
      let grand = 0;
      rows.forEach(row => {
        const inputs = row.querySelectorAll('input[type=number]');
        let rowSum = 0;
        inputs.forEach((inp, ci) => {
          const v = parseFloat(inp.value)||0;
          colSums[ci] += v; rowSum += v;
        });
        const rt = row.querySelector('.rolling-rowtotal');
        if (rt) rt.textContent = rowSum > 0 ? +rowSum.toFixed(4)+'' : '—';
      });
      colSums.forEach((v, i) => {
        const el = document.getElementById('rs'+i);
        if (el) el.textContent = v > 0 ? +v.toFixed(4)+'' : '0';
        grand += v;
      });
      const st = document.getElementById('rstotal');
      if (st) st.textContent = grand > 0 ? +grand.toFixed(4)+'' : '0';
    },

    renderRolling() {
      const wrap = document.getElementById('kpi-rolling-inner'); if (!wrap) return;
      const y = _rollingYear;
      const src = _rollingMode === 'ec' ? _ecRolling : _rolling;
      const yData = src[y] || {};

      const ROWS = [
        { key:'DRAM', label:'DRAM Test',              fixed:true },
        { key:'SSD',  label:'SSD Test',               fixed:true },
        { key:'MID',  label:'Mobile Ink Die',          fixed:true },
        { key:'SCR',  label:'Scrap 자재 공급',         fixed:true },
        { key:'RMA',  label:'RMA 운영',               fixed:true },
        { key:'SUS',  label:'Sustainability 컨설팅',   fixed:true },
        { key:'MOD',  label:'모듈 세일즈',             fixed:true },
      ];
      const MO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
      const thS = 'padding:6px 6px;text-align:center;font-size:11px;font-weight:500;color:var(--tbl-tx-body);background:var(--tbl-sum-bg);border:1px solid var(--bd);white-space:nowrap';
      const inpW = 'width:52px;padding:4px 3px;border:1px solid var(--bd2);border-radius:4px;font-size:12px;text-align:right;background:var(--card);color:var(--tx);font-family:var(--font-mono)';

      const tableRows = ROWS.map((r, i) => {
        const vals = yData[r.key] || Array(12).fill(0);
        const cells = vals.map((v) =>
          `<td style="padding:3px 3px;border:1px solid var(--bd)"><input type="number" value="${v||''}" placeholder="0" step="0.0001" style="${inpW}" oninput="Pages.KpiTarget.calcRollingRow(this)"></td>`
        ).join('');
        const rowSum = vals.reduce((s,v) => s+(parseFloat(v)||0), 0);
        return `<tr>
          <td style="padding:6px 8px;text-align:center;font-size:12px;color:var(--tbl-tx-body);background:var(--tbl-sum-bg);border:1px solid var(--bd)">${i+1}</td>
          <td style="padding:6px 10px;font-size:12px;font-weight:${r.fixed?'500':'400'};color:${r.fixed?'var(--tx)':'var(--tx3)'};background:var(--tbl-sum-bg);border:1px solid var(--bd);white-space:nowrap;text-align:center">${r.label}</td>
          ${cells}
          <td class="rolling-rowtotal" style="padding:6px 6px;text-align:right;font-size:12px;font-weight:500;color:var(--tx);background:var(--tbl-sum-bg);border:1px solid var(--bd);font-family:var(--font-mono)">${rowSum>0?+rowSum.toFixed(4):'—'}</td>
        </tr>`;
      }).join('');

      const colSums = Array(12).fill(0);
      ROWS.forEach(r => {
        const vals = yData[r.key] || [];
        vals.forEach((v,i) => { colSums[i] += parseFloat(v)||0; });
      });
      const grand = colSums.reduce((s,v)=>s+v,0);
      const sumCells = colSums.map((v,i) =>
        `<td id="rs${i}" style="padding:6px 6px;text-align:right;font-size:12px;font-weight:500;background:#F1EFE8;border:1px solid var(--bd);font-family:var(--font-mono)">${v>0?+v.toFixed(4):'0'}</td>`
      ).join('');

      wrap.innerHTML = `
        <div style="font-size:12px;color:${_rollingMode==='ec'?'#0F6E56':'#E24B4A'};font-weight:500;margin-bottom:12px">Unit: Million USD &nbsp;·&nbsp; ${_rollingMode==='ec'?'EC(예상비용) 기준':'KPI 목표 기준'} · 저장하면 즉시 반영됩니다</div>
        <div style="overflow-x:auto">
          <table style="border-collapse:collapse;table-layout:auto">
            <thead>
              <tr>
                <th style="${thS};width:30px">No.</th>
                <th style="${thS};min-width:110px">구분</th>
                ${MO.map(m=>`<th style="${thS};width:56px">${m}</th>`).join('')}
                <th style="${thS};width:60px;background:#F1EFE8">합계</th>
              </tr>
            </thead>
            <tbody id="rolling-tbody">${tableRows}</tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding:6px 10px;text-align:center;font-size:12px;font-weight:500;background:#F1EFE8;border:1px solid var(--bd)">합계</td>
                ${sumCells}
                <td id="rstotal" style="padding:6px 6px;text-align:right;font-size:12px;font-weight:600;color:var(--tx);background:#E8E4D8;border:1px solid var(--bd);font-family:var(--font-mono)">${grand>0?+grand.toFixed(4):'0'}</td>
              </tr>
            </tfoot>
          </table>
        </div>`;
    },

    saveRolling() {
      const body = document.getElementById('rolling-tbody'); if (!body) return;
      const y = _rollingYear;
      const ROWS = ['DRAM','SSD','MID','SCR','RMA','SUS','MOD'];
      const rows = body.querySelectorAll('tr');
      const newData = {};
      rows.forEach((row, ri) => {
        const key = ROWS[ri]; if (!key) return;
        const inputs = row.querySelectorAll('input[type=number]');
        newData[key] = Array.from(inputs).map(i => parseFloat(i.value)||0);
      });
      _saveRollingData(y, newData);
      Pages.KpiTarget.closeRolling();
      Pages.KpiTarget.render();
      if (typeof Nav !== 'undefined' && Nav.current && Nav.current() === 'dash') Pages.Dashboard.render();
      UI.toast(`${y}년 ${_rollingMode === 'ec' ? 'EC' : 'KPI'} 롤링 데이터 저장됨`);
    },

    setMode(mode) {
      _rollingMode = mode;
      Pages.KpiTarget.render();
    },

    openFactorPanel() {
      const el = document.getElementById('kpi-factor-panel');
      const ov = document.getElementById('kpi-rolling-overlay');
      if (!el) return;
      // Factor 입력 UI 렌더
      const rows = CONFIG.BIZ_LIST.map(b => {
        const f = _getFactor(b);
        return `<tr>
          <td style="padding:8px 12px;font-size:13px;font-weight:500;color:${CONFIG.BIZ_COLORS[b]};font-family:Pretendard,sans-serif;white-space:nowrap">${CONFIG.BIZ_LABELS[b]}</td>
          <td style="padding:8px 12px">
            <input type="number" id="factor-${b}" value="${f}" min="0" max="2" step="0.01"
              style="width:80px;padding:5px 8px;border:1px solid #CCC;border-radius:4px;font-size:13px;text-align:right;font-family:'DM Mono',monospace">
          </td>
          <td style="padding:8px 12px;font-size:12px;color:#888;font-family:Pretendard,sans-serif">
            매출 100 → 이익 <span id="preview-${b}" style="font-weight:600;color:#333">${(100*f).toFixed(1)}</span>
          </td>
        </tr>`;
      }).join('');

      document.getElementById('kpi-factor-inner').innerHTML = `
        <div style="font-size:12px;color:#888;margin-bottom:14px;font-family:Pretendard,sans-serif">
          Factor = 매출이익 / 매출 &nbsp;·&nbsp; 예) 매출 100, Factor 0.9 → 매출이익 90
        </div>
        <table style="border-collapse:collapse;width:100%">
          <thead><tr>
            <th style="padding:8px 12px;text-align:left;font-size:12px;font-weight:700;background:#F0F0F0;border-bottom:2px solid #CCC;font-family:Pretendard,sans-serif">사업</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;font-weight:700;background:#F0F0F0;border-bottom:2px solid #CCC;font-family:Pretendard,sans-serif">Factor</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;font-weight:700;background:#F0F0F0;border-bottom:2px solid #CCC;font-family:Pretendard,sans-serif">미리보기</th>
          </tr></thead>
          <tbody id="factor-tbody">${rows}</tbody>
        </table>`;

      // 실시간 미리보기
      CONFIG.BIZ_LIST.forEach(b => {
        const inp = document.getElementById('factor-' + b);
        if (inp) inp.addEventListener('input', () => {
          const prev = document.getElementById('preview-' + b);
          if (prev) prev.textContent = (100 * (parseFloat(inp.value)||0)).toFixed(1);
        });
      });

      el.style.display = 'block';
      if (ov) ov.style.display = 'block';
      document.body.style.overflow = 'hidden';
    },

    closeFactorPanel() {
      const el = document.getElementById('kpi-factor-panel');
      const ov = document.getElementById('kpi-rolling-overlay');
      if (el) el.style.display = 'none';
      if (ov) ov.style.display = 'none';
      document.body.style.overflow = '';
    },

    saveFactors() {
      const newFactors = {};
      CONFIG.BIZ_LIST.forEach(b => {
        const inp = document.getElementById('factor-' + b);
        newFactors[b] = parseFloat(inp?.value ?? 1);
      });
      _saveFactors(newFactors);
      Pages.KpiTarget.closeFactorPanel();
      Pages.KpiTarget.render();
      UI.toast('Factor 저장 완료');
    },
  };

})();
