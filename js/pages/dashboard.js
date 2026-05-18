/**
 * pages/dashboard.js
 * 메인 대시보드 — 컴팩트 표 형식
 */

Pages.Dashboard = (() => {

  const FS = "font-size:12px;font-family:'Pretendard',-apple-system,sans-serif";
  const S = {
    th:  `padding:7px 10px;text-align:center;${FS};font-weight:700;color:#222;background:#F0F0F0;border-bottom:2px solid #CCC;border-right:1px solid #DDD;white-space:nowrap`,
    thr: `padding:7px 10px;text-align:right;${FS};font-weight:700;color:#222;background:#F0F0F0;border-bottom:2px solid #CCC;border-right:1px solid #DDD;white-space:nowrap`,
    td:  `padding:7px 10px;border-bottom:1px solid #E8E8E8;border-right:1px solid #E8E8E8;color:#333;vertical-align:middle;${FS}`,
    tdr: `padding:7px 10px;border-bottom:1px solid #E8E8E8;border-right:1px solid #E8E8E8;color:#333;vertical-align:middle;text-align:right;font-family:'DM Mono',monospace;font-size:12px`,
    tdm: `padding:7px 10px;border-bottom:1px solid #E8E8E8;border-right:1px solid #E8E8E8;color:#333;vertical-align:middle;${FS}`,
  };

  const CO_STYLE = {
    HK: 'border:1px solid #9DC3F0;color:#1B4F8A;background:#EBF2FB',
    SG: 'border:1px solid #8DCFBC;color:#0F6E56;background:#E8F5F0',
  };
  const BIZ_STYLE = {
    DRAM: 'border:1px solid #9DC3F0;color:#1B4F8A;background:#EBF2FB',
    SSD:  'border:1px solid #8DCFBC;color:#0F6E56;background:#E8F5F0',
    MID:  'border:1px solid #C4A8DC;color:#6A3D7C;background:#F3EEF8',
  };
  const ST_STYLE = {
    done:    'border:1px solid var(--bd);color:var(--tx2);background:transparent',
    inprog:  'border:1px solid #34C759;color:#1A7F37;background:#F0FBF3',
    overdue: 'border:1px solid #FECACA;color:#dc2626;background:#FEF2F2',
  };
  const ST_LABEL = { done: '완료', inprog: '진행중', overdue: '지연' };

  function badge(text, style) {
    return `<span style="display:inline-flex;align-items:center;padding:1px 6px;border-radius:3px;white-space:nowrap;${style}">${text}</span>`;
  }

  function _calcKpi() {
    const lots      = Store.getLots();
    const dailies   = Store.getDailies();
    const invoices  = Store.getInvoices();
    const shipments = Store.getShipments();
    const activeLots = lots.filter(l => getLotStatus(l) !== 'done');
    const doneLots   = lots.filter(l => getLotStatus(l) === 'done');
    const totalUnits = lots.reduce((s, l) => s + parseNumber(l.qty), 0);
    const totalProc  = lots.reduce((s, l) => s + getLotCumulative(l.id, dailies), 0);
    const invTotal = invoices.reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
    const useInv   = invTotal > 0;
    function revByBiz(biz) {
      if (useInv) return invoices.filter(r => r.biz === biz).reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
      return doneLots.filter(l => l.biz === biz).reduce((s, l) => s + parseNumber(l.price) * parseNumber(l.qty), 0);
    }
    function revByCo(co) {
      if (useInv) return invoices.filter(r => r.country === co).reduce((s, r) => s + parseNumber(r.total || r.amount), 0);
      return doneLots.filter(l => l.country === co).reduce((s, l) => s + parseNumber(l.price) * parseNumber(l.qty), 0);
    }
    const revenue = {
      total: useInv ? invTotal : doneLots.reduce((s, l) => s + parseNumber(l.price) * parseNumber(l.qty), 0),
      SSD: revByBiz('SSD'), DRAM: revByBiz('DRAM'), MID: revByBiz('MID'),
      HK: revByCo('HK'), SG: revByCo('SG'),
    };
    const overdueLots = activeLots.filter(l => getLotStatus(l) === 'overdue');
    const nearDueLots = activeLots.filter(l =>
      l.targetDate && diffDays(today(), l.targetDate) >= 0 && diffDays(today(), l.targetDate) <= 3
    );
    const upcomingShipments = [...shipments]
      .filter(s => s.expectedDate >= today())
      .sort((a, b) => String(a.expectedDate || '').localeCompare(String(b.expectedDate || '')));
    return { lots, dailies, invoices, activeLots, doneLots, totalUnits, totalProc, revenue, overdueLots, nearDueLots, upcomingShipments };
  }

  function _renderAlerts(overdueLots, nearDueLots) {
    return [
      overdueLots.length > 0 ? `<div style="background:#FEF2F2;color:#dc2626;border-left:2px solid #FECACA;padding:7px 12px;border-radius:var(--rs);font-size:14px;margin-bottom:8px">지연 LOT ${overdueLots.length}건 — ${overdueLots.map(l => l.lotNo || l.id).join(', ')}</div>` : '',
      nearDueLots.length > 0 ? `<div style="background:var(--bg);color:var(--tx2);border-left:2px solid var(--bd2);padding:7px 12px;border-radius:var(--rs);font-size:14px;margin-bottom:8px">완료 기한 3일 이내 LOT ${nearDueLots.length}건</div>` : '',
    ].join('');
  }

  function _renderKpiRow(kpi) {
    const year = new Date().getFullYear();

    function kpiCard(label, value, sub, color, subExtra, fxInput) {
      color = color || ''; subExtra = subExtra || ''; fxInput = fxInput || '';
      return `<div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin-bottom:4px">${label}</div>
        <div style="font-size:22px;font-weight:600;line-height:1;${color ? 'color:' + color : ''}">${value}</div>
        <div style="font-size:12px;color:var(--tx2);margin-top:4px">${sub}</div>
        ${subExtra ? '<div style="font-size:11px;color:var(--tx3);margin-top:2px">' + subExtra + '</div>' : ''}
        ${fxInput ? '<div style="display:flex;align-items:center;gap:5px;margin-top:7px;padding-top:7px;border-top:0.5px solid var(--bd)"><span style="font-size:11px;color:var(--tx3)">환율</span>' + fxInput + '<span style="font-size:11px;color:var(--tx3)">₩/USD</span></div>' : ''}
      </div>`;
    }

    const fxRate = parseFloat(Store.getSetting('usd_krw') || localStorage.getItem('usd_krw') || '1350');
    const revKrw = kpi.revenue.total > 0 ? kpi.revenue.total * fxRate : 0;
    const krwSub = revKrw > 0 ? '≈ ₩' + formatNumber(Math.round(revKrw)) : '';
    const fxInputHtml = '<input type="number" id="fx-rate-input" value="' + fxRate + '" min="1" step="1" style="width:70px;padding:3px 7px;border:1px solid var(--bd2);border-radius:5px;font-size:12px;font-family:var(--font-mono);background:var(--card);color:var(--tx);text-align:right" onkeydown="if(event.key===\'Enter\'){Store.setSetting(\'usd_krw\',this.value);Pages.Dashboard.render();}"><button onclick="Store.setSetting(\'usd_krw\',document.getElementById(\'fx-rate-input\').value);Pages.Dashboard.render();" style="padding:3px 8px;font-size:11px;font-weight:500;border:1px solid var(--bd2);border-radius:5px;background:var(--tx);color:#fff;cursor:pointer;white-space:nowrap;font-family:\'Pretendard\',sans-serif">적용</button>';

    // ── Job Orders: 국가별 진행중 + 완료 숫자 ──────────────────
    const hkActive = kpi.activeLots.filter(function(l){ return l.country === 'HK'; }).length;
    const sgActive = kpi.activeLots.filter(function(l){ return l.country === 'SG'; }).length;
    const joValueHtml = '<div style="display:flex;align-items:baseline;gap:12px">'
      + '<div style="display:flex;align-items:baseline;gap:4px"><span style="font-size:11px;color:var(--tx3);font-weight:500">HK</span><span style="font-size:22px;font-weight:600;line-height:1;color:#1B4F8A">' + hkActive + '</span></div>'
      + '<div style="display:flex;align-items:baseline;gap:4px"><span style="font-size:11px;color:var(--tx3);font-weight:500">SG</span><span style="font-size:22px;font-weight:600;line-height:1;color:#0F6E56">' + sgActive + '</span></div>'
      + '</div>';
    const joCardHtml = '<div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px">'
      + '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin-bottom:4px">Job Orders <span style="font-weight:400;text-transform:none;letter-spacing:0">진행중</span></div>'
      + joValueHtml
      + '<div style="font-size:12px;color:var(--tx2);margin-top:4px">완료 ' + kpi.doneLots.length + '</div>'
      + '</div>';

    // ── KPI 달성률: 103억 기준 + ahead/behind ─────────────────
    const KPI_TARGET_KRW = 10_300_000_000;
    const actKrw = kpi.revenue.total * fxRate;
    const pct    = KPI_TARGET_KRW > 0 ? (actKrw / KPI_TARGET_KRW * 100) : 0;
    // 연간 기준 pace
    const yStart = new Date(year, 0, 1);
    const yEnd   = new Date(year + 1, 0, 1);
    const now    = new Date();
    const daysElapsed = Math.max(1, Math.floor((now - yStart) / 86400000) + 1);
    const totalDays   = Math.round((yEnd - yStart) / 86400000);
    const pacePct     = daysElapsed / totalDays * 100;
    const diffPct     = pct - pacePct;
    const isAhead     = diffPct >= 0;
    const trackColor  = isAhead ? '#1A7F37' : '#dc2626';
    const trackLabel  = isAhead ? 'ahead' : 'behind';
    const pctColor    = pct >= 100 ? '#1A7F37' : isAhead ? 'var(--tx)' : 'var(--tx2)';
    const kpiValueHtml = pct.toFixed(1) + '%';
    const kpiSubHtml   = '목표 ' + (KPI_TARGET_KRW / 100000000).toFixed(0) + '억 · 실적 ' + (actKrw / 100000000).toFixed(2) + '억';
    const kpiExtraHtml = '<span style="color:' + trackColor + ';font-weight:600">' + trackLabel + ' ' + Math.abs(diffPct).toFixed(1) + '%</span>'
      + ' <span style="color:var(--tx3)">(pace ' + pacePct.toFixed(1) + '%)</span>';
    const kpiCardHtml = '<div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px">'
      + '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin-bottom:4px">KPI 달성률</div>'
      + '<div style="font-size:22px;font-weight:600;line-height:1;color:' + pctColor + '">' + kpiValueHtml + '</div>'
      + '<div style="font-size:12px;color:var(--tx2);margin-top:4px">' + kpiSubHtml + '</div>'
      + '<div style="font-size:11px;margin-top:2px">' + kpiExtraHtml + '</div>'
      + '</div>';

    return '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px">'
      + joCardHtml
      + kpiCard('Total Revenue', kpi.revenue.total > 0 ? '$' + formatNumber(Math.round(kpi.revenue.total)) : '—', '완료 기준', 'var(--tx)', krwSub, fxInputHtml)
      + kpiCardHtml
      + '</div>';
  }

  // ── 주간 보고(주단위): 입고 + 인보이스 (결제 LOT 입고시점/LT) ──
  function _calcWeekly(start, end) {
    const lots     = Store.getLots();
    const dailies  = Store.getDailies();
    const invoices = Store.getInvoices();

    const inRange = function(d){ return d && d >= start && d <= end; };

    const periodLots     = lots.filter(function(l){ return inRange(l.inDate); });
    const periodDailies  = dailies.filter(function(d){ return inRange(d.date); });
    const periodInvoices = invoices.filter(function(i){ return inRange(i.date); });

    const totalIn   = periodLots.reduce(function(s, l){ return s + parseNumber(l.qty); }, 0);
    const totalProc = periodDailies.reduce(function(s, d){ return s + parseNumber(d.proc); }, 0);
    const totalRev  = periodInvoices.reduce(function(s, i){ return s + parseNumber(i.total || i.amount); }, 0);

    // 기말 WIP = (입고일 ≤ end의 총 qty) − (date ≤ end의 총 proc)
    const wipQty  = lots.filter(function(l){ return l.inDate && l.inDate <= end; })
                        .reduce(function(s, l){ return s + parseNumber(l.qty); }, 0);
    const wipProc = dailies.filter(function(d){ return d.date && d.date <= end; })
                           .reduce(function(s, d){ return s + parseNumber(d.proc); }, 0);
    const wip     = Math.max(0, wipQty - wipProc);

    // 이번 사이클에 결제(인보이스 발행)된 LOT들의 lead time (입고일 → 인보이스일)
    const ltDays      = [];
    const paidLotIds  = new Set();
    const paidInDates = [];
    periodInvoices.forEach(function(inv){
      const lot = lots.find(function(l){ return String(l.id) === String(inv.lotId); });
      if (lot && lot.inDate && inv.date) {
        ltDays.push(diffDays(lot.inDate, inv.date));
        paidLotIds.add(lot.id);
        paidInDates.push(lot.inDate);
      }
    });
    const avgLT = ltDays.length ? Math.round(ltDays.reduce(function(a, b){ return a + b; }, 0) / ltDays.length) : null;

    // 사업별 breakdown
    const byBiz = {};
    CONFIG.BIZ_LIST.forEach(function(b){ byBiz[b] = { in: 0, proc: 0, rev: 0 }; });
    periodLots.forEach(function(l){ if (byBiz[l.biz]) byBiz[l.biz].in += parseNumber(l.qty); });
    periodDailies.forEach(function(d){ if (byBiz[d.biz]) byBiz[d.biz].proc += parseNumber(d.proc); });
    periodInvoices.forEach(function(i){ if (byBiz[i.biz]) byBiz[i.biz].rev += parseNumber(i.total || i.amount); });

    // 인보이스별 상세 (어떤 LOT, 언제 입고된 건 결제분인지)
    const invDetails = periodInvoices.map(function(inv){
      const lot = lots.find(function(l){ return String(l.id) === String(inv.lotId); });
      const amt = parseNumber(inv.total || inv.amount);
      const lt  = (lot && lot.inDate) ? diffDays(lot.inDate, inv.date) : null;
      return {
        lotNo: lot ? (lot.lotNo || lot.id) : (inv.lotNo || '—'),
        biz:   lot ? lot.biz : inv.biz,
        customer: lot ? lot.customerName : (inv.customerName || ''),
        amt, inDate: lot ? lot.inDate : null, invDate: inv.date, lt
      };
    }).sort(function(a, b){ return b.amt - a.amt; });

    return { totalIn, totalProc, totalRev, wip, avgLT, paidLotCount: paidLotIds.size, paidInDates, byBiz, invDetails };
  }

  function _renderWeeklyRow(start, end, p, isCur, idx) {
    const fmtMD = function(d){ return d.slice(5).replace('-', '/'); };

    // 입고 사업별 (값 있는 것만, 큰 순)
    const inBizItems = CONFIG.BIZ_LIST
      .filter(function(b){ return p.byBiz[b].in > 0; })
      .sort(function(a, b){ return p.byBiz[b].in - p.byBiz[a].in; });
    const inHtml = inBizItems.length
      ? inBizItems.map(function(b){
          const c = CONFIG.BIZ_COLORS[b] || '#666';
          return '<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px;font-size:12px">'
               + '<span style="width:6px;height:6px;border-radius:50%;background:' + c + '"></span>'
               + '<span style="color:var(--tx2)">' + (CONFIG.BIZ_LABELS[b] || b) + '</span>'
               + '<span style="font-family:var(--font-mono);font-weight:600;color:var(--tx)">' + formatNumber(p.byBiz[b].in) + '</span>'
               + '</span>';
        }).join('')
        + '<span style="color:var(--tx3);font-size:11px;margin-left:4px">계 ' + formatNumber(p.totalIn) + '</span>'
      : '<span style="font-size:12px;color:var(--tx3)">입고 없음</span>';

    // 인보이스 상세 (어떤 LOT, 언제 입고된 건)
    let invHtml = '';
    if (p.invDetails.length === 0) {
      invHtml = '<span style="font-size:12px;color:var(--tx3)">인보이스 없음</span>';
    } else {
      // 총액 요약 + 평균 LT
      const summary = '<span style="font-size:13px;font-weight:600;color:#1A6B3A;margin-right:8px">$' + formatNumber(Math.round(p.totalRev)) + '</span>'
                    + '<span style="font-size:11px;color:var(--tx3)">' + p.invDetails.length + '건'
                    + (p.avgLT !== null ? ' · 평균 LT ' + p.avgLT + '일' : '') + '</span>';
      // 인보이스별 한 줄: LOT번호 · $금액 (입고 M/D · LT N일)
      const rows = p.invDetails.map(function(d){
        const ltStr = d.inDate
          ? '<span style="color:var(--tx3)">입고 ' + fmtMD(d.inDate) + (d.lt !== null ? ' · LT ' + d.lt + '일' : '') + '</span>'
          : '<span style="color:var(--tx3)">입고일 미상</span>';
        const bizCol = CONFIG.BIZ_COLORS[d.biz] || '#666';
        return '<div style="display:flex;align-items:center;gap:8px;font-size:11px;padding:3px 0">'
          + '<span style="display:inline-block;width:3px;height:12px;background:' + bizCol + ';border-radius:1px"></span>'
          + '<span style="font-family:var(--font-mono);font-weight:500;color:var(--tx);min-width:80px">' + d.lotNo + '</span>'
          + '<span style="color:var(--tx2);min-width:120px">' + (d.customer || '—') + '</span>'
          + '<span style="font-family:var(--font-mono);font-weight:600;color:#1A6B3A;min-width:80px;text-align:right">$' + formatNumber(Math.round(d.amt)) + '</span>'
          + '<span style="font-family:var(--font-mono);flex:1">' + ltStr + '</span>'
          + '</div>';
      }).join('');
      invHtml = summary
        + '<div style="margin-top:6px;padding-top:6px;border-top:0.5px dashed var(--bd)">' + rows + '</div>';
    }

    const weekTag = isCur ? '<span style="font-size:10px;color:#0C447C;font-weight:600;margin-left:6px;padding:1px 7px;border:1px solid #9DC3F0;border-radius:3px;background:#EBF2FB">이번주</span>'
                          : (idx === 1 ? '<span style="font-size:10px;color:var(--tx3);margin-left:6px">지난주</span>' : '');
    const rowBg  = isCur ? '#FAFCFE' : (idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA');

    return '<div style="display:grid;grid-template-columns:160px 1fr;gap:14px;padding:12px 14px;background:' + rowBg + ';border-bottom:0.5px solid var(--bd)">'
      + '<div>'
      +   '<div style="font-size:13px;font-weight:600;color:var(--tx);font-family:var(--font-mono)">' + fmtMD(start) + ' ~ ' + fmtMD(end) + '</div>'
      +   '<div style="margin-top:4px">' + weekTag + '</div>'
      + '</div>'
      + '<div>'
      +   '<div style="margin-bottom:6px">'
      +     '<span style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-right:8px">입고</span>'
      +     inHtml
      +   '</div>'
      +   '<div>'
      +     '<span style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-right:8px">인보이스</span>'
      +     invHtml
      +   '</div>'
      + '</div>'
      + '</div>';
  }

  function _renderWeeklyTable() {
    const N_WEEKS = 4;
    const t = today();
    const rows = [];
    for (let i = 0; i < N_WEEKS; i++) {
      const end   = addDays(t, -7 * i);
      const start = addDays(end, -6);
      const p     = _calcWeekly(start, end);
      rows.push(_renderWeeklyRow(start, end, p, i === 0, i));
    }

    return '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px">'
      + '<div style="font-size:14px;font-weight:600;color:var(--tx)">주간 보고 — 최근 ' + N_WEEKS + '주</div>'
      + '<div style="font-size:12px;color:var(--tx3)">주차별 사업별 입고 + 인보이스(어떤 LOT의 결제분인지 + lead time)</div>'
      + '</div>'
      + '<div style="background:var(--card);border:0.5px solid var(--bd);border-radius:8px;overflow:hidden;margin-bottom:14px">'
      + rows.join('')
      + '</div>';
  }

  // ── 일별 처리 현황 (지역별, 영업일 14일 mini bar) ──────────
  function _isBusinessDay(d) {
    const dow = d.getDay();
    return dow !== 0 && dow !== 6;
  }
  function _dStr(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function _businessDaysWindow(endStr, n) {
    const result = [];
    const parts = endStr.split('-').map(Number);
    let cur = new Date(parts[0], parts[1]-1, parts[2]);
    while (!_isBusinessDay(cur)) cur.setDate(cur.getDate() - 1);
    while (result.length < n) {
      if (_isBusinessDay(cur)) result.unshift(_dStr(cur));
      cur.setDate(cur.getDate() - 1);
    }
    return result;
  }
  function _bizDaysBetween(fromStr, toStr) {
    if (!fromStr || !toStr || fromStr >= toStr) return 0;
    const a = fromStr.split('-').map(Number);
    const b = toStr.split('-').map(Number);
    let cur = new Date(a[0], a[1]-1, a[2]);
    const end = new Date(b[0], b[1]-1, b[2]);
    cur.setDate(cur.getDate() + 1);
    let count = 0;
    while (cur <= end) {
      if (_isBusinessDay(cur)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  function _renderOpsFollowUp(activeLots, dailies) {
    const inProgressLots = activeLots.filter(function(l){ return l.inDate && l.inDate <= today(); });
    if (!inProgressLots.length) return '';

    const N_DAYS   = 14;
    const todayStr = today();
    const windowD  = _businessDaysWindow(todayStr, N_DAYS);
    // 직전 영업일 = 누락 평가 기준 (오늘은 아직 입력 진행 중이라 누락 아님)
    const tParts = todayStr.split('-').map(Number);
    let _ref = new Date(tParts[0], tParts[1]-1, tParts[2]);
    _ref.setDate(_ref.getDate() - 1);
    while (!_isBusinessDay(_ref)) _ref.setDate(_ref.getDate() - 1);
    const refStr  = _dStr(_ref);

    function procMap(lotId) {
      const m = {};
      dailies.filter(function(d){ return String(d.lotId) === String(lotId) && d.date; })
             .forEach(function(d){ m[d.date] = (m[d.date] || 0) + parseNumber(d.proc); });
      return m;
    }
    function lastEntryDate(lotId) {
      const dates = dailies.filter(function(d){ return String(d.lotId) === String(lotId) && d.date && parseNumber(d.proc) > 0; })
                           .map(function(d){ return d.date; }).sort();
      return dates.length ? dates[dates.length-1] : null;
    }

    function buildLotRow(lot) {
      const pmap     = procMap(lot.id);
      const cum      = getLotCumulative(lot.id, dailies);
      const qty      = parseNumber(lot.qty);
      const pct      = qty > 0 ? Math.round(cum / qty * 100) : 0;
      const last     = lastEntryDate(lot.id);
      // 누락일수: 직전 영업일(refStr) 기준
      const refForMiss = last || lot.inDate || refStr;
      const missDays   = _bizDaysBetween(refForMiss, refStr);
      const bizColor   = CONFIG.BIZ_COLORS[lot.biz] || '#666';

      const vals = windowD.map(function(d){ return pmap[d] || 0; });
      const maxV = Math.max.apply(null, vals.concat([1]));

      const bars = windowD.map(function(d){
        const v       = pmap[d] || 0;
        const isToday = (d === todayStr);
        const isRef   = (d === refStr);
        const dispMD  = d.slice(5).replace('-', '/');
        const tipBase = (isToday ? '오늘 (' + dispMD + ')' : dispMD);
        const tip     = tipBase + (v > 0 ? ' · ' + formatNumber(v) + '개' : (isToday ? ' · 입력 전 (클릭 입력)' : ' · 누락 (클릭 입력)'));
        const tipHtml = '<div class="dash-bar-tip" style="position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);padding:3px 7px;background:#1D1D1F;color:#fff;font-size:11px;border-radius:4px;white-space:nowrap;pointer-events:none;font-family:Pretendard,sans-serif;opacity:0;transition:opacity 0.1s;z-index:10">' + tip + '<div style="position:absolute;top:100%;left:50%;transform:translateX(-50%);border:3px solid transparent;border-top-color:#1D1D1F"></div></div>';
        const wrapBase = 'position:relative;flex:1;min-width:6px;height:32px;display:flex;align-items:flex-end;justify-content:center';
        const hoverJs  = 'onmouseover="this.querySelector(\'.dash-bar-tip\').style.opacity=\'1\'" onmouseout="this.querySelector(\'.dash-bar-tip\').style.opacity=\'0\'"';
        // 비어있는 칸 = 클릭하면 빠른 입력 모달
        const clickJs  = v > 0
          ? ''
          : 'onclick="event.stopPropagation();Pages.Dashboard.openQuickInput(' + lot.id + ',\'' + d + '\')" style="cursor:pointer"';

        if (v > 0) {
          const h = Math.max(8, Math.round(v / maxV * 100));
          const col = isToday ? '#1A7F37' : bizColor;
          return '<div ' + hoverJs + ' style="' + wrapBase + ';cursor:default"><div style="width:100%;height:' + h + '%;background:' + col + ';border-radius:1px"></div>' + tipHtml + '</div>';
        }
        // 누락 셀 — position:absolute로 부모(wrap)를 완전히 채워 풀높이 네모 박스 보장
        let bg = 'transparent', bd = '#D0D0D0';
        if (isToday)      { bg = 'transparent';  bd = '#9CA3AF'; }
        else if (isRef)   { bg = '#FEF2F2';      bd = '#dc2626'; }
        return '<div ' + hoverJs + ' ' + clickJs + ' style="' + wrapBase + ';cursor:pointer">'
          + '<div style="position:absolute;inset:0;background:' + bg + ';border:1px dashed ' + bd + ';border-radius:2px;box-sizing:border-box"></div>'
          + tipHtml + '</div>';
      }).join('');

      let statusBadge;
      if (missDays === 0) {
        statusBadge = '<span style="font-size:10px;color:#1A7F37;font-weight:500;padding:1px 7px;background:#F0FBF3;border:1px solid #34C759;border-radius:3px">정상</span>';
      } else if (missDays === 1) {
        statusBadge = '<span style="font-size:10px;color:#92400E;font-weight:600;padding:1px 7px;background:#FFFBEB;border:1px solid #F59E0B;border-radius:3px">1일 누락</span>';
      } else {
        statusBadge = '<span style="font-size:10px;color:#dc2626;font-weight:600;padding:1px 7px;background:#FEF2F2;border:1px solid #FECACA;border-radius:3px">' + missDays + '일 누락</span>';
      }
      const lastStr = last ? '마지막 ' + last.slice(5) : '<span style="color:#dc2626">입력 없음</span>';

      return '<div onclick="Nav.go(\'daily\')" '
        + 'style="display:grid;grid-template-columns:300px 1fr 130px;gap:12px;align-items:center;padding:8px 12px;border-bottom:0.5px solid var(--bd);cursor:pointer;transition:background 0.1s" '
        + 'onmouseover="this.style.background=\'#FAFAFA\'" onmouseout="this.style.background=\'transparent\'">'
        + '<div>'
        +   '<div style="display:flex;align-items:center;gap:6px;font-size:12px">'
        +     '<span style="font-family:var(--font-mono);font-weight:600">' + (lot.lotNo || lot.id) + '</span>'
        +     badge(lot.biz, BIZ_STYLE[lot.biz] || '')
        +     '<span style="color:var(--tx2)">' + (lot.customerName || '—') + '</span>'
        +   '</div>'
        +   '<div style="font-size:11px;color:var(--tx3);margin-top:3px">'
        +     '입고 ' + ((lot.inDate || '—').slice(5)) + ' · 진행 ' + pct + '% (' + formatNumber(cum) + '/' + formatNumber(qty) + ')'
        +   '</div>'
        + '</div>'
        + '<div style="display:flex;align-items:flex-end;gap:2px;height:32px">' + bars + '</div>'
        + '<div style="text-align:right">'
        +   '<div style="font-size:11px;color:var(--tx3)">' + lastStr + '</div>'
        +   '<div style="margin-top:3px">' + statusBadge + '</div>'
        + '</div>'
        + '</div>';
    }

    function buildRegion(country, lots) {
      const label = country === 'HK' ? '홍콩 (HK)' : '싱가포르 (SG)';
      const color = country === 'HK' ? '#1B4F8A' : '#0F6E56';
      if (!lots.length) {
        return '<div style="background:var(--card);border:0.5px solid var(--bd);border-radius:8px;padding:14px;text-align:center;font-size:12px;color:var(--tx3)">' + label + ' — 진행중 LOT 없음</div>';
      }
      // 누락 많은 LOT 우선, 그다음 입고일 내림차순 (기준: 직전 영업일 refStr)
      const sorted = lots.slice().sort(function(a, b){
        const la = lastEntryDate(a.id), lb = lastEntryDate(b.id);
        const ra = la || a.inDate || refStr;
        const rb = lb || b.inDate || refStr;
        const ma = _bizDaysBetween(ra, refStr);
        const mb = _bizDaysBetween(rb, refStr);
        if (ma !== mb) return mb - ma;
        return String(b.inDate || '').localeCompare(String(a.inDate || ''));
      });

      // 누락 카운트 = 직전 영업일(refStr)에 입력 없는 LOT 수
      const missCount = sorted.filter(function(l){
        const pm = procMap(l.id);
        return !pm[refStr];
      }).length;

      const refMD = refStr.slice(5).replace('-', '/');
      const headerTag = missCount > 0
        ? '<span style="margin-left:10px;font-size:11px;color:#dc2626;font-weight:600">' + refMD + ' 누락 ' + missCount + '건</span>'
        : '<span style="margin-left:10px;font-size:11px;color:#1A7F37;font-weight:500">' + refMD + ' 입력 모두 OK</span>';

      // 영업일 라벨
      const dateLabels = '<div style="display:grid;grid-template-columns:300px 1fr 130px;gap:12px;padding:4px 12px 6px;font-size:9px;color:var(--tx3);font-family:var(--font-mono)">'
        + '<div></div>'
        + '<div style="display:flex;gap:2px">'
        +   windowD.map(function(d, i){
              const isToday = d === todayStr;
              const isRef   = d === refStr;
              const showLabel = i === 0 || isToday || isRef || i === Math.floor(windowD.length / 2);
              let style = 'flex:1;min-width:6px;text-align:center';
              let text  = d.slice(5);
              if (isToday) { style += ';color:#0C447C;font-weight:600'; text = '오늘'; }
              else if (isRef) { style += ';color:#dc2626;font-weight:600'; }
              return '<div style="' + style + '">' + (showLabel ? text : '') + '</div>';
            }).join('')
        + '</div>'
        + '<div></div>'
        + '</div>';

      return '<div style="background:var(--card);border:0.5px solid var(--bd);border-radius:8px;overflow:visible">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg);border-bottom:0.5px solid var(--bd);border-radius:8px 8px 0 0">'
        +   '<div>'
        +     '<span style="font-size:13px;font-weight:600;color:' + color + '">' + label + '</span>'
        +     '<span style="font-size:11px;color:var(--tx3);margin-left:6px">진행중 ' + lots.length + '건</span>'
        +     headerTag
        +   '</div>'
        +   '<span style="font-size:10px;color:var(--tx3)">최근 ' + N_DAYS + '영업일 (주말 제외)</span>'
        + '</div>'
        + dateLabels
        + sorted.map(buildLotRow).join('')
        + '</div>';
    }

    const byCountry = { HK: [], SG: [] };
    inProgressLots.forEach(function(l){ if (byCountry[l.country]) byCountry[l.country].push(l); });

    return '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px">'
      + '<div style="font-size:14px;font-weight:600;color:var(--tx)">일별 처리 현황</div>'
      + '<div style="font-size:12px;color:var(--tx3)">막대 = 일 처리량 · 빨강 박스 = 직전 영업일 누락 · 빈 칸 클릭 = 처리량 빠른 입력 (호버 시 상세)</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">'
      + buildRegion('HK', byCountry.HK)
      + buildRegion('SG', byCountry.SG)
      + '</div>';
  }

  function _renderShipments(shipments) {
    if (!shipments.length) return '';
    const rows = shipments.map(function(s){
      const dd     = s.expectedDate ? diffDays(today(), s.expectedDate) : null;
      const ddText = dd === null ? '—' : dd === 0 ? 'D-Day' : dd < 0 ? 'D+' + Math.abs(dd) : 'D-' + dd;
      const ddColor = dd === null ? 'var(--tx3)' : dd <= 3 ? 'var(--tx3)' : 'var(--tx2)';
      return '<tr>'
        + '<td style="' + S.td + ';font-family:var(--font-mono)">' + (s.lotNo || '—') + '</td>'
        + '<td style="' + S.td + '">' + badge(s.country, CO_STYLE[s.country] || '') + '</td>'
        + '<td style="' + S.td + '">' + badge(s.biz, BIZ_STYLE[s.biz] || '') + '</td>'
        + '<td style="' + S.tdm + '">' + (s.customerName || '—') + '</td>'
        + '<td style="' + S.tdr + '">' + formatNumber(parseNumber(s.qty)) + ' ' + (s.unit || '개') + '</td>'
        + '<td style="' + S.tdm + '">' + (s.expectedDate || '—') + '</td>'
        + '<td style="' + S.td + ';font-weight:500;color:' + ddColor + '">' + ddText + '</td>'
        + '<td style="' + S.td + '">' + badge(s.status === 'confirmed' ? '확정' : '미확정', 'border:1px solid var(--bd);color:var(--tx2);background:transparent') + '</td>'
        + '</tr>';
    }).join('');

    return '<div style="font-size:14px;font-weight:600;color:var(--tx);margin-bottom:8px">입고 예정</div>'
      + '<div style="border:1px solid #E0E0E0;border-radius:6px;overflow:hidden;margin-bottom:12px">'
      + '<table style="width:100%;border-collapse:collapse;font-family:\'Pretendard\',-apple-system,sans-serif">'
      + '<thead><tr>'
      + '<th style="' + S.th + '">LOT 번호</th><th style="' + S.th + '">지역</th><th style="' + S.th + '">사업</th>'
      + '<th style="' + S.th + '">고객사</th><th style="' + S.thr + '">예정수량</th>'
      + '<th style="' + S.th + '">입고예정일</th><th style="' + S.th + '">D-day</th><th style="' + S.th + '">상태</th>'
      + '</tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table></div>';
  }

  // ── 빠른 일별 입력 모달 ───────────────────────────────────
  function _openQuickInput(lotId, dateStr) {
    const lot = Store.getLotById(lotId);
    if (!lot) { UI.toast('LOT를 찾을 수 없습니다', true); return; }

    // 같은 LOT × 같은 날짜에 이미 기록이 있는지 (중복 방지)
    const existing = Store.getDailies().find(function(d){
      return String(d.lotId) === String(lotId) && d.date === dateStr && parseNumber(d.proc) > 0;
    });

    const cum = getLotCumulative(lot.id, Store.getDailies());
    const qty = parseNumber(lot.qty);
    const rem = Math.max(0, qty - cum);

    // dateStr → "5월 15일 (금)" 표시
    const dParts = dateStr.split('-').map(Number);
    const dObj   = new Date(dParts[0], dParts[1]-1, dParts[2]);
    const dowKr  = ['일','월','화','수','목','금','토'][dObj.getDay()];
    const dispDate = (dParts[1]) + '월 ' + dParts[2] + '일 (' + dowKr + ')';

    // 기존 모달이 있으면 제거
    const old = document.getElementById('dash-quick-modal');
    if (old) old.remove();

    const modalHtml = ''
      + '<div id="dash-quick-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:Pretendard,sans-serif" onclick="if(event.target===this)Pages.Dashboard.closeQuickInput()">'
      + '<div style="background:#fff;border-radius:10px;width:360px;max-width:90vw;box-shadow:0 12px 36px rgba(0,0,0,0.2);overflow:hidden">'
      +   '<div style="padding:14px 18px;border-bottom:1px solid #E0E0E0;display:flex;justify-content:space-between;align-items:center">'
      +     '<div>'
      +       '<div style="font-size:14px;font-weight:600;color:#1D1D1F">일별 처리 빠른 입력</div>'
      +       '<div style="font-size:11px;color:#86868B;margin-top:2px">' + (lot.lotNo || lot.id) + ' · ' + (CONFIG.BIZ_LABELS[lot.biz]||lot.biz) + ' · ' + (lot.customerName||'—') + '</div>'
      +     '</div>'
      +     '<button onclick="Pages.Dashboard.closeQuickInput()" style="border:none;background:none;font-size:22px;color:#86868B;cursor:pointer;padding:0 4px;line-height:1">×</button>'
      +   '</div>'
      +   '<div style="padding:16px 18px">'
      +     '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">'
      +       '<div style="font-size:13px;color:#3A3A3C">날짜</div>'
      +       '<div style="font-size:14px;font-weight:600;color:#1D1D1F;font-family:var(--font-mono)">' + dispDate + '</div>'
      +     '</div>'
      +     (existing
          ? '<div style="padding:8px 10px;background:#FFFBEB;border:1px solid #F59E0B;border-radius:4px;font-size:11px;color:#92400E;margin-bottom:10px">이미 ' + formatNumber(parseNumber(existing.proc)) + '개 입력됨. 새 값으로 추가 저장됩니다 (합산이 아닌 별도 기록).</div>'
          : '')
      +     '<div style="display:flex;justify-content:space-between;font-size:11px;color:#86868B;margin-bottom:6px">'
      +       '<span>총 ' + formatNumber(qty) + '개</span>'
      +       '<span>누적 처리 ' + formatNumber(cum) + ' · 잔량 ' + formatNumber(rem) + '</span>'
      +     '</div>'
      +     '<label style="display:block;font-size:12px;color:#3A3A3C;margin-bottom:6px">처리량</label>'
      +     '<div style="display:flex;gap:8px;align-items:center">'
      +       '<input id="dash-quick-proc" type="number" min="0" max="' + Math.max(rem, qty) + '" placeholder="0" style="flex:1;padding:8px 12px;border:1px solid #D2D2D7;border-radius:6px;font-size:15px;font-family:var(--font-mono);text-align:right" autofocus '
      +       'onkeydown="if(event.key===\'Enter\')Pages.Dashboard.saveQuickInput(' + lotId + ',\'' + dateStr + '\');if(event.key===\'Escape\')Pages.Dashboard.closeQuickInput()">'
      +       '<span style="font-size:12px;color:#86868B">개</span>'
      +     '</div>'
      +     '<div id="dash-quick-after" style="font-size:11px;color:#86868B;margin-top:6px;text-align:right">&nbsp;</div>'
      +   '</div>'
      +   '<div style="padding:12px 18px;background:#F7F7F7;display:flex;gap:8px;justify-content:flex-end">'
      +     '<button onclick="Pages.Dashboard.closeQuickInput()" style="padding:7px 14px;border:1px solid #D2D2D7;background:#fff;color:#1D1D1F;font-size:13px;font-weight:500;border-radius:6px;cursor:pointer;font-family:Pretendard,sans-serif">취소</button>'
      +     '<button id="dash-quick-save" onclick="Pages.Dashboard.saveQuickInput(' + lotId + ',\'' + dateStr + '\')" style="padding:7px 14px;border:none;background:#1B4F8A;color:#fff;font-size:13px;font-weight:600;border-radius:6px;cursor:pointer;font-family:Pretendard,sans-serif">저장</button>'
      +   '</div>'
      + '</div>'
      + '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const inp = document.getElementById('dash-quick-proc');
    if (inp) {
      inp.focus();
      inp.addEventListener('input', function(){
        const v = parseNumber(inp.value);
        const newCum = cum + v;
        const newRem = Math.max(0, qty - newCum);
        const after  = document.getElementById('dash-quick-after');
        if (after) after.innerHTML = v > 0 ? '입력 후 잔량 <b style="color:#1D1D1F">' + formatNumber(newRem) + '</b>개' + (newRem === 0 ? ' <span style="color:#1A7F37;font-weight:600">→ LOT 완료</span>' : '') : '&nbsp;';
      });
    }
  }

  function _closeQuickInput() {
    const m = document.getElementById('dash-quick-modal');
    if (m) m.remove();
  }

  async function _saveQuickInput(lotId, dateStr) {
    const lot = Store.getLotById(lotId);
    if (!lot) { UI.toast('LOT를 찾을 수 없습니다', true); return; }
    const inp = document.getElementById('dash-quick-proc');
    if (!inp) return;
    const proc = parseNumber(inp.value);
    if (!proc || proc <= 0) { UI.toast('처리량을 입력해 주세요', true); return; }

    const cumNew = getLotCumulative(lot.id, Store.getDailies()) + proc;
    const remNew = Math.max(0, parseNumber(lot.qty) - cumNew);
    const isDone = remNew === 0;

    const record = {
      id: Date.now(), date: dateStr, lotId: lot.id, lotNo: lot.lotNo || lot.id,
      biz: lot.biz, country: lot.country, customerName: lot.customerName || '',
      proc, normal: 0, noBoot: 0, abnormal: 0, cumul: cumNew, remain: remNew,
      note: '대시보드 빠른 입력', done: isDone ? '1' : '0'
    };

    const saveBtn = document.getElementById('dash-quick-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '저장 중...'; }

    const result = await Api.appendNow(CONFIG.SHEETS.DAILY, record);
    if (!result || !result.success) {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '저장'; }
      UI.toast('저장 실패', true);
      return;
    }

    Store.upsertDaily(record);
    if (isDone) {
      const updated = Object.assign({}, lot, { done: '1', actualDone: dateStr });
      Store.upsertLot(updated);
      Api.update(CONFIG.SHEETS.LOTS, lot.id, updated);
    }
    Api.log('일별처리', '등록(빠른입력)', lot.lotNo || String(lot.id), dateStr + ' 처리 ' + formatNumber(proc) + '개 | 누적 ' + formatNumber(cumNew) + ' / 잔량 ' + formatNumber(remNew));

    UI.toast(isDone ? lot.lotNo + ' 완료!' : '저장됨 (' + dateStr.slice(5) + ' · ' + formatNumber(proc) + '개)');
    _closeQuickInput();
    Pages.Dashboard.render();
  }

  return {
    openQuickInput: _openQuickInput,
    closeQuickInput: _closeQuickInput,
    saveQuickInput: _saveQuickInput,
    render: function() {
      const el = document.getElementById('dash-root');
      if (!el) return;
      const kpi   = _calcKpi();
      const dtStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
      el.innerHTML = '<div style="max-width:1200px">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'
        + '<div style="font-size:16px;font-weight:600;letter-spacing:-.02em">Operations Dashboard</div>'
        + '<div style="font-size:14px;color:var(--tx3)">' + dtStr + '</div>'
        + '</div>'
        + _renderAlerts(kpi.overdueLots, kpi.nearDueLots)
        + _renderKpiRow(kpi)
        + _renderOpsFollowUp(kpi.activeLots, kpi.dailies)
        + _renderWeeklyTable()
        + _renderShipments(kpi.upcomingShipments)
        + '</div>';
    },
  };

})();
