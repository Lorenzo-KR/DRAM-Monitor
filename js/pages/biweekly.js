/**
 * pages/biweekly.js
 * Bi-Weekly 리포트 — 월별 처리량/매출액 표 + 이번달/지난달 현황 요약
 */

Pages.Biweekly = (() => {

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

  function _calcStatus(year, month) {
    const invoices = Store.getInvoices();
    const lots     = Store.getLots();
    const dailies  = Store.getDailies();
    const prefix   = _getMonthPrefix(year, month);
    const result   = {};
    CONFIG.BIZ_LIST.forEach(biz => {
      CONFIG.COUNTRY_LIST.forEach(co => {
        const doneInvs = invoices.filter(r =>
          r.biz === biz && r.country === co && String(r.date || '').startsWith(prefix)
        );
        const doneQty = doneInvs.reduce((s, r) => {
          const lot = lots.find(l => String(l.id) === String(r.lotId));
          return s + parseNumber(lot?.qty || 0);
        }, 0);
        const doneAmt = doneInvs.reduce((s, r) => s + parseNumber(r.amount || r.total), 0);
        const inProgLots = lots.filter(l => {
          if (l.biz !== biz || l.country !== co) return false;
          const st  = getLotStatus(l);
          const inv = invoices.find(r => String(r.lotId) === String(l.id));
          return (st === 'done' && !inv) || (st !== 'done' && st !== 'upcoming');
        });
        const inProgQty = inProgLots.reduce((s, l) => s + getLotCumulative(l.id, dailies), 0);
        result[`${biz}_${co}`] = { doneQty, doneAmt, inProgQty };
      });
    });
    return result;
  }

  return {
    render() {
      const el = document.getElementById('biweekly-root'); if (!el) return;

      const now       = new Date();
      const curYear   = now.getFullYear();
      const curMonth  = now.getMonth() + 1;
      const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
      const prevYear  = curMonth === 1 ? curYear - 1 : curYear;

      const MONTHS     = [1,2,3,4,5,6,7,8,9,10,11,12];
      const BIZ        = CONFIG.BIZ_LIST;
      const CO         = CONFIG.COUNTRY_LIST;
      const BIZ_LABELS = CONFIG.BIZ_LABELS;
      const CO_LABELS  = { HK: '홍콩', SG: '싱가포르' };

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

      // ── 셀 스타일 빌더 ──────────────────────────────────────
      // 헤더 셀 — 모든 방향 보더
      const TH = (t, extra='') =>
        `<th style="padding:9px 10px;text-align:center;font-size:11px;font-weight:600;color:${HTX};background:${HBG};border:1px solid ${BD};white-space:nowrap;${extra}">${t}</th>`;

      // 데이터 헤더 (월/지역) — colspan 지원
      const THM = (t, bg=HBG, extra='', colspan=1) =>
        `<th colspan="${colspan}" style="padding:8px 6px;text-align:center;font-size:11px;font-weight:600;color:${HTX};background:${bg};border:1px solid ${BD};white-space:nowrap;${extra}">${t}</th>`;

      // 데이터 셀 — 모든 방향 보더
      const TD = (t, bg='#FFFFFF', color=VTX, fw='400', extra='') =>
        `<td style="padding:9px 8px;text-align:right;font-size:12px;font-family:var(--font-mono);font-weight:${fw};color:${color};background:${bg};border:1px solid ${BD};white-space:nowrap;${extra}">${t}</td>`;

      // 사업명 셀 (첫 컬럼, 좌측 정렬)
      const TDL = (t, bg=HBG, fw='600', extra='') =>
        `<td style="padding:9px 12px;text-align:left;font-size:12px;font-weight:${fw};color:${BTX};background:${bg};border:1px solid ${BD};white-space:nowrap;${extra}">${t}</td>`;

      // ── 1. 월별 표 ───────────────────────────────────────
      function buildMonthlyTable(type) {
        const title = type === 'proc' ? '월별 처리량' : '월별 매출액';
        const unit  = type === 'proc' ? 'ea'          : 'USD';

        // 월 헤더 행 — colspan으로 HK+SG 열 병합
        const monthHeaders = MONTHS.map(m => {
          const isCur = m === curMonth;
          return THM(`${m}월`, isCur ? HBG2 : HBG, `font-weight:${isCur?700:600}`, CO.length);
        }).join('') + THM('연간합계', SBG, `background:${SBG}`);

        // 지역 소헤더 행
        const coHeaders = MONTHS.map(m => {
          const isCur = m === curMonth;
          return CO.map(co => THM(CO_LABELS[co], isCur ? HBG2 : HBG)).join('');
        }).join('') + THM('합계', SBG, `background:${SBG};width:80px`);

        // 데이터 행
        let grandTotal = Array(MONTHS.length * CO.length).fill(0);
        const dataRows = BIZ.map(biz => {
          let rowTotal = 0;
          const cells = MONTHS.map((m, mi) =>
            CO.map((co, ci) => {
              const val = type === 'proc'
                ? _procByBizCo(biz, co, curYear, m)
                : _revByBizCo(biz, co, curYear, m);
              grandTotal[mi * CO.length + ci] += val;
              rowTotal += val;
              const isCur  = m === curMonth;
              const disp   = val > 0 ? (type==='proc' ? formatNumber(val) : '$'+formatNumber(Math.round(val))) : '—';
              const color  = val > 0 ? VTX : ETX;
              return TD(disp, isCur ? '#EAEAF2' : '#FFFFFF', color);
            }).join('')
          ).join('');
          const rowDisp = rowTotal > 0 ? (type==='proc' ? formatNumber(rowTotal) : '$'+formatNumber(Math.round(rowTotal))) : '—';
          return `<tr>${TDL(BIZ_LABELS[biz])}${cells}${TD(rowDisp, SBG, STX, '600')}</tr>`;
        }).join('');

        // 합계 행
        let colTotal = 0;
        const totalCells = MONTHS.map((m, mi) =>
          CO.map((co, ci) => {
            const v = grandTotal[mi * CO.length + ci];
            colTotal += v;
            const isCur = m === curMonth;
            const disp  = v > 0 ? (type==='proc' ? formatNumber(v) : '$'+formatNumber(Math.round(v))) : '—';
            return TD(disp, isCur ? HBG2 : SBG, v>0?STX:ETX, '600');
          }).join('')
        ).join('');
        const colDisp = colTotal > 0 ? (type==='proc' ? formatNumber(colTotal) : '$'+formatNumber(Math.round(colTotal))) : '—';

        return `
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px">
            <div style="font-size:14px;font-weight:600;color:#1D1D1F">${title}</div>
            <div style="font-size:12px;color:#86868B">${unit} · 인보이스 발행 완료 기준</div>
          </div>
          <table class="bw-monthly-table" style="border-collapse:collapse;table-layout:fixed;min-width:100%;margin-bottom:24px">
            <colgroup>
              <col style="width:88px">
              ${MONTHS.map(() => CO.map(() => `<col style="width:60px">`).join('')).join('')}
              <col style="width:78px">
            </colgroup>
            <thead>
              <tr>${TH('사업')}${monthHeaders}</tr>
              <tr>${TH('')}${coHeaders}</tr>
            </thead>
            <tbody>${dataRows}</tbody>
            <tfoot>
              <tr>${TDL('합계', SBG, '600')}${totalCells}${TD(colDisp, SBG, STX, '600')}</tr>
            </tfoot>
          </table>`;
      }

      // ── 2. 이번달/지난달 현황 카드 ───────────────────────
      function buildStatusTable(year, month, label, isPrev) {
        const status   = _calcStatus(year, month);
        const invoices = Store.getInvoices();

        // 셀 스타일 — 모든 방향 보더 통일
        const S_TH  = (t, w='auto') =>
          `<th style="padding:9px 14px;text-align:center;font-size:11px;font-weight:600;color:${HTX};background:${HBG};border:1px solid ${BD};white-space:nowrap;width:${w}">${t}</th>`;
        const S_TD1 = (t) =>   // 사업명 셀
          `<td style="padding:9px 14px;text-align:left;font-size:12px;font-weight:600;color:${BTX};background:${HBG};border:1px solid ${BD};white-space:nowrap;width:100px">${t}</td>`;
        const S_TDV = (t, color=VTX) =>   // 값 셀
          `<td style="padding:9px 14px;text-align:right;font-size:12px;font-family:var(--font-mono);color:${color};background:#FFFFFF;border:1px solid ${BD};white-space:nowrap;width:110px">${t}</td>`;
        const S_TDE = (t) =>   // 빈값 셀
          `<td style="padding:9px 14px;text-align:right;font-size:12px;color:${ETX};background:#FFFFFF;border:1px solid ${BD};white-space:nowrap;width:110px">${t}</td>`;

        // 처리완료 표
        const doneRows = BIZ.map(biz => {
          const sg = status[`${biz}_SG`] || {};
          const hk = status[`${biz}_HK`] || {};
          const sgQty = sg.doneQty || 0;
          const hkQty = hk.doneQty || 0;
          const totAmt = (sg.doneAmt||0) + (hk.doneAmt||0);
          const totQty = sgQty + hkQty;
          const avg = totQty > 0 ? (totAmt/totQty).toFixed(1)+' $/개' : null;
          return `<tr>
            ${S_TD1(BIZ_LABELS[biz])}
            ${sgQty > 0 ? S_TDV(formatNumber(sgQty)+' 개') : S_TDE('—')}
            ${hkQty > 0 ? S_TDV(formatNumber(hkQty)+' 개') : S_TDE('—')}
            ${totAmt > 0 ? S_TDV('$'+formatNumber(Math.round(totAmt)), STX) : S_TDE('—')}
            ${avg ? S_TDV(avg) : S_TDE('—')}
          </tr>`;
        }).join('');

        // 진행중 표
        const inProgRows = BIZ.map(biz => {
          const sg = status[`${biz}_SG`] || {};
          const hk = status[`${biz}_HK`] || {};
          const sgProg = sg.inProgQty || 0;
          const hkProg = hk.inProgQty || 0;
          return `<tr>
            ${S_TD1(BIZ_LABELS[biz])}
            ${sgProg > 0 ? S_TDV(formatNumber(sgProg)+' 개') : S_TDE('—')}
            ${hkProg > 0 ? S_TDV(formatNumber(hkProg)+' 개') : S_TDE('—')}
          </tr>`;
        }).join('');

        return `
          <div style="font-size:14px;font-weight:600;color:#1D1D1F;margin-bottom:2px">${label}</div>
          <div style="font-size:12px;color:#86868B;margin-bottom:14px">인보이스 발행 완료 기준</div>

          <div style="font-size:13px;font-weight:600;color:#3A3A3C;margin-bottom:6px">처리 완료</div>
          <div style="overflow-x:auto;margin-bottom:16px">
            <table style="border-collapse:collapse;table-layout:auto">
              <thead><tr>
                ${S_TH('구분','100px')}
                ${S_TH('싱가포르','110px')}
                ${S_TH('홍콩','110px')}
                ${S_TH('발행금액','110px')}
                ${S_TH('평균단가','110px')}
              </tr></thead>
              <tbody>${doneRows}</tbody>
            </table>
          </div>

          ${!isPrev ? `
          <div style="font-size:13px;font-weight:600;color:#3A3A3C;margin-bottom:6px;margin-top:4px">진행중</div>
          <div style="overflow-x:auto;margin-bottom:8px">
            <table style="border-collapse:collapse;table-layout:auto">
              <thead><tr>
                ${S_TH('구분','100px')}
                ${S_TH('싱가포르','110px')}
                ${S_TH('홍콩','110px')}
              </tr></thead>
              <tbody>${inProgRows}</tbody>
            </table>
          </div>` : '<div style="font-size:11px;color:#C7C7CC;margin-top:8px">※ 진행중 현황은 이번달 카드에서 확인</div>'}`;
      }

      // ── 최종 렌더 ────────────────────────────────────────
      el.innerHTML = `
        <div style="width:100%">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
            <div>
              <div style="font-size:16px;font-weight:600;letter-spacing:-.01em;color:#1D1D1F">Bi-Weekly</div>
              <div style="font-size:12px;color:#86868B;margin-top:2px">${curYear}년 운영 현황</div>
            </div>
            <div style="font-size:12px;color:#86868B">${curYear}년 ${curMonth}월 기준</div>
          </div>

          <div style="overflow-x:auto;margin-bottom:0">
            ${buildMonthlyTable('proc')}
            ${buildMonthlyTable('rev')}
          </div>

          <div style="height:1px;background:#D2D2D7;margin:4px 0 24px"></div>

          <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">
            <div style="background:#FFFFFF;border:1px solid #D2D2D7;border-radius:10px;padding:16px 18px;flex:0 0 auto">
              ${buildStatusTable(prevYear, prevMonth, `${prevYear}년 ${prevMonth}월 현황`, true)}
            </div>
            <div style="background:#FFFFFF;border:1px solid #D2D2D7;border-radius:10px;padding:16px 18px;flex:0 0 auto">
              ${buildStatusTable(curYear, curMonth, `${curYear}년 ${curMonth}월 현황`, false)}
            </div>
          </div>
        </div>`;
    },
  };

})();
