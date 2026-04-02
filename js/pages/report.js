/**
 * pages/report.js
 * 보고서 (테스트용) — 기준월별 국가별 LOT 현황 요약
 */

Pages.Report = (() => {

  let _month = currentMonth(); // YYYY-MM
  // 정렬 상태: { tableId: { col, asc } }
  let _sort = {};

  function _sortData(data, col, asc) {
    return [...data].sort((a, b) => {
      const va = a[col] || ''; const vb = b[col] || '';
      const na = parseFloat(String(va).replace(/[^0-9.-]/g,'')); 
      const nb = parseFloat(String(vb).replace(/[^0-9.-]/g,''));
      let cmp = (!isNaN(na) && !isNaN(nb)) ? na - nb : String(va).localeCompare(String(vb));
      return asc ? cmp : -cmp;
    });
  }

  // ── 헬퍼 ───────────────────────────────────────────────────
  function _bizBadge(biz) {
    return `<span style="border:1px solid #D2D2D7;color:#6E6E73;padding:2px 7px;border-radius:3px;font-size:11px;white-space:nowrap">${CONFIG.BIZ_LABELS[biz] || biz}</span>`;
  }

  function _dot(color) {
    return `<span style="width:7px;height:7px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>`;
  }

  const TH  = (t, align='left', extra='') =>
    `<th style="padding:8px 12px;background:#E8E8ED;border:1px solid #D2D2D7;color:#3A3A3C;font-size:11px;font-weight:600;white-space:nowrap;text-align:${align};${extra}">${t}</th>`;
  // 클릭 정렬 가능한 헤더
  const THSort = (t, col, tableId, align='left') => {
    const s = _sort[tableId] || {};
    const active = s.col === col;
    const arrow = active ? (s.asc ? ' ↑' : ' ↓') : '';
    return `<th onclick="Pages.Report.sortTable('${tableId}','${col}')"
      style="padding:8px 12px;background:#E8E8ED;border:1px solid #D2D2D7;color:${active?'#1D1D1F':'#3A3A3C'};font-size:11px;font-weight:600;white-space:nowrap;text-align:${align};cursor:pointer;user-select:none"
      >${t}${arrow}</th>`;
  };
  const TD  = (t, align='left', extra='') =>
    `<td style="padding:8px 12px;border:1px solid #D2D2D7;text-align:${align};font-size:12px;color:#6E6E73;${extra}">${t}</td>`;
  const TDM = (t, align='left', extra='') =>
    `<td style="padding:8px 12px;border:1px solid #D2D2D7;text-align:${align};font-size:12px;font-family:var(--font-mono);color:#1D1D1F;${extra}">${t}</td>`;
  const TDS = (t, bg='#EFEFF4') =>
    `<td style="padding:8px 12px;border:1px solid #D2D2D7;font-size:12px;font-weight:600;color:#1D1D1F;background:${bg}">${t}</td>`;

  // ── 섹션 렌더 ───────────────────────────────────────────────
  function _renderCountry(co, coLabel, prefix, lots, dailies, invoices) {

    // 1. 인보이스 청구 완료 — 해당 월에 청구일이 있는 LOT (표시용)
    const invoicedIds = new Set(
      invoices
        .filter(r => r.country === co && String(r.date || '').startsWith(prefix))
        .map(r => String(r.lotId))
    );
    // 청구예정 필터용: 월 무관하게 인보이스가 존재하는 LOT ID 전체
    const allInvoicedIds = new Set(
      invoices
        .filter(r => r.country === co)
        .map(r => String(r.lotId))
    );
    const invoicedLots = lots.filter(l => l.country === co && invoicedIds.has(String(l.id)));

    // 2. 청구 예정 — 완료됐지만 인보이스 미청구인 LOT
    // 기준: 작업 완료일이 기준월 내(해당 월 1일~말일)인 건만
    // 각 월은 그 월에 완료된 건만 표시 (이전 달 건은 해당 달에서 표시)
    const pendingLots = lots.filter(l => {
      if (l.country !== co) return false;
      if (allInvoicedIds.has(String(l.id))) return false;
      // 완료 판단: done='1' 이거나 actualDone 날짜가 있는 경우
      const isDone = getLotStatus(l) === 'done' || !!(l.actualDone);
      if (!isDone) return false;
      // 완료일이 기준월 내인 경우만 (YYYY-MM으로 시작)
      const doneDate = l.actualDone || l.targetDate || '';
      return doneDate.startsWith(prefix);
    });

    // 3. 작업 진행중 — 완료 안 된 LOT (입고됐고 아직 진행중)
    const inProgLots = lots.filter(l => {
      if (l.country !== co) return false;
      const st = getLotStatus(l);
      if (st === 'done') return false;
      // 입고일이 기준월 이하인 경우만
      return (l.inDate || '') <= (prefix + '-31') && (l.inDate || '') >= '2000-01-01';
    });

    // ── 표 1: 인보이스 청구 완료 ─────────────────────────────
    let table1 = '';
    if (invoicedLots.length === 0) {
      table1 = `<div style="font-size:12px;color:#C7C7CC;padding:10px 0 4px">해당 없음</div>`;
    } else {
      const t1s = _sort[co + '-invoiced'] || { col: 'invDate', asc: false };
      const inv1Sorted = _sortData(
        invoicedLots.map(l => {
          const inv = invoices.find(r => String(r.lotId) === String(l.id));
          const qty = parseNumber(l.qty);
          const amt = inv ? parseNumber(inv.amount) : 0;
          return { ...l, invDate: inv?.date || '', amount: amt, qty, avg: qty > 0 ? amt/qty : 0 };
        }), t1s.col, t1s.asc
      );
      let totalQty = 0, totalAmt = 0;
      const rows1 = inv1Sorted.map(l => {
        const qty = parseNumber(l.qty);
        const amt = l.amount || 0;
        const avg = qty > 0 && amt > 0 ? (amt / qty).toFixed(1) : '—';
        totalQty += qty; totalAmt += amt;
        return `<tr>
          ${TDM(l.lotNo || l.id, 'left', 'font-weight:500')}
          <td style="padding:8px 12px;border:1px solid #D2D2D7;text-align:center">${_bizBadge(l.biz)}</td>
          ${TDM(formatNumber(qty), 'right')}
          ${TD(l.inDate || '—', 'center')}
          ${TD(l.actualDone || l.targetDate || '—', 'center')}
          ${TD(l.invDate || '—', 'center')}
          ${TDM(amt > 0 ? '$' + formatNumber(Math.round(amt)) : '—', 'right', 'font-weight:600;color:#1D1D1F')}
          ${TDM(avg !== '—' ? '$' + avg : '—', 'right', 'color:#6E6E73')}
        </tr>`;
      }).join('');
      const sumRow = `<tr style="background:#EFEFF4">
        ${TDS('합계', '#EFEFF4')}
        <td style="border:1px solid #D2D2D7;background:#EFEFF4"></td>
        ${TDS(formatNumber(totalQty), '#EFEFF4')}
        <td colspan="3" style="border:1px solid #D2D2D7;background:#EFEFF4"></td>
        ${TDS('$' + formatNumber(Math.round(totalAmt)), '#EFEFF4')}
        <td style="border:1px solid #D2D2D7;background:#EFEFF4"></td>
      </tr>`;
      const t1id = co + '-invoiced';
      table1 = `<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:12px;width:100%">
        <thead><tr>
          ${THSort('LOT번호','lotNo',t1id)}
          ${TH('사업구분','center')}
          ${THSort('수량','qty',t1id,'right')}
          ${THSort('입고일','inDate',t1id,'center')}
          ${THSort('완료일','actualDone',t1id,'center')}
          ${THSort('청구일','invDate',t1id,'center')}
          ${THSort('청구금액','amount',t1id,'right')}
          ${THSort('평균단가','avg',t1id,'right')}
        </tr></thead>
        <tbody>${rows1}${sumRow}</tbody>
      </table></div>`;
    }

    // ── 표 2: 청구 예정 ──────────────────────────────────────
    let table2 = '';
    if (pendingLots.length === 0) {
      table2 = `<div style="font-size:12px;color:#C7C7CC;padding:10px 0 4px">해당 없음</div>`;
    } else {
      const t2id = co + '-pending';
      const t2s  = _sort[t2id] || { col: 'actualDone', asc: true }; // 기본: 완료일 오름차순
      const pendingSorted = _sortData(
        pendingLots.map(l => ({ ...l, actualDone: l.actualDone || l.targetDate || '' })),
        t2s.col, t2s.asc
      );
      const rows2 = pendingSorted.map(l => {
        const qty = parseNumber(l.qty);
        return `<tr style="background:#FFFBEE">
          ${TDM(l.lotNo || l.id, 'left', 'font-weight:500')}
          <td style="padding:8px 12px;border:1px solid #D2D2D7;text-align:center">${_bizBadge(l.biz)}</td>
          ${TDM(formatNumber(qty), 'right')}
          ${TD(l.inDate || '—', 'center')}
          ${TD(l.actualDone || l.targetDate || '—', 'center')}
        </tr>`;
      }).join('');
      table2 = `<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:12px;width:100%">
        <thead><tr>
          ${THSort('LOT번호','lotNo',t2id)}
          ${TH('사업구분','center')}
          ${THSort('qty',  'qty',  t2id,'right')}
          ${THSort('입고일','inDate',t2id,'center')}
          ${THSort('완료일','actualDone',t2id,'center')}
        </tr></thead>
        <tbody>${rows2}</tbody>
      </table></div>`;
    }

    // ── 표 3: 작업 진행중 ────────────────────────────────────
    let table3 = '';
    if (inProgLots.length === 0) {
      table3 = `<div style="font-size:12px;color:#C7C7CC;padding:10px 0 4px">해당 없음</div>`;
    } else {
      const rows3 = inProgLots.map(l => {
        const qty = parseNumber(l.qty);
        const cum = getLotCumulative(l.id, dailies);
        const rem = Math.max(0, qty - cum);
        const pct = qty > 0 ? Math.min(100, Math.round(cum / qty * 100)) : 0;
        const barColor = pct >= 100 ? '#34C759' : pct >= 80 ? '#EF9F27' : '#1D1D1F';
        return `<tr>
          ${TDM(l.lotNo || l.id, 'left', 'font-weight:500')}
          <td style="padding:8px 12px;border:1px solid #D2D2D7;text-align:center">${_bizBadge(l.biz)}</td>
          ${TD(l.inDate || '—', 'center')}
          ${TDM(formatNumber(qty), 'right')}
          ${TDM(formatNumber(cum), 'right')}
          ${TDM(formatNumber(rem), 'right')}
          <td style="padding:8px 12px;border:1px solid #D2D2D7;min-width:140px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;height:5px;background:#E8E8ED;border-radius:3px;overflow:hidden;min-width:70px">
                <div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px"></div>
              </div>
              <span style="font-size:11px;font-weight:500;color:${barColor};white-space:nowrap;min-width:32px;text-align:right">${pct}%</span>
            </div>
          </td>
        </tr>`;
      }).join('');
      table3 = `<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:12px;width:100%">
        <thead><tr>
          ${TH('LOT번호')}
          ${TH('사업구분','center')}
          ${TH('입고일','center')}
          ${TH('전체수량','right')}
          ${TH('처리수량','right')}
          ${TH('잔여수량','right')}
          ${TH('진행률','center','min-width:140px')}
        </tr></thead>
        <tbody>${rows3}</tbody>
      </table></div>`;
    }

    const [y, m] = prefix.split('-');
    const monthLabel = `${y}년 ${parseInt(m)}월`;

    return `
      <div style="margin-bottom:32px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
          <span style="font-size:15px;font-weight:600;color:#1D1D1F">${coLabel}</span>
          <span style="font-size:11px;color:#86868B;padding:2px 8px;border:1px solid #D2D2D7;border-radius:4px">${monthLabel}</span>
        </div>

        <div style="margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
            ${_dot('#34C759')}
            <span style="font-size:13px;font-weight:600;color:#1D1D1F">인보이스 청구 완료</span>
            <span style="font-size:11px;color:#86868B">${invoicedLots.length}건</span>
          </div>
          ${table1}
        </div>

        <div style="margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
            ${_dot('#F59E0B')}
            <span style="font-size:13px;font-weight:600;color:#1D1D1F">청구 예정</span>
            <span style="font-size:11px;color:#86868B">${pendingLots.length}건 · 작업 완료, 인보이스 미청구</span>
          </div>
          ${table2}
        </div>

        <div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
            ${_dot('#D2D2D7')}
            <span style="font-size:13px;font-weight:600;color:#1D1D1F">작업 진행중</span>
            <span style="font-size:11px;color:#86868B">${inProgLots.length}건</span>
          </div>
          ${table3}
        </div>
      </div>`;
  }

  // ── Public ─────────────────────────────────────────────────
  return {
    sortTable(tableId, col) {
      const s = _sort[tableId] || {};
      _sort[tableId] = { col, asc: s.col === col ? !s.asc : true };
      Pages.Report.render();
    },

    render() {
      const el = document.getElementById('report-root'); if (!el) return;

      const lots     = Store.getLots();
      const dailies  = Store.getDailies();
      const invoices = Store.getInvoices();
      const prefix   = _month; // YYYY-MM
      const [y, m]   = prefix.split('-');
      const monthLabel = `${y}년 ${parseInt(m)}월`;

      const hkSection = _renderCountry('HK', '홍콩 (HK)', prefix, lots, dailies, invoices);
      const sgSection = _renderCountry('SG', '싱가포르 (SG)', prefix, lots, dailies, invoices);

      el.innerHTML = `
        <div style="max-width:1200px">
          <!-- 헤더 -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
            <div>
              <div style="font-size:15px;font-weight:600;color:#1D1D1F">보고서</div>
              <div style="font-size:12px;color:#86868B;margin-top:2px">기준월별 국가별 LOT 현황 요약</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:12px;color:#6E6E73">기준월</span>
              <input type="month" id="rpt-month" value="${_month}"
                style="padding:6px 10px;border:1px solid #D2D2D7;border-radius:6px;font-size:12px;color:#1D1D1F;background:#fff;outline:none"
                onchange="Pages.Report.setMonth(this.value)">
              <button onclick="Pages.Report.render()"
                style="padding:6px 14px;background:#1D1D1F;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer">조회</button>
            </div>
          </div>

          <!-- 홍콩 -->
          ${hkSection}

          <div style="height:1px;background:#D2D2D7;margin:0 0 28px"></div>

          <!-- 싱가포르 -->
          ${sgSection}
        </div>`;
    },

    setMonth(val) {
      _month = val;
    },
  };

})();
