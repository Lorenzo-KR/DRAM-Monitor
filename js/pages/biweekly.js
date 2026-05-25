/**
 * pages/biweekly.js
 * Bi-Weekly 리포트 — 월별 처리량/매출액 표
 */

Pages.Biweekly = (() => {

  // 표 그룹 정의 (상단/하단)
  const TOP_BIZ    = ['DRAM', 'SSD', 'MID'];
  const BOTTOM_BIZ = ['SCR', 'RMA', 'MOD'];

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
      const CO_LABELS  = { HK: '홍콩', SG: '싱가포르' };

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
        const DC = (proc, rev, unbilled, bg='#FFFFFF', isTotal=false) => {
          const procDisp  = proc > 0 ? formatNumber(proc) + '<span style="font-size:10px;color:#A1A1A6;font-weight:400"> 개</span>' : '—';
          const procColor = proc > 0 ? (isTotal ? STX : VTX) : ETX;
          const avg       = proc > 0 && rev > 0 ? (rev / proc) : 0;
          const avgDisp   = avg > 0 ? ` <span style="font-size:10.5px;font-weight:400;color:#A1A1A6">($${avg.toFixed(1)})</span>` : '';
          const revDisp   = rev  > 0 ? '$' + formatNumber(Math.round(rev)) + avgDisp : '—';
          const revColor  = rev  > 0 ? (isTotal ? '#3A3A3C' : '#86868B')   : ETX;
          const fwProc    = isTotal ? '700' : '500';
          const fwRev     = isTotal ? '600' : '400';
          const unbDisp   = unbilled > 0
            ? `<div style="font-size:10.5px;font-weight:${isTotal?'600':'500'};color:#D70015">미청구 ${formatNumber(unbilled)}<span style="font-size:10px;font-weight:400;color:#E08080"> 개</span></div>`
            : '';
          return `<td style="padding:3px 8px;text-align:right;font-family:var(--font-mono);background:${bg};border:1px solid ${BD};white-space:nowrap;line-height:1.25">
            <div style="font-size:12px;font-weight:${fwProc};color:${procColor}">${procDisp}</div>
            <div style="font-size:10.5px;font-weight:${fwRev};color:${revColor}">${revDisp}</div>
            ${unbDisp}
          </td>`;
        };

        // 헤더 1행
        const bizHeaders = bizList.map(biz => {
          const color = BIZ_COLORS[biz] || HTX;
          return THM(BIZ_LABELS[biz], HBG,
            `color:${color};border-bottom:2px solid ${color}`, CO.length + 1);
        }).join('');

        // 헤더 2행
        const subHeaders = bizList.map(() =>
          CO.map(co => THM(CO_LABELS[co], HBG)).join('') + THM('소계', SBG, `background:${SBG}`)
        ).join('');

        // 데이터 행 — 월별
        const N = bizList.length * (CO.length + 1);
        const colTotalsP = Array(N).fill(0);
        const colTotalsR = Array(N).fill(0);
        const colTotalsU = Array(N).fill(0);
        let grandP = 0, grandR = 0, grandU = 0;

        const dataRows = MONTHS.map(m => {
          const isCur = m === curMonth;
          const rowBg = isCur ? '#EAEAF2' : '#FFFFFF';
          const subBg = isCur ? '#DCDCE6' : SBG;
          let rowTotalP = 0, rowTotalR = 0, rowTotalU = 0;

          const cells = bizList.map((biz, bi) => {
            let bizSubP = 0, bizSubR = 0, bizSubU = 0;
            const coCells = CO.map((co, ci) => {
              const p = _procByBizCo(biz, co, curYear, m);
              const r = _revByBizCo(biz, co, curYear, m);
              const u = _unbilledByBizCo(biz, co, curYear, m);
              bizSubP += p; bizSubR += r; bizSubU += u;
              colTotalsP[bi * (CO.length + 1) + ci] += p;
              colTotalsR[bi * (CO.length + 1) + ci] += r;
              colTotalsU[bi * (CO.length + 1) + ci] += u;
              return DC(p, r, u, rowBg, false);
            }).join('');
            rowTotalP += bizSubP; rowTotalR += bizSubR; rowTotalU += bizSubU;
            colTotalsP[bi * (CO.length + 1) + CO.length] += bizSubP;
            colTotalsR[bi * (CO.length + 1) + CO.length] += bizSubR;
            colTotalsU[bi * (CO.length + 1) + CO.length] += bizSubU;
            return coCells + DC(bizSubP, bizSubR, bizSubU, subBg, true);
          }).join('');

          grandP += rowTotalP; grandR += rowTotalR; grandU += rowTotalU;

          const monthCellBg = isCur ? HBG2 : HBG;
          const monthCellFw = isCur ? '700' : '600';
          const monthCell = `<td style="padding:3px 10px;text-align:center;font-size:12px;font-weight:${monthCellFw};color:${BTX};background:${monthCellBg};border:1px solid ${BD};white-space:nowrap;line-height:1.2">${m}월</td>`;

          return `<tr>${monthCell}${cells}${DC(rowTotalP, rowTotalR, rowTotalU, isCur ? HBG2 : SBG, true)}</tr>`;
        }).join('');

        // 합계 행 — 사업별 컬럼 합계
        const totalCells = bizList.map((biz, bi) => {
          const coTotals = CO.map((co, ci) => {
            const p = colTotalsP[bi * (CO.length + 1) + ci];
            const r = colTotalsR[bi * (CO.length + 1) + ci];
            const u = colTotalsU[bi * (CO.length + 1) + ci];
            return DC(p, r, u, SBG, true);
          }).join('');
          const sp = colTotalsP[bi * (CO.length + 1) + CO.length];
          const sr = colTotalsR[bi * (CO.length + 1) + CO.length];
          const su = colTotalsU[bi * (CO.length + 1) + CO.length];
          return coTotals + DC(sp, sr, su, SBG, true);
        }).join('');

        const cols = `
          <col style="width:${W_MONTH}px">
          ${bizList.map(() =>
            CO.map(() => `<col style="width:${W_DATA}px">`).join('') +
            `<col style="width:${W_SUB}px">`
          ).join('')}
          <col style="width:${W_TOTAL}px">`;

        const legend = showLegend
          ? `<div style="font-size:12px;color:#86868B">상단: 처리량(ea) · 중단: 매출액 USD (괄호: 평균단가 $/ea) · 하단: <span style="color:#D70015">미청구 수량</span> (완료월 기준 현시점 미청구)</div>`
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
