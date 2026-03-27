/**
 * pages/biweekly.js
 * Bi-Weekly 리포트 — 월별 처리량/매출액 표 + 이번달/지난달 현황 요약
 */

Pages.Biweekly = (() => {

  // ── 헬퍼 ───────────────────────────────────────────────────
  function _getMonthPrefix(year, month) {
    return `${year}-${String(month).padStart(2,'0')}`;
  }

  // 사업+지역 기준 해당 월 처리량 (완료된 daily 기준)
  function _procByBizCo(biz, co, year, month) {
    const prefix = _getMonthPrefix(year, month);
    return Store.getDailies()
      .filter(d => d.biz === biz && d.country === co && String(d.date || '').startsWith(prefix))
      .reduce((s, d) => s + parseNumber(d.proc), 0);
  }

  // 사업+지역 기준 해당 월 매출 (인보이스 완료 기준)
  function _revByBizCo(biz, co, year, month) {
    const prefix = _getMonthPrefix(year, month);
    return Store.getInvoices()
      .filter(r => r.biz === biz && r.country === co && String(r.date || '').startsWith(prefix))
      .reduce((s, r) => s + parseNumber(r.amount || r.total), 0);
  }

  // 이번달/지난달 현황 요약 계산
  function _calcStatus(year, month) {
    const invoices = Store.getInvoices();
    const lots     = Store.getLots();
    const dailies  = Store.getDailies();
    const prefix   = _getMonthPrefix(year, month);

    const result = {};
    CONFIG.BIZ_LIST.forEach(biz => {
      CONFIG.COUNTRY_LIST.forEach(co => {
        // 인보이스 완료된 LOT (처리 완료 기준)
        const doneInvs = invoices.filter(r =>
          r.biz === biz && r.country === co && String(r.date || '').startsWith(prefix)
        );
        const doneQty = doneInvs.reduce((s, r) => {
          const lot = lots.find(l => String(l.id) === String(r.lotId));
          return s + parseNumber(lot?.qty || 0);
        }, 0);
        const doneAmt = doneInvs.reduce((s, r) => s + parseNumber(r.amount || r.total), 0);

        // 인보이스 없는 완료 LOT → 진행중
        const inProgLots = lots.filter(l => {
          if (l.biz !== biz || l.country !== co) return false;
          const st  = getLotStatus(l);
          const inv = invoices.find(r => String(r.lotId) === String(l.id));
          return (st === 'done' && !inv) || (st !== 'done' && st !== 'upcoming');
        });
        const inProgQty = inProgLots.reduce((s, l) => {
          const cum = getLotCumulative(l.id, dailies);
          return s + cum;
        }, 0);

        result[`${biz}_${co}`] = { doneQty, doneAmt, inProgQty };
      });
    });
    return result;
  }

  // ── 렌더 ───────────────────────────────────────────────────
  return {
    render() {
      const el = document.getElementById('biweekly-root'); if (!el) return;

      const now      = new Date();
      const curYear  = now.getFullYear();
      const curMonth = now.getMonth() + 1; // 1~12
      const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
      const prevYear  = curMonth === 1 ? curYear - 1 : curYear;

      const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12];
      const BIZ    = CONFIG.BIZ_LIST;   // ['DRAM','SSD','MID']
      const CO     = CONFIG.COUNTRY_LIST; // ['HK','SG']
      const BIZ_LABELS = CONFIG.BIZ_LABELS;
      const CO_LABELS  = { HK: '홍콩', SG: '싱가포르' };

      const TH  = (t, attr='') => `<th style="padding:8px 10px;text-align:center;font-size:12px;font-weight:600;color:var(--tx2);background:var(--bg);border:1px solid var(--bd);white-space:nowrap;${attr}">${t}</th>`;
      const THR = (t, attr='') => `<th style="padding:8px 8px;text-align:center;font-size:12px;font-weight:600;color:var(--tx2);background:var(--bg);border:1px solid var(--bd);white-space:nowrap;width:62px;${attr}">${t}</th>`;
      const TD  = (t, attr='') => `<td style="padding:7px 8px;text-align:right;font-size:13px;font-family:var(--font-mono);border:1px solid var(--bd);width:62px;color:var(--tx);${attr}">${t}</td>`;
      const TDL = (t, attr='') => `<td style="padding:7px 10px;text-align:left;font-size:13px;font-weight:600;color:var(--tx);border:1px solid var(--bd);white-space:nowrap;${attr}">${t}</td>`;

      // ── 1. 월별 표 ───────────────────────────────────────
      function buildMonthlyTable(type) {
        const monthHeaders = MONTHS.map(m =>
          `<th colspan="${CO.length}" style="padding:7px 8px;text-align:center;font-size:12px;font-weight:600;color:${m===curMonth?'var(--tx)':'var(--tx2)'};background:${m===curMonth?'#EEECEA':'var(--bg)'};border:1px solid var(--bd);font-weight:${m===curMonth?'700':'600'}">${m}월</th>`
        ).join('') + `<th style="padding:7px 8px;text-align:center;font-size:12px;font-weight:600;color:var(--tx3);background:var(--bg);border:0.5px solid #2563a8">연간합계</th>`;

        const coHeaders = MONTHS.map(m =>
          CO.map(co => THR(CO_LABELS[co], m===curMonth?'background:#F5F4F1;':'')).join('')
        ).join('') + THR('합계', 'width:80px');

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
              const display = val > 0
                ? (type === 'proc' ? formatNumber(val) : '$' + formatNumber(Math.round(val)))
                : '—';
              return TD(display, `color:${val>0?'var(--tx)':'var(--tx3)'};${m===curMonth?'background:#F5F4F1;':''}`);
            }).join('')
          ).join('');
          const rowTotalDisplay = rowTotal > 0
            ? (type === 'proc' ? formatNumber(rowTotal) : '$' + formatNumber(Math.round(rowTotal)))
            : '—';
          return `<tr>${TDL(BIZ_LABELS[biz])}${cells}${TD(rowTotalDisplay, 'font-weight:600;background:#F9F8F5;color:var(--tx);width:80px')}</tr>`;
        }).join('');

        // 합계 행
        let colGrandTotal = 0;
        const totalCells = MONTHS.map((m, mi) =>
          CO.map((co, ci) => {
            const v = grandTotal[mi * CO.length + ci];
            colGrandTotal += v;
            const display = v > 0
              ? (type === 'proc' ? formatNumber(v) : '$' + formatNumber(Math.round(v)))
              : '—';
            return TD(display, `font-weight:600;color:${v>0?'#085041':'var(--tx3)'};background:var(--bg);${m===curMonth?'background:#EEECEA;':''}`);
          }).join('')
        ).join('');
        const grandTotalDisplay = colGrandTotal > 0
          ? (type === 'proc' ? formatNumber(colGrandTotal) : '$' + formatNumber(Math.round(colGrandTotal)))
          : '—';

        const unit  = type === 'proc' ? '(ea)' : '(USD)';
        const title = type === 'proc' ? '월별 처리량' : '월별 매출액';
        const basis = `<span style="font-size:11px;color:var(--tx3);margin-left:8px">인보이스 발행 완료 기준</span>`;

        return `
          <div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:8px">${title} <span style="font-size:12px;font-weight:400;color:var(--tx3)">${unit}</span>${basis}</div>
          <div style="overflow-x:auto;margin-bottom:20px;width:100%">
            <table style="border-collapse:collapse;width:100%;table-layout:fixed">
              <colgroup>
                <col style="width:90px">
                ${MONTHS.map(() => CO.map(() => `<col style="width:62px">`).join('')).join('')}
                <col style="width:80px">
              </colgroup>
              <thead>
                <tr>${TH('사업명')}${monthHeaders}</tr>
                <tr>${TH('')}${coHeaders}</tr>
              </thead>
              <tbody>${dataRows}</tbody>
              <tfoot>
                <tr>${TDL('합계', 'font-weight:600;background:var(--bg)')}${totalCells}${TD(grandTotalDisplay, 'font-weight:600;background:var(--bg);color:var(--tx);width:80px')}</tr>
              </tfoot>
            </table>
          </div>`;
      }

      // ── 2. 이번달/지난달 현황 요약 표 ────────────────────
      function buildStatusTable(year, month, label) {
        const status = _calcStatus(year, month);
        const invoices = Store.getInvoices();

        const rows = BIZ.map(biz => {
          return CO.map(co => {
            const key  = `${biz}_${co}`;
            const s    = status[key] || { doneQty: 0, doneAmt: 0, inProgQty: 0 };
            const avgPrice = s.doneQty > 0 ? (s.doneAmt / s.doneQty).toFixed(1) : '—';
            const coLabel  = CO_LABELS[co];

            // 진행중 비고 — 진행중 LOT의 홍콩/싱가폴 누적 처리량 및 메모
            const inProgLots = Store.getLots().filter(l => {
              if (l.biz !== biz || l.country !== co) return false;
              const st  = getLotStatus(l);
              const inv = invoices.find(r => String(r.lotId) === String(l.id));
              return (st === 'done' && !inv) || (st !== 'done' && st !== 'upcoming');
            });
            const noteQty = inProgLots.reduce((s, l) => s + getLotCumulative(l.id, Store.getDailies()), 0);
            const noteText = noteQty > 0 ? `${coLabel}(${formatNumber(noteQty)}개) 처리 완료<br>인보이스 작성중` : '—';

            if (co === CO[0]) {
              // 첫 지역: rowspan 처리 없이 그냥 biz 표시
              return `<tr>
                ${co === CO[0] ? `<td style="padding:9px 14px;text-align:center;font-size:12px;font-weight:600;border:1px solid var(--bd);background:var(--bg)">${BIZ_LABELS[biz]}</td>` : ''}
                ${TD(s.doneQty > 0 ? formatNumber(s.doneQty) + ' 개' : 'NA')}
                ${TD(s.doneAmt > 0 ? '$' + formatNumber(Math.round(s.doneAmt)) : (noteQty > 0 ? `<span style="color:var(--tx3);font-size:12px">작성중</span>` : 'NA'))}
                ${TD(avgPrice !== '—' ? avgPrice + ' $/개' : '—')}
              </tr>`;
            }
            return '';
          }).filter(Boolean).join('');
        });

        // 더 직관적인 포맷으로 다시 구성
        const BIZ_TD = (t) => `<td style="padding:8px 12px;text-align:center;font-size:13px;font-weight:600;color:var(--tx);border:1px solid var(--bd);background:var(--bg);white-space:nowrap">${t}</td>`;
        const VAL_TD = (t, attr='') => `<td style="padding:8px 12px;text-align:right;font-size:13px;font-family:var(--font-mono);color:var(--tx);border:1px solid var(--bd);width:88px;${attr}">${t}</td>`;
        const NA_TD  = (t) => `<td style="padding:8px 12px;text-align:right;font-size:13px;color:var(--tx4);border:1px solid var(--bd);width:88px">${t}</td>`;
        const S_TH   = (t, w='88px') => `<th style="padding:8px 12px;text-align:center;font-size:12px;font-weight:600;color:var(--tx2);background:var(--bg);border:1px solid var(--bd);white-space:nowrap;width:${w}">${t}</th>`;

        const doneRows = BIZ.map(biz => {
          const sgKey = `${biz}_SG`;
          const hkKey = `${biz}_HK`;
          const sg = status[sgKey] || {};
          const hk = status[hkKey] || {};
          const sgQty  = sg.doneQty || 0;
          const hkQty  = hk.doneQty || 0;
          const sgAmt  = sg.doneAmt || 0;
          const hkAmt  = hk.doneAmt || 0;
          const totAmt = sgAmt + hkAmt;
          const totQty = sgQty + hkQty;
          const avg    = totQty > 0 ? (totAmt / totQty).toFixed(1) + ' $/개' : '—';
          return `<tr>
            ${BIZ_TD(BIZ_LABELS[biz])}
            ${sgQty > 0 ? VAL_TD(formatNumber(sgQty) + ' 개') : NA_TD('NA')}
            ${hkQty > 0 ? VAL_TD(formatNumber(hkQty) + ' 개') : NA_TD(hkQty === 0 ? '0' : 'NA')}
            ${totAmt > 0 ? VAL_TD('$' + formatNumber(Math.round(totAmt)), 'color:var(--tx);font-weight:500') : NA_TD('—')}
            ${avg !== '—' ? VAL_TD(avg) : NA_TD('—')}
          </tr>`;
        }).join('');

        // 진행중 행
        const inProgRows = BIZ.map(biz => {
          const sgKey = `${biz}_SG`;
          const hkKey = `${biz}_HK`;
          const sg = status[sgKey] || {};
          const hk = status[hkKey] || {};
          const sgProg = sg.inProgQty || 0;
          const hkProg = hk.inProgQty || 0;
          return `<tr>
            ${BIZ_TD(BIZ_LABELS[biz])}
            ${sgProg > 0 ? VAL_TD(formatNumber(sgProg) + ' 개') : NA_TD('—')}
            ${hkProg > 0 ? VAL_TD(formatNumber(hkProg) + ' 개') : NA_TD('NA')}
          </tr>`;
        }).join('');

        return `
          <div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:4px">${label}</div>
          <div style="font-size:11px;color:var(--tx3);margin-bottom:10px">인보이스 발행 완료 기준</div>

          <div style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">처리 완료 — Invoice 발행 기준</div>
          <div style="margin-bottom:14px">
            <table style="border-collapse:collapse;table-layout:auto">
              <thead>
                <tr>
                  ${S_TH('구분', '110px')}
                  ${S_TH('싱가포르')}
                  ${S_TH('홍콩')}
                  ${S_TH('Invoice 발행 금액', '130px')}
                  ${S_TH('평균 단가', '90px')}
                </tr>
              </thead>
              <tbody>${doneRows}</tbody>
            </table>
          </div>

          <div style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">현재 진행중</div>
          <div style="margin-bottom:24px">
            <table style="border-collapse:collapse;table-layout:auto">
              <thead>
                <tr>
                  ${S_TH('구분', '110px')}
                  ${S_TH('싱가포르')}
                  ${S_TH('홍콩')}
                </tr>
              </thead>
              <tbody>${inProgRows}</tbody>
            </table>
          </div>`;
      }

      // ── 최종 렌더 ────────────────────────────────────────
      el.innerHTML = `
        <div style="width:100%">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
            <div>
              <div style="font-size:16px;font-weight:600;letter-spacing:-.01em;color:var(--tx)">Bi-Weekly</div>
              <div style="font-size:12px;color:var(--tx3);margin-top:2px">${curYear}년 운영 현황</div>
            </div>
            <div style="font-size:12px;color:var(--tx3)">${curYear}년 ${curMonth}월 기준</div>
          </div>

          ${buildMonthlyTable('proc')}
          ${buildMonthlyTable('rev')}

          <div style="height:1px;background:var(--bd);margin:8px 0 24px"></div>

          <div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start">
            <div style="flex:0 0 auto">
              ${buildStatusTable(prevYear, prevMonth, `${prevYear}년 ${prevMonth}월 현황`)}
            </div>
            <div style="flex:0 0 auto">
              ${buildStatusTable(curYear, curMonth, `${curYear}년 ${curMonth}월 현황`)}
            </div>
          </div>
        </div>`;
    },
  };

})();
