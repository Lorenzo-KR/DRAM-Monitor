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

      const TH = (t, attr='') => `<th style="padding:8px 12px;text-align:center;font-size:13px;font-weight:600;color:var(--tx2);background:var(--bg);border:0.5px solid var(--bd);white-space:nowrap;${attr}">${t}</th>`;
      const TD = (t, attr='') => `<td style="padding:8px 12px;text-align:center;font-size:14px;border:0.5px solid var(--bd);${attr}">${t}</td>`;
      const TDL = (t, attr='') => `<td style="padding:8px 12px;text-align:left;font-size:14px;font-weight:500;border:0.5px solid var(--bd);${attr}">${t}</td>`;

      // ── 1. 월별 처리량 표 ────────────────────────────────
      function buildMonthlyTable(type) {
        // 헤더 — 월별 × 지역
        const monthHeaders = MONTHS.map(m =>
          `<th colspan="${CO.length}" style="padding:8px 12px;text-align:center;font-size:13px;font-weight:600;color:var(--tx2);background:var(--bg);border:0.5px solid var(--bd);${m === curMonth ? 'background:#E6F1FB;color:#0C447C;' : ''}">${m}월</th>`
        ).join('');

        const coHeaders = MONTHS.map(m =>
          CO.map(co => TH(CO_LABELS[co], m === curMonth ? 'background:#EEF4FF;' : '')).join('')
        ).join('');

        // 데이터 행
        let grandTotal = Array(MONTHS.length * CO.length).fill(0);
        const dataRows = BIZ.map(biz => {
          const cells = MONTHS.map((m, mi) =>
            CO.map((co, ci) => {
              const val = type === 'proc'
                ? _procByBizCo(biz, co, curYear, m)
                : _revByBizCo(biz, co, curYear, m);
              grandTotal[mi * CO.length + ci] += val;
              const display = val > 0
                ? (type === 'proc' ? formatNumber(val) : '$' + formatNumber(Math.round(val)))
                : '—';
              const color = val > 0 ? 'color:var(--tx)' : 'color:var(--tx3)';
              return TD(display, `${color};${m === curMonth ? 'background:#F5F9FF;' : ''}`);
            }).join('')
          ).join('');
          return `<tr>${TDL(BIZ_LABELS[biz])}${cells}</tr>`;
        }).join('');

        // 합계 행
        const totalCells = MONTHS.map((m, mi) =>
          CO.map((co, ci) => {
            const v = grandTotal[mi * CO.length + ci];
            const display = v > 0
              ? (type === 'proc' ? formatNumber(v) : '$' + formatNumber(Math.round(v)))
              : '—';
            return TD(display, `font-weight:600;color:${v > 0 ? '#085041' : 'var(--tx3)'};background:var(--bg);${m === curMonth ? 'background:#EEF4FF;' : ''}`);
          }).join('')
        ).join('');

        const unit  = type === 'proc' ? '(ea)' : '(USD)';
        const title = type === 'proc' ? '월별 처리량' : '월별 매출액';

        return `
          <div style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:8px">${title} <span style="font-size:13px;font-weight:400;color:var(--tx3)">${unit}</span></div>
          <div style="overflow-x:auto;margin-bottom:20px">
            <table style="border-collapse:collapse;min-width:max-content">
              <thead>
                <tr>${TH('사업명', 'min-width:110px')}${monthHeaders}</tr>
                <tr>${TH('')}${coHeaders}</tr>
              </thead>
              <tbody>${dataRows}</tbody>
              <tfoot>
                <tr style="background:var(--bg)">${TDL('합계', 'font-weight:600;background:var(--bg)')}${totalCells}</tr>
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
                ${co === CO[0] ? `<td style="padding:9px 14px;text-align:center;font-size:14px;font-weight:600;border:0.5px solid var(--bd);background:var(--bg)">${BIZ_LABELS[biz]}</td>` : ''}
                ${TD(s.doneQty > 0 ? formatNumber(s.doneQty) + ' 개' : 'NA')}
                ${TD(s.doneAmt > 0 ? '$' + formatNumber(Math.round(s.doneAmt)) : (noteQty > 0 ? `<span style="color:#A32D2D;font-size:12px">인보이스<br>작성중</span>` : 'NA'))}
                ${TD(avgPrice !== '—' ? avgPrice + ' $/개' : '—')}
              </tr>`;
            }
            return '';
          }).filter(Boolean).join('');
        });

        // 더 직관적인 포맷으로 다시 구성
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
            <td style="padding:9px 16px;text-align:center;font-size:14px;font-weight:600;border:0.5px solid var(--bd);background:var(--bg)">${BIZ_LABELS[biz]}</td>
            ${TD(sgQty > 0 ? formatNumber(sgQty) + ' 개' : 'NA')}
            ${TD(hkQty > 0 ? formatNumber(hkQty) + ' 개' : (hkQty === 0 ? '0' : 'NA'))}
            ${TD(totAmt > 0 ? '$' + formatNumber(Math.round(totAmt)) : '—', 'color:#085041;font-weight:500')}
            ${TD(avg)}
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

          if (sgProg === 0 && hkProg === 0) {
            return `<tr>
              <td style="padding:9px 16px;text-align:center;font-size:14px;font-weight:600;border:0.5px solid var(--bd);background:var(--bg)">${BIZ_LABELS[biz]}</td>
              ${TD('—')}${TD('NA')}${TD('—', 'color:var(--tx3)')}
            </tr>`;
          }

          const noteHk = hkProg > 0 ? `홍콩(${formatNumber(hkProg)}개) 처리 완료<br><span style="color:#A32D2D">인보이스 작성중</span>` : '—';

          return `<tr>
            <td style="padding:9px 16px;text-align:center;font-size:14px;font-weight:600;border:0.5px solid var(--bd);background:var(--bg)">${BIZ_LABELS[biz]}</td>
            ${TD(sgProg > 0 ? formatNumber(sgProg) + ' 개' : '—')}
            ${TD(hkProg > 0 ? formatNumber(hkProg) + ' 개' : 'NA')}
            ${TD(hkProg > 0 ? noteHk : '—', 'font-size:12px;line-height:1.6')}
          </tr>`;
        }).join('');

        return `
          <div style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:4px">${label}</div>
          <div style="font-size:12px;color:#E24B4A;font-weight:500;margin-bottom:10px">★ 처리 완료 기준: 인보이스 발행 완료 기준</div>

          <div style="font-size:13px;font-weight:600;color:var(--tx2);margin-bottom:6px">■ 처리 완료 (Invoice 발행 기준)</div>
          <div style="overflow-x:auto;margin-bottom:14px">
            <table style="border-collapse:collapse;width:100%">
              <thead>
                <tr>
                  ${TH('구분', 'min-width:120px')}
                  ${TH('싱가포르')}
                  ${TH('홍콩')}
                  ${TH('Invoice 발행 금액')}
                  ${TH('평균 단가')}
                </tr>
              </thead>
              <tbody>${doneRows}</tbody>
            </table>
          </div>

          <div style="font-size:13px;font-weight:600;color:var(--tx2);margin-bottom:6px">■ 현재 진행중</div>
          <div style="overflow-x:auto;margin-bottom:24px">
            <table style="border-collapse:collapse;width:100%">
              <thead>
                <tr>
                  ${TH('구분', 'min-width:120px')}
                  ${TH('싱가포르')}
                  ${TH('홍콩')}
                  ${TH('비고', 'min-width:200px')}
                </tr>
              </thead>
              <tbody>${inProgRows}</tbody>
            </table>
          </div>`;
      }

      // ── 최종 렌더 ────────────────────────────────────────
      el.innerHTML = `
        <div style="max-width:1400px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
            <div>
              <div style="font-size:22px;font-weight:600;letter-spacing:-.02em">Bi-Weekly</div>
              <div style="font-size:14px;color:var(--tx3);margin-top:3px">${curYear}년 운영 현황</div>
            </div>
            <div style="font-size:13px;color:var(--tx3)">${curYear}년 ${curMonth}월 기준</div>
          </div>

          ${buildMonthlyTable('proc')}
          ${buildMonthlyTable('rev')}

          <div style="height:1px;background:var(--bd);margin:8px 0 24px"></div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px">
            <div>
              ${buildStatusTable(curYear, curMonth, `${curYear}년 ${curMonth}월 현황`)}
            </div>
            <div>
              ${buildStatusTable(prevYear, prevMonth, `${prevYear}년 ${prevMonth}월 현황`)}
            </div>
          </div>
        </div>`;
    },
  };

})();
