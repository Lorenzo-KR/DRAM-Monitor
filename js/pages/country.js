/**
 * pages/country.js
 * 국가별 현황 — HK/SG × 사업별 매트릭스
 */

Pages.Country = (() => {

  function setPeriod(el, period) {
    Store.setCountryPeriod(period);
    document.querySelectorAll('[data-k="co-period"]').forEach(e => e.classList.remove('on'));
    el.classList.add('on');
    render();
  }

  function render() {
    const period   = Store.getCountryPeriod();
    const useMonth = period === 'month';
    const curMonth = new Date().toISOString().slice(0, 7);
    const dailies  = Store.getDailies();
    const invoices = Store.getInvoices();

    const html = CONFIG.COUNTRY_LIST.map(co => {
      const coLots   = Store.getLots().filter(l => l.country === co);
      const totalAct = coLots.filter(l => getLotStatus(l) !== 'done').length;
      const totalDone = coLots.filter(l => getLotStatus(l) === 'done').length;
      const totalRem = coLots.reduce((s, l) => s + getLotRemaining(l, dailies), 0);
      const totalBill = invoices
        .filter(r => r.country === co && (!useMonth || String(r.date || '').startsWith(curMonth)))
        .reduce((s, r) => s + parseNumber(r.amount), 0);

      const bizCards = CONFIG.BIZ_LIST.map(b => {
        const bl   = coLots.filter(l => l.biz === b);
        const actB = bl.filter(l => getLotStatus(l) !== 'done');
        const ovB  = bl.filter(l => getLotStatus(l) === 'overdue');
        const doneB = bl.filter(l => getLotStatus(l) === 'done');
        const remB = bl.reduce((s, l) => s + getLotRemaining(l, dailies), 0);
        const bill = invoices
          .filter(r => r.country === co && r.biz === b && (!useMonth || String(r.date || '').startsWith(curMonth)))
          .reduce((s, r) => s + parseNumber(r.amount), 0);

        if (bl.length === 0 && bill === 0) return `
          <div class="co-biz-card" style="border-top-color:${CONFIG.BIZ_COLORS[b]};opacity:.45">
            <div class="co-biz-head"><span class="co-biz-name" style="color:${CONFIG.BIZ_COLORS[b]}">${CONFIG.BIZ_LABELS[b]}</span><span class="bdg b-neu" style="font-size:12px">없음</span></div>
            <div style="font-size:12px;color:var(--tbl-tx-body);text-align:center;padding:8px 0">LOT 없음</div>
          </div>`;

        const avgPct = actB.length > 0 ? Math.round(actB.reduce((s, l) => s + getLotProgress(l, dailies), 0) / actB.length) : 0;
        return `
          <div class="co-biz-card" style="border-top-color:${CONFIG.BIZ_COLORS[b]}">
            <div class="co-biz-head">
              <span class="co-biz-name" style="color:${CONFIG.BIZ_COLORS[b]}">${CONFIG.BIZ_LABELS[b]}</span>
              ${ovB.length > 0 ? '<span class="bdg b-over">지연</span>' : actB.length > 0 ? '<span class="bdg b-inprog">진행중</span>' : '<span class="bdg b-done">완료</span>'}
            </div>
            <div class="co-row"><span class="co-l">진행 LOT</span><span class="co-v" style="color:${ovB.length > 0 ? '#dc2626' : CONFIG.BIZ_COLORS[b]}">${actB.length}건${ovB.length > 0 ? ` (지연 ${ovB.length})` : ''}</span></div>
            <div class="co-row"><span class="co-l">완료 LOT</span><span class="co-v" style="color:#166534">${doneB.length}건</span></div>
            <div class="co-row"><span class="co-l">잔량</span><span class="co-v" style="color:${remB > 0 ? '#92400e' : 'var(--tx3)'}">${formatNumber(remB)}</span></div>
            <div class="co-row"><span class="co-l">${useMonth ? '이달' : '누적'} 청구</span><span class="co-v" style="color:${CONFIG.BIZ_COLORS[b]}">${formatNumberShort(bill)}</span></div>
            ${actB.length > 0 ? `<div class="pb-w" style="margin-top:6px"><div class="pb" style="width:${avgPct}%;background:${CONFIG.BIZ_COLORS[b]}"></div></div><div style="font-size:12px;color:var(--tbl-tx-body);margin-top:2px">평균 진행률 ${avgPct}%</div>` : ''}
          </div>`;
      }).join('');

      const coColor = CONFIG.COUNTRY_COLORS[co] || 'var(--tx)';
      return `
        <div style="margin-bottom:24px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="font-size:18px;font-weight:600;color:${coColor}">${CONFIG.COUNTRY_LABELS[co] || co}</div>
            <span class="bdg" style="background:${coColor}22;color:${coColor}">진행 ${totalAct}건 · 완료 ${totalDone}건 · 잔량 ${formatNumber(totalRem)} · ${useMonth ? '이달' : '누적'} ${formatNumberShort(totalBill)}</span>
          </div>
          <div class="co-matrix">${bizCards}</div>
        </div>`;
    }).join('');

    const el = document.getElementById('co-content'); if (el) el.innerHTML = html;
  }

  return { render, setPeriod };

})();
