/**
 * pages/biweekly.js
 * Bi-Weekly 리포트 — 월별 처리량/매출액 표
 */

Pages.Biweekly = (() => {

  // 표 그룹 정의 (상단/하단)
  const TOP_BIZ    = ['DRAM', 'SSD', 'MID'];
  const BOTTOM_BIZ = ['SCR', 'RMA'];

  function _getMonthPrefix(year, month) {
    return `${year}-${String(month).padStart(2,'0')}`;
  }

  function _procByBizCo(biz, co, year, month) {
    // 기준: 인보이스 청구일이 해당 월인 LOT의 총 처리량 합산
    // 인보이스 미청구 LOT는 포함하지 않음
    const prefix   = _getMonthPrefix(year, month);
    const lots     = Store.getLots();
    const dailies  = Store.getDailies();
    const invoices = Store.getInvoices();

    // 해당 월에 청구된 인보이스의 lotId 목록
    const invoicedThisMonth = invoices.filter(r =>
      r.biz === biz && r.country === co && String(r.date || '').startsWith(prefix)
    );

    // 각 LOT의 누적 처리량(getLotCumulative) 합산
    return invoicedThisMonth.reduce((sum, inv) => {
      const lot = lots.find(l => String(l.id) === String(inv.lotId));
      if (!lot) return sum;
      return sum + getLotCumulative(lot.id, dailies);
    }, 0);
  }

  function _revByBizCo(biz, co, year, month) {
    const prefix = _getMonthPrefix(year, month);
    return Store.getInvoices()
      .filter(r => r.biz === biz && r.country === co && String(r.date || '').startsWith(prefix))
      .reduce((s, r) => s + parseNumber(r.amount || r.total), 0);
  }

  /** 해당 연도에 (사업, 법인) 조합의 인보이스나 LOT 실적이 하나라도 있는지 */
  function _hasDataByBizCo(biz, co, year) {
    const yr = String(year);
    const hit = r => r.biz === biz && r.country === co;
    return Store.getInvoices().some(r => hit(r) && String(r.date || '').startsWith(yr))
        || Store.getLots().some(l => hit(l) &&
             (String(l.actualDone || '').startsWith(yr) || String(l.targetDate || '').startsWith(yr)));
  }

  function _unbilledByBizCo(biz, co, year, month) {
    // 해당 월에 완료(actualDone||targetDate)된 LOT 중 현시점 기준 인보이스 미청구분의 수량 합
    // 완료 판정: 누적 처리량이 LOT qty 이상 (report.js 청구예정과 동일)
    const prefix   = _getMonthPrefix(year, month);
    const lots     = Store.getLots();
    const dailies  = Store.getDailies();
    const invoices = Store.getInvoices();
    const invoicedIds = new Set(invoices.map(r => String(r.lotId)));

    return lots
      .filter(l => {
        if (l.biz !== biz || l.country !== co) return false;
        if (invoicedIds.has(String(l.id))) return false;
        const qty = parseNumber(l.qty);
        if (qty <= 0) return false;
        const cum = getLotCumulative(l.id, dailies);
        if (cum < qty) return false;
        const doneDate = l.actualDone || l.targetDate || '';
        return doneDate.startsWith(prefix);
      })
      .reduce((s, l) => s + parseNumber(l.qty), 0);
  }

  return {
    render() {
      const el = document.getElementById('biweekly-root'); if (!el) return;

      const now      = new Date();
      const curYear  = now.getFullYear();
      const curMonth = now.getMonth() + 1;

      const MONTHS     = [1,2,3,4,5,6,7,8,9,10,11,12];
      const BIZ        = CONFIG.BIZ_LIST;
      const CO         = CONFIG.COUNTRY_LIST;
      const BIZ_LABELS = CONFIG.BIZ_LABELS;
      const BIZ_COLORS = CONFIG.BIZ_COLORS || {};
      const CO_LABELS  = CONFIG.COUNTRY_LABELS;

      // 실제 BIZ_LIST에 존재하는 사업만 필터링
      const topBiz    = TOP_BIZ.filter(b => BIZ.includes(b));
      const bottomBiz = BOTTOM_BIZ.filter(b => BIZ.includes(b));

      // ── 공통 색상 상수 ──────────────────────────────────────
      // 표 선색: 헤더와 본문 모두 동일하게 #D2D2D7 사용
      const BD   = '#D2D2D7';   // 모든 셀 보더
      const HBG  = '#E8E8ED';   // 헤더 배경
      const HBG2 = '#DCDCE6';   // 현재달 헤더 배경 (약간 더 진하게)
      const HTX  = '#3A3A3C';   // 헤더 텍스트
      const SBG  = '#EFEFF4';   // 합계행 배경
      const STX  = '#1D1D1F';   // 합계행 텍스트
      const BTX  = '#1D1D1F';   // 본문 첫 컬럼
      const VTX  = '#3A3A3C';   // 본문 값 텍스트
      const ETX  = '#C7C7CC';   // 빈값

      // ── 셀 스타일 빌더 (월별 표 — 촘촘) ──────────────────────
      // 헤더 셀 — 모든 방향 보더
      const TH = (t, extra='') =>
        `<th style="padding:4px 10px;text-align:center;font-size:11px;font-weight:600;color:${HTX};background:${HBG};border:1px solid ${BD};white-space:nowrap;line-height:1.2;${extra}">${t}</th>`;

      // 데이터 헤더 (월/지역) — colspan 지원
      const THM = (t, bg=HBG, extra='', colspan=1) =>
        `<th colspan="${colspan}" style="padding:3px 6px;text-align:center;font-size:11px;font-weight:600;color:${HTX};background:${bg};border:1px solid ${BD};white-space:nowrap;line-height:1.2;${extra}">${t}</th>`;

      // 데이터 셀 — 모든 방향 보더
      const TD = (t, bg='#FFFFFF', color=VTX, fw='400', extra='') =>
        `<td style="padding:4px 8px;text-align:right;font-size:12px;font-family:var(--font-mono);font-weight:${fw};color:${color};background:${bg};border:1px solid ${BD};white-space:nowrap;line-height:1.2;${extra}">${t}</td>`;

      // 사업명 셀 (첫 컬럼, 좌측 정렬)
      const TDL = (t, bg=HBG, fw='600', extra='') =>
        `<td style="padding:4px 12px;text-align:left;font-size:12px;font-weight:${fw};color:${BTX};background:${bg};border:1px solid ${BD};white-space:nowrap;line-height:1.2;${extra}">${t}</td>`;

      // ── 1. 월별 표 (피벗: 월=행, 사업=열, 처리량+매출액 합본) ──
      function buildMonthlyTable(bizList, title, showLegend) {
        // 일정한 칸 사이즈
        const W_MONTH = 64;
        const W_DATA  = 116;
        const W_SUB   = 128;
        const W_TOTAL = 148;

        if (bizList.length === 0) return '';

        // 처리량(위) + 매출액·평균단가(중) + 미청구(아래) 3줄 셀
        // proc/unbilled 는 { 단위: 수량 } 맵 — 사업마다 단위가 달라 합계에서 섞이면 안 됨
        const _unitCell = (map, cls) => Object.keys(map).filter(u => map[u])
          .sort((a, b) => (a === CONFIG.DEFAULT_UNIT ? -1 : 1))
          .map(u => formatNumber(map[u]) + `<span style="${cls}"> ${u}</span>`)
          .join(' · ');
        const DC = (proc, rev, unbilled, bg='#FFFFFF', isTotal=false) => {
          const procTotal = Object.keys(proc).reduce((s, u) => s + proc[u], 0);
          const procDisp  = procTotal > 0 ? _unitCell(proc, 'font-size:10px;color:#A1A1A6;font-weight:400') : '—';
          const procColor = procTotal > 0 ? (isTotal ? STX : VTX) : ETX;
          // 평균단가는 단위가 하나일 때만 의미가 있음 (개와 톤이 섞인 합계 셀에서는 생략)
          const pUnit     = soleUnit(proc);
          const avg       = pUnit && rev > 0 ? (rev / proc[pUnit]) : 0;
          const avgDisp   = avg > 0 ? ` <span style="font-size:10.5px;font-weight:400;color:#A1A1A6">($${avg.toFixed(1)}/${pUnit})</span>` : '';
          const revDisp   = rev  > 0 ? '$' + formatNumber(Math.round(rev)) + avgDisp : '—';
          const revColor  = rev  > 0 ? (isTotal ? '#3A3A3C' : '#86868B')   : ETX;
          const fwProc    = isTotal ? '700' : '500';
          const fwRev     = isTotal ? '600' : '400';
          const unbTotal  = Object.keys(unbilled).reduce((s, u) => s + unbilled[u], 0);
          const unbDisp   = unbTotal > 0
            ? `<div style="font-size:10.5px;font-weight:${isTotal?'600':'500'};color:#D70015">미청구 ${_unitCell(unbilled, 'font-size:10px;font-weight:400;color:#E08080')}</div>`
            : '';
          return `<td style="padding:3px 8px;text-align:right;font-family:var(--font-mono);background:${bg};border:1px solid ${BD};white-space:nowrap;line-height:1.25">
            <div style="font-size:12px;font-weight:${fwProc};color:${procColor}">${procDisp}</div>
            <div style="font-size:10.5px;font-weight:${fwRev};color:${revColor}">${revDisp}</div>
            ${unbDisp}
          </td>`;
        };

        // 사업별 취급 법인 (예: 한국은 SCR도 취급)
        // 취급 법인이 아니더라도 실제 실적이 있으면 컬럼을 남긴다 —
        // 잘못 입력된 조합을 조용히 숨겨 소계에서 누락시키지 않기 위함.
        // 월 행마다 반복 호출되므로 사업별로 1회만 계산
        const _coCache = {};
        const coOf = biz => _coCache[biz] || (_coCache[biz] = CO.filter(co =>
          countriesForBiz(biz).includes(co) || _hasDataByBizCo(biz, co, curYear)
        ));

        // 헤더 1행
        const bizHeaders = bizList.map(biz => {
          const color = BIZ_COLORS[biz] || HTX;
          return THM(BIZ_LABELS[biz], HBG,
            `color:${color};border-bottom:2px solid ${color}`, coOf(biz).length + 1);
        }).join('');

        // 헤더 2행
        const subHeaders = bizList.map(biz =>
          coOf(biz).map(co => THM(CO_LABELS[co], HBG)).join('') + THM('소계', SBG, `background:${SBG}`)
        ).join('');

        // 데이터 행 — 월별
        // 컬럼 합계는 사업마다 법인 수가 다르므로 `사업|법인` 키로 누적 (소계는 '|__sub')
        // 처리량·미청구는 { 단위: 수량 } 맵으로 누적 (매출은 USD 단일 통화라 숫자 그대로)
        const colTotalsP = {};
        const colTotalsR = {};
        const colTotalsU = {};
        const addCol = (key, p, r, u) => {
          colTotalsP[key] = unitsMerge(colTotalsP[key] || {}, p);
          colTotalsR[key] = (colTotalsR[key] || 0) + r;
          colTotalsU[key] = unitsMerge(colTotalsU[key] || {}, u);
        };
        let grandP = {}, grandR = 0, grandU = {};

        const dataRows = MONTHS.map(m => {
          const isCur = m === curMonth;
          const rowBg = isCur ? '#EAEAF2' : '#FFFFFF';
          const subBg = isCur ? '#DCDCE6' : SBG;
          let rowTotalP = {}, rowTotalR = 0, rowTotalU = {};

          const cells = bizList.map(biz => {
            let bizSubP = {}, bizSubR = 0, bizSubU = {};
            const coCells = coOf(biz).map(co => {
              const p = unitsAdd({}, biz, _procByBizCo(biz, co, curYear, m));
              const r = _revByBizCo(biz, co, curYear, m);
              const u = unitsAdd({}, biz, _unbilledByBizCo(biz, co, curYear, m));
              unitsMerge(bizSubP, p); bizSubR += r; unitsMerge(bizSubU, u);
              addCol(`${biz}|${co}`, p, r, u);
              return DC(p, r, u, rowBg, false);
            }).join('');
            unitsMerge(rowTotalP, bizSubP); rowTotalR += bizSubR; unitsMerge(rowTotalU, bizSubU);
            addCol(`${biz}|__sub`, bizSubP, bizSubR, bizSubU);
            return coCells + DC(bizSubP, bizSubR, bizSubU, subBg, true);
          }).join('');

          unitsMerge(grandP, rowTotalP); grandR += rowTotalR; unitsMerge(grandU, rowTotalU);

          const monthCellBg = isCur ? HBG2 : HBG;
          const monthCellFw = isCur ? '700' : '600';
          const monthCell = `<td style="padding:3px 10px;text-align:center;font-size:12px;font-weight:${monthCellFw};color:${BTX};background:${monthCellBg};border:1px solid ${BD};white-space:nowrap;line-height:1.2">${m}월</td>`;

          return `<tr>${monthCell}${cells}${DC(rowTotalP, rowTotalR, rowTotalU, isCur ? HBG2 : SBG, true)}</tr>`;
        }).join('');

        // 합계 행 — 사업별 컬럼 합계
        const totalCells = bizList.map(biz => {
          const coTotals = coOf(biz).map(co => {
            const k = `${biz}|${co}`;
            return DC(colTotalsP[k] || {}, colTotalsR[k] || 0, colTotalsU[k] || {}, SBG, true);
          }).join('');
          const sk = `${biz}|__sub`;
          return coTotals + DC(colTotalsP[sk] || {}, colTotalsR[sk] || 0, colTotalsU[sk] || {}, SBG, true);
        }).join('');

        const cols = `
          <col style="width:${W_MONTH}px">
          ${bizList.map(biz =>
            coOf(biz).map(() => `<col style="width:${W_DATA}px">`).join('') +
            `<col style="width:${W_SUB}px">`
          ).join('')}
          <col style="width:${W_TOTAL}px">`;

        const legend = showLegend
          ? `<div style="font-size:12px;color:#86868B">상단: 처리량 (사업별 단위 — Scrap 자재는 톤) · 중단: 매출액 USD (괄호: 평균단가 $/단위) · 하단: <span style="color:#D70015">미청구 수량</span> (완료월 기준 현시점 미청구)</div>`
          : '';
        return `
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px">
            <div style="font-size:14px;font-weight:600;color:#1D1D1F">${title}</div>
            ${legend}
          </div>
          <table class="bw-monthly-table" style="border-collapse:collapse;table-layout:fixed;margin-bottom:24px">
            <colgroup>${cols}</colgroup>
            <thead>
              <tr>${TH('월')}${bizHeaders}${THM('연간합계', SBG, `background:${SBG}`)}</tr>
              <tr>${TH('')}${subHeaders}${THM('', SBG, `background:${SBG}`)}</tr>
            </thead>
            <tbody>${dataRows}</tbody>
            <tfoot>
              <tr>
                <td style="padding:3px 10px;text-align:center;font-size:12px;font-weight:700;color:${BTX};background:${SBG};border:1px solid ${BD};white-space:nowrap;line-height:1.2">합계</td>
                ${totalCells}
                ${DC(grandP, grandR, grandU, SBG, true)}
              </tr>
            </tfoot>
          </table>`;
      }

      // ── 최종 렌더 ────────────────────────────────────────
      el.innerHTML = `
        <div style="width:100%">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div>
              <div style="font-size:16px;font-weight:600;letter-spacing:-.01em;color:#1D1D1F">월별 처리량/매출액</div>
              <div style="font-size:12px;color:#86868B;margin-top:2px">${curYear}년 운영 현황</div>
            </div>
            <div style="font-size:12px;color:#86868B">${curYear}년 ${curMonth}월 기준</div>
          </div>

          <div style="overflow-x:auto;margin-bottom:0">
            ${buildMonthlyTable(topBiz, '월별 처리량 / 매출액 — Test 사업', true)}
          </div>
          <div style="overflow-x:auto;margin-bottom:0">
            ${buildMonthlyTable(bottomBiz, '월별 처리량 / 매출액 — 기타 사업', false)}
          </div>
        </div>`;
    },
  };

})();
