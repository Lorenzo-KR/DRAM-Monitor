/**
 * pages/dramPrice.js
 * DRAM Price Tracking (TrendForce)
 *
 * 4개 시트를 각각 독립 섹션으로 표시 (차트 + 표)
 * 시트별로 컬럼 구조가 다르므로 SHEETS 설정에서 각각 정의
 */
Pages.DramPrice = (() => {

  // 시트별 설정: sheet(시트명), cols(표시할 컬럼), avgCol(차트 기준 컬럼), chgCol(변화율 컬럼)
  const SHEETS = [
    {
      key: 'spot', label: 'DRAM Spot Price', color: '#1B4F8A', sheet: 'spot_prices',
      cols:   ['Daily High', 'Daily Low', 'Session High', 'Session Low', 'Session Average', 'Session Change'],
      avgCol: 'Session Average',
      chgCol: 'Session Change',
    },
    {
      key: 'contract', label: 'DRAM Contract Price', color: '#0F6E56', sheet: 'contract_prices',
      cols:   ['Session High', 'Session Low', 'Session Average', 'Average Change', 'Low Change'],
      avgCol: 'Session Average',
      chgCol: 'Average Change',
    },
    {
      key: 'module', label: 'Module Spot Price', color: '#6A3D7C', sheet: 'module_prices',
      cols:   ['Weekly High', 'Weekly Low', 'Session High', 'Session Low', 'Session Average', 'Average Change'],
      avgCol: 'Session Average',
      chgCol: 'Average Change',
    },
    {
      key: 'gddr', label: 'GDDR Spot Price', color: '#B45309', sheet: 'gddr_prices',
      cols:   ['Weekly High', 'Weekly Low', 'Session High', 'Session Low', 'Session Average', 'Average Change'],
      avgCol: 'Session Average',
      chgCol: 'Average Change',
    },
  ];

  const COLORS = [
    '#1B4F8A','#0F6E56','#6A3D7C','#B45309','#0C6B8A',
    '#2D7D46','#8B3A3A','#555','#C05621','#1A6B3A',
  ];

  // 섹션별 상태 (제품 필터 + 차트 인스턴스)
  let _data  = {};   // { spot: [{Date, Item, 'Daily High', ...}, ...], ... }
  let _state = {};   // { spot: { selProds: Set, chart: null }, ... }

  SHEETS.forEach(s => {
    _data[s.key]  = [];
    _state[s.key] = { selProds: new Set(), chart: null };
  });

  // ── 데이터 fetch ───────────────────────────────────────────
  async function _fetchSheet(sheetName) {
    try {
      const res  = await fetch(`${CONFIG.API_URL}?action=getDramPrices&sheet=${encodeURIComponent(sheetName)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json || json.error) throw new Error(json?.error || 'unknown error');
      return Array.isArray(json) ? json.filter(r => r['Date']) : [];
    } catch (e) {
      console.warn(`[DramPrice] fetch(${sheetName}) 오류:`, e.message);
      return [];
    }
  }

  // ── 숫자 파싱 ───────────────────────────────────────────────
  const pn = s => {
    const n = parseFloat(String(s || '').replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? null : n;
  };

  // ── 변화율 색상 ─────────────────────────────────────────────
  const chgColor = s =>
    s && s.includes('▲') ? '#1A6B3A' :
    s && s.includes('▼') ? '#A32D2D' : '#555';

  // ── 차트 렌더 ──────────────────────────────────────────────
  function _renderChart(cfg) {
    const state  = _state[cfg.key];
    const rows   = _data[cfg.key];
    const canvas = document.getElementById(`dp-chart-${cfg.key}`);
    if (!canvas) return;

    if (state.chart) { state.chart.destroy(); state.chart = null; }

    const filtered = state.selProds.size > 0
      ? rows.filter(r => state.selProds.has(r['Item']))
      : rows;

    if (!filtered.length) return;

    const items  = [...new Set(filtered.map(r => r['Item']).filter(Boolean))];
    const byDate = {};
    filtered.forEach(r => {
      const d = r['Date'], item = r['Item'];
      if (!d || !item) return;
      if (!byDate[d]) byDate[d] = {};
      byDate[d][item] = pn(r[cfg.avgCol]);
    });

    const dates    = Object.keys(byDate).sort();
    const datasets = items.map((item, i) => ({
      label:           item,
      data:            dates.map(d => byDate[d][item] ?? null),
      borderColor:     COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + '18',
      tension:         0.3,
      pointRadius:     dates.length > 30 ? 2 : 4,
      spanGaps:        true,
    }));

    state.chart = new Chart(canvas, {
      type: 'line',
      data: { labels: dates, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { family: 'Pretendard', size: 11 }, boxWidth: 10, padding: 6 },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: $${ctx.parsed.y?.toFixed(3) ?? '—'}`,
            },
          },
        },
        scales: {
          x: { ticks: { font: { family: 'Pretendard', size: 11 }, maxTicksLimit: 12 }, grid: { color: '#F0F0F0' } },
          y: { ticks: { font: { family: 'Pretendard', size: 11 }, callback: v => '$' + v.toFixed(2) }, grid: { color: '#F0F0F0' } },
        },
      },
    });
  }

  // ── 제품 필터 버튼 ────────────────────────────────────────
  function _renderProdBtns(cfg) {
    const el = document.getElementById(`dp-prods-${cfg.key}`);
    if (!el) return;
    const items = [...new Set(_data[cfg.key].map(r => r['Item']).filter(Boolean))];
    const state = _state[cfg.key];
    el.innerHTML = items.map((p, i) => {
      const on = state.selProds.size === 0 || state.selProds.has(p);
      const c  = COLORS[i % COLORS.length];
      return `<button onclick="Pages.DramPrice.toggleProduct('${cfg.key}','${p.replace(/'/g, "\\'")}')"
        style="padding:2px 8px;border:1px solid ${c};border-radius:20px;font-size:11px;
               font-family:Pretendard,sans-serif;cursor:pointer;margin:2px 2px 2px 0;
               background:${on ? c : '#fff'};color:${on ? '#fff' : c}">${p}</button>`;
    }).join('');
  }

  // ── 데이터 표 ─────────────────────────────────────────────
  function _renderTable(cfg) {
    const el = document.getElementById(`dp-table-${cfg.key}`);
    if (!el) return;

    const state = _state[cfg.key];
    const rows  = (_data[cfg.key])
      .filter(r => state.selProds.size === 0 || state.selProds.has(r['Item']))
      .sort((a, b) => b['Date'].localeCompare(a['Date']))
      .slice(0, 200);

    if (!rows.length) {
      el.innerHTML = '<div style="padding:20px;text-align:center;color:#999;font-family:Pretendard,sans-serif;font-size:12px">데이터 없음</div>';
      return;
    }

    const FS  = "font-family:Pretendard,sans-serif;font-size:12px";
    const FM  = "font-family:'DM Mono',monospace;font-size:12px";
    const thS = `padding:6px 10px;text-align:center;${FS};font-weight:700;color:#222;background:#F0F0F0;border-bottom:2px solid #CCC;border-right:1px solid #DDD;white-space:nowrap`;
    const tdB = `padding:6px 10px;border-bottom:1px solid #E8E8E8;border-right:1px solid #E8E8E8`;

    const ths = ['날짜', 'Last Update', '제품', ...cfg.cols]
      .map(h => `<th style="${thS}">${h}</th>`).join('');

    const trs = rows.map((r, i) => {
      const dataCells = cfg.cols.map(col => {
        const v = r[col] || '—';
        if (col === cfg.chgCol) {
          return `<td style="${tdB};${FM};text-align:center;color:${chgColor(v)};font-weight:600">${v}</td>`;
        }
        if (col === cfg.avgCol) {
          return `<td style="${tdB};${FM};text-align:right;font-weight:600">${v}</td>`;
        }
        return `<td style="${tdB};${FM};text-align:right">${v}</td>`;
      }).join('');

      return `<tr style="${i % 2 === 1 ? 'background:#FAFAFA' : ''}">
        <td style="${tdB};${FS};color:#888;white-space:nowrap">${r['Date'] || '—'}</td>
        <td style="${tdB};color:#aaa;white-space:nowrap;font-size:10px;font-family:Pretendard,sans-serif">${r['Last Update'] || '—'}</td>
        <td style="${tdB};${FS};white-space:nowrap">${r['Item'] || '—'}</td>
        ${dataCells}
      </tr>`;
    }).join('');

    el.innerHTML = `<div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>${ths}</tr></thead>
        <tbody>${trs}</tbody>
      </table></div>`;
  }

  // ── 섹션 전체 업데이트 ────────────────────────────────────
  function _refreshSection(cfg) {
    _renderProdBtns(cfg);
    _renderChart(cfg);
    _renderTable(cfg);
  }

  // ── 섹션 HTML 빌드 ────────────────────────────────────────
  function _buildSectionHtml(cfg) {
    const rows      = _data[cfg.key];
    const lastRow   = rows.length ? [...rows].sort((a, b) => b['Date'].localeCompare(a['Date']))[0] : null;
    const lastUpdate = lastRow ? (lastRow['Last Update'] || lastRow['Date'] || '—') : '데이터 없음';
    const dayCount  = new Set(rows.map(r => r['Date'])).size;

    return `
      <div class="page-card" style="margin-bottom:16px">
        <!-- 섹션 헤더 -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="width:4px;height:20px;background:${cfg.color};border-radius:2px;display:inline-block"></span>
            <span style="font-size:14px;font-weight:700;font-family:Pretendard,sans-serif;color:var(--tx)">${cfg.label}</span>
            <span style="font-size:11px;color:#888;font-family:Pretendard,sans-serif">${dayCount}일 누적</span>
          </div>
          <span style="font-size:11px;color:#888;font-family:Pretendard,sans-serif">${lastUpdate}</span>
        </div>

        <!-- 제품 필터 -->
        <div id="dp-prods-${cfg.key}" style="margin-bottom:12px"></div>

        <!-- 차트 -->
        <div style="position:relative;height:280px;margin-bottom:16px">
          <canvas id="dp-chart-${cfg.key}"></canvas>
        </div>

        <!-- 표 -->
        <div style="border-top:1px solid #EBEBEB;padding-top:10px">
          <div style="font-size:11px;font-weight:600;color:#888;font-family:Pretendard,sans-serif;margin-bottom:6px">
            최근 200건
          </div>
          <div id="dp-table-${cfg.key}"></div>
        </div>
      </div>`;
  }

  // ── Public ────────────────────────────────────────────────
  return {

    toggleProduct(key, prod) {
      const state = _state[key];
      if (!state) return;
      if (state.selProds.has(prod)) state.selProds.delete(prod);
      else state.selProds.add(prod);
      const cfg = SHEETS.find(s => s.key === key);
      if (cfg) _refreshSection(cfg);
    },

    async render() {
      const el = document.getElementById('dp-root');
      if (!el) return;
      el.innerHTML = `<div class="page-wrap"><div style="padding:40px;text-align:center;color:#999;font-family:Pretendard,sans-serif">데이터 불러오는 중...</div></div>`;

      // 4개 시트 병렬 fetch
      const fetched = await Promise.all(SHEETS.map(s => _fetchSheet(s.sheet)));
      SHEETS.forEach((s, i) => { _data[s.key] = fetched[i]; });

      // 섹션 HTML 조립
      const sectionsHtml = SHEETS.map(s => _buildSectionHtml(s)).join('');

      el.innerHTML = `
        <div class="page-wrap">
          <div class="ph-row">
            <div class="ph">
              <h1>DRAM Price Tracking</h1>
              <p>TrendForce · 시트별 독립 업데이트 주기</p>
            </div>
          </div>
          ${sectionsHtml}
        </div>`;

      // 각 섹션 렌더 (setTimeout으로 canvas 생성 후)
      setTimeout(() => {
        SHEETS.forEach(cfg => _refreshSection(cfg));
      }, 50);
    },
  };
})();
