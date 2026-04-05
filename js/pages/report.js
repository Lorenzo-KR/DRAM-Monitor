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

  const TH  = (t, align='center', extra='') =>
    `<th style="padding:10px 14px;background:#F0F0F0;border-bottom:2px solid #CCC;border-right:1px solid #DDD;color:#222;font-size:13px;font-weight:700;white-space:nowrap;text-align:center;font-family:'Pretendard',-apple-system,sans-serif;${extra}">${t}</th>`;
  const THSort = (t, col, tableId, align='center') => {
    const s = _sort[tableId] || {};
    const active = s.col === col;
    const arrow = active ? (s.asc ? ' ↑' : ' ↓') : '';
    return `<th onclick="Pages.Report.sortTable('${tableId}','${col}')"
      style="padding:10px 14px;background:#F0F0F0;border-bottom:2px solid #CCC;border-right:1px solid #DDD;color:${active?'#000':'#222'};font-size:13px;font-weight:700;white-space:nowrap;text-align:center;cursor:pointer;user-select:none;font-family:'Pretendard',-apple-system,sans-serif"
      >${t}${arrow}</th>`;
  };
  const TD  = (t, align='left', extra='') =>
    `<td style="padding:9px 14px;border-bottom:1px solid #E8E8E8;border-right:1px solid #E8E8E8;text-align:${align};font-size:13px;color:#333;line-height:1.5;font-family:'Pretendard',-apple-system,sans-serif;${extra}">${t}</td>`;
  const TDM = (t, align='left', extra='') =>
    `<td style="padding:9px 14px;border-bottom:1px solid #E8E8E8;border-right:1px solid #E8E8E8;text-align:${align};font-size:13px;font-family:'DM Mono',monospace;color:#111;line-height:1.5;${extra}">${t}</td>`;
  const TDS = (t, bg='#F0F0F0') =>
    `<td style="padding:9px 14px;border-bottom:1px solid #CCC;border-right:1px solid #DDD;font-size:13px;font-weight:700;color:#111;background:${bg};font-family:'Pretendard',-apple-system,sans-serif">${t}</td>`;

  // ── 섹션 렌더 ───────────────────────────────────────────────
  function _renderCountry(co, coLabel, prefix, lots, dailies, invoices) {

    // 1. 인보이스 청구 완료 — 해당 월에 청구일이 있는 LOT (표시용)
    const invoicedIds = new Set(
      invoices
        .filter(r => r.country === co && String(r.date || '').startsWith(prefix))
        .map(r => String(r.lotId))
    );
    // 청구예정 필터용: 기준월 말일 이하에 청구된 인보이스만 (기준월 이후 청구는 미청구로 처리)
    const monthEnd = prefix + '-31';
    const allInvoicedIds = new Set(
      invoices
        .filter(r => r.country === co && String(r.date || '') <= monthEnd && String(r.date || '') >= '2000-01-01')
        .map(r => String(r.lotId))
    );
    const invoicedLots = lots.filter(l => l.country === co && invoicedIds.has(String(l.id)));

    // 2. 청구 예정 — 완료됐지만 인보이스 미청구인 LOT
    // 기준: 완료일 기준월 말일 이하 AND 진행률 100% (실제 완료된 건만)
    const pendingLots = lots.filter(l => {
      if (l.country !== co) return false;
      if (allInvoicedIds.has(String(l.id))) return false;
      // 진행률 100% 확인 — monthEnd 기준 처리량
      const qty = parseNumber(l.qty);
      if (qty <= 0) return false;
      const cutoffDailies = dailies.filter(d =>
        String(d.lotId) === String(l.id) && (d.date || '') <= monthEnd
      );
      const cum = cutoffDailies.reduce((s, d) => s + parseNumber(d.proc), 0);
      const pct = Math.min(100, Math.round(cum / qty * 100));
      if (pct < 100) return false;
      // 완료일이 기준월 말일 이하인지 확인
      const doneDate = l.actualDone || l.targetDate || '';
      return doneDate >= '2000-01-01' && doneDate <= monthEnd;
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
        const rowBg1 = inv1Sorted.indexOf(l) % 2 === 1 ? 'background:#FAFAFA' : '';
        return `<tr style="${rowBg1}">
          ${TDM(l.lotNo || l.id, 'left', 'font-weight:600')}
          <td style="padding:9px 12px;border-bottom:1px solid #E8E8E8;border-right:1px solid #E8E8E8;text-align:center">${_bizBadge(l.biz)}</td>
          ${TDM(formatNumber(qty), 'right')}
          <td style="padding:9px 12px;border-bottom:1px solid #E8E8E8;border-right:1px solid #E8E8E8;font-size:12px;color:#444;line-height:1.8;font-family:'Pretendard',-apple-system,sans-serif;white-space:nowrap">
            <div>${l.inDate || '—'}</div>
            <div>${l.actualDone || l.targetDate || '—'}</div>
            <div style="color:#1A6B3A;font-weight:500">${l.invDate || '—'}</div>
          </td>
          ${TDM(amt > 0 ? '$' + formatNumber(Math.round(amt)) : '—', 'right', 'font-weight:600;color:#111')}
          ${TDM(avg !== '—' ? '$' + avg : '—', 'right', 'color:#555')}
        </tr>`;
      }).join('');
      const sumRow = `<tr style="background:#F0F0F0">
        ${TDS('합계')}
        <td style="padding:9px 12px;border-bottom:1px solid #CCC;border-right:1px solid #DDD;background:#F0F0F0"></td>
        ${TDS(formatNumber(totalQty))}
        <td style="padding:9px 12px;border-bottom:1px solid #CCC;border-right:1px solid #DDD;background:#F0F0F0"></td>
        ${TDS('$' + formatNumber(Math.round(totalAmt)))}
        <td style="padding:9px 12px;border-bottom:1px solid #CCC;border-right:1px solid #DDD;background:#F0F0F0"></td>
      </tr>`;
      const t1id = co + '-invoiced';
      table1 = `<table style="border-collapse:collapse;width:100%;max-width:900px;font-family:'Pretendard',-apple-system,sans-serif">
        <thead><tr>
          ${THSort('LOT번호','lotNo',t1id)}
          ${TH('사업')}
          ${THSort('수량','qty',t1id,'right')}
          ${TH('입고일 / 완료일 / 청구일')}
          ${THSort('청구금액','amount',t1id,'right')}
          ${THSort('평균단가','avg',t1id,'right')}
        </tr></thead>
        <tbody>${rows1}${sumRow}</tbody>
      </table>`;
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
        const doneDate = l.actualDone || l.targetDate || '';
        const isThisMonth = doneDate.startsWith(prefix);
        const rowBg = isThisMonth ? '#FFFBEE' : '#FFF8F0';
        const doneDateLabel = isThisMonth ? doneDate : `<span style="color:#B45309;font-weight:600">${doneDate}</span>`;
        const rowBg2 = pendingSorted.indexOf(l) % 2 === 1 ? '#FAFAFA' : '#fff';
        return `<tr style="background:${isThisMonth ? rowBg2 : '#FFF8F0'}">
          ${TDM(l.lotNo || l.id, 'left', 'font-weight:600')}
          <td style="padding:9px 12px;border-bottom:1px solid #E8E8E8;border-right:1px solid #E8E8E8;text-align:center">${_bizBadge(l.biz)}</td>
          ${TDM(formatNumber(qty), 'right')}
          <td style="padding:9px 12px;border-bottom:1px solid #E8E8E8;border-right:1px solid #E8E8E8;font-size:12px;color:#444;line-height:1.8;font-family:'Pretendard',-apple-system,sans-serif;white-space:nowrap">
            <div>${l.inDate || '—'}</div>
            <div style="color:${isThisMonth?'#333':'#B45309'};font-weight:${isThisMonth?'400':'600'}">${doneDate}</div>
            <div style="color:#999">—</div>
          </td>
          ${TD(isThisMonth ? '이번 달' : '이월 미청구', 'center', isThisMonth ? 'color:#92400E' : 'color:#B45309;font-weight:600')}
        </tr>`;
      }).join('');
      table2 = `<table style="border-collapse:collapse;width:100%;max-width:900px;font-family:'Pretendard',-apple-system,sans-serif">
        <thead><tr>
          ${THSort('LOT번호','lotNo',t2id)}
          ${TH('사업')}
          ${THSort('수량','qty',t2id,'right')}
          ${TH('입고일 / 완료일 / 청구일')}
          ${TH('구분')}
        </tr></thead>
        <tbody>${rows2}</tbody>
      </table>`;
    }

    // ── 표 3: 작업 진행중 ────────────────────────────────────
    let table3 = '';
    if (inProgLots.length === 0) {
      table3 = `<div style="font-size:12px;color:#C7C7CC;padding:10px 0 4px">해당 없음</div>`;
    } else {
      const rows3 = inProgLots.map(l => {
        const qty = parseNumber(l.qty);
        // 기준월 말일까지의 처리량만 계산 (전월이면 전월 말일 기준)
        const cutoff = monthEnd; // prefix + '-31' (이미 선언됨)
        const filteredDailies = dailies.filter(d =>
          String(d.lotId) === String(l.id) && (d.date || '') <= cutoff
        );
        const cum = filteredDailies.reduce((s, d) => s + parseNumber(d.proc), 0);
        const rem = Math.max(0, qty - cum);
        const pct = qty > 0 ? Math.min(100, Math.round(cum / qty * 100)) : 0;
        const barColor = pct >= 100 ? '#34C759' : pct >= 80 ? '#EF9F27' : '#1D1D1F';
        const rowBg3 = inProgLots.indexOf(l) % 2 === 1 ? '#FAFAFA' : '#fff';
        return `<tr style="background:${rowBg3}">
          ${TDM(l.lotNo || l.id, 'left', 'font-weight:600')}
          <td style="padding:9px 12px;border-bottom:1px solid #E8E8E8;border-right:1px solid #E8E8E8;text-align:center">${_bizBadge(l.biz)}</td>
          ${TDM(formatNumber(qty), 'right')}
          <td style="padding:9px 12px;border-bottom:1px solid #E8E8E8;border-right:1px solid #E8E8E8;font-size:12px;color:#444;line-height:1.8;font-family:'Pretendard',-apple-system,sans-serif;white-space:nowrap">
            <div>${l.inDate || '—'}</div>
            <div style="color:#999">—</div>
            <div style="color:#999">—</div>
          </td>
          ${TDM(formatNumber(cum), 'right')}
          ${TDM(formatNumber(rem), 'right')}
          <td style="padding:9px 12px;border-bottom:1px solid #E8E8E8;border-right:1px solid #E8E8E8;white-space:nowrap">
            <div style="display:flex;align-items:center;gap:5px">
              <div style="width:36px;height:4px;background:#E0E0E0;border-radius:2px;overflow:hidden;flex-shrink:0">
                <div style="width:${pct}%;height:100%;background:${barColor};border-radius:2px"></div>
              </div>
              <span style="font-size:12px;color:${barColor};font-weight:600">${pct}%</span>
            </div>
          </td>
        </tr>`;
      }).join('');
      table3 = `<table style="border-collapse:collapse;width:100%;max-width:900px;font-family:'Pretendard',-apple-system,sans-serif">
        <thead><tr>
          ${TH('LOT번호')}
          ${TH('사업')}
          ${TH('수량','right')}
          ${TH('입고일 / 완료일 / 청구일')}
          ${TH('처리량','right')}
          ${TH('잔여','right')}
          ${TH('진행률','center')}
        </tr></thead>
        <tbody>${rows3}</tbody>
      </table>`;
    }

    return { table1, table2, table3,
      cnt1: invoicedLots.length, cnt2: pendingLots.length, cnt3: inProgLots.length };
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

      // 전월 계산
      const [cy, cm] = prefix.split('-').map(Number);
      const prevMonth = cm === 1
        ? `${cy-1}-12`
        : `${cy}-${String(cm-1).padStart(2,'0')}`;
      const [py, pm] = prevMonth.split('-').map(Number);
      const prevLabel = `${py}년 ${pm}월`;
      const currLabel = `${cy}년 ${cm}월`;

      const hkPrev = _renderCountry('HK', '홍콩 (HK)', prevMonth, lots, dailies, invoices);
      const hkCurr = _renderCountry('HK', '홍콩 (HK)', prefix,    lots, dailies, invoices);
      const sgPrev = _renderCountry('SG', '싱가포르 (SG)', prevMonth, lots, dailies, invoices);
      const sgCurr = _renderCountry('SG', '싱가포르 (SG)', prefix,    lots, dailies, invoices);

      const mhStyle = (isCurr) => `display:inline-block;padding:4px 12px;border-radius:5px;font-size:12px;font-weight:600;margin-bottom:10px;background:${isCurr?'#1D1D1F':'#F1EFE8'};color:${isCurr?'#fff':'#5F5E5A'}`;
      const secTitle = (dot, title, cnt, sub='') => `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;margin-top:4px">
          ${_dot(dot)}
          <span style="font-size:13px;font-weight:600;color:#1D1D1F">${title}</span>
          <span style="font-size:11px;color:#86868B">${cnt}건${sub}</span>
        </div>`;
      const half = 'width:50%;min-width:0;padding:0 12px';
      const divider = '<div style="height:1px;background:#E8E8ED;margin:14px 0"></div>';

      const _section = (prev, curr, tableKey, dot, title, subFn) => `
        <div style="background:#fff;border:1px solid #E0E0E0;border-radius:8px;padding:16px;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px">
            ${_dot(dot)}
            <span style="font-size:14px;font-weight:700;color:#111;font-family:'Pretendard',-apple-system,sans-serif">${title}</span>
          </div>
          <div style="display:flex;align-items:flex-start;gap:0">
            <div style="${half};border-right:1px solid #E0E0E0;padding-right:16px">
              <div style="font-size:11px;color:#888;margin-bottom:8px;font-family:'Pretendard',-apple-system,sans-serif">${subFn?subFn(prev['cnt'+tableKey]):''}${prev['cnt'+tableKey]}건</div>
              ${prev['table'+tableKey]}
            </div>
            <div style="${half};padding-left:16px">
              <div style="font-size:11px;color:#888;margin-bottom:8px;font-family:'Pretendard',-apple-system,sans-serif">${subFn?subFn(curr['cnt'+tableKey]):''}${curr['cnt'+tableKey]}건</div>
              ${curr['table'+tableKey]}
            </div>
          </div>
        </div>`;

      const _country = (coLabel, prev, curr) => `
        <div style="margin-bottom:28px;background:#F7F7F5;border-radius:10px;padding:16px">
          <div style="font-size:15px;font-weight:700;color:#111;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #222;font-family:'Pretendard',-apple-system,sans-serif">${coLabel}</div>
          <!-- 월 헤더 -->
          <div style="display:flex;margin-bottom:12px">
            <div style="${half};border-right:1px solid #E8E8ED">
              <span style="${mhStyle(false)}">${prevLabel} (전월)</span>
            </div>
            <div style="${half}">
              <span style="${mhStyle(true)}">${currLabel} (기준월)</span>
            </div>
          </div>
          ${_section(prev, curr, '1', '#34C759', '인보이스 청구 완료')}
          ${_section(prev, curr, '2', '#F59E0B', '청구 예정', () => ' · 작업 완료, 미청구')}
          ${_section(prev, curr, '3', '#D2D2D7', '작업 진행중')}
        </div>`;

      el.innerHTML = `
        <div style="max-width:1200px;margin:0 auto">
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
          ${_country('홍콩 (HK)', hkPrev, hkCurr)}
          <div style="height:1px;background:#D2D2D7;margin:0 0 28px"></div>
          ${_country('싱가포르 (SG)', sgPrev, sgCurr)}
        </div>`;
    },

    setMonth(val) {
      _month = val;
    },
  };

})();
