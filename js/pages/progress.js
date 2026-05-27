/**
 * pages/progress.js
 * LOT 진행 현황 통합 — LOT 등록 + 일별 처리 + 입고예정
 *
 * - 표 맨 위 빈 행: LOT 바로 등록
 * - 입고일이 미래: 자동으로 '입고예정' 상태
 * - 행 클릭: 아래에 처리 이력 + 새 기록 입력 펼쳐짐
 */

Pages.Progress = (() => {

  let _chart     = null;
  let _openLotId = null;
  let _viewMode  = 'table';            // 'table' | 'gantt'
  const _collapsedGroups = new Set();  // 간트 그룹 접힘 상태 (key: country_biz)

  // ── 상태 헬퍼 (입고예정 추가) ──────────────────────────────
  function _status(lot) {
    if (lot.inDate > today()) return 'upcoming';
    // 출고일이 입력되면 '출고완료'
    if (lot.shipDate) return 'shipped';
    const base = getLotStatus(lot); // done / overdue / inprog
    // 테스트 작업완료(done) → 출고 대기 단계 = '출고준비'
    if (base === 'done') return 'ready';
    return base;
  }

  const ST_LABEL = { upcoming: '입고예정', inprog: '진행중', overdue: '지연', ready: '출고준비', shipped: '출고완료' };
  const ST_STYLE = {
    upcoming: 'border:1px solid #999;color:#555;background:#F5F5F5',
    inprog:   'border:1px solid #8DCFBC;color:#0F6E56;background:#E8F5F0;font-weight:700',
    overdue:  'border:1px solid #F09595;color:#A32D2D;background:#FCEBEB;font-weight:700',
    ready:    'border:1px solid #F0C36D;color:#92400E;background:#FEF6E6;font-weight:700',
    shipped:  'border:1px solid #BFBFBF;color:#999;background:#F5F5F5',
  };
  const CO_STYLE  = { HK: 'border:1px solid #9DC3F0;color:#1B4F8A;background:#EBF2FB', SG: 'border:1px solid #8DCFBC;color:#0F6E56;background:#E8F5F0' };
  const BIZ_STYLE = { DRAM: 'border:1px solid #9DC3F0;color:#1B4F8A;background:#EBF2FB', SSD: 'border:1px solid #8DCFBC;color:#0F6E56;background:#E8F5F0', MID: 'border:1px solid #C4A8DC;color:#6A3D7C;background:#F3EEF8' };
  const BAR_COLOR = { upcoming: 'var(--tx3)', inprog: 'var(--tx2)', overdue: '#dc2626', ready: '#D97706', shipped: 'var(--tx)' };

  function _badge(text, style) {
    return `<span style="display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:1px 6px;border-radius:2px;white-space:nowrap;border:1px solid;${style}">${text}</span>`;
  }

  // ── 차트 ───────────────────────────────────────────────────
  function _toggleArrayFilter(key, value) {
    const cur = Store.getChartFilter()[key] || [];
    const next = cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value];
    Store.setChartFilter({ [key]: next });
    return next;
  }

  function setChartBiz(el) {
    const next = _toggleArrayFilter('biz', el.dataset.chartBiz);
    el.classList.toggle('on', next.includes(el.dataset.chartBiz));
    renderChart();
  }

  function setChartCountry(el) {
    document.querySelectorAll('[data-chart-co]').forEach(e => e.classList.remove('on'));
    el.classList.add('on');
    Store.setChartFilter({ country: el.dataset.chartCo });
    renderChart();
  }

  function setChartMetric(el) {
    const next = _toggleArrayFilter('metric', el.dataset.chartMetric);
    el.classList.toggle('on', next.includes(el.dataset.chartMetric));
    renderChart();
  }

  function setChartYear(el, year) {
    Store.setChartFilter({ year });
    document.querySelectorAll('[data-chart-year]').forEach(e => {
      const active = Number(e.dataset.chartYear) === year;
      e.style.background  = active ? 'var(--navy)' : 'none';
      e.style.color       = active ? '#fff' : 'var(--tx2)';
      e.style.borderColor = active ? 'var(--navy)' : 'var(--bd2)';
    });
    renderChart();
  }

  function initYearTabs() {
    const tabs = document.getElementById('chart-year-tabs'); if (!tabs) return;
    const curYear = new Date().getFullYear();
    const selYear = Store.getChartFilter().year;
    let html = '';
    for (let y = CONFIG.CHART_START_YEAR; y <= Math.max(curYear, CONFIG.CHART_START_YEAR); y++) {
      const active = y === selYear;
      html += `<button onclick="Pages.Progress.setChartYear(this,${y})" data-chart-year="${y}"
        style="padding:3px 12px;border-radius:20px;font-size:14px;font-weight:600;cursor:pointer;border:1.5px solid;transition:.15s;
        ${active ? 'background:var(--navy);color:#fff;border-color:var(--navy)' : 'background:none;color:var(--tx2);border-color:var(--bd2)'}">${y}년</button>`;
    }
    tabs.innerHTML = html;
  }

  function _monthValue(metric, biz, co, monthPrefix, lots, dailies) {
    if (metric === 'qty') {
      return lots
        .filter(l => l.biz === biz && l.country === co && String(l.inDate||'').startsWith(monthPrefix))
        .reduce((s, l) => s + parseNumber(l.qty), 0);
    }
    if (metric === 'backlog') {
      const lastDay = monthPrefix + '-31';
      const inflow = lots
        .filter(l => l.biz === biz && l.country === co && (l.inDate || '') <= lastDay)
        .reduce((s, l) => s + parseNumber(l.qty), 0);
      const outflow = dailies
        .filter(r => r.biz === biz && r.country === co && (r.date || '') <= lastDay)
        .reduce((s, r) => s + parseNumber(r.proc), 0);
      return Math.max(0, inflow - outflow);
    }
    // proc
    return dailies
      .filter(r => r.biz === biz && r.country === co && String(r.date||'').startsWith(monthPrefix))
      .reduce((s, r) => s + parseNumber(r.proc), 0);
  }

  const METRIC_LABEL = { qty: '입고', proc: '처리', backlog: '잔량' };
  const _patternCache = {};

  function _stripePattern(color) {
    if (_patternCache[color]) return _patternCache[color];
    const cv = document.createElement('canvas');
    cv.width = 10; cv.height = 10;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = color + '1A';
    ctx.fillRect(0, 0, 10, 10);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = -5; i <= 15; i += 5) {
      ctx.moveTo(i, -2);
      ctx.lineTo(i + 12, 12);
    }
    ctx.stroke();
    return _patternCache[color] = ctx.createPattern(cv, 'repeat');
  }

  function _datasetStyle(metric, color) {
    if (metric === 'qty')     return { backgroundColor: color, borderColor: color, borderWidth: 2 };
    if (metric === 'proc')    return { backgroundColor: _stripePattern(color), borderColor: color, borderWidth: 2 };
    return { backgroundColor: color + '00', borderColor: color, borderWidth: 2, borderDash: [4, 3] };
  }

  function renderChart() {
    const canvas = document.getElementById('monthly-chart'); if (!canvas) return;
    let { biz: bizArr = [], country: co = 'SG', year: chartYear, metric: metricArr = [] } = Store.getChartFilter();
    metricArr = metricArr.filter(m => m !== 'backlog');
    const lots    = Store.getLots();
    const dailies = Store.getDailies();
    const months  = [];
    for (let m = 1; m <= 12; m++) months.push(chartYear + '-' + String(m).padStart(2, '0'));
    const labels = months.map(m => m.slice(5) + '월');

    const datasets = [];
    bizArr.forEach(b => {
      metricArr.forEach(mt => {
        const color = CONFIG.BIZ_COLORS[b] || '#888';
        datasets.push({
          label: `${b} ${METRIC_LABEL[mt] || mt}`,
          data: months.map(m => _monthValue(mt, b, co, m, lots, dailies)),
          borderRadius: 3, borderSkipped: false,
          ..._datasetStyle(mt, color),
        });
      });
    });

    if (_chart) { _chart.destroy(); _chart = null; }
    const datalabelsPlugin = window.ChartDataLabels ? [window.ChartDataLabels] : [];
    _chart = new Chart(canvas, {
      type: 'bar', plugins: datalabelsPlugin,
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: datasets.length > 0, labels: { font:{size:11}, color:'#888', boxWidth:10, padding:12 } },
          tooltip: { mode:'index', intersect:false, callbacks:{ label: ctx => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw)}` } },
          datalabels: {
            display: ctx => { const v=ctx.dataset.data[ctx.dataIndex]; const all=ctx.chart.data.datasets.flatMap(d=>d.data); const mx=Math.max(...all); return v>0&&(mx===0||v/mx>0.04); },
            anchor:'end', align:'end', color:'#555', font:{size:10,weight:'600',family:'DM Mono,monospace'},
            formatter: v => v>0?formatNumber(v):'', offset:2, clip:false,
          },
        },
        scales: {
          x: { grid:{display:false}, ticks:{color:'#888',font:{size:11}} },
          y: { grid:{color:'rgba(0,0,0,0.06)'}, ticks:{color:'#888',font:{size:11},callback:v=>formatNumber(v)}, beginAtZero:true, grace:'15%' },
        },
        layout: { padding:{top:20} },
      },
    });

    // 요약 카드 (선택된 BIZ만, 선택된 국가 기준)
    const yearStr = String(chartYear);
    const curM    = currentMonth();
    const lots_co    = lots.filter(l => l.country === co);
    const dailies_co = dailies.filter(r => r.country === co);

    const items = bizArr.map(b => {
      const yearInflow  = lots_co.filter(l => l.biz===b && String(l.inDate||'').startsWith(yearStr)).reduce((s,l)=>s+parseNumber(l.qty), 0);
      const yearProc    = dailies_co.filter(r => r.biz===b && String(r.date||'').startsWith(yearStr)).reduce((s,r)=>s+parseNumber(r.proc), 0);
      const monthInflow = lots_co.filter(l => l.biz===b && String(l.inDate||'').startsWith(curM)).reduce((s,l)=>s+parseNumber(l.qty), 0);
      const monthProc   = dailies_co.filter(r => r.biz===b && String(r.date||'').startsWith(curM)).reduce((s,r)=>s+parseNumber(r.proc), 0);
      return { label: CONFIG.BIZ_LABELS[b], color: CONFIG.BIZ_COLORS[b], yearInflow, yearProc, monthInflow, monthProc };
    });

    const totEl = document.getElementById('monthly-totals');
    if (totEl) {
      if (!items.length) {
        totEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--tx3);font-size:12px;padding:16px">선택된 사업이 없습니다</div>';
        totEl.style.gridTemplateColumns = '1fr';
      } else {
        totEl.style.gridTemplateColumns = `repeat(${items.length},1fr)`;
        const cell = 'font-family:var(--font-mono);font-size:12px;text-align:right;padding:2px 0';
        const lab  = 'font-size:10px;color:var(--tx3);text-align:right;padding:2px 0';
        const row  = 'font-size:11px;color:var(--tx3);padding:2px 0';
        totEl.innerHTML = items.map(it => `
          <div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--rs);padding:8px 12px">
            <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:${it.color};margin-bottom:6px">${it.label}</div>
            <div style="display:grid;grid-template-columns:32px 1fr 1fr;column-gap:8px;align-items:baseline">
              <span></span><span style="${lab}">입고</span><span style="${lab}">처리</span>
              <span style="${row}">이달</span><span style="${cell};color:var(--tx);font-weight:600">${formatNumber(it.monthInflow)}</span><span style="${cell};color:var(--tx);font-weight:600">${formatNumber(it.monthProc)}</span>
              <span style="${row}">연간</span><span style="${cell};color:var(--tx2)">${formatNumber(it.yearInflow)}</span><span style="${cell};color:var(--tx2)">${formatNumber(it.yearProc)}</span>
            </div>
          </div>`).join('');
      }
    }
  }

  // ── 필터 ───────────────────────────────────────────────────
  function setFilter(el, key) {
    const storeKey = key === 'biz' ? 'biz' : key === 'co' ? 'country' : 'status';
    Store.setLotFilter({ [storeKey]: el.dataset.v });
    document.querySelectorAll(`[data-k="${el.dataset.k}"]`).forEach(e => e.classList.remove('on'));
    el.classList.add('on');
    render();
  }

  // ── LOT 등록 (인라인 빈 행) ─────────────────────────────────
  function _newRowHTML() {
    const custs = Store.getCustomers();
    const custOpts = custs.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    const tdS = 'padding:3px 6px;background:var(--tbl-hd-bg);border-bottom:1px solid var(--tbl-hd-bd);vertical-align:middle';
    const inp = 'border:1px solid var(--tbl-wrap-bd);border-radius:4px;background:#fff;font-size:12px;color:var(--tx);font-family:Pretendard,-apple-system,sans-serif';
    return `
      <tr id="new-lot-row">
        <td style="${tdS};text-align:center;color:var(--tx2);font-size:14px;font-weight:400">+</td>
        <td style="${tdS}">
          <select id="nl-co" style="${inp};width:100%;padding:2px 3px">
            <option value="HK">HK</option><option value="SG">SG</option>
          </select>
        </td>
        <td style="${tdS}">
          <select id="nl-biz" style="${inp};width:100%;padding:2px 3px">
            <option value="DRAM">DRAM</option><option value="SSD">SSD</option><option value="MID">MID</option><option value="SCR">Scrap 자재</option><option value="RMA">RMA</option><option value="SUS">Sustainability</option><option value="MOD">모듈 세일즈</option>
          </select>
        </td>
        <td style="${tdS}">
          <input id="nl-lot" placeholder="LOT 번호" style="${inp};width:100%;padding:3px 6px;font-family:var(--font-mono)">
        </td>
        <td style="${tdS}">
          <select id="nl-cust" style="${inp};width:100%;padding:2px 3px" onchange="if(this.value==='__manual__'){document.getElementById('nl-cust-manual').style.display='block'}else{document.getElementById('nl-cust-manual').style.display='none'}">
            <option value="">-- 고객사 --</option>${custOpts}<option value="__manual__">직접 입력...</option>
          </select>
          <input id="nl-cust-manual" placeholder="직접 입력" style="display:none;${inp};width:100%;padding:2px 5px;margin-top:2px">
        </td>
        <td style="${tdS}">
          <input id="nl-qty" type="number" placeholder="수량" min="0" style="${inp};width:100%;padding:3px 6px;text-align:right">
        </td>
        <td style="${tdS};color:var(--tx3);font-size:14px;text-align:right">—</td>
        <td style="${tdS};color:var(--tx3);font-size:14px">—</td>
        <td style="${tdS}">
          <input id="nl-indate" type="date" style="${inp};width:100%;padding:3px 5px" onchange="Pages.Progress.calcNewTgt()">
        </td>
        <td style="${tdS}">
          <input id="nl-tgt" type="date" style="${inp};width:100%;padding:3px 5px">
        </td>
        <td style="${tdS}"></td>
        <td style="${tdS}"></td>
        <td style="${tdS}">
          <button onclick="Pages.Progress.saveLot()" style="width:100%;padding:4px 4px;background:var(--tx);color:#fff;border:none;border-radius:var(--rs);font-size:12px;font-weight:600;cursor:pointer">+ 등록</button>
          <span id="nl-ok" style="display:none;font-size:13px;color:#3B6D11;font-weight:500">✓</span>
        </td>
        <td style="${tdS}"></td>
      </tr>`;
  }

  function handleNewCust(el) {
    const sel = document.getElementById('nl-cust');
    if (sel && sel.value === '__manual__') sel.value = '';
  }

  function calcNewTgt() {
    const d = document.getElementById('nl-indate')?.value;
    if (d) { const tgt = document.getElementById('nl-tgt'); if (tgt) tgt.value = addDays(d, CONFIG.LOT_DEFAULT_TARGET_DAYS); }
  }

  async function saveLot() {
    const lotNo  = document.getElementById('nl-lot')?.value.trim();
    const qty    = parseNumber(document.getElementById('nl-qty')?.value);
    const inDate = document.getElementById('nl-indate')?.value;
    if (!lotNo || !qty || !inDate) { UI.toast('LOT 번호, 입고일, 수량은 필수입니다', true); return; }

    const sel    = document.getElementById('nl-cust');
    const manual = document.getElementById('nl-cust-manual');
    const custName = sel?.value === '__manual__' ? manual?.value.trim() : sel?.value || '';

    const record = {
      id: Date.now(), biz: document.getElementById('nl-biz')?.value || 'DRAM',
      country: document.getElementById('nl-co')?.value || 'HK',
      customerName: custName, lotNo,
      inDate, targetDate: document.getElementById('nl-tgt')?.value || addDays(inDate, CONFIG.LOT_DEFAULT_TARGET_DAYS),
      qty, unit: '개', price: 0, currency: 'USD', product: '', note: '', done: '0', actualDone: '', shipDate: '',
    };

    const regBtn = document.querySelector('#new-lot-row button');
    if (regBtn) { regBtn.disabled = true; regBtn.textContent = '등록 중...'; }

    const result = await Api.appendNow(CONFIG.SHEETS.LOTS, record);

    if (regBtn) { regBtn.disabled = false; regBtn.textContent = '+ 등록'; }

    if (!result.success) return;

    Store.upsertLot(record);
    const ok = document.getElementById('nl-ok');
    if (ok) { ok.style.display = 'inline'; setTimeout(() => ok.style.display = 'none', 1500); }
    ['nl-lot','nl-qty','nl-indate','nl-tgt'].forEach(id => { const e=document.getElementById(id); if(e) e.value=''; });
    if (sel) sel.selectedIndex = 0;
    UI.toast(lotNo + ' 등록됨');
    render();
    Api.log('LOT', '등록', record.lotNo || String(record.id), `${CONFIG.BIZ_LABELS[record.biz]||record.biz} · ${CONFIG.COUNTRY_LABELS[record.country]||record.country} · ${record.customerName||''} · ${record.qty}개 · 입고 ${record.inDate}`);
  }

  // ── 현재 진행 중 요약 (싱가포르 / 홍콩) ───────────────────
  function _renderActiveSummary() {
    const el = document.getElementById('pr-active-summary'); if (!el) return;
    const allLots = Store.getLots();
    const BIZ = ['DRAM', 'SSD', 'MID'];
    const COS = [
      { code: 'SG', label: '싱가포르' },
      { code: 'HK', label: '홍콩' },
    ];

    const cards = COS.map(co => {
      const lotsCo = allLots.filter(l => l.country === co.code && _status(l) === 'inprog');
      const total  = lotsCo.length;
      const counts = BIZ.map(b => ({ biz: b, n: lotsCo.filter(l => l.biz === b).length }));
      const items  = counts.map(c => `
        <div style="display:flex;align-items:baseline;gap:6px">
          <span style="font-size:11px;font-weight:700;color:${CONFIG.BIZ_COLORS[c.biz]};letter-spacing:.04em">${c.biz}</span>
          <span style="font-family:var(--font-mono);font-size:16px;font-weight:600;color:${c.n>0?'var(--tx)':'var(--tx3)'}">${c.n}</span>
          <span style="font-size:11px;color:var(--tx3)">건</span>
        </div>`).join('');
      return `
        <div style="background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:14px 18px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
            <span style="font-size:13px;font-weight:600;color:var(--tx)">${co.label}</span>
            <span><span style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:var(--tx)">${total}</span><span style="font-size:11px;color:var(--tx3);margin-left:3px">건 진행 중</span></span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(${BIZ.length},1fr);gap:8px">${items}</div>
        </div>`;
    }).join('');

    el.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${cards}</div>`;
  }

  // ── 보기 모드 전환 ────────────────────────────────────────
  function setViewMode(mode) {
    if (mode !== 'table' && mode !== 'gantt') return;
    _viewMode = mode;
    _updateViewToggle();
    render();
  }

  function _updateViewToggle() {
    const tBtn = document.getElementById('pr-view-table');
    const gBtn = document.getElementById('pr-view-gantt');
    if (!tBtn || !gBtn) return;
    const on  = b => { b.style.background = '#1B3A6B'; b.style.color = '#fff'; };
    const off = b => { b.style.background = '#fff';    b.style.color = 'var(--tx2)'; };
    if (_viewMode === 'gantt') { on(gBtn); off(tBtn); } else { on(tBtn); off(gBtn); }
  }

  function toggleGanttGroup(key) {
    if (_collapsedGroups.has(key)) _collapsedGroups.delete(key); else _collapsedGroups.add(key);
    render();
  }

  // ── 메인 렌더 ──────────────────────────────────────────────
  function render() {
    _renderActiveSummary();
    _updateViewToggle();
    const filter  = Store.getLotFilter();
    const dailies = Store.getDailies();
    let lots      = Store.getLots();

    if (filter.biz)     lots = lots.filter(l => l.biz === filter.biz);
    if (filter.country) lots = lots.filter(l => l.country === filter.country);
    if (filter.status) {
      lots = lots.filter(l => _status(l) === filter.status);
    }

    const cntEl = document.getElementById('pr-cnt');
    if (cntEl) cntEl.textContent = lots.length + '건';

    const el = document.getElementById('pr-cards'); if (!el) return;

    if (_viewMode === 'gantt') {
      el.innerHTML = _renderGantt(lots, dailies);
      return;
    }

    lots.sort((a, b) => String(b.inDate||'').localeCompare(String(a.inDate||'')));

    const TH = (label, align='center', extra='') =>
      `<th style="${extra}">${label}</th>`;

    const rows = lots.map(lot => {
      if (!lot?.id) return '';
      const st    = _status(lot);
      const cum   = st === 'upcoming' ? 0 : getLotCumulative(lot.id, dailies);
      const qty   = parseNumber(lot.qty);
      const rem   = Math.max(0, qty - cum);
      const pct   = (qty > 0 && st !== 'upcoming') ? Math.min(100, Math.round(cum/qty*100)) : 0;
      const dd    = lot.targetDate ? diffDays(today(), lot.targetDate) : null;
      const pctColor  = st==='overdue'?'#dc2626': st==='shipped'?'#C7C7CC': st==='ready'?'#1A6B3A': pct>=80?'#EF9F27':'var(--tx2)';
      const barColor  = BAR_COLOR[st] || 'var(--tx2)';
      const isOpen    = _openLotId === lot.id;

      const rowIdx = lots.indexOf(lot);
      const evenBg = rowIdx % 2 === 1 ? '#F2F2F2' : '#fff';
      const statusBg =
        st==='shipped' ? 'opacity:0.6' :
        st==='ready'   ? 'background:#FFFBF0 !important' :
        st==='overdue' ? 'background:#FFF5F5 !important' :
        st==='inprog'  ? 'background:#F5F9FF !important' : '';
      const rowBold = st==='inprog' || st==='overdue';

      const lotRow = `
        <tr class="lot-data-row" onclick="Pages.Progress.toggleCard(${lot.id})" style="cursor:pointer;${statusBg};${
          st==='overdue' ? 'border-left:3px solid #E24B4A' :
          st==='inprog'  ? 'border-left:3px solid #378ADD' : ''
        }">
          <td class="td-c" style="color:#888;width:30px">
            <svg width="10" height="10" fill="none" viewBox="0 0 16 16" style="transition:transform .2s;transform:${isOpen?'rotate(180deg)':'rotate(0)'}"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </td>
          <td class="td-c">${_badge(lot.country, CO_STYLE[lot.country]||'')}</td>
          <td class="td-c">${_badge(lot.biz, BIZ_STYLE[lot.biz]||'')}</td>
          <td class="td-l td-ellipsis" style="font-family:'DM Mono',monospace;font-weight:${rowBold?'600':'400'};color:#000">${lot.lotNo||lot.id}</td>
          <td class="td-l td-ellipsis" style="color:#000;font-weight:${rowBold?'600':'400'}">${lot.customerName||'—'}</td>
          <td class="td-num" style="font-weight:${rowBold?'600':'400'};color:#000">${formatNumber(qty)}</td>
          <td class="td-num" style="color:#000">${st==='upcoming'?'—':formatNumber(cum)}</td>
          <td class="td-c">
            ${st==='upcoming'
              ? `<span style="font-size:11px;color:#888">입고예정</span>`
              : `<div style="display:flex;align-items:center;gap:3px;justify-content:center">
                  <div style="width:34px;height:5px;background:#E0E0E0;flex-shrink:0"><div style="height:100%;background:${barColor};width:${pct}%"></div></div>
                  <span style="font-size:11px;color:#000">${pct}%</span>
                </div>`}
          </td>
          <td class="td-c" style="color:#000;font-weight:${rowBold?'600':'400'}">${lot.inDate||'—'}</td>
          <td class="td-c" style="color:${st==='overdue'?'#A32D2D':(st==='ready'||st==='shipped')?'#999':'#000'};font-weight:${st==='overdue'?'700':rowBold?'600':'400'}">
            ${lot.targetDate||'—'}${st!=='ready'&&st!=='shipped'&&dd!==null?`<span style="font-size:10px;margin-left:3px;color:${dd<0?'#A32D2D':dd<=3?'#92400e':'#888'}">(${dd<0?'D+'+Math.abs(dd):'D-'+dd})</span>`:''}
          </td>
          <td class="td-c" style="color:${(st==='ready'||st==='shipped')?'#1A6B3A':'#999'};font-weight:${(st==='ready'||st==='shipped')?'600':'400'}">${(st==='ready'||st==='shipped')?(lot.actualDone||'—'):'—'}</td>
          <td class="td-c" onclick="event.stopPropagation()">
            ${st==='shipped'
              ? `<span style="color:#1A6B3A;font-weight:600">${lot.shipDate}</span>`
              : st==='ready'
                ? `<input type="date" onchange="Pages.Progress.setShipDate(${lot.id},this.value)" title="출고일을 입력하면 출고완료로 처리됩니다" style="width:100%;padding:2px 4px;border:1px solid #E0A93D;border-radius:3px;background:#FEF6E6;font-size:11px;color:var(--tx);font-family:'Pretendard',sans-serif">`
                : '—'}
          </td>
          <td class="td-c">${_badge(ST_LABEL[st], ST_STYLE[st]||'')}</td>
          <td class="td-c">
            <div style="display:flex;flex-direction:column;gap:3px;align-items:center">
              <button style="font-size:11px;padding:2px 10px;border:1px solid #CCC;border-radius:2px;background:#fff;cursor:pointer;font-family:'Pretendard',sans-serif;width:100%" onclick="event.stopPropagation();Pages.Progress.openEditPanel(${lot.id})">수정</button>
              <button style="font-size:11px;padding:2px 10px;border:1px solid #CCC;border-radius:2px;background:#fff;cursor:pointer;font-family:'Pretendard',sans-serif;color:#A32D2D;width:100%" onclick="event.stopPropagation();Pages.Progress.deleteLot(${lot.id})">삭제</button>
            </div>
          </td>
        </tr>`;

      const expandRow = isOpen ? `
        <tr><td colspan="14" style="padding:0;border-bottom:1px solid var(--bd)">
          ${_renderExpand(lot, dailies)}
        </td></tr>` : '';

      return lotRow + expandRow;
    }).join('');

    el.innerHTML = `
      <div class="page-wrap">
      <div class="page-card" style="padding:0;overflow:hidden">
        <table class="std-table" style="font-family:'Pretendard',-apple-system,sans-serif">
          <colgroup>
            <col style="width:30px">
            <col style="width:46px">
            <col style="width:50px">
            <col style="width:140px">
            <col style="width:60px">
            <col style="width:70px">
            <col style="width:70px">
            <col style="width:80px">
            <col style="width:92px">
            <col style="width:92px">
            <col style="width:92px">
            <col style="width:104px">
            <col style="width:72px">
            <col style="width:60px">
          </colgroup>
          <thead><tr>
            ${TH('')}${TH('지역')}${TH('사업')}${TH('LOT 번호')}${TH('고객사')}
            ${TH('수량','right')}${TH('처리','right')}
            ${TH('진행률')}
            ${TH('입고일')}${TH('완료예정일')}${TH('작업완료일')}${TH('출고일')}${TH('상태')}${TH('수정/삭제')}
          </tr></thead>
          <tbody>
            ${_newRowHTML()}
            ${rows || '<tr><td colspan="14" class="td-c">LOT가 없습니다</td></tr>'}
          </tbody>
        </table>
      </div></div>`;
  }

  // ── 간트 차트 렌더 ─────────────────────────────────────────
  function _renderGantt(lotsArg, dailies) {
    const lots = [...lotsArg]
      .filter(l => l && l.inDate)
      .sort((a, b) => String(a.inDate||'').localeCompare(String(b.inDate||'')));

    if (!lots.length) {
      return `<div class="page-wrap"><div style="background:#fff;border:1px solid var(--bd);border-radius:14px;padding:64px;text-align:center;color:var(--tx3);font-size:13px">표시할 LOT가 없습니다</div></div>`;
    }

    // ── 시간 범위 ──
    const all = [];
    lots.forEach(l => {
      if (l.inDate)     all.push(l.inDate);
      if (l.targetDate) all.push(l.targetDate);
      if (l.actualDone) all.push(l.actualDone);
      if (l.shipDate)   all.push(l.shipDate);
    });
    all.push(today());
    all.sort();
    const minDate   = addDays(all[0], -3);
    const maxDate   = addDays(all[all.length - 1], 14);
    const totalDays = Math.max(1, diffDays(minDate, maxDate) + 1);

    const DAY_W   = 22;
    const LEFT_W  = 320;
    const ROW_H   = 38;
    const HEAD_H  = 46;
    const timelineW = totalDays * DAY_W;

    // ── 그룹화 (국가 → 사업) ──
    const groups = {};
    lots.forEach(l => {
      const c = l.country || '-';
      const b = l.biz     || '-';
      (groups[c] = groups[c] || {});
      (groups[c][b] = groups[c][b] || []).push(l);
    });

    // ── 헤더: 월 + 일 ──
    const monthSegs = [];
    let curM = minDate.slice(0,7);
    let curStart = 0;
    for (let i = 1; i < totalDays; i++) {
      const m = addDays(minDate, i).slice(0,7);
      if (m !== curM) {
        monthSegs.push({ month: curM, x: curStart * DAY_W, w: (i - curStart) * DAY_W });
        curM = m; curStart = i;
      }
    }
    monthSegs.push({ month: curM, x: curStart * DAY_W, w: (totalDays - curStart) * DAY_W });

    const monthsHtml = monthSegs.map(s => `
      <div style="position:absolute;left:${s.x}px;width:${s.w}px;top:0;height:22px;font-size:11px;font-weight:600;letter-spacing:.02em;color:#1B3A6B;display:flex;align-items:center;padding-left:8px;border-right:1px solid #E2E0DB;background:#FAFBFD">
        ${s.month}
      </div>`).join('');

    const todayStr = today();
    let daysHtml = '';
    for (let i = 0; i < totalDays; i++) {
      const d  = addDays(minDate, i);
      const wd = new Date(d.slice(0,4), Number(d.slice(5,7))-1, Number(d.slice(8,10))).getDay();
      const isWeekend = wd === 0 || wd === 6;
      const isToday   = d === todayStr;
      const num = d.slice(8,10);
      daysHtml += `<div style="position:absolute;left:${i*DAY_W}px;top:22px;width:${DAY_W}px;height:24px;font-size:10px;font-family:var(--font-mono);color:${isToday?'#fff':isWeekend?'#A8A49E':'#6B6762'};background:${isToday?'#1B3A6B':isWeekend?'#F7F7FA':'transparent'};display:flex;align-items:center;justify-content:center;border-right:1px solid #F2F2F7;${isToday?'border-radius:3px':''}">${num}</div>`;
    }

    const todayX = diffDays(minDate, todayStr) * DAY_W + DAY_W/2;

    // ── 행 ──
    let rowsHtml = '';
    let rowIdx = 0;
    const coKeys = Object.keys(groups).sort();
    coKeys.forEach(co => {
      const bizKeys = Object.keys(groups[co]).sort();
      bizKeys.forEach(biz => {
        const groupKey   = `${co}_${biz}`;
        const isCollapsed = _collapsedGroups.has(groupKey);
        const items = groups[co][biz];
        const bizColor = (CONFIG.BIZ_COLORS && CONFIG.BIZ_COLORS[biz]) || '#888';
        const coLabel  = (CONFIG.COUNTRY_LABELS && CONFIG.COUNTRY_LABELS[co]) || co;

        rowsHtml += `
          <div style="display:grid;grid-template-columns:${LEFT_W}px ${timelineW}px;background:#F5F7FB;border-bottom:1px solid #E2E0DB;cursor:pointer"
               onclick="Pages.Progress.toggleGanttGroup('${groupKey}')">
            <div style="position:sticky;left:0;background:#F5F7FB;padding:7px 14px;display:flex;align-items:center;gap:9px;z-index:2;border-right:1px solid #E2E0DB">
              <svg width="9" height="9" fill="none" viewBox="0 0 16 16" style="transition:transform .2s;transform:rotate(${isCollapsed?'-90deg':'0'})">
                <path d="M3 6l5 5 5-5" stroke="#1B3A6B" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span style="font-size:11px;font-weight:700;color:#1B3A6B;letter-spacing:.04em">${coLabel}</span>
              <span style="width:1px;height:10px;background:#D0CEC9"></span>
              <span style="font-size:11px;font-weight:700;color:${bizColor};letter-spacing:.04em">${biz}</span>
              <span style="margin-left:auto;font-size:10px;color:#A8A49E;font-family:var(--font-mono)">${items.length}</span>
            </div>
            <div></div>
          </div>`;

        if (isCollapsed) return;

        items.forEach(lot => {
          rowsHtml += _renderGanttRow(lot, dailies, minDate, DAY_W, LEFT_W, ROW_H, timelineW, rowIdx++);
        });
      });
    });

    // ── 오늘 라인 (바디 전체에 오버레이) ──
    const todayLineHtml = `
      <div style="position:absolute;left:${LEFT_W + todayX}px;top:0;bottom:0;width:0;border-left:1.5px dashed #F09595;pointer-events:none;z-index:1"></div>
      <div style="position:absolute;left:${LEFT_W + todayX - 14}px;top:-3px;width:28px;height:6px;background:#F09595;border-radius:3px;pointer-events:none;z-index:1"></div>`;

    // ── 범례 ──
    const legendHtml = `
      <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding:10px 18px;border-top:1px solid #E2E0DB;background:#FAFBFD;font-size:11px;color:#6B6762">
        <div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:14px;height:8px;background:#8DCFBC;border-radius:4px"></span>진행중</div>
        <div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:14px;height:8px;background:#F09595;border-radius:4px"></span>지연</div>
        <div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:14px;height:8px;background:#F0C36D;border-radius:4px"></span>출고준비</div>
        <div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:14px;height:8px;background:#8E8E93;border-radius:4px"></span>출고완료</div>
        <div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:14px;height:8px;background:#C7C7CC;border-radius:4px"></span>입고예정</div>
        <span style="width:1px;height:14px;background:#D0CEC9"></span>
        <div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;background:#1B3A6B;transform:rotate(45deg)"></span>입고</div>
        <div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;background:#1A6B3A;transform:rotate(45deg)"></span>완료</div>
        <div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;background:#6B6762;transform:rotate(45deg)"></span>출고</div>
        <div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:2px;height:12px;background:repeating-linear-gradient(to bottom,#6B6762 0 3px,transparent 3px 6px)"></span>완료예정</div>
        <div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:14px;height:2px;border-top:1.5px dashed #F09595"></span>오늘</div>
      </div>`;

    return `
      <div class="page-wrap">
        <div style="background:#fff;border:1px solid var(--bd);border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(27,58,107,0.04)">
          <div style="overflow-x:auto;overflow-y:visible">
            <div style="min-width:${LEFT_W + timelineW}px;position:relative">
              <!-- 헤더 -->
              <div style="display:grid;grid-template-columns:${LEFT_W}px ${timelineW}px;background:#fff;border-bottom:1px solid #D2D2D7;position:sticky;top:0;z-index:4">
                <div style="position:sticky;left:0;background:#fff;padding:0 14px;font-size:11px;font-weight:700;color:#1B3A6B;text-transform:uppercase;letter-spacing:.06em;z-index:3;border-right:1px solid #E2E0DB;display:flex;align-items:center;height:${HEAD_H}px">LOT 작업</div>
                <div style="position:relative;height:${HEAD_H}px;background:#FAFBFD">
                  ${monthsHtml}
                  ${daysHtml}
                </div>
              </div>
              <!-- 본문 -->
              <div style="position:relative">
                ${rowsHtml}
                ${todayLineHtml}
              </div>
            </div>
          </div>
          ${legendHtml}
        </div>
      </div>`;
  }

  function _renderGanttRow(lot, dailies, minDate, DAY_W, LEFT_W, ROW_H, timelineW, rowIdx) {
    const st  = _status(lot);
    const cum = st === 'upcoming' ? 0 : getLotCumulative(lot.id, dailies);
    const qty = parseNumber(lot.qty);
    const pct = (qty > 0 && st !== 'upcoming') ? Math.min(100, Math.round(cum/qty*100)) : 0;

    // 세련된 팔레트: 네이비/슬레이트/민트/코랄
    const PAL = {
      upcoming: { bg: '#EFEFF4', fg: '#C7C7CC', tx: '#8E8E93' },
      inprog:   { bg: '#E8F5F0', fg: '#8DCFBC', tx: '#0F6E56' },
      overdue:  { bg: '#FCEBEB', fg: '#F09595', tx: '#A32D2D' },
      ready:    { bg: '#FEF6E6', fg: '#F0C36D', tx: '#92400E' },
      shipped:  { bg: '#EFEFF4', fg: '#8E8E93', tx: '#6E6E73' },
    };
    const c = PAL[st] || PAL.upcoming;

    const startDate = lot.inDate;
    const endDate   = lot.shipDate || lot.actualDone || lot.targetDate || addDays(lot.inDate, 14);
    const startX    = diffDays(minDate, startDate) * DAY_W;
    const endX      = (diffDays(minDate, endDate) + 1) * DAY_W;
    const barW      = Math.max(DAY_W, endX - startX);
    const progressW = barW * pct / 100;

    // 마일스톤 (다이아몬드)
    const ms = [];
    if (lot.inDate)     ms.push({ x: diffDays(minDate, lot.inDate)     * DAY_W + DAY_W/2, color: '#1B3A6B', label: '입고', d: lot.inDate });
    if (lot.actualDone) ms.push({ x: diffDays(minDate, lot.actualDone) * DAY_W + DAY_W/2, color: '#1A6B3A', label: '완료', d: lot.actualDone });
    if (lot.shipDate)   ms.push({ x: diffDays(minDate, lot.shipDate)   * DAY_W + DAY_W/2, color: '#6B6762', label: '출고', d: lot.shipDate });
    const msHtml = ms.map(m => `
      <div title="${m.label} · ${m.d}" style="position:absolute;left:${m.x - 6}px;top:${ROW_H/2 - 6}px;width:12px;height:12px;background:${m.color};transform:rotate(45deg);box-shadow:0 0 0 1.5px #fff,0 0 0 2.5px ${m.color};z-index:3"></div>`).join('');

    const targetX = lot.targetDate ? diffDays(minDate, lot.targetDate) * DAY_W + DAY_W/2 : null;
    const targetHtml = targetX !== null ? `
      <div title="완료예정 · ${lot.targetDate}" style="position:absolute;left:${targetX - 1}px;top:8px;bottom:8px;width:2px;background:repeating-linear-gradient(to bottom,#6B6762 0 3px,transparent 3px 6px);z-index:2"></div>` : '';

    const bizColor = (CONFIG.BIZ_COLORS && CONFIG.BIZ_COLORS[lot.biz]) || '#888';
    const evenBg = rowIdx % 2 === 1 ? '#FBFBFC' : '#fff';
    const custLabel = lot.customerName || '—';
    const qtyLabel  = formatNumber(qty);

    // 바 위 라벨 (LOT번호 · 진행률) — 바가 충분히 넓을 때만
    const onBarLabel = barW > 80
      ? `<div style="position:absolute;left:${startX + 10}px;top:${ROW_H/2 - 7}px;font-size:10px;font-weight:700;font-family:var(--font-mono);color:${pct >= 50 ? '#fff' : c.tx};pointer-events:none;mix-blend-mode:${pct >= 50 ? 'normal' : 'normal'};white-space:nowrap">${pct}%</div>`
      : '';

    return `
      <div style="display:grid;grid-template-columns:${LEFT_W}px ${timelineW}px;background:${evenBg};border-bottom:1px solid #F2F2F7;transition:background .12s"
           onmouseover="this.style.background='#F7F9FC'" onmouseout="this.style.background='${evenBg}'"
           onclick="Pages.Progress.toggleCard(${lot.id})">
        <div style="position:sticky;left:0;background:inherit;padding:6px 12px 6px 30px;display:flex;flex-direction:column;justify-content:center;gap:2px;z-index:2;border-right:1px solid #E2E0DB;cursor:pointer;border-left:3px solid ${bizColor}">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:12px;font-weight:600;font-family:var(--font-mono);color:#111110;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px">${lot.lotNo || lot.id}</span>
            <span style="font-size:10px;font-weight:600;padding:1px 5px;border-radius:3px;background:${c.bg};color:${c.tx};border:1px solid ${c.fg}66">${ST_LABEL[st]}</span>
          </div>
          <div style="font-size:11px;color:#6B6762;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${custLabel} · ${qtyLabel}개</div>
        </div>
        <div style="position:relative;height:${ROW_H}px">
          <div style="position:absolute;left:${startX}px;top:${ROW_H/2 - 8}px;width:${barW}px;height:16px;background:${c.bg};border:1px solid ${c.fg}99;border-radius:8px"></div>
          ${pct > 0 ? `<div style="position:absolute;left:${startX}px;top:${ROW_H/2 - 8}px;width:${progressW}px;height:16px;background:${c.fg};border-radius:8px"></div>` : ''}
          ${onBarLabel}
          ${targetHtml}
          ${msHtml}
        </div>
      </div>`;
  }

  // ── 펼침 영역 (처리 이력 + 입력) ───────────────────────────
  function _renderExpand(lot, dailies) {
    const isDram = lot.biz === 'DRAM';
    const cum    = getLotCumulative(lot.id, dailies);
    const hist   = dailies.filter(r => String(r.lotId)===String(lot.id)).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));

    const colGrid = isDram ? '90px 60px 60px 60px 70px 70px 70px 1fr 30px' : '90px 70px 70px 70px 1fr 30px';

    const histRows = hist.length === 0
      ? `<div style="font-size:13px;color:var(--tx3);padding:10px 0;text-align:center">처리 기록 없음</div>`
      : hist.map(r => {
          const tot = isDram ? (parseNumber(r.normal)+parseNumber(r.noBoot)+parseNumber(r.abnormal))||parseNumber(r.proc) : parseNumber(r.proc);
          return `<div style="display:grid;grid-template-columns:${colGrid};gap:6px;padding:5px 0;border-bottom:1px solid var(--bd);font-size:14px;align-items:center">
            <span style="font-family:var(--font-mono)">${r.date}</span>
            ${isDram?`<span style="font-family:var(--font-mono);color:var(--tx);text-align:right">${formatNumber(parseNumber(r.normal))}</span><span style="font-family:var(--font-mono);color:var(--tx2);text-align:right">${formatNumber(parseNumber(r.noBoot))}</span><span style="font-family:var(--font-mono);color:var(--tx2);text-align:right">${formatNumber(parseNumber(r.abnormal))}</span>`:''}
            <span style="font-family:var(--font-mono);font-weight:500;text-align:right">${formatNumber(tot)}</span>
            <span style="font-family:var(--font-mono);color:var(--tx2);text-align:right">${formatNumber(parseNumber(r.cumul))}</span>
            <span style="font-family:var(--font-mono);color:${parseNumber(r.remain)>0?'var(--tx3)':'var(--tx)'};text-align:right">${formatNumber(parseNumber(r.remain))}</span>
            <span style="font-size:13px;color:var(--tx3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.note||''}</span>
            <button class="btn del sm" style="padding:2px 6px;font-size:14px" onclick="Pages.Progress.deleteDaily(${r.id},${lot.id})">✕</button>
          </div>`;
        }).join('');

    const histHeader = `
      <div style="display:grid;grid-template-columns:${colGrid};gap:6px;padding:5px 0;border-bottom:1.5px solid var(--bd);font-size:13px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em">
        <span>날짜</span>${isDram?'<span style="text-align:right;color:#085041">Normal</span><span style="text-align:right;color:#633806">NoBoot</span><span style="text-align:right;color:#791F1F">Abnor.</span>':''}
        <span style="text-align:right">처리</span><span style="text-align:right">누적</span><span style="text-align:right">잔량</span><span>비고</span><span></span>
      </div>`;

    const remNow = Math.max(0, parseNumber(lot.qty) - cum);

    return `
      <div style="padding:14px 16px;background:var(--bg)">
        <div style="font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:.07em;color:var(--tx3);margin-bottom:8px">처리 이력 (${hist.length}건)</div>
        ${histHeader}${histRows}

        <div style="margin-top:14px;background:var(--card);border:1px solid var(--bd);border-radius:var(--rs);overflow:hidden">
          <!-- 탭 헤더 -->
          <div style="display:flex;border-bottom:1px solid var(--bd);background:var(--bg)">
            <button id="dp-tab-manual-${lot.id}" onclick="Pages.Progress.switchTab(${lot.id},'manual')"
              style="padding:9px 18px;font-size:13px;font-weight:500;border:none;background:var(--card);color:var(--tx);cursor:pointer;border-bottom:2px solid var(--navy)">
              직접 입력
            </button>
            <button id="dp-tab-paste-${lot.id}" onclick="Pages.Progress.switchTab(${lot.id},'paste')"
              style="padding:9px 18px;font-size:13px;font-weight:500;border:none;background:none;color:var(--tx3);cursor:pointer;border-bottom:2px solid transparent">
              붙여넣기
            </button>
          </div>

          <!-- 직접 입력 탭 -->
          <div id="dp-panel-manual-${lot.id}" style="padding:14px">

            <!-- 1행: 날짜 · 처리량 · 잔량 · 완료여부 -->
            <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px">
              <div class="fld" style="margin:0"><label style="font-size:11px">날짜</label>
                <input type="date" id="dp-date-${lot.id}" value="${today()}" style="width:130px;padding:5px 8px">
              </div>
              <div class="fld" style="margin:0"><label style="font-size:11px">처리량</label>
                <input type="number" id="dp-proc-${lot.id}" placeholder="0" min="0"
                  oninput="Pages.Progress.calcRem(${lot.id})"
                  style="width:80px;padding:5px 8px;text-align:right">
              </div>
              <div class="fld" style="margin:0"><label style="font-size:11px">잔량 (자동)</label>
                <input type="number" id="dp-rem-${lot.id}" readonly value="${remNow}"
                  style="width:80px;padding:5px 8px;text-align:right;color:var(--tx2);background:var(--bg)">
              </div>
              <div class="fld" style="margin:0"><label style="font-size:11px">완료 여부</label>
                <select id="dp-done-${lot.id}" style="width:90px;padding:5px 8px">
                  <option value="0">진행 중</option><option value="1">완료 처리</option>
                </select>
              </div>
            </div>

            <!-- 2행: DRAM 분류 (DRAM만) -->
            ${isDram?`
            <div style="margin-bottom:12px">
              <div style="font-size:11px;font-weight:600;color:var(--tx2);margin-bottom:6px">DRAM 분류 <span style="font-weight:400;color:var(--tx3)">(합계 자동계산)</span></div>
              <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
                <div class="fld" style="margin:0"><label style="font-size:11px;color:#1A7F37">Normal</label>
                  <input type="number" id="dp-normal-${lot.id}" placeholder="0" min="0"
                    oninput="Pages.Progress.calcDram(${lot.id})"
                    style="width:80px;padding:5px 8px;text-align:right;border-color:var(--bd);background:var(--bg)">
                </div>
                <div class="fld" style="margin:0"><label style="font-size:11px;color:#B45309">No Boot</label>
                  <input type="number" id="dp-noboot-${lot.id}" placeholder="0" min="0"
                    oninput="Pages.Progress.calcDram(${lot.id})"
                    style="width:80px;padding:5px 8px;text-align:right;border-color:var(--bd);background:var(--bg)">
                </div>
                <div class="fld" style="margin:0"><label style="font-size:11px;color:#dc2626">Abnormal</label>
                  <input type="number" id="dp-abnormal-${lot.id}" placeholder="0" min="0"
                    oninput="Pages.Progress.calcDram(${lot.id})"
                    style="width:80px;padding:5px 8px;text-align:right;border-color:var(--bd);background:var(--bg)">
                </div>
                <div class="fld" style="margin:0"><label style="font-size:11px;color:var(--tx3)">합계 확인</label>
                  <div id="dp-dram-sum-${lot.id}"
                    style="width:80px;padding:5px 10px;border:1px solid var(--bd);border-radius:var(--rs);font-size:12px;text-align:right;background:var(--bg);color:var(--tx2);font-family:var(--font-mono)">0</div>
                </div>
              </div>
            </div>`:''}
            <!-- 3행: 비고 + 저장 -->
            <div style="display:flex;gap:10px;align-items:flex-end">
              <div class="fld" style="margin:0;flex:1"><label style="font-size:11px">비고</label>
                <input type="text" id="dp-note-${lot.id}" placeholder="이슈, 특이사항 등" style="width:100%;padding:5px 8px">
              </div>
              <button class="btn pri sm" onclick="Pages.Progress.saveDaily(${lot.id})" style="height:30px;white-space:nowrap">저장</button>
              <span id="dp-ok-${lot.id}" style="font-size:13px;color:#085041;display:none;font-weight:500;align-self:center">✓ 저장됨</span>
            </div>

          </div>

          <!-- 붙여넣기 탭 -->
          <div id="dp-panel-paste-${lot.id}" style="padding:14px;display:none">
            <div style="font-size:13px;color:var(--tx3);margin-bottom:8px">
              엑셀/표에서 헤더 포함해서 복사 후 붙여넣기 하세요.<br>
              <span style="color:var(--tx2);font-weight:500">날짜, 처리량, Normal, No Boot, Abnormal</span> 컬럼을 자동으로 인식합니다.
            </div>
            <textarea id="dp-paste-${lot.id}" placeholder="Date&#9;Qty&#9;Normal&#9;No Boot&#9;Abnormal
2026-03-18&#9;280&#9;210&#9;40&#9;30
2026-03-17&#9;320&#9;280&#9;25&#9;15"
              style="width:100%;height:130px;padding:9px 12px;border:1px solid var(--bd2);border-radius:var(--rs);font-size:13px;font-family:var(--font-mono);background:var(--bg);color:var(--tx);resize:vertical;line-height:1.6"></textarea>
            <div id="dp-paste-preview-${lot.id}" style="margin-top:10px;display:none"></div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <button class="btn sm" onclick="Pages.Progress.parsePaste(${lot.id})">데이터 확인</button>
              <button class="btn pri sm" id="dp-paste-save-${lot.id}" onclick="Pages.Progress.savePaste(${lot.id})" style="display:none">전체 저장</button>
              <span id="dp-paste-ok-${lot.id}" style="font-size:13px;color:#085041;display:none;font-weight:500;align-self:center">✓ 저장됨</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ── 토글 ───────────────────────────────────────────────────
  function toggleCard(lotId) {
    _openLotId = _openLotId === lotId ? null : lotId;
    render();
  }

  // ── DRAM 분류 자동 합산 ────────────────────────────────────
  function calcDram(lotId) {
    const nm = parseNumber(document.getElementById('dp-normal-'+lotId)?.value);
    const nb = parseNumber(document.getElementById('dp-noboot-'+lotId)?.value);
    const ab = parseNumber(document.getElementById('dp-abnormal-'+lotId)?.value);
    const total = nm + nb + ab;
    const el = document.getElementById('dp-proc-'+lotId);
    if (el) { el.value = total || ''; calcRem(lotId); }
    // 합계 확인 div 업데이트
    const sumEl = document.getElementById('dp-dram-sum-'+lotId);
    if (sumEl) {
      sumEl.textContent = total > 0 ? total.toLocaleString() : '0';
      sumEl.style.color = total > 0 ? 'var(--tx)' : 'var(--tx3)';
    }
  }

  function calcRem(lotId) {
    const lot = Store.getLotById(lotId); if (!lot) return;
    const cum  = getLotCumulative(lot.id, Store.getDailies());
    const proc = parseNumber(document.getElementById('dp-proc-'+lotId)?.value);
    const el   = document.getElementById('dp-rem-'+lotId);
    if (el) el.value = Math.max(0, parseNumber(lot.qty)-cum-proc);
  }

  // ── 일별 처리 저장 ─────────────────────────────────────────
  async function saveDaily(lotId) {
    const lot  = Store.getLotById(lotId); if (!lot) return;
    const date = document.getElementById('dp-date-'+lotId)?.value;
    const proc = parseNumber(document.getElementById('dp-proc-'+lotId)?.value);
    if (!date||!proc) { UI.toast('날짜와 처리량은 필수입니다', true); return; }

    const isDram   = lot.biz==='DRAM';
    const normal   = isDram ? parseNumber(document.getElementById('dp-normal-'+lotId)?.value)   : 0;
    const noBoot   = isDram ? parseNumber(document.getElementById('dp-noboot-'+lotId)?.value)   : 0;
    const abnormal = isDram ? parseNumber(document.getElementById('dp-abnormal-'+lotId)?.value) : 0;
    const cumNew   = getLotCumulative(lot.id, Store.getDailies()) + proc;
    const remNew   = Math.max(0, parseNumber(lot.qty)-cumNew);
    const isDone   = document.getElementById('dp-done-'+lotId)?.value==='1' || remNew===0;

    const record = { id:Date.now(), date, lotId:lot.id, lotNo:lot.lotNo||lot.id, biz:lot.biz, country:lot.country, customerName:lot.customerName||'', proc, normal, noBoot, abnormal, cumul:cumNew, remain:remNew, note:document.getElementById('dp-note-'+lotId)?.value||'', done:isDone?'1':'0' };

    // 저장 중 버튼 비활성화
    const saveBtn = document.querySelector(`[onclick="Pages.Progress.saveDaily(${lotId})"]`);
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '저장 중...'; }

    const result = await Api.appendNow(CONFIG.SHEETS.DAILY, record);

    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '저장'; }

    if (!result.success) return;

    Store.upsertDaily(record);
    if (isDone) {
      const upd = {...lot, done:'1', actualDone:date};
      Store.upsertLot(upd);
      Api.update(CONFIG.SHEETS.LOTS, lot.id, upd);
      UI.toast(lot.lotNo+' 완료!');
    }
    const ok = document.getElementById('dp-ok-'+lotId);
    if (ok) { ok.style.display='inline'; setTimeout(()=>ok.style.display='none',1500); }
    UI.toast('저장됨');
    render();
  }

  // ── 삭제 ───────────────────────────────────────────────────
  // ── LOT 삭제 확인 모달 ─────────────────────────────────────
  let _deleteLotId = null;

  function openDeleteModal(id) {
    const lot  = Store.getLotById(id); if (!lot) return;
    _deleteLotId = id;
    const nameEl = document.getElementById('lot-delete-name');
    if (nameEl) nameEl.textContent = lot.lotNo || lot.id;
    const modal = document.getElementById('lot-delete-modal');
    if (modal) { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
  }

  function cancelDelete() {
    _deleteLotId = null;
    const modal = document.getElementById('lot-delete-modal');
    if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
  }

  async function confirmDelete() {
    if (!_deleteLotId) return;
    const id  = _deleteLotId;
    const lot = Store.getLotById(id);
    cancelDelete();
    Store.deleteLot(id);
    if (_openLotId === id) _openLotId = null;
    render();
    UI.toast('삭제됨');
    Api.delete(CONFIG.SHEETS.LOTS, id);
    Api.log('LOT', '삭제', lot?.lotNo || String(id), `${CONFIG.BIZ_LABELS[lot?.biz]||lot?.biz||''} · ${CONFIG.COUNTRY_LABELS[lot?.country]||lot?.country||''} · ${lot?.customerName||''} LOT 삭제`);
  }

  async function deleteLot(id) {
    openDeleteModal(id);
  }

  async function deleteDaily(id, lotId) {
    if (!confirm('삭제하시겠습니까?')) return;
    const rec = Store.getDailies().find(d => String(d.id) === String(id));
    Store.deleteDaily(id);
    render();
    UI.toast('삭제됨');
    Api.delete(CONFIG.SHEETS.DAILY, id);
    Api.log('일별처리', '삭제', rec?.lotNo || String(lotId), `${rec?.date || ''} 처리 ${Number(rec?.proc||0).toLocaleString()}개${rec?.biz==='DRAM' ? ` (N:${Number(rec?.normal||0).toLocaleString()} / NB:${Number(rec?.noBoot||0).toLocaleString()} / AB:${Number(rec?.abnormal||0).toLocaleString()})` : ''} 삭제`);
  }

  // ── 엑셀 내보내기 ──────────────────────────────────────────
  function exportExcel() {
    const dailies = Store.getDailies();
    const lots    = Store.getLots();

    // ── 시트 ①: LOT 요약 ─────────────────────────────────
    const lotData = lots.map(l => ({
      'LOT번호':    l.lotNo || l.id,
      '사업':       CONFIG.BIZ_LABELS[l.biz] || l.biz,
      '국가':       CONFIG.COUNTRY_LABELS[l.country] || l.country,
      '고객사':     l.customerName || '',
      '입고일':     l.inDate || '',
      '목표완료일': l.targetDate || '',
      '작업완료일': l.actualDone || '',
      '출고일':     l.shipDate || '',
      '총수량':     parseNumber(l.qty),
      '누적처리':   getLotCumulative(l.id, dailies),
      '잔량':       getLotRemaining(l, dailies),
      '진행률(%)':  getLotProgress(l, dailies),
      '상태':       ST_LABEL[_status(l)] || '',
      '단가(USD)':  parseNumber(l.price),
      '통화':       l.currency || '',
    }));

    // ── 시트 ②: 일별 처리 이력 ───────────────────────────
    // LOT번호 기준 그룹화 → 날짜 오름차순
    const lotMap = {};
    lots.forEach(l => { lotMap[String(l.id)] = l; });

    const dailyData = [...dailies]
      .sort((a, b) => {
        const la = lotMap[String(a.lotId)]?.lotNo || a.lotNo || a.lotId || '';
        const lb = lotMap[String(b.lotId)]?.lotNo || b.lotNo || b.lotId || '';
        if (la !== lb) return String(la).localeCompare(String(lb));
        return String(a.date || '').localeCompare(String(b.date || ''));
      })
      .map(d => {
        const lot = lotMap[String(d.lotId)];
        return {
          'LOT번호':   lot?.lotNo || d.lotNo || d.lotId || '',
          '사업':      CONFIG.BIZ_LABELS[d.biz] || d.biz || '',
          '국가':      CONFIG.COUNTRY_LABELS[d.country] || d.country || '',
          '고객사':    d.customerName || lot?.customerName || '',
          '날짜':      d.date || '',
          '처리량':    parseNumber(d.proc),
          'Normal':    parseNumber(d.normal),
          'No Boot':   parseNumber(d.noBoot),
          'Abnormal':  parseNumber(d.abnormal),
          '누적':      parseNumber(d.cumul),
          '잔량':      parseNumber(d.remain),
          '비고':      d.note || '',
        };
      });

    if (!lotData.length && !dailyData.length) {
      UI.toast('데이터 없음', true);
      return;
    }

    // ── 멀티 시트 엑셀 생성 ──────────────────────────────
    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(lotData);
    XLSX.utils.book_append_sheet(wb, ws1, 'LOT 요약');

    if (dailyData.length) {
      const ws2 = XLSX.utils.json_to_sheet(dailyData);
      XLSX.utils.book_append_sheet(wb, ws2, '일별 처리 이력');
    }

    XLSX.writeFile(wb, 'LOT현황_' + today() + '.xlsx');
    UI.toast('다운로드 완료 — 시트 ' + (dailyData.length ? 2 : 1) + '개');
  }

  function currentMonth() { return new Date().toISOString().slice(0,7); }

  // ── LOT 수정 패널 ──────────────────────────────────────────
  let _editLotId = null;

  function openEditPanel(lotId) {
    const lot = Store.getLotById(lotId); if (!lot) return;
    _editLotId = lotId;

    document.getElementById('ep-lot').value          = lot.lotNo       || '';
    document.getElementById('ep-co').value           = lot.country     || 'HK';
    document.getElementById('ep-biz').value          = lot.biz         || 'DRAM';
    document.getElementById('ep-cust').value         = lot.customerName|| '';
    document.getElementById('ep-indate').value       = lot.inDate      || '';
    document.getElementById('ep-tgt').value          = lot.targetDate  || '';
    document.getElementById('ep-qty').value          = lot.qty         || '';
    document.getElementById('ep-price').value        = lot.price       || '';
    document.getElementById('ep-cur').value          = lot.currency    || 'USD';
    document.getElementById('ep-prod').value         = lot.product     || '';
    document.getElementById('ep-note').value         = lot.note        || '';
    document.getElementById('ep-done').value         = lot.done        || '0';
    document.getElementById('ep-actual-done').value  = lot.actualDone  || '';
    const epShip = document.getElementById('ep-ship-date');
    if (epShip) epShip.value = lot.shipDate || '';

    const ok = document.getElementById('ep-ok'); if (ok) ok.style.display = 'none';
    document.getElementById('lot-edit-panel').style.display   = 'block';
    document.getElementById('lot-edit-overlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  function closeEditPanel() {
    document.getElementById('lot-edit-panel').style.display   = 'none';
    document.getElementById('lot-edit-overlay').style.display = 'none';
    document.body.style.overflow = '';
    _editLotId = null;
  }

  function calcEditTgt() {
    const d = document.getElementById('ep-indate')?.value;
    if (d) { const el = document.getElementById('ep-tgt'); if (el && !el.value) el.value = addDays(d, CONFIG.LOT_DEFAULT_TARGET_DAYS); }
  }

  async function saveLotEdit() {
    const lot = Store.getLotById(_editLotId); if (!lot) return;
    const doneVal      = document.getElementById('ep-done')?.value || '0';
    const actualDone   = document.getElementById('ep-actual-done')?.value || '';
    const updated = {
      ...lot,
      lotNo:        document.getElementById('ep-lot').value.trim()   || lot.lotNo,
      country:      document.getElementById('ep-co').value,
      biz:          document.getElementById('ep-biz').value,
      customerName: document.getElementById('ep-cust').value.trim(),
      inDate:       document.getElementById('ep-indate').value       || lot.inDate,
      targetDate:   document.getElementById('ep-tgt').value          || lot.targetDate,
      qty:          parseNumber(document.getElementById('ep-qty').value) || lot.qty,
      price:        parseNumber(document.getElementById('ep-price').value),
      currency:     document.getElementById('ep-cur').value,
      product:      document.getElementById('ep-prod').value.trim(),
      note:         document.getElementById('ep-note').value.trim(),
      done:         doneVal,
      actualDone:   doneVal === '1' ? (actualDone || today()) : actualDone,
      shipDate:     document.getElementById('ep-ship-date')?.value || '',
    };
    Store.upsertLot(updated);
    Api.update(CONFIG.SHEETS.LOTS, _editLotId, updated);
    Api.log('LOT', '수정', updated.lotNo || String(_editLotId), `${CONFIG.BIZ_LABELS[updated.biz]||updated.biz} 수정`);
    const ok = document.getElementById('ep-ok');
    if (ok) { ok.style.display = 'block'; setTimeout(() => { ok.style.display = 'none'; closeEditPanel(); }, 1000); }
    UI.toast('LOT 수정됨');
    render();
  }

  // ── 출고 처리 ──────────────────────────────────────────────
  // 출고준비(작업완료) LOT 의 출고일을 입력하면 '출고완료' 상태로 전환
  async function setShipDate(lotId, val) {
    const lot = Store.getLotById(lotId); if (!lot) return;
    if (!val) return;
    const updated = { ...lot, shipDate: val };
    Store.upsertLot(updated);
    Api.update(CONFIG.SHEETS.LOTS, lotId, updated);
    Api.log('LOT', '출고완료', updated.lotNo || String(lotId),
      `${val} 출고 — ${CONFIG.BIZ_LABELS[updated.biz]||updated.biz} · ${updated.customerName||''}`);
    UI.toast((updated.lotNo || lotId) + ' 출고완료 (' + val + ')');
    render();
  }

  // ── 탭 전환 ────────────────────────────────────────────────
  function switchTab(lotId, tab) {
    ['manual','paste'].forEach(t => {
      const btn   = document.getElementById(`dp-tab-${t}-${lotId}`);
      const panel = document.getElementById(`dp-panel-${t}-${lotId}`);
      if (!btn || !panel) return;
      const active = t === tab;
      btn.style.background    = active ? 'var(--card)' : 'transparent';
      btn.style.color         = active ? 'var(--tx)'   : 'var(--tx3)';
      btn.style.borderBottom  = active ? '2px solid var(--tx)' : '2px solid transparent';
      panel.style.display     = active ? 'block' : 'none';
    });
  }

  // ── 붙여넣기 파싱 ──────────────────────────────────────────
  function parsePaste(lotId) {
    const raw = document.getElementById('dp-paste-' + lotId)?.value.trim();
    if (!raw) { UI.toast('데이터를 붙여넣어 주세요', true); return; }

    const lines = raw.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) { UI.toast('헤더와 데이터 행이 필요합니다', true); return; }

    // 헤더 매핑 — 다양한 표현 허용
    const header = lines[0].split('\t').map(h => h.trim().toLowerCase());
    const COL = {
      date:     header.findIndex(h => /date|날짜|일자|day/.test(h)),
      proc:     header.findIndex(h => /qty|합계|total|처리량|proc|quantity|수량/.test(h)),
      normal:   header.findIndex(h => /normal|정상/.test(h)),
      noBoot:   header.findIndex(h => /no.?boot|noboot/.test(h)),
      abnormal: header.findIndex(h => /abnormal|불량|이상/.test(h)),
    };

    if (COL.date === -1) { UI.toast('날짜 컬럼을 찾을 수 없습니다 (Date, 날짜, 일자)', true); return; }

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t').map(c => c.trim());
      const dateVal = cols[COL.date] || '';
      if (!dateVal) continue;

      // 날짜 정규화
      let date = dateVal.replace(/\//g, '-');
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) { /* ok */ }
      else {
        const d = new Date(dateVal);
        if (!isNaN(d)) date = d.toISOString().split('T')[0];
        else continue;
      }

      const normal   = COL.normal   >= 0 ? parseNumber(cols[COL.normal])   : 0;
      const noBoot   = COL.noBoot   >= 0 ? parseNumber(cols[COL.noBoot])   : 0;
      const abnormal = COL.abnormal >= 0 ? parseNumber(cols[COL.abnormal]) : 0;
      const proc     = COL.proc >= 0
        ? parseNumber(cols[COL.proc])
        : (normal + noBoot + abnormal) || 0;

      if (!proc && !normal && !noBoot && !abnormal) continue;
      parsed.push({ date, proc, normal, noBoot, abnormal });
    }

    if (!parsed.length) { UI.toast('파싱된 데이터가 없습니다', true); return; }

    // 미리보기 렌더
    const previewEl = document.getElementById('dp-paste-preview-' + lotId);
    const saveBtn   = document.getElementById('dp-paste-save-' + lotId);
    if (!previewEl) return;

    const lot     = Store.getLotById(lotId);
    const isDram  = lot?.biz === 'DRAM';
    const dailies = Store.getDailies();
    const existing = new Set(dailies.filter(r => String(r.lotId) === String(lotId)).map(r => r.date));

    const rows = parsed.map(r => {
      const dup = existing.has(r.date);
      return `<tr style="${dup ? 'background:#FAEEDA' : ''}">
        <td style="padding:6px 10px;font-family:var(--font-mono);font-size:13px">${r.date}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:500">${formatNumber(r.proc)}</td>
        ${isDram ? `
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:#085041">${formatNumber(r.normal)}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:#633806">${formatNumber(r.noBoot)}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:#791F1F">${formatNumber(r.abnormal)}</td>
        ` : ''}
        <td style="padding:6px 10px;font-size:12px">${dup ? '<span style="border:1px solid var(--bd);color:var(--tx2);background:transparent;padding:1px 6px;border-radius:3px;font-size:12px">중복 (덮어씀)</span>' : ''}</td>
      </tr>`;
    }).join('');

    const thStyle = 'padding:7px 10px;text-align:left;font-size:12px;font-weight:600;color:var(--tx3);text-transform:uppercase;background:var(--tbl-hd-bg);border-bottom:1px solid var(--tbl-hd-bd)';
    previewEl.innerHTML = `
      <div style="font-size:13px;font-weight:500;color:var(--tx2);margin-bottom:6px">${parsed.length}건 인식됨 ${existing.size > 0 && parsed.some(r => existing.has(r.date)) ? '· <span style="color:#BA7517">노란색: 날짜 중복 (덮어쓰기)</span>' : ''}</div>
      <div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--rs);overflow:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr>
            <th style="${thStyle}">날짜</th>
            <th style="${thStyle};text-align:right">처리량</th>
            ${isDram ? `<th style="${thStyle};text-align:right;color:#085041">Normal</th><th style="${thStyle};text-align:right;color:#633806">No Boot</th><th style="${thStyle};text-align:right;color:#791F1F">Abnormal</th>` : ''}
            <th style="${thStyle}"></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    previewEl.style.display = 'block';
    previewEl.dataset.parsed = JSON.stringify(parsed);
    if (saveBtn) saveBtn.style.display = 'inline-block';
  }

  // ── 붙여넣기 일괄 저장 ─────────────────────────────────────
  async function savePaste(lotId) {
    const previewEl = document.getElementById('dp-paste-preview-' + lotId);
    if (!previewEl?.dataset.parsed) return;

    const parsed  = JSON.parse(previewEl.dataset.parsed);
    const lot     = Store.getLotById(lotId); if (!lot) return;
    const dailies = Store.getDailies();

    let cum = getLotCumulative(lot.id, dailies);
    let cnt = 0;

    // 날짜 오름차순으로 처리
    const sorted = [...parsed].sort((a, b) => a.date.localeCompare(b.date));

    for (const r of sorted) {
      // 중복이면 기존 삭제
      const dup = dailies.find(d => String(d.lotId) === String(lotId) && d.date === r.date);
      if (dup) {
        Store.deleteDaily(dup.id);
        Api.delete(CONFIG.SHEETS.DAILY, dup.id);
        cum -= parseNumber(dup.proc);
      }

      cum += r.proc;
      const remNew = Math.max(0, parseNumber(lot.qty) - cum);
      const record = {
        id: Date.now() + Math.random(),
        date: r.date, lotId: lot.id, lotNo: lot.lotNo || lot.id,
        biz: lot.biz, country: lot.country, customerName: lot.customerName || '',
        proc: r.proc, normal: r.normal, noBoot: r.noBoot, abnormal: r.abnormal,
        cumul: cum, remain: remNew, note: '', done: remNew === 0 ? '1' : '0',
      };
      Store.upsertDaily(record);
      await Api.append(CONFIG.SHEETS.DAILY, record);
      Api.log('일별처리', '등록', record.lotNo || String(record.lotId), `${record.date} 처리 ${Number(record.proc).toLocaleString()}개${record.biz==='DRAM' ? ` (N:${Number(record.normal).toLocaleString()} / NB:${Number(record.noBoot).toLocaleString()} / AB:${Number(record.abnormal).toLocaleString()})` : ''} | 누적 ${Number(record.cumul).toLocaleString()} / 잔여 ${Number(record.remain).toLocaleString()}`);
      cnt++;
    }

    const okEl = document.getElementById('dp-paste-ok-' + lotId);
    if (okEl) { okEl.style.display = 'inline'; setTimeout(() => okEl.style.display = 'none', 2000); }
    const saveBtn = document.getElementById('dp-paste-save-' + lotId);
    if (saveBtn) saveBtn.style.display = 'none';
    previewEl.style.display = 'none';
    previewEl.dataset.parsed = '';
    const pasteEl = document.getElementById('dp-paste-' + lotId);
    if (pasteEl) pasteEl.value = '';
    UI.toast(cnt + '건 저장됨');
    render();
  }

  return { render, renderChart, initYearTabs, setFilter, setChartBiz, setChartCountry, setChartMetric, setChartYear, toggleCard, calcDram, calcRem, saveLot, saveDaily, deleteLot, deleteDaily, handleNewCust, calcNewTgt, exportExcel, openEditPanel, closeEditPanel, calcEditTgt, saveLotEdit, setShipDate, switchTab, parsePaste, savePaste, openDeleteModal, cancelDelete, confirmDelete, setViewMode, toggleGanttGroup };

})();
