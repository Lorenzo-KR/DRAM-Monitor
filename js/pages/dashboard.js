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

    const kpiSum   = Pages.KpiTarget.getKpiSummary(year);
    const kpiPct   = kpiSum.pct;
    const kpiColor = kpiPct === null ? '' : kpiPct >= 100 ? 'var(--tx)' : kpiPct >= 70 ? 'var(--tx2)' : 'var(--tx3)';
    const fmt      = function(v) { return kpiSum.hasRate ? (v / 100000000).toFixed(2) + '억원' : '$' + formatNumberShort(Math.round(v)); };
    const kpiCardHtml = kpiSum.tgt === null
      ? kpiCard('KPI 달성률', '—', '목표 미설정')
      : kpiCard('KPI 달성률', kpiPct + '%', '목표 ' + fmt(kpiSum.tgt), kpiColor, '실적 ' + fmt(kpiSum.act));

    return '<div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:12px">'
      + kpiCard('Job Orders', kpi.lots.length, '진행 ' + kpi.activeLots.length + ' · 완료 ' + kpi.doneLots.length)
      + kpiCard('Total Units', formatNumber(kpi.totalUnits), '처리 ' + formatNumber(kpi.totalProc) + ' · 잔량 ' + formatNumber(Math.max(0, kpi.totalUnits - kpi.totalProc)))
      + kpiCard('Total Revenue', kpi.revenue.total > 0 ? '$' + formatNumber(Math.round(kpi.revenue.total)) : '—', '완료 기준', 'var(--tx)', krwSub, fxInputHtml)
      + kpiCard('Active Orders', kpi.activeLots.length, kpi.overdueLots.length > 0 ? '지연 ' + kpi.overdueLots.length + '건 포함' : '지연 없음', 'var(--tx2)')
      + kpiCardHtml
      + '</div>';
  }

  function _renderBarCards(kpi) {
    const year = new Date().getFullYear();

    const BIZ_DOT = { SSD: '#6B6762', DRAM: '#A8A49E', MID: '#6B6762' };
    const maxRev  = Math.max.apply(null, CONFIG.BIZ_LIST.map(function(b){ return kpi.revenue[b] || 0; }).concat([1]));
    const revBars = CONFIG.BIZ_LIST.filter(function(b){ return kpi.revenue[b] > 0; }).map(function(b){
      return '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:0.5px solid var(--bd)">'
        + '<div style="display:flex;align-items:center;gap:6px;font-size:14px;color:var(--tx2);min-width:100px">'
        + '<span style="width:7px;height:7px;border-radius:50%;background:' + (BIZ_DOT[b]||'#999') + ';flex-shrink:0;display:inline-block"></span>' + CONFIG.BIZ_LABELS[b]
        + '</div>'
        + '<div style="flex:1;height:5px;background:var(--bd);border-radius:3px;overflow:hidden"><div style="height:100%;border-radius:3px;background:' + (BIZ_DOT[b]||'#999') + ';width:' + Math.round((kpi.revenue[b]||0)/maxRev*100) + '%"></div></div>'
        + '<div style="font-size:14px;font-weight:600;min-width:72px;text-align:right">$' + formatNumber(Math.round(kpi.revenue[b])) + '</div>'
        + '</div>';
    }).join('');

    const CO_COLORS = { HK: '#6B6762', SG: '#A8A49E' };
    const CO_LABELS = { HK: '홍콩 (HK)', SG: '싱가포르 (SG)' };
    const maxRegRev = Math.max(kpi.revenue.HK || 0, kpi.revenue.SG || 0, 1);
    const regBars   = ['HK', 'SG'].map(function(co){
      return '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:0.5px solid var(--bd)">'
        + '<div style="display:flex;align-items:center;gap:6px;font-size:14px;color:var(--tx2);min-width:110px">'
        + '<span style="width:7px;height:7px;border-radius:50%;background:' + CO_COLORS[co] + ';flex-shrink:0;display:inline-block"></span>' + CO_LABELS[co]
        + '</div>'
        + '<div style="flex:1;height:5px;background:var(--bd);border-radius:3px;overflow:hidden"><div style="height:100%;border-radius:3px;background:' + CO_COLORS[co] + ';width:' + (kpi.revenue[co] > 0 ? Math.round(kpi.revenue[co]/maxRegRev*100) : 0) + '%"></div></div>'
        + '<div style="font-size:14px;font-weight:600;min-width:72px;text-align:right;color:' + (kpi.revenue[co] > 0 ? 'var(--tx)' : 'var(--tx3)') + '">$' + formatNumber(Math.round(kpi.revenue[co]||0)) + '</div>'
        + '</div>';
    }).join('');
    const regPadRow = '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:0.5px solid var(--bd);opacity:0;pointer-events:none"><div style="min-width:110px;font-size:14px">—</div><div style="flex:1;height:5px"></div><div style="min-width:72px"></div></div>';

    const kpiSum  = Pages.KpiTarget.getKpiSummary(year);
    const kpiBars = CONFIG.BIZ_LIST.map(function(b){
      if (!Pages.KpiTarget.getTarget(year, b)) return '';
      const bizSum = Pages.KpiTarget.getBizSummary(year, b);
      const pct    = bizSum ? (bizSum.pct || 0) : 0;
      const color  = CONFIG.BIZ_COLORS[b];
      return '<div style="display:flex;align-items:center;gap:8px;padding:9px 13px;border-bottom:0.5px solid var(--bd)">'
        + '<div style="display:flex;align-items:center;gap:6px;font-size:14px;color:var(--tx2);min-width:90px">'
        + '<span style="width:7px;height:7px;border-radius:50%;background:' + color + ';flex-shrink:0;display:inline-block"></span>' + CONFIG.BIZ_LABELS[b]
        + '</div>'
        + '<div style="flex:1;height:5px;background:var(--bd);border-radius:3px;overflow:hidden"><div style="height:100%;border-radius:3px;background:' + color + ';width:' + Math.min(100,pct) + '%"></div></div>'
        + '<div style="font-size:15px;font-weight:500;min-width:28px;text-align:right;color:' + (pct >= 70 ? color : 'var(--tx3)') + '">' + pct + '%</div>'
        + '</div>';
    }).filter(Boolean).join('');

    const totalKpiPct    = kpiSum.pct;
    const kpiFooterColor = totalKpiPct === null ? 'var(--tx3)' : totalKpiPct >= 100 ? 'var(--tx)' : totalKpiPct >= 70 ? 'var(--tx2)' : 'var(--tx3)';
    const kpiFooter      = totalKpiPct !== null
      ? '<span style="font-size:14px;font-weight:500;color:var(--tx)">총 달성률</span><span style="font-size:14px;font-weight:600;color:' + kpiFooterColor + '">' + totalKpiPct + '%</span>'
      : '';

    function barCard(title, sub, content, footer) {
      footer = footer || '';
      return '<div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);overflow:hidden">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg);border-bottom:0.5px solid var(--bd)">'
        + '<span style="font-size:14px;font-weight:600;color:var(--tx)">' + title + '</span>'
        + '<span style="font-size:14px;color:var(--tx3)">' + sub + '</span>'
        + '</div>' + content
        + (footer ? '<div style="display:flex;justify-content:space-between;padding:8px 14px;background:var(--bg)">' + footer + '</div>' : '')
        + '</div>';
    }

    const revTotal  = kpi.revenue.total;
    const revFooter = revTotal > 0 ? '<span style="font-size:14px;font-weight:500;color:var(--tx)">Total</span><span style="font-size:14px;font-weight:600;color:#085041">$' + formatNumber(Math.round(revTotal)) + '</span>' : '';

    return '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">'
      + barCard('Revenue by business', 'USD', revBars || '<div style="padding:12px 14px;font-size:14px;color:var(--tx3)">데이터 없음</div>', revFooter)
      + barCard('Revenue by region', 'USD', regBars + regPadRow, revTotal > 0 ? '<span style="font-size:14px;font-weight:500;color:var(--tx)">Total</span><span style="font-size:14px;font-weight:600;color:#085041">$' + formatNumber(Math.round(revTotal)) + '</span>' : '')
      + (kpiBars
          ? barCard('KPI 목표 달성', String(year) + '년', kpiBars, kpiFooter)
          : barCard('KPI 목표 달성', '', '<div style="padding:12px 14px;font-size:14px;color:var(--tx3)">목표 미설정 — <a href="#" onclick="Nav.go(\'kpitarget\');return false;" style="color:var(--navy)">설정하기</a></div>'))
      + '</div>';
  }

  function _renderActiveTable(activeLots, dailies) {
    const invoices    = Store.getInvoices();
    const upcomingLots   = activeLots.filter(function(l){ return l.inDate > today(); });
    const inProgressLots = activeLots.filter(function(l){ return l.inDate <= today(); });
    const doneLots       = Store.getLots().filter(function(l){ return getLotStatus(l) === 'done'; });
    const unpaidLots     = doneLots.filter(function(l){
      const inv = invoices.find(function(r){ return String(r.lotId) === String(l.id); });
      return !inv || inv.status === 'unpaid' || inv.status === 'partial';
    });

    // ★ 입고일 역순 정렬
    const allLots = upcomingLots.concat(inProgressLots, unpaidLots)
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

      const ddTag = dd !== null && !isUpcoming ? '<span style="font-size:11px;margin-left:4px;color:' + (dd < 0 ? '#dc2626' : 'var(--tx3)') + '">(' + (dd < 0 ? 'D+' + Math.abs(dd) : 'D-' + dd) + ')</span>' : '';
      const targetCell = isDone
        ? (lot.actualDone || lot.targetDate || '—')
        : ((lot.targetDate || '—') + ddTag);

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
        + '<td style="' + S.tdm + ';color:' + (st === 'overdue' ? '#dc2626' : isDone ? 'var(--tx)' : 'var(--tx3)') + '">' + targetCell + '</td>'
        + '<td style="' + S.td + '">' + statusCell + ' ' + unpaidBadge + '</td>'
        + '</tr>';
    }).join('');

    return '<div style="font-size:14px;font-weight:600;color:var(--tx);margin-bottom:8px">Active & Upcoming Job Orders <span style="font-size:12px;font-weight:400;color:var(--tx3);margin-left:4px">(진행중 · 입고예정 · 미수금)</span></div>'
      + '<div style="border:1px solid #E0E0E0;border-radius:6px;overflow:hidden;margin-bottom:12px">'
      + '<table style="width:100%;border-collapse:collapse;font-family:\'Pretendard\',-apple-system,sans-serif">'
      + '<thead><tr>'
      + '<th style="' + S.th + '">LOT 번호</th><th style="' + S.th + '">지역</th><th style="' + S.th + '">사업</th><th style="' + S.th + '">고객사</th>'
      + '<th style="' + S.thr + '">입고량</th><th style="' + S.thr + '">처리</th><th style="' + S.thr + '">잔량</th>'
      + '<th style="' + S.th + ';min-width:120px">진행률</th>'
      + '<th style="' + S.th + '">입고일</th><th style="' + S.th + '">목표완료</th><th style="' + S.th + '">상태</th>'
      + '</tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table></div>';
  }

  function _renderCompletedTable(doneLots, dailies, invoices) {
    const paidLots = doneLots.filter(function(l){
      const inv = invoices.find(function(r){ return String(r.lotId) === String(l.id); });
      return inv && (inv.status === 'paid' || inv.status === 'partial');
    });
    if (!paidLots.length) return '';

    const sorted = paidLots.slice().sort(function(a, b){
      return String(b.actualDone || b.inDate || '').localeCompare(String(a.actualDone || a.inDate || ''));
    });

    const rows = sorted.map(function(lot, ci){
      const inv  = invoices.find(function(r){ return String(r.lotId) === String(lot.id); });
      const rev  = inv ? parseNumber(inv.total || inv.amount) : parseNumber(lot.price) * parseNumber(lot.qty);
      const tat  = (lot.inDate && lot.actualDone) ? diffDays(lot.inDate, lot.actualDone) + 'd' : '—';
      const bg   = ci % 2 === 1 ? 'background:#FAFAFA' : 'background:#fff';
      return '<tr style="' + bg + '">'
        + '<td style="' + S.td + ';font-family:var(--font-mono)">' + (lot.lotNo || lot.id) + '</td>'
        + '<td style="' + S.td + '">' + badge(lot.country, CO_STYLE[lot.country] || '') + '</td>'
        + '<td style="' + S.td + '">' + badge(lot.biz, BIZ_STYLE[lot.biz] || '') + '</td>'
        + '<td style="' + S.tdm + '">' + (lot.customerName || '—') + '</td>'
        + '<td style="' + S.tdr + '">' + formatNumber(parseNumber(lot.qty)) + '</td>'
        + '<td style="' + S.tdm + '">' + (lot.inDate || '—') + '</td>'
        + '<td style="' + S.tdm + '">' + (lot.actualDone || '—') + '</td>'
        + '<td style="' + S.tdm + '">' + tat + '</td>'
        + '<td style="' + S.tdr + ';color:' + (rev > 0 ? 'var(--tx)' : 'var(--tx3)') + '">' + (rev > 0 ? '$' + formatNumber(Math.round(rev)) : '—') + '</td>'
        + '</tr>';
    }).join('');

    const totalQty = sorted.reduce(function(s, l){ return s + parseNumber(l.qty); }, 0);
    const totalRev = sorted.reduce(function(s, lot){
      const inv = invoices.find(function(r){ return String(r.lotId) === String(lot.id); });
      return s + (inv ? parseNumber(inv.total || inv.amount) : parseNumber(lot.price) * parseNumber(lot.qty));
    }, 0);

    // ★ 합계 행: border-top:2px solid #CCC (헤더와 동일), Pretendard 폰트
    const sumRow = '<tr style="background:#F0F0F0">'
      + '<td colspan="4" style="padding:7px 10px;' + FS + ';font-weight:600;color:var(--tx2);border-top:2px solid #CCC;border-right:1px solid #DDD">Total</td>'
      + '<td style="padding:7px 10px;border-top:2px solid #CCC;border-right:1px solid #DDD;text-align:right;font-family:\'DM Mono\',monospace;font-size:12px;font-weight:700;color:#111">' + formatNumber(totalQty) + '</td>'
      + '<td colspan="3" style="padding:7px 10px;border-top:2px solid #CCC;border-right:1px solid #DDD"></td>'
      + '<td style="padding:7px 10px;border-top:2px solid #CCC;border-right:1px solid #DDD;text-align:right;font-family:\'DM Mono\',monospace;font-size:12px;font-weight:700;color:#1A6B3A">' + (totalRev > 0 ? '$' + formatNumber(Math.round(totalRev)) : '—') + '</td>'
      + '</tr>';

    return '<div style="font-size:14px;font-weight:600;color:var(--tx);margin-bottom:8px">Completed job orders</div>'
      + '<div style="border:1px solid #E0E0E0;border-radius:6px;overflow:hidden;margin-bottom:12px">'
      + '<table style="width:100%;border-collapse:collapse;font-family:\'Pretendard\',-apple-system,sans-serif">'
      + '<thead><tr>'
      + '<th style="' + S.th + '">LOT 번호</th><th style="' + S.th + '">지역</th><th style="' + S.th + '">사업</th><th style="' + S.th + '">고객사</th>'
      + '<th style="' + S.thr + '">수량</th><th style="' + S.th + '">입고일</th><th style="' + S.th + '">완료일</th>'
      + '<th style="' + S.th + '">TAT</th><th style="' + S.thr + '">매출액</th>'
      + '</tr></thead>'
      + '<tbody>' + rows + sumRow + '</tbody>'
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
        + _renderBarCards(kpi)
        + _renderActiveTable(kpi.activeLots, kpi.dailies)
        + _renderCompletedTable(kpi.doneLots, kpi.dailies, kpi.invoices)
        + _renderShipments(kpi.upcomingShipments)
        + '</div>';
    },
  };

})();
