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

  // ── 주간 보고(2주 사이클): 운영(입고/처리/WIP) + 수금(매출/Lead time) ──
  function _calcBiweekly(start, end) {
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

    return { totalIn, totalProc, totalRev, wip, avgLT, paidLotCount: paidLotIds.size, paidInDates, byBiz };
  }

  function _renderBiweeklyCard(label, start, end, p, isCur) {
    const fmtMD = function(d){ return d.slice(5).replace('-', '/'); };
    const labelStyle = 'font-size:10px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.05em';
    const valueStyle = 'font-size:20px;font-weight:600;line-height:1';
    const metricBox  = 'display:flex;flex-direction:column;gap:3px';

    // 사업별 mini-bars (입고 vs 처리)
    const bizItems = CONFIG.BIZ_LIST.filter(function(b){ return p.byBiz[b].in > 0 || p.byBiz[b].proc > 0 || p.byBiz[b].rev > 0; });
    const maxV = bizItems.length ? Math.max.apply(null, bizItems.flatMap(function(b){ return [p.byBiz[b].in, p.byBiz[b].proc]; }).concat([1])) : 1;
    const bizBars = bizItems.map(function(b){
      const x = p.byBiz[b];
      const inPct   = Math.round(x.in   / maxV * 100);
      const procPct = Math.round(x.proc / maxV * 100);
      const color   = CONFIG.BIZ_COLORS[b] || '#666';
      return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:11px">'
        + '<span style="min-width:80px;color:var(--tx2);font-weight:500">' + (CONFIG.BIZ_LABELS[b] || b) + '</span>'
        + '<span style="min-width:62px;text-align:right;color:var(--tx3);font-family:var(--font-mono)">입 ' + (x.in > 0 ? formatNumber(x.in) : '—') + '</span>'
        + '<div style="flex:1;display:flex;gap:3px;height:7px">'
        +   '<div style="flex:1;background:#F0F0F0;border-radius:2px;overflow:hidden"><div style="width:' + inPct + '%;height:100%;background:' + color + ';opacity:0.45"></div></div>'
        +   '<div style="flex:1;background:#F0F0F0;border-radius:2px;overflow:hidden"><div style="width:' + procPct + '%;height:100%;background:' + color + '"></div></div>'
        + '</div>'
        + '<span style="min-width:62px;text-align:right;color:' + (x.proc > 0 ? color : 'var(--tx3)') + ';font-family:var(--font-mono);font-weight:500">처 ' + (x.proc > 0 ? formatNumber(x.proc) : '—') + '</span>'
        + '<span style="min-width:62px;text-align:right;color:' + (x.rev > 0 ? '#1A6B3A' : 'var(--tx3)') + ';font-family:var(--font-mono)">' + (x.rev > 0 ? '$' + formatNumber(Math.round(x.rev)) : '매 —') + '</span>'
        + '</div>';
    }).join('');

    const bizSection = bizItems.length
      ? '<div style="margin-top:10px;padding-top:10px;border-top:0.5px dashed var(--bd)">' + bizBars + '</div>'
      : '';

    const opsSection = '<div style="padding:12px 14px;border-bottom:0.5px solid var(--bd)">'
      + '<div style="font-size:11px;font-weight:600;color:var(--tx2);margin-bottom:8px;letter-spacing:.02em">◾ 운영 활동</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'
      +   '<div style="' + metricBox + '"><div style="' + labelStyle + '">입고</div><div style="' + valueStyle + '">' + formatNumber(p.totalIn) + '</div></div>'
      +   '<div style="' + metricBox + '"><div style="' + labelStyle + '">처리</div><div style="' + valueStyle + ';color:#1B4F8A">' + formatNumber(p.totalProc) + '</div></div>'
      +   '<div style="' + metricBox + '"><div style="' + labelStyle + '">기말 WIP</div><div style="' + valueStyle + ';color:#B45309">' + formatNumber(p.wip) + '</div></div>'
      + '</div>'
      + bizSection
      + '</div>';

    // 결제된 LOT 입고일 범위
    let ltNote = '';
    if (p.paidInDates.length) {
      const sorted = p.paidInDates.slice().sort();
      const oldest = sorted[0];
      const newest = sorted[sorted.length - 1];
      ltNote = '<div style="margin-top:8px;padding-top:8px;border-top:0.5px dashed var(--bd);font-size:11px;color:var(--tx3)">'
        + '결제된 LOT 입고일 범위: <span style="font-family:var(--font-mono);color:var(--tx2)">' + fmtMD(oldest) + ' ~ ' + fmtMD(newest) + '</span>'
        + '</div>';
    }

    const revSection = '<div style="padding:12px 14px">'
      + '<div style="font-size:11px;font-weight:600;color:var(--tx2);margin-bottom:8px;letter-spacing:.02em">◾ 수금 (매출)</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'
      +   '<div style="' + metricBox + '"><div style="' + labelStyle + '">매출</div><div style="' + valueStyle + ';color:#0F6E56">' + (p.totalRev > 0 ? '$' + formatNumber(Math.round(p.totalRev)) : '—') + '</div></div>'
      +   '<div style="' + metricBox + '"><div style="' + labelStyle + '">결제 LOT</div><div style="' + valueStyle + '">' + p.paidLotCount + '<span style="font-size:12px;font-weight:500;color:var(--tx3);margin-left:2px">건</span></div></div>'
      +   '<div style="' + metricBox + '"><div style="' + labelStyle + '">평균 lead time</div><div style="' + valueStyle + '">' + (p.avgLT !== null ? p.avgLT + '<span style="font-size:12px;font-weight:500;color:var(--tx3);margin-left:2px">일</span>' : '—') + '</div></div>'
      + '</div>'
      + ltNote
      + '</div>';

    const tag = isCur
      ? '<span style="font-size:10px;color:#0C447C;font-weight:500;margin-left:6px;padding:1px 6px;border:1px solid #9DC3F0;border-radius:3px;background:#EBF2FB">이번 사이클</span>'
      : '<span style="font-size:10px;color:var(--tx3);margin-left:6px">직전 사이클</span>';

    return '<div style="background:var(--card);border:0.5px solid var(--bd);border-radius:8px;overflow:hidden">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 14px;background:var(--bg);border-bottom:0.5px solid var(--bd)">'
      +   '<span style="font-size:13px;font-weight:600;color:var(--tx)">' + label + tag + '</span>'
      +   '<span style="font-size:11px;color:var(--tx3);font-family:var(--font-mono)">' + fmtMD(start) + ' ~ ' + fmtMD(end) + '</span>'
      + '</div>'
      + opsSection
      + revSection
      + '</div>';
  }

  function _renderWeeklyTable() {
    const t         = today();
    const curStart  = addDays(t, -13);
    const curEnd    = t;
    const prevStart = addDays(t, -27);
    const prevEnd   = addDays(t, -14);
    const cur  = _calcBiweekly(curStart,  curEnd);
    const prev = _calcBiweekly(prevStart, prevEnd);

    return '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px">'
      + '<div style="font-size:14px;font-weight:600;color:var(--tx)">주간 보고 — 2주 사이클</div>'
      + '<div style="font-size:12px;color:var(--tx3)">운영(입고·처리·WIP) + 수금(매출·LT)을 분리해서 시간차 가시화</div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">'
      + _renderBiweeklyCard('이번 2주', curStart,  curEnd,  cur,  true)
      + _renderBiweeklyCard('지난 2주', prevStart, prevEnd, prev, false)
      + '</div>';
  }


  function _renderActiveTable(activeLots, dailies) {
    const invoices    = Store.getInvoices();
    const upcomingLots   = activeLots.filter(function(l){ return l.inDate > today(); });
    const inProgressLots = activeLots.filter(function(l){ return l.inDate <= today(); });

    // ★ 입고일 역순 정렬 (완료 LOT은 제외)
    const allLots = upcomingLots.concat(inProgressLots)
      .sort(function(a, b){ return String(b.inDate || '').localeCompare(String(a.inDate || '')); });
    if (!allLots.length) return '';

    const rows = allLots.map(function(lot, rowIdx){
      const isUpcoming = lot.inDate > today();
      const isDone     = getLotStatus(lot) === 'done';
      const inv        = invoices.find(function(r){ return String(r.lotId) === String(lot.id); });
      const isUnpaid   = isDone && (!inv || inv.status === 'unpaid' || inv.status === 'partial');
      const cum      = isUpcoming ? 0 : getLotCumulative(lot.id, dailies);
      const qty      = parseNumber(lot.qty);
      const rem      = Math.max(0, qty - cum);
      const pct      = (qty > 0 && !isUpcoming) ? Math.min(100, Math.round(cum / qty * 100)) : 0;
      const st       = isUpcoming ? 'upcoming' : getLotStatus(lot);
      const dd       = lot.targetDate ? diffDays(today(), lot.targetDate) : null;
      const ddIn     = isUpcoming ? diffDays(today(), lot.inDate) : null;
      const pctColor = st === 'overdue' ? '#dc2626' : pct >= 80 ? 'var(--tx3)' : 'var(--tx2)';
      const barColor = st === 'overdue' ? '#dc2626' : st === 'upcoming' ? 'var(--tx3)' : st === 'done' ? 'var(--tx)' : pct >= 80 ? 'var(--tx3)' : 'var(--tx2)';
      const stStyle  = st === 'upcoming' ? 'border:1px solid #5AC8FA;color:#0077A8;background:#F0F8FF' : (ST_STYLE[st] || '');
      const stLabel  = st === 'upcoming' ? '입고예정' : (ST_LABEL[st] || st);

      // ★ 지연: '진행중' + '지연' 배지 두 개
      const statusCell = st === 'overdue'
        ? badge('진행중', ST_STYLE['inprog']) + ' ' + badge('지연', ST_STYLE['overdue'])
        : badge(stLabel, stStyle);

      const evenBg = rowIdx % 2 === 1 ? 'background:#FAFAFA' : 'background:#fff';
      const rowBg  = isUpcoming ? 'background:#F8F8F8' : isUnpaid ? 'background:#FFF8F0' : evenBg;
      const unpaidBadge = isUnpaid
        ? badge(
            inv && inv.status === 'partial' ? '부분수금' : '미수금',
            inv && inv.status === 'partial'
              ? 'border:1px solid var(--bd);color:var(--tx2);background:transparent'
              : 'border:1px solid #FECACA;color:#dc2626;background:#FEF2F2')
        : '';

      const ddTag = dd !== null && !isUpcoming && !isDone ? '<span style="font-size:10px;margin-left:3px;color:' + (dd < 0 ? '#dc2626' : 'var(--tx3)') + '">(' + (dd < 0 ? 'D+' + Math.abs(dd) : 'D-' + dd) + ')</span>' : '';
      const targetColor = st === 'overdue' ? '#dc2626' : 'var(--tx3)';
      const actualColor = lot.actualDone ? 'var(--tx)' : 'var(--tx3)';
      const targetCell = '<div style="font-size:10px;color:' + targetColor + ';line-height:1.3">' + (lot.targetDate || '—') + ddTag + '</div>'
                       + '<div style="color:' + actualColor + ';line-height:1.3;margin-top:2px;font-weight:' + (lot.actualDone ? 500 : 400) + '">' + (lot.actualDone || '—') + '</div>';

      return '<tr style="' + rowBg + '">'
        + '<td style="' + S.td + ';font-family:var(--font-mono)">' + (lot.lotNo || lot.id) + '</td>'
        + '<td style="' + S.td + '">' + badge(lot.country, CO_STYLE[lot.country] || '') + '</td>'
        + '<td style="' + S.td + '">' + badge(lot.biz, BIZ_STYLE[lot.biz] || '') + '</td>'
        + '<td style="' + S.tdm + '">' + (lot.customerName || '—') + '</td>'
        + '<td style="' + S.tdr + '">' + formatNumber(qty) + '</td>'
        + '<td style="' + S.tdr + ';color:' + (CONFIG.BIZ_COLORS[lot.biz] || 'var(--tx)') + '">' + (isUpcoming ? '—' : formatNumber(cum)) + '</td>'
        + '<td style="' + S.tdr + '">' + formatNumber(rem) + '</td>'
        + '<td style="' + S.td + ';min-width:120px">'
        + (isUpcoming
            ? '<span style="font-size:15px;color:#0C447C;font-weight:500">D-' + ddIn + '</span>'
            : '<div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:4px;background:#E0E0E0;border-radius:2px;overflow:hidden"><div style="height:100%;border-radius:2px;background:' + barColor + ';width:' + pct + '%"></div></div><span style="font-size:14px;font-weight:500;color:' + pctColor + ';min-width:28px;text-align:right">' + pct + '%</span></div>')
        + '</td>'
        + '<td style="' + S.tdm + ';color:' + (isUpcoming ? 'var(--tx2)' : 'var(--tx3)') + ';font-weight:' + (isUpcoming ? '500' : '400') + '">' + (lot.inDate || '—') + '</td>'
        + '<td style="' + S.tdm + '">' + targetCell + '</td>'
        + '<td style="' + S.td + '">' + statusCell + ' ' + unpaidBadge + '</td>'
        + '</tr>';
    }).join('');

    return '<div style="font-size:14px;font-weight:600;color:var(--tx);margin-bottom:8px">Active & Upcoming Job Orders <span style="font-size:12px;font-weight:400;color:var(--tx3);margin-left:4px">(진행중 · 입고예정)</span></div>'
      + '<div style="border:1px solid #E0E0E0;border-radius:6px;overflow:hidden;margin-bottom:12px">'
      + '<table style="width:100%;border-collapse:collapse;font-family:\'Pretendard\',-apple-system,sans-serif">'
      + '<thead><tr>'
      + '<th style="' + S.th + '">LOT 번호</th><th style="' + S.th + '">지역</th><th style="' + S.th + '">사업</th><th style="' + S.th + '">고객사</th>'
      + '<th style="' + S.thr + '">입고량</th><th style="' + S.thr + '">처리</th><th style="' + S.thr + '">잔량</th>'
      + '<th style="' + S.th + ';min-width:120px">진행률</th>'
      + '<th style="' + S.th + '">입고일</th><th style="' + S.th + '"><div style="font-size:10px;color:var(--tx3);font-weight:500;line-height:1.3">목표완료일</div><div style="line-height:1.3">실완료일</div></th><th style="' + S.th + '">상태</th>'
      + '</tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table></div>';
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

  return {
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
        + _renderWeeklyTable()
        + _renderActiveTable(kpi.activeLots, kpi.dailies)
        + _renderShipments(kpi.upcomingShipments)
        + '</div>';
    },
  };

})();
