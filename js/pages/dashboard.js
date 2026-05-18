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

  function _renderWeeklyTable() {
    const now      = new Date();
    const year     = now.getFullYear();
    const month    = now.getMonth() + 1;
    const ymPref   = year + '-' + String(month).padStart(2, '0');
    const lots     = Store.getLots();
    const dailies  = Store.getDailies();
    const invoices = Store.getInvoices();

    // 이번 달 마지막 날로 주차 수 결정
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
    const TH = function(t, extra){ extra = extra || ''; return '<th style="padding:6px 8px;text-align:center;font-size:11px;font-weight:600;color:#222;background:' + HBG + ';border:1px solid ' + BD + ';white-space:nowrap;' + extra + '">' + t + '</th>'; };
    const THM = function(t, bg, colspan){ bg = bg || HBG; colspan = colspan || 1; return '<th colspan="' + colspan + '" style="padding:6px 8px;text-align:center;font-size:11px;font-weight:600;color:#222;background:' + bg + ';border:1px solid ' + BD + ';white-space:nowrap">' + t + '</th>'; };
    const TD = function(v, bg, color, fw){ bg = bg || '#fff'; color = color || '#333'; fw = fw || '400'; return '<td style="padding:6px 8px;text-align:right;font-size:12px;font-family:var(--font-mono);font-weight:' + fw + ';color:' + color + ';background:' + bg + ';border:1px solid ' + BD + ';white-space:nowrap">' + v + '</td>'; };
    const TDL = function(t, bg){ bg = bg || HBG; return '<td style="padding:6px 10px;text-align:left;font-size:12px;font-weight:600;color:#1D1D1F;background:' + bg + ';border:1px solid ' + BD + ';white-space:nowrap">' + t + '</td>'; };

    // 헤더: 주차 그룹 (입고/처리/매출 3열씩)
    const curWk = _weekOfMonth(today());
    const weekHeader = weeks.map(function(w){
      const isCur = w === curWk;
      return THM(month + '월 ' + w + '주', isCur ? HBG2 : HBG, 3);
    }).join('') + THM('월 합계', SBG, 3);

    const subHeader = weeks.map(function(w){
      const isCur = w === curWk;
      const bg = isCur ? HBG2 : HBG;
      return THM('입고', bg) + THM('처리', bg) + THM('매출', bg);
    }).join('') + THM('입고', SBG) + THM('처리', SBG) + THM('매출', SBG);

    // 데이터 행
    const colTotals = Array(weeks.length * 3 + 3).fill(0);
    const dataRows = bizList.map(function(biz){
      let rowIn = 0, rowProc = 0, rowRev = 0;
      const cells = weeks.map(function(w, wi){
        const vIn   = sumIn(biz, w);
        const vProc = sumProc(biz, w);
        const vRev  = sumRev(biz, w);
        rowIn   += vIn;   rowProc += vProc; rowRev += vRev;
        colTotals[wi * 3]     += vIn;
        colTotals[wi * 3 + 1] += vProc;
        colTotals[wi * 3 + 2] += vRev;
        const isCur = w === curWk;
        const bg    = isCur ? '#F4F8FC' : '#fff';
        return TD(vIn > 0 ? formatNumber(vIn) : '—', bg, vIn > 0 ? '#333' : '#C7C7CC')
             + TD(vProc > 0 ? formatNumber(vProc) : '—', bg, vProc > 0 ? (CONFIG.BIZ_COLORS[biz] || '#333') : '#C7C7CC')
             + TD(vRev > 0 ? '$' + formatNumber(Math.round(vRev)) : '—', bg, vRev > 0 ? '#1A6B3A' : '#C7C7CC');
      }).join('');
      colTotals[weeks.length * 3]     += rowIn;
      colTotals[weeks.length * 3 + 1] += rowProc;
      colTotals[weeks.length * 3 + 2] += rowRev;
      const totCells = TD(rowIn > 0 ? formatNumber(rowIn) : '—', SBG, rowIn > 0 ? '#1D1D1F' : '#C7C7CC', '600')
                     + TD(rowProc > 0 ? formatNumber(rowProc) : '—', SBG, rowProc > 0 ? '#1D1D1F' : '#C7C7CC', '600')
                     + TD(rowRev > 0 ? '$' + formatNumber(Math.round(rowRev)) : '—', SBG, rowRev > 0 ? '#1A6B3A' : '#C7C7CC', '600');
      return '<tr>' + TDL(CONFIG.BIZ_LABELS[biz] || biz) + cells + totCells + '</tr>';
    }).join('');

    // 합계 행
    const totalRow = '<tr>' + TDL('합계', SBG) + weeks.map(function(w, wi){
      const isCur = w === curWk;
      const bg    = isCur ? HBG2 : SBG;
      const v0 = colTotals[wi * 3], v1 = colTotals[wi * 3 + 1], v2 = colTotals[wi * 3 + 2];
      return TD(v0 > 0 ? formatNumber(v0) : '—', bg, v0 > 0 ? '#1D1D1F' : '#C7C7CC', '600')
           + TD(v1 > 0 ? formatNumber(v1) : '—', bg, v1 > 0 ? '#1D1D1F' : '#C7C7CC', '600')
           + TD(v2 > 0 ? '$' + formatNumber(Math.round(v2)) : '—', bg, v2 > 0 ? '#1A6B3A' : '#C7C7CC', '600');
    }).join('')
    + TD(colTotals[weeks.length * 3] > 0 ? formatNumber(colTotals[weeks.length * 3]) : '—', SBG, '#1D1D1F', '700')
    + TD(colTotals[weeks.length * 3 + 1] > 0 ? formatNumber(colTotals[weeks.length * 3 + 1]) : '—', SBG, '#1D1D1F', '700')
    + TD(colTotals[weeks.length * 3 + 2] > 0 ? '$' + formatNumber(Math.round(colTotals[weeks.length * 3 + 2])) : '—', SBG, '#1A6B3A', '700')
    + '</tr>';

    const body = bizList.length
      ? dataRows + totalRow
      : '<tr><td colspan="' + (weeks.length * 3 + 4) + '" style="padding:14px;text-align:center;font-size:12px;color:var(--tx3);border:1px solid ' + BD + '">' + month + '월 데이터 없음</td></tr>';

    return '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px">'
      + '<div style="font-size:14px;font-weight:600;color:var(--tx)">주간 보고 — ' + month + '월</div>'
      + '<div style="font-size:12px;color:var(--tx3)">사업별 입고/처리/매출 (2주 단위 보고)</div>'
      + '</div>'
      + '<div style="overflow-x:auto;margin-bottom:14px">'
      + '<table style="border-collapse:collapse;table-layout:auto;font-family:\'Pretendard\',-apple-system,sans-serif">'
      + '<thead><tr>' + TH('사업', 'width:100px') + weekHeader + '</tr>'
      + '<tr>' + TH('') + subHeader + '</tr></thead>'
      + '<tbody>' + body + '</tbody>'
      + '</table></div>';
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

    return '<div style="font-size:14px;font-weight:600;color:var(--tx);margin-bottom:8px">Active & Upcoming Job Orders <span style="font-size:12px;font-weight:400;color:var(--tx3);margin-left:4px">(진행중 · 입고예정 · 미수금)</span></div>'
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
        + _renderWeeklyTable()
        + _renderActiveTable(kpi.activeLots, kpi.dailies)
        + _renderShipments(kpi.upcomingShipments)
        + '</div>';
    },
  };

})();
