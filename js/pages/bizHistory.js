/**
 * pages/bizHistory.js
 * 사업별 히스토리 — Executive 스타일 대시보드
 *
 * KPI 기준: 103억 (kpi103 모드)
 * 화폐 환산: KpiTarget 사업계획 환율 사용
 *
 * 30초 뷰: 헤더 + 상태 배지 + KPI 카드
 * 3분 뷰  : 월마감 요약 + 추이 차트
 * 10분 뷰 : 이벤트 타임라인
 */

Pages.BizHistory = (() => {

  // ── 상태 ───────────────────────────────────────────────────
  const KPI_MODE = 'kpi103';
  const KPI_LABEL = '103억 기준';

  let _biz     = 'DRAM';
  let _country = '';   // '' = 전체
  let _chartProc, _chartRev, _chartCum;

  const EVT_STYLE = {
    in:    { color: '#1B4F8A', bg: '#EBF2FB', label: '입고' },
    done:  { color: '#0F6E56', bg: '#E8F5F0', label: '완료' },
    inv:   { color: '#6A3D7C', bg: '#F3EEF8', label: '청구' },
    paid:  { color: '#B45309', bg: '#FEF6E7', label: '수금' },
    ship:  { color: '#6B6762', bg: '#F5F5F7', label: '입고예정' },
  };

  // ── 유틸 ──────────────────────────────────────────────────
  const _ym = (d) => (d || '').slice(0, 7);

  function _lots() {
    return Store.getLots().filter(l =>
      l.biz === _biz && (!_country || l.country === _country)
    );
  }
  function _invoices() {
    return Store.getInvoices().filter(i =>
      i.biz === _biz && (!_country || i.country === _country)
    );
  }
  function _shipments() {
    return Store.getShipments().filter(s =>
      s.biz === _biz && (!_country || s.country === _country)
    );
  }
  function _lotIdSet() {
    const set = new Set();
    _lots().forEach(l => set.add(String(l.id)));
    return set;
  }
  function _dailies() {
    const ids = _lotIdSet();
    return Store.getDailies().filter(d => ids.has(String(d.lotId)));
  }

  /** 사업/국가/연도/월 필터링된 인보이스의 매출 합계 (USD) */
  function _revenueUsd(year, month) {
    const prefix = month
      ? `${year}-${String(month).padStart(2, '0')}`
      : String(year);
    return _invoices()
      .filter(r => String(r.date || '').startsWith(prefix))
      .reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
  }

  /** 사업 EBIT 환산 (KRW). factor와 환율 적용 */
  function _ebitKrw(usdRevenue) {
    const factor = Pages.KpiTarget.getFactor(_biz);
    const xrate  = Pages.KpiTarget.getExchangeRate();
    return usdRevenue * factor * xrate;
  }

  /** 사업 시작일 = 첫 LOT 입고일 */
  function _startDate() {
    const dates = _lots().map(l => l.inDate).filter(Boolean).sort();
    return dates[0] || '';
  }

  /** 상태 판정 — paceDiff(%p) 기반 */
  function _statusOf(paceDiff) {
    if (paceDiff === null) return { key: 'na',     label: '데이터 부족', color: '#A8A49E', bg: '#F5F5F7' };
    if (paceDiff >=  5)    return { key: 'ahead',  label: 'Ahead',     color: '#1B4F8A', bg: '#EBF2FB' };
    if (paceDiff >= -2)    return { key: 'track',  label: 'On Track',  color: '#0F6E56', bg: '#E8F5F0' };
    if (paceDiff >= -5)    return { key: 'watch',  label: 'Watch',     color: '#B45309', bg: '#FEF6E7' };
    return                        { key: 'behind', label: 'Behind',    color: '#A32D2D', bg: '#FEF2F2' };
  }

  // ── 통계 묶음 계산 ─────────────────────────────────────────
  function _computeStats() {
    const year   = new Date().getFullYear();
    const curMon = new Date().getMonth() + 1;

    const lots     = _lots();
    const invoices = _invoices();
    const dailies  = _dailies();

    const totalQty  = lots.reduce((s, l) => s + parseNumber(l.qty), 0);
    const totalProc = dailies.reduce((s, d) => s + parseNumber(d.proc), 0);
    const doneLots  = lots.filter(l => getLotStatus(l) === 'done');
    const activeLots= lots.length - doneLots.length;

    // 누적 매출 (인보이스 청구 기준)
    const revUsd      = invoices.reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
    const paidUsd     = invoices.filter(r => r.status === 'paid').reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
    const xrate       = Pages.KpiTarget.getExchangeRate();
    const revKrw      = xrate > 0 ? revUsd * xrate : 0;

    // 평균 리드타임 (완료 LOT 기준)
    const leadDaysArr = doneLots
      .filter(l => l.inDate && l.actualDone)
      .map(l => diffDays(l.inDate, l.actualDone));
    const avgLead = leadDaysArr.length
      ? (leadDaysArr.reduce((a, b) => a + b, 0) / leadDaysArr.length)
      : null;

    // KPI (103억 기준)
    const kpi = Pages.KpiTarget.getBizSummary(year, _biz, KPI_MODE);
    const kpiTgtKrw = kpi ? kpi.tgt : 0;       // 원
    const kpiActKrw = kpi ? kpi.act : 0;       // 원 (factor 적용된 EBIT)
    const kpiActUsd = kpi ? kpi.actUsd : 0;    // USD EBIT
    const kpiPctRaw = kpi ? kpi.pctRaw : null;
    const kpiPct    = kpi ? kpi.pct    : null;

    // 누적 계획 (이번 달까지)
    let cumPlanKrw = 0;
    for (let m = 1; m <= curMon; m++) {
      cumPlanKrw += Pages.KpiTarget.getMonthlyTarget(year, _biz, m, KPI_MODE) || 0;
    }
    const expectPct = kpiTgtKrw > 0 ? (cumPlanKrw / kpiTgtKrw) * 100 : null;
    const paceDiff  = (kpiPctRaw !== null && expectPct !== null) ? (kpiPctRaw - expectPct) : null;

    return {
      year, curMon,
      lots, invoices, doneLots, activeLots, totalQty, totalProc,
      revUsd, revKrw, paidUsd, xrate, avgLead,
      kpi, kpiTgtKrw, kpiActKrw, kpiActUsd, kpiPctRaw, kpiPct,
      cumPlanKrw, expectPct, paceDiff,
    };
  }

  // ── 1. 헤더 ───────────────────────────────────────────────
  function _renderHeader(s) {
    const status = _statusOf(s.paceDiff);
    const period = `${s.year}년 1월 ~ ${s.curMon}월`;
    const start  = _startDate();
    const ms     = start ? Math.round(diffDays(start, today()) / 30 * 10) / 10 : 0;

    // 헤드라인 — 사실 기반 한 줄
    let headline;
    if (!start) {
      headline = '아직 등록된 LOT가 없는 사업입니다.';
    } else if (s.paceDiff === null) {
      headline = `${CONFIG.BIZ_LABELS[_biz]} 사업 — 누적 운영 ${ms}개월, KPI 목표 미설정.`;
    } else if (s.paceDiff >= 5) {
      headline = `누적 진척률 ${s.kpiPctRaw.toFixed(1)}% — 계획 대비 +${s.paceDiff.toFixed(1)}%p 앞서 진행 중.`;
    } else if (s.paceDiff >= -2) {
      headline = `누적 진척률 ${s.kpiPctRaw.toFixed(1)}% — 계획에 거의 부합하는 흐름.`;
    } else if (s.paceDiff >= -5) {
      headline = `누적 진척률 ${s.kpiPctRaw.toFixed(1)}% — 계획 대비 ${s.paceDiff.toFixed(1)}%p 뒤처짐. 모니터링 필요.`;
    } else {
      headline = `누적 진척률 ${s.kpiPctRaw.toFixed(1)}% — 계획 대비 ${s.paceDiff.toFixed(1)}%p 미달. 따라잡기 액션 필요.`;
    }

    return `
    <div style="background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:20px 24px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Business Progress Report</div>
          <div style="font-size:22px;font-weight:600;color:var(--tx);line-height:1.25">${CONFIG.BIZ_LABELS[_biz]}</div>
          <div style="font-size:13px;color:var(--tx2);margin-top:6px;line-height:1.55">${headline}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:14px;background:${status.bg};border:1px solid ${status.color}33;color:${status.color};font-size:11px;font-weight:600;letter-spacing:.04em">
            <span style="width:6px;height:6px;border-radius:50%;background:${status.color}"></span>
            ${status.label}
          </span>
          <div style="font-size:11px;color:var(--tx3);text-align:right">
            보고 기간 ${period}<br>
            ${start ? `사업 시작 ${start} · ${ms}개월 운영` : '시작 LOT 없음'}
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── 2. KPI 카드 (Executive Snapshot) ──────────────────────
  function _renderSnapshot(s) {
    const xrate = s.xrate;
    function card(label, value, target, meaning, accent) {
      return `<div style="background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:16px 18px;display:flex;flex-direction:column">
        <div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">${label}</div>
        <div style="font-size:24px;font-weight:600;line-height:1.15;${accent?'color:'+accent:'color:var(--tx)'}">${value}</div>
        <div style="font-size:11px;color:var(--tx3);margin-top:4px">${target || '&nbsp;'}</div>
        <div style="font-size:11px;color:var(--tx2);margin-top:auto;padding-top:10px;line-height:1.5">${meaning || '&nbsp;'}</div>
      </div>`;
    }

    // KPI 카드
    const kpiVal  = s.kpiPct === null ? '—' : s.kpiPctRaw.toFixed(1) + '%';
    const kpiTgt  = `목표 ${KPI_LABEL} · ${(s.kpiTgtKrw/100000000).toFixed(2)}억원`;
    const kpiMean = s.paceDiff === null
      ? '연간 목표가 설정되지 않았습니다.'
      : s.paceDiff >= 0
        ? `${s.curMon}월 누적 계획 ${s.expectPct.toFixed(1)}% 대비 +${s.paceDiff.toFixed(1)}%p 앞섬.`
        : `${s.curMon}월 누적 계획 ${s.expectPct.toFixed(1)}% 대비 ${s.paceDiff.toFixed(1)}%p 뒤처짐.`;
    const kpiAccent = s.paceDiff === null ? '' : s.paceDiff >= -2 ? '#0F6E56' : s.paceDiff >= -5 ? '#B45309' : '#A32D2D';

    // 매출 카드 (USD + KRW)
    const revVal = s.revUsd > 0 ? '$' + formatNumber(Math.round(s.revUsd)) : '—';
    const revTgt = s.revKrw > 0
      ? `≈ ₩${formatNumber(Math.round(s.revKrw))} (${(s.revKrw/100000000).toFixed(2)}억원, ₩${xrate}/USD)`
      : (xrate > 0 ? '청구 인보이스 없음' : '사업계획 환율 미입력');
    const recogPct = s.revUsd > 0 ? Math.round(s.paidUsd / s.revUsd * 100) : 0;
    const revMean = s.invoices.length === 0
      ? '청구가 시작되지 않았습니다.'
      : `${s.invoices.length}건 인보이스 · 수금 ${recogPct}% ($${formatNumber(Math.round(s.paidUsd))}).`;

    // EBIT 카드 (KPI 기준 실적)
    const ebitVal = s.kpiActKrw > 0 ? `${(s.kpiActKrw/100000000).toFixed(2)}억원` : '—';
    const ebitTgt = `매출 × Factor(${Pages.KpiTarget.getFactor(_biz).toFixed(2)}) × ₩${xrate}`;
    const ebitMean = s.kpiActUsd > 0
      ? `EBIT 환산 $${formatNumber(Math.round(s.kpiActUsd))} → ₩${formatNumber(Math.round(s.kpiActKrw))}.`
      : 'KPI 인정 실적이 아직 없습니다.';

    // 처리량 카드
    const procVal = formatNumber(s.totalProc);
    const procTgt = `입고 ${formatNumber(s.totalQty)} · 잔량 ${formatNumber(Math.max(0, s.totalQty - s.totalProc))}`;
    const procRate = s.totalQty > 0 ? Math.round(s.totalProc / s.totalQty * 100) : 0;
    const procMean = `누적 입고 대비 ${procRate}% 처리 완료.`;

    // LOT 카드
    const lotVal = `${s.lots.length}건`;
    const lotTgt = `완료 ${s.doneLots.length} · 진행 ${s.activeLots}`;
    const lotMean = s.avgLead !== null
      ? `평균 리드타임 ${s.avgLead.toFixed(1)}일 (완료 ${s.doneLots.length}건 기준).`
      : '완료된 LOT가 없어 리드타임 미산정.';

    // 페이스 카드
    const paceVal = s.paceDiff === null ? '—' : (s.paceDiff >= 0 ? '+' : '') + s.paceDiff.toFixed(1) + '%p';
    const paceTgt = s.paceDiff === null ? '' : '실적 진척률 − 계획 진척률';
    const paceMean = s.paceDiff === null
      ? '목표 미설정.'
      : s.paceDiff >= 5 ? '계획을 크게 앞섬.'
      : s.paceDiff >= -2 ? '계획에 부합.'
      : s.paceDiff >= -5 ? '계획 대비 약간 뒤처짐 — 모니터링.'
      : '계획 대비 크게 미달 — 액션 필요.';
    const paceAccent = s.paceDiff === null ? '' : s.paceDiff >= -2 ? '#0F6E56' : s.paceDiff >= -5 ? '#B45309' : '#A32D2D';

    return `
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:10px">
      ${card(`KPI 달성률 · ${KPI_LABEL}`, kpiVal, kpiTgt, kpiMean, kpiAccent)}
      ${card('계획대비 페이스', paceVal, paceTgt, paceMean, paceAccent)}
      ${card('누적 EBIT (KPI 기준)', ebitVal, ebitTgt, ebitMean)}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:18px">
      ${card('누적 매출 (청구)', revVal, revTgt, revMean)}
      ${card('처리량', procVal, procTgt, procMean)}
      ${card('LOT', lotVal, lotTgt, lotMean)}
    </div>`;
  }

  // ── 3. 월마감 요약 (Plan vs Actual) ───────────────────────
  function _renderMonthlyClose(s) {
    const rows = [];
    let cumPlan = 0, cumAct = 0;

    for (let m = 1; m <= 12; m++) {
      const planKrw = Pages.KpiTarget.getMonthlyTarget(s.year, _biz, m, KPI_MODE) || 0;
      const revUsd  = _revenueUsd(s.year, m);
      const actKrw  = _ebitKrw(revUsd);
      cumPlan += planKrw;
      const isPast = m < s.curMon;
      const isCur  = m === s.curMon;
      if (isPast || isCur) cumAct += actKrw;
      const diff      = actKrw - planKrw;
      const cumDiff   = cumAct - cumPlan;
      const cumPctVsAnnual    = s.kpiTgtKrw > 0 ? (cumAct  / s.kpiTgtKrw) * 100 : 0;
      const planPctVsAnnual   = s.kpiTgtKrw > 0 ? (cumPlan / s.kpiTgtKrw) * 100 : 0;
      const pace      = cumPctVsAnnual - planPctVsAnnual;

      rows.push({ m, planKrw, actKrw, revUsd, diff, cumPlan, cumAct, cumDiff, cumPctVsAnnual, pace, isPast, isCur });
    }

    const fmtEok = (v) => (v / 100000000).toFixed(2);
    const sign   = (v) => v >= 0 ? '+' : '';
    const paceColor = (p) => p >= -2 ? '#0F6E56' : p >= -5 ? '#B45309' : '#A32D2D';

    const TH = (l, w) => `<th style="padding:8px 10px;text-align:right;font-size:11px;font-weight:600;color:var(--tx2);background:#F7F7F5;border-bottom:1px solid var(--bd);white-space:nowrap${w?';width:'+w:''}">${l}</th>`;
    const THL= (l, w) => `<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--tx2);background:#F7F7F5;border-bottom:1px solid var(--bd);white-space:nowrap${w?';width:'+w:''}">${l}</th>`;

    const body = rows.map(r => {
      const future = !r.isPast && !r.isCur;
      const monthBg = r.isCur ? '#FBFBF8' : '';
      const monthLabel = r.m + '월' + (r.isCur ? ' (진행)' : '');
      const td  = (v, color, bold) => `<td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-size:12px;border-bottom:1px solid #F0EFE9;${color?'color:'+color+';':'color:var(--tx);'}${bold?'font-weight:600;':''}${future?'opacity:.35;':''}${monthBg?'background:'+monthBg+';':''}">${v}</td>`;
      const tdL = `<td style="padding:8px 12px;font-size:12px;color:var(--tx);border-bottom:1px solid #F0EFE9;${future?'opacity:.35;':''}${monthBg?'background:'+monthBg+';font-weight:600;':''}">${monthLabel}</td>`;

      const planTxt = r.planKrw > 0 ? fmtEok(r.planKrw) : '—';
      const actTxt  = future ? '—' : (r.actKrw > 0 ? fmtEok(r.actKrw) : '0.00');
      const diffTxt = future || (!r.planKrw && !r.actKrw) ? '—' : sign(r.diff) + fmtEok(r.diff);
      const diffClr = future || (!r.planKrw && !r.actKrw) ? 'var(--tx3)' : (r.diff >= 0 ? '#0F6E56' : '#A32D2D');
      const cumPctTxt = future ? '—' : r.cumPctVsAnnual.toFixed(1) + '%';
      const paceTxt = future || !r.planKrw ? '—' : sign(r.pace) + r.pace.toFixed(1) + '%p';
      const paceClr = future || !r.planKrw ? 'var(--tx3)' : paceColor(r.pace);

      return `<tr>${tdL}${td(planTxt)}${td(actTxt)}${td(diffTxt, diffClr, true)}${td(fmtEok(r.cumPlan))}${td(future?'—':fmtEok(r.cumAct))}${td(cumPctTxt, '', true)}${td(paceTxt, paceClr, true)}</tr>`;
    }).join('');

    // 해석문
    const lastClosed = rows.filter(r => r.isPast).slice(-1)[0];
    const curRow     = rows[s.curMon - 1];
    let interp = '';
    if (lastClosed) {
      const lcSign = lastClosed.diff >= 0 ? '초과' : '미달';
      interp += `${lastClosed.m}월 마감: 계획 ${fmtEok(lastClosed.planKrw)}억원 대비 실적 ${fmtEok(lastClosed.actKrw)}억원 (${sign(lastClosed.diff)}${fmtEok(lastClosed.diff)}억원 ${lcSign}). `;
    }
    if (curRow && curRow.planKrw > 0) {
      const todo = Math.max(0, curRow.planKrw - curRow.actKrw);
      interp += `${curRow.m}월 진행 중 — 잔여 계획 ${fmtEok(todo)}억원.`;
    }

    return `
    <div style="background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:18px 22px;margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;gap:12px;flex-wrap:wrap">
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--tx)">월마감 요약 — KPI 추종 현황</div>
          <div style="font-size:11px;color:var(--tx3);margin-top:3px">${s.year}년 · ${KPI_LABEL} · 단위 억원 (₩${s.xrate}/USD)</div>
        </div>
        ${interp ? `<div style="font-size:12px;color:var(--tx2);max-width:520px;text-align:right;line-height:1.55">${interp}</div>` : ''}
      </div>
      <div style="overflow-x:auto;margin-top:12px">
        <table style="width:100%;border-collapse:collapse;min-width:780px">
          <thead><tr>
            ${THL('월', '90px')}
            ${TH('계획')}
            ${TH('실적')}
            ${TH('차이')}
            ${TH('누적 계획')}
            ${TH('누적 실적')}
            ${TH('누적 진척률')}
            ${TH('계획대비')}
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>`;
  }

  // ── 4. 추이 차트 ──────────────────────────────────────────
  function _renderCharts(s) {
    setTimeout(() => {
      if (_chartProc) _chartProc.destroy();
      if (_chartRev)  _chartRev.destroy();
      if (_chartCum)  _chartCum.destroy();

      const labels = [];
      const t = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(t.getFullYear(), t.getMonth() - i, 1);
        labels.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
      }

      const procByM = {}, revByM = {};
      labels.forEach(m => { procByM[m] = 0; revByM[m] = 0; });
      _dailies().forEach(d => {
        const m = _ym(d.date); if (procByM[m] !== undefined) procByM[m] += parseNumber(d.proc);
      });
      _invoices().forEach(i => {
        const m = _ym(i.date); if (revByM[m] !== undefined) revByM[m] += parseNumber(i.total || i.amount);
      });

      const muted = '#3B5571';
      const lineOpts = {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10, family: 'DM Mono' }, color: '#A8A49E' } },
          y: { grid: { color: '#F0F0F0' }, ticks: { font: { size: 10, family: 'DM Mono' }, color: '#A8A49E' } }
        }
      };

      const ctxProc = document.getElementById('bh-c-proc');
      if (ctxProc) _chartProc = new Chart(ctxProc, {
        type: 'bar',
        data: {
          labels: labels.map(m => m.slice(2)),
          datasets: [{ data: labels.map(m => procByM[m]), backgroundColor: muted + 'CC', borderRadius: 2 }]
        },
        options: lineOpts
      });

      const ctxRev = document.getElementById('bh-c-rev');
      if (ctxRev) _chartRev = new Chart(ctxRev, {
        type: 'bar',
        data: {
          labels: labels.map(m => m.slice(2)),
          datasets: [{ data: labels.map(m => revByM[m]), backgroundColor: muted + '88', borderRadius: 2 }]
        },
        options: {
          ...lineOpts,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: c => '$' + formatNumber(Math.round(c.raw)) } }
          },
          scales: {
            ...lineOpts.scales,
            y: { ...lineOpts.scales.y, ticks: { ...lineOpts.scales.y.ticks,
              callback: v => v >= 1000 ? (v/1000).toFixed(0) + 'K' : v
            } }
          }
        }
      });

      // 누적 진척률 라인 — 현재 연도 계획 vs 실적
      const cumLabels = [];
      const cumPlanArr = [];
      const cumActArr  = [];
      let cp = 0, ca = 0;
      for (let m = 1; m <= 12; m++) {
        cumLabels.push(m + '월');
        cp += Pages.KpiTarget.getMonthlyTarget(s.year, _biz, m, KPI_MODE) || 0;
        if (m <= s.curMon) ca += _ebitKrw(_revenueUsd(s.year, m));
        const planPct = s.kpiTgtKrw > 0 ? (cp / s.kpiTgtKrw) * 100 : 0;
        const actPct  = s.kpiTgtKrw > 0 && m <= s.curMon ? (ca / s.kpiTgtKrw) * 100 : null;
        cumPlanArr.push(planPct);
        cumActArr.push(actPct);
      }
      const ctxCum = document.getElementById('bh-c-cum');
      if (ctxCum) _chartCum = new Chart(ctxCum, {
        type: 'line',
        data: {
          labels: cumLabels,
          datasets: [
            { label: '계획 누적', data: cumPlanArr, borderColor: '#A8A49E', borderDash: [4,3], borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0 },
            { label: '실적 누적', data: cumActArr,  borderColor: '#1B4F8A', borderWidth: 2,    pointRadius: cumActArr.map(v => v !== null ? 3 : 0), pointBackgroundColor:'#1B4F8A', fill: false, tension: 0 },
          ]
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12, color: '#6B6762' } },
            tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw === null ? '—' : c.raw.toFixed(1) + '%'}` } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#A8A49E' } },
            y: { grid: { color: '#F0F0F0' }, ticks: { font: { size: 10, family: 'DM Mono' }, color: '#A8A49E', callback: v => v + '%' } }
          }
        }
      });
    }, 30);

    return `
    <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:10px;margin-bottom:18px">
      <div style="background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:14px 16px">
        <div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:2px">KPI 누적 진척률 추이</div>
        <div style="font-size:11px;color:var(--tx3);margin-bottom:10px">${s.year}년 계획 vs 실적 (연간 ${KPI_LABEL} 대비 %)</div>
        <div style="position:relative;height:160px"><canvas id="bh-c-cum"></canvas></div>
      </div>
      <div style="background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:14px 16px">
        <div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:2px">월별 처리량</div>
        <div style="font-size:11px;color:var(--tx3);margin-bottom:10px">최근 12개월</div>
        <div style="position:relative;height:160px"><canvas id="bh-c-proc"></canvas></div>
      </div>
      <div style="background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:14px 16px">
        <div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:2px">월별 매출 USD</div>
        <div style="font-size:11px;color:var(--tx3);margin-bottom:10px">청구 인보이스 기준</div>
        <div style="position:relative;height:160px"><canvas id="bh-c-rev"></canvas></div>
      </div>
    </div>`;
  }

  // ── 5. 이벤트 타임라인 ────────────────────────────────────
  function _buildEvents() {
    const events = [];
    const lots     = _lots();
    const dailies  = Store.getDailies();
    const invoices = _invoices();
    const ships    = _shipments();

    lots.forEach(l => {
      if (!l.inDate) return;
      events.push({
        date:  l.inDate, type: 'in',
        title: `${l.lotNo || l.id} 입고`,
        sub:   `${l.customerName || '고객사 미지정'} · ${formatNumber(parseNumber(l.qty))}${l.unit || '개'}` +
               (l.country ? ` · ${CONFIG.COUNTRY_LABELS[l.country] || l.country}` : ''),
      });
      if (l.actualDone) {
        const cum = getLotCumulative(l.id, dailies);
        const leadDays = l.inDate ? diffDays(l.inDate, l.actualDone) : null;
        events.push({
          date:  l.actualDone, type: 'done',
          title: `${l.lotNo || l.id} 완료`,
          sub:   `처리 ${formatNumber(cum)}${leadDays !== null ? ` · 리드타임 ${leadDays}일` : ''}`,
        });
      }
    });

    invoices.forEach(i => {
      if (!i.date) return;
      const amt = parseNumber(i.total || i.amount);
      const lbl = i.no || ('INV#' + i.id);
      events.push({
        date: i.date, type: 'inv',
        title: `${lbl} 청구`,
        sub:   `${i.currency || ''} ${formatNumber(Math.round(amt))}` +
               (i.customerName ? ` · ${i.customerName}` : ''),
      });
      if (i.paidDate) {
        events.push({
          date: i.paidDate, type: 'paid',
          title: `${lbl} 수금`,
          sub:   `${i.currency || ''} ${formatNumber(Math.round(parseNumber(i.paidAmt || i.total || i.amount)))}`,
        });
      }
    });

    ships
      .filter(s => s.expectedDate && s.expectedDate >= today())
      .forEach(s => events.push({
        date: s.expectedDate, type: 'ship',
        title: `${s.lotNo || ''} 입고 예정`,
        sub:   `${s.customerName || ''} · ${formatNumber(parseNumber(s.qty))}${s.unit || '개'}`,
        future: true,
      }));

    events.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return events;
  }

  function _renderTimeline() {
    const events = _buildEvents();
    if (events.length === 0) {
      return `<div style="background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:36px 20px;text-align:center;color:var(--tx3);font-size:13px">
        ${CONFIG.BIZ_LABELS[_biz]} 사업 이벤트가 아직 없습니다
      </div>`;
    }

    const byMonth = {};
    events.forEach(e => { (byMonth[_ym(e.date)] ||= []).push(e); });
    const months = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));
    const now    = today();

    const monthsHtml = months.map(m => {
      const eventsHtml = byMonth[m].map((e, idx, arr) => {
        const st     = EVT_STYLE[e.type];
        const isLast = idx === arr.length - 1;
        const future = e.future || e.date > now;
        return `<div style="position:relative;padding-left:34px;padding-bottom:${isLast?'0':'12px'}">
          ${isLast ? '' : '<div style="position:absolute;left:11px;top:18px;bottom:0;width:1px;background:var(--bd)"></div>'}
          <div style="position:absolute;left:5px;top:5px;width:13px;height:13px;border-radius:50%;background:${st.bg};border:2px solid ${st.color};${future?'opacity:.55':''}"></div>
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:2px">
            <span style="font-family:var(--font-mono);font-size:11px;color:var(--tx3);min-width:54px">${e.date.slice(5)}</span>
            <span style="display:inline-flex;align-items:center;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:600;color:${st.color};background:${st.bg};border:1px solid ${st.color}33">${st.label}</span>
            <span style="font-size:13px;font-weight:500;color:var(--tx);${future?'opacity:.65':''}">${e.title}</span>
          </div>
          <div style="font-size:12px;color:var(--tx2);padding-left:62px">${e.sub || ''}</div>
        </div>`;
      }).join('');
      const [yyyy, mm] = m.split('-');
      return `<div style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="font-size:12px;font-weight:600;color:var(--tx2)">${yyyy}년 ${parseInt(mm,10)}월</div>
          <div style="flex:1;height:1px;background:var(--bd)"></div>
          <div style="font-size:11px;color:var(--tx3)">${byMonth[m].length}건</div>
        </div>
        ${eventsHtml}
      </div>`;
    }).join('');

    return `<div style="background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:20px 22px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--tx)">이벤트 타임라인</div>
          <div style="font-size:11px;color:var(--tx3);margin-top:2px">입고 · 완료 · 청구 · 수금 활동 로그</div>
        </div>
        <div style="font-size:11px;color:var(--tx3)">총 ${events.length}건 · 최신순</div>
      </div>
      ${monthsHtml}
    </div>`;
  }

  // ── 필터 탭 ──────────────────────────────────────────────
  function _renderTabs() {
    const bizTabs = CONFIG.BIZ_LIST.map(b => {
      const active = b === _biz;
      return `<button onclick="Pages.BizHistory.setBiz('${b}')"
        style="padding:6px 14px;border:1px solid ${active?'var(--tx)':'var(--bd2)'};border-radius:6px;
        background:${active?'var(--tx)':'var(--card)'};color:${active?'#fff':'var(--tx2)'};
        font-size:12px;font-weight:${active?'600':'500'};cursor:pointer;transition:.12s">
        ${CONFIG.BIZ_LABELS[b]}
      </button>`;
    }).join('');

    const coTabs = [['', '전체'], ['HK', '홍콩'], ['SG', '싱가포르']].map(([v, label]) => {
      const active = v === _country;
      return `<button onclick="Pages.BizHistory.setCountry('${v}')"
        style="padding:5px 11px;border:1px solid ${active?'var(--tx2)':'var(--bd2)'};border-radius:6px;
        background:${active?'#F7F7F5':'var(--card)'};color:${active?'var(--tx)':'var(--tx3)'};
        font-size:11px;font-weight:${active?'600':'500'};cursor:pointer">
        ${label}
      </button>`;
    }).join('');

    return `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${bizTabs}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
      <span style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em;margin-right:4px">국가</span>
      ${coTabs}
    </div>`;
  }

  // ── 메인 렌더 ─────────────────────────────────────────────
  function render() {
    const root = document.getElementById('bizhistory-body');
    if (!root) return;
    const s = _computeStats();
    root.innerHTML =
      _renderTabs() +
      _renderHeader(s) +
      _renderSnapshot(s) +
      _renderMonthlyClose(s) +
      _renderCharts(s) +
      _renderTimeline();
  }

  return {
    render,
    setBiz(b)     { _biz = b; render(); },
    setCountry(c) { _country = c; render(); },
  };

})();
