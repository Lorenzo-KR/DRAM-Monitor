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

    return '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px">'
      + joCardHtml
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

  // ── 주간 보고(입고/처리/매출) ─────────────────────────────
  // 주차 정의: 1주=1~7일, 2주=8~14일, 3주=15~21일, 4주=22~28일, 5주=29~말일
  function _weekOfMonth(dateStr) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return null;
    const day = parseInt(dateStr.slice(8, 10), 10);
    return Math.min(5, Math.floor((day - 1) / 7) + 1);
  }

  function _renderWeeklyTableFor(year, month, opts) {
    opts = opts || {};
    const isCurrent = !!opts.isCurrent;
    const ymPref   = year + '-' + String(month).padStart(2, '0');
    const lots     = Store.getLots();
    const dailies  = Store.getDailies();
    const invoices = Store.getInvoices();

    // 해당 달 마지막 날로 주차 수 결정
    const lastDay  = new Date(year, month, 0).getDate();
    const numWeeks = Math.min(5, Math.floor((lastDay - 1) / 7) + 1);
    const weeks    = Array.from({ length: numWeeks }, function(_, i){ return i + 1; });

    // 사업: 실제 데이터 있는 것만
    const usedBiz = new Set();
    lots.forEach(function(l){ if (l.inDate && String(l.inDate).startsWith(ymPref)) usedBiz.add(l.biz); });
    dailies.forEach(function(d){ if (d.date && String(d.date).startsWith(ymPref)) usedBiz.add(d.biz); });
    invoices.forEach(function(i){ if (i.date && String(i.date).startsWith(ymPref)) usedBiz.add(i.biz); });
    const bizList = CONFIG.BIZ_LIST.filter(function(b){ return usedBiz.has(b); });

    function sumIn(biz, wk) {
      return lots.filter(function(l){
        return l.biz === biz && String(l.inDate || '').startsWith(ymPref) && _weekOfMonth(l.inDate) === wk;
      }).reduce(function(s, l){ return s + parseNumber(l.qty); }, 0);
    }
    function sumProc(biz, wk) {
      return dailies.filter(function(d){
        return d.biz === biz && String(d.date || '').startsWith(ymPref) && _weekOfMonth(d.date) === wk;
      }).reduce(function(s, d){ return s + parseNumber(d.proc); }, 0);
    }
    function sumRev(biz, wk) {
      return invoices.filter(function(i){
        return i.biz === biz && String(i.date || '').startsWith(ymPref) && _weekOfMonth(i.date) === wk;
      }).reduce(function(s, i){ return s + parseNumber(i.total || i.amount); }, 0);
    }

    const BD = '#E0E0E0', HBG = '#F0F0F0', HBG2 = '#E4ECF5', SBG = '#F7F7F7';
    const TH  = function(t, extra){ extra = extra || ''; return '<th style="padding:5px 4px;text-align:center;font-size:10px;font-weight:600;color:#222;background:' + HBG + ';border:1px solid ' + BD + ';white-space:nowrap;' + extra + '">' + t + '</th>'; };
    const THM = function(t, bg, colspan, extra){ bg = bg || HBG; colspan = colspan || 1; extra = extra || ''; return '<th colspan="' + colspan + '" style="padding:5px 4px;text-align:center;font-size:10px;font-weight:600;color:#222;background:' + bg + ';border:1px solid ' + BD + ';white-space:nowrap;' + extra + '">' + t + '</th>'; };
    const TD  = function(v, bg, color, fw){ bg = bg || '#fff'; color = color || '#333'; fw = fw || '400'; return '<td style="padding:5px 4px;text-align:right;font-size:11px;font-family:var(--font-mono);font-weight:' + fw + ';color:' + color + ';background:' + bg + ';border:1px solid ' + BD + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + v + '</td>'; };
    const TDL = function(t, bg){ bg = bg || HBG; return '<td style="padding:5px 8px;text-align:left;font-size:11px;font-weight:600;color:#1D1D1F;background:' + bg + ';border:1px solid ' + BD + ';white-space:nowrap">' + t + '</td>'; };

    // ── 가로: 사업 (3열 입고/처리/매출씩) + 사업 합계 / 세로: 주차 + 월 합계
    const curWk = isCurrent ? _weekOfMonth(today()) : null;

    // 헤더 row1: 사업명
    const bizHeader = bizList.map(function(biz){
      const color = CONFIG.BIZ_COLORS[biz] || '#222';
      return THM('<span style="color:' + color + '">' + (CONFIG.BIZ_LABELS[biz] || biz) + '</span>', HBG, 3, 'border-left:2px solid ' + BD);
    }).join('') + THM('사업 합계', SBG, 3, 'border-left:2px solid #BBB');

    // 헤더 row2: 입고/처리/매출 반복
    const subHeader = bizList.map(function(_, bi){
      return THM('입고', HBG, 1, bi === 0 ? 'border-left:2px solid ' + BD : '')
           + THM('처리', HBG)
           + THM('매출', HBG);
    }).join('')
    + THM('입고', SBG, 1, 'border-left:2px solid #BBB')
    + THM('처리', SBG)
    + THM('매출', SBG);

    // 데이터 행: 주차마다
    const rowTotals = { in: 0, proc: 0, rev: 0 };
    const bizColTotals = bizList.map(function(){ return { in: 0, proc: 0, rev: 0 }; });

    const dataRows = weeks.map(function(w){
      const isCur = w === curWk;
      const rowBg = isCur ? '#F4F8FC' : '#fff';
      const weekLabel = month + '월 ' + w + '주' + (isCur ? ' <span style="font-size:9px;color:#0C447C;font-weight:500">(이번주)</span>' : '');
      let rowSumIn = 0, rowSumProc = 0, rowSumRev = 0;
      const cells = bizList.map(function(biz, bi){
        const vIn   = sumIn(biz, w);
        const vProc = sumProc(biz, w);
        const vRev  = sumRev(biz, w);
        rowSumIn   += vIn;   rowSumProc += vProc; rowSumRev += vRev;
        bizColTotals[bi].in   += vIn;
        bizColTotals[bi].proc += vProc;
        bizColTotals[bi].rev  += vRev;
        const procColor = vProc > 0 ? (CONFIG.BIZ_COLORS[biz] || '#333') : '#C7C7CC';
        const leftBd = bi === 0 ? 'border-left:2px solid ' + BD : '';
        const inCell = '<td style="padding:5px 4px;text-align:right;font-size:11px;font-family:var(--font-mono);color:' + (vIn > 0 ? '#333' : '#C7C7CC') + ';background:' + rowBg + ';border:1px solid ' + BD + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' + leftBd + '">' + (vIn > 0 ? formatNumber(vIn) : '—') + '</td>';
        return inCell
             + TD(vProc > 0 ? formatNumber(vProc) : '—', rowBg, procColor)
             + TD(vRev > 0 ? '$' + formatNumber(Math.round(vRev)) : '—', rowBg, vRev > 0 ? '#1A6B3A' : '#C7C7CC');
      }).join('');
      rowTotals.in   += rowSumIn;
      rowTotals.proc += rowSumProc;
      rowTotals.rev  += rowSumRev;
      const sumBg = isCur ? '#EAF0F8' : SBG;
      const sumCells = '<td style="padding:5px 4px;text-align:right;font-size:11px;font-family:var(--font-mono);font-weight:600;color:' + (rowSumIn > 0 ? '#1D1D1F' : '#C7C7CC') + ';background:' + sumBg + ';border:1px solid ' + BD + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:2px solid #BBB">' + (rowSumIn > 0 ? formatNumber(rowSumIn) : '—') + '</td>'
                    + TD(rowSumProc > 0 ? formatNumber(rowSumProc) : '—', sumBg, rowSumProc > 0 ? '#1D1D1F' : '#C7C7CC', '600')
                    + TD(rowSumRev > 0 ? '$' + formatNumber(Math.round(rowSumRev)) : '—', sumBg, rowSumRev > 0 ? '#1A6B3A' : '#C7C7CC', '600');
      const labelBg = isCur ? HBG2 : HBG;
      return '<tr>' + TDL(weekLabel, labelBg) + cells + sumCells + '</tr>';
    }).join('');

    // 월 합계 행
    const totalRowCells = bizList.map(function(biz, bi){
      const t = bizColTotals[bi];
      const procColor = t.proc > 0 ? (CONFIG.BIZ_COLORS[biz] || '#1D1D1F') : '#C7C7CC';
      const leftBd = bi === 0 ? 'border-left:2px solid ' + BD : '';
      const inCell = '<td style="padding:5px 4px;text-align:right;font-size:11px;font-family:var(--font-mono);font-weight:600;color:' + (t.in > 0 ? '#1D1D1F' : '#C7C7CC') + ';background:' + SBG + ';border:1px solid ' + BD + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' + leftBd + '">' + (t.in > 0 ? formatNumber(t.in) : '—') + '</td>';
      return inCell
           + TD(t.proc > 0 ? formatNumber(t.proc) : '—', SBG, procColor, '600')
           + TD(t.rev > 0 ? '$' + formatNumber(Math.round(t.rev)) : '—', SBG, t.rev > 0 ? '#1A6B3A' : '#C7C7CC', '600');
    }).join('');
    const totalRowGrand = '<td style="padding:5px 4px;text-align:right;font-size:11px;font-family:var(--font-mono);font-weight:700;color:' + (rowTotals.in > 0 ? '#1D1D1F' : '#C7C7CC') + ';background:' + SBG + ';border:1px solid ' + BD + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:2px solid #BBB">' + (rowTotals.in > 0 ? formatNumber(rowTotals.in) : '—') + '</td>'
                       + TD(rowTotals.proc > 0 ? formatNumber(rowTotals.proc) : '—', SBG, '#1D1D1F', '700')
                       + TD(rowTotals.rev > 0 ? '$' + formatNumber(Math.round(rowTotals.rev)) : '—', SBG, '#1A6B3A', '700');
    const totalRow = '<tr>' + TDL(month + '월 합계', SBG) + totalRowCells + totalRowGrand + '</tr>';

    // colgroup: 첫 컬럼 84px 고정, 나머지는 균등 분배
    const dataColCount = (bizList.length + 1) * 3;
    const colgroup = '<colgroup><col style="width:84px">'
      + Array(dataColCount).fill(0).map(function(_, ci){
          const w = (100 / dataColCount).toFixed(3) + '%';
          return '<col style="width:' + w + '">';
        }).join('')
      + '</colgroup>';

    const body = bizList.length
      ? dataRows + totalRow
      : '<tr><td colspan="' + (dataColCount + 1) + '" style="padding:14px;text-align:center;font-size:12px;color:var(--tx3);border:1px solid ' + BD + '">' + month + '월 데이터 없음</td></tr>';

    const labelTag = isCurrent ? '<span style="font-size:11px;color:#0C447C;font-weight:500;margin-left:6px">(이번달)</span>'
                               : '<span style="font-size:11px;color:var(--tx3);margin-left:6px">(지난달)</span>';

    return '<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:6px">'
      + '<div style="font-size:13px;font-weight:600;color:var(--tx)">' + year + '년 ' + month + '월</div>'
      + labelTag
      + '</div>'
      + '<div style="margin-bottom:14px">'
      + '<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-family:\'Pretendard\',-apple-system,sans-serif">'
      + colgroup
      + '<thead><tr>' + TH('주차') + bizHeader + '</tr>'
      + '<tr>' + TH('') + subHeader + '</tr></thead>'
      + '<tbody>' + body + '</tbody>'
      + '</table></div>';
  }

  function _renderWeeklyTable() {
    const now      = new Date();
    const curYear  = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
    const prevYear  = curMonth === 1 ? curYear - 1 : curYear;

    return '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px">'
      + '<div style="font-size:14px;font-weight:600;color:var(--tx)">주간 보고</div>'
      + '<div style="font-size:12px;color:var(--tx3)">주차(세로) × 사업(가로) — 입고/처리/매출 (2주 단위 보고)</div>'
      + '</div>'
      + _renderWeeklyTableFor(curYear,  curMonth,  { isCurrent: true })
      + _renderWeeklyTableFor(prevYear, prevMonth, { isCurrent: false });
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
        + _renderBarCards(kpi)
        + _renderWeeklyTable()
        + _renderActiveTable(kpi.activeLots, kpi.dailies)
        + _renderShipments(kpi.upcomingShipments)
        + '</div>';
    },
  };

})();
