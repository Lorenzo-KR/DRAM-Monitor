/**
 * pages/dramPrice.js
 * DRAM Price Tracking (TrendForce)
 * 3개 카테고리: DRAM Spot / DRAM Contract / Module Spot
 * 컬럼: Date | Last Update | Category | Item |
 *        Daily High | Daily Low | Session High | Session Low |
 *        Session Average | Session Change | Source
 */
Pages.DramPrice = (() => {

  const SHEET_MAP = {
    spot:     'spot_prices',
    contract: 'contract_prices',
    module:   'module_prices',
  };

  const CATEGORIES = [
    { key: 'all',      label: '전체',          color: '#1D1D1F' },
    { key: 'spot',     label: 'DRAM Spot',     color: '#1B4F8A' },
    { key: 'contract', label: 'DRAM Contract', color: '#0F6E56' },
    { key: 'module',   label: 'Module Spot',   color: '#6A3D7C' },
  ];

  const COLORS = [
    '#1B4F8A','#0F6E56','#6A3D7C','#B45309','#0C6B8A',
    '#2D7D46','#8B3A3A','#555','#C05621','#1A6B3A','#7B3F00','#003366',
  ];

  // 컬럼 인덱스: Date | Last Update | Category | Item | Daily High | Daily Low | Session High | Session Low | Session Average | Session Change | Source
  const C = { date:0, lastUpdate:1, cat:2, item:3, dHigh:4, dLow:5, sHigh:6, sLow:7, sAvg:8, sChg:9 };

  let _allData  = { spot: [], contract: [], module: [] };
  let _selCat   = 'all';
  let _selProds = new Set();
  let _metric   = 'avg';
  let _chart    = null;

  const pn = s => { const n = parseFloat(String(s||'').replace(/[^0-9.-]/g,'')); return isNaN(n) ? null : n; };

  // ── 단일 시트 fetch (GAS getAll action 사용) ──────────────
  async function _fetchSheet(sheetName) {
    try {
      const token = Auth.getToken();
      const url   = `${CONFIG.API_URL}?action=getAll&sheet=${encodeURIComponent(sheetName)}&token=${encodeURIComponent(token)}`;
      const res   = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json  = await res.json();
      if (!json || json.error) throw new Error(json?.error || 'unknown');

      // GAS getAll 응답 구조: { headers:[], rows:[[],[],…] } 또는 배열
      let rawRows = [];
      if (Array.isArray(json)) {
        // 배열 형태 (getDramPrices 스타일)
        const KEYS = ['Date','Last Update','Category','Item',
                      'Daily High','Daily Low','Session High','Session Low',
                      'Session Average','Session Change','Source'];
        rawRows = json.map(obj => KEYS.map(k => obj[k] || ''));
      } else if (json.rows) {
        // { headers, rows } 형태
        const hdrs = json.headers || [];
        rawRows = (json.rows || []).map(row => {
          // 헤더 순서에 맞게 재배열 → C 인덱스 기준으로
          const KEYS = ['Date','Last Update','Category','Item',
                        'Daily High','Daily Low','Session High','Session Low',
                        'Session Average','Session Change','Source'];
          return KEYS.map(k => {
            const hi = hdrs.indexOf(k);
            return hi >= 0 ? (row[hi] || '') : '';
          });
        });
      }
      return rawRows.filter(r => r[C.date]);
    } catch (e) {
      console.warn(`[DramPrice] fetchSheet(${sheetName}) error:`, e.message);
      return [];
    }
  }

  // ── 현재 카테고리 rows ────────────────────────────────────
  function _currentRows() {
    if (_selCat === 'all') {
      return [
        ..._allData.spot,
        ..._allData.contract,
        ..._allData.module,
      ];
    }
    return _allData[_selCat] || [];
  }

  function _getItems(rows) {
    return [...new Set(rows.map(r => r[C.item]).filter(Boolean))];
  }

  // ── 차트 ──────────────────────────────────────────────────
  function _buildChart(rows) {
    const items    = _getItems(rows);
    const filtered = items.filter(i => _selProds.size === 0 || _selProds.has(i));
    const byDate   = {};
    rows.forEach(r => {
      const d = r[C.date], item = r[C.item];
      if (!byDate[d]) byDate[d] = {};
      byDate[d][item] = _metric === 'high' ? pn(r[C.dHigh])
                      : _metric === 'low'  ? pn(r[C.dLow])
                      :                      pn(r[C.sAvg]);
    });
    const dates    = Object.keys(byDate).sort();
    const datasets = filtered.map((item, i) => ({
      label:           item,
      data:            dates.map(d => byDate[d][item] ?? null),
      borderColor:     COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + '18',
      tension: 0.3, pointRadius: dates.length > 30 ? 2 : 4, spanGaps: true,
    }));
    return { labels: dates, datasets };
  }

  function _refreshChart() {
    const canvas = document.getElementById('dp-chart');
    if (!canvas) return;
    if (_chart) { _chart.destroy(); _chart = null; }
    const rows = _currentRows().filter(r => _selProds.size === 0 || _selProds.has(r[C.item]));
    if (!rows.length) return;
    _chart = new Chart(canvas, {
      type: 'line', data: _buildChart(rows),
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Pretendard', size: 11 }, boxWidth: 10, padding: 6 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: $${ctx.parsed.y?.toFixed(3) ?? '—'}` } },
        },
        scales: {
          x: { ticks: { font: { family: 'Pretendard', size: 11 }, maxTicksLimit: 14 }, grid: { color: '#F0F0F0' } },
          y: { ticks: { font: { family: 'Pretendard', size: 11 }, callback: v => '$' + v.toFixed(2) }, grid: { color: '#F0F0F0' } },
        },
      },
    });
  }

  // ── 제품 버튼 ─────────────────────────────────────────────
  function _renderProdBtns() {
    const el = document.getElementById('dp-prod-wrap');
    if (!el) return;
    const items = _getItems(_currentRows());
    el.innerHTML = items.map((p, i) => {
      const on = _selProds.size === 0 || _selProds.has(p);
      return `<button class="dp-prod-btn" data-prod="${p}"
        onclick="Pages.DramPrice.toggleProduct('${p.replace(/'/g,"\\'")}')"
        style="padding:2px 8px;border:1px solid ${COLORS[i%COLORS.length]};border-radius:20px;
               font-size:11px;font-family:Pretendard,sans-serif;cursor:pointer;margin:2px 2px 2px 0;
               background:${on ? COLORS[i%COLORS.length] : '#fff'};
               color:${on ? '#fff' : COLORS[i%COLORS.length]}">${p}</button>`;
    }).join('');
  }

  // ── 데이터 표 ─────────────────────────────────────────────
  function _renderTable() {
    const el = document.getElementById('dp-table');
    if (!el) return;

    const rows = _currentRows()
      .filter(r => _selProds.size === 0 || _selProds.has(r[C.item]))
      .sort((a, b) => b[C.date].localeCompare(a[C.date]))
      .slice(0, 500);

    if (!rows.length) {
      el.innerHTML = '<div style="padding:20px;text-align:center;color:#999;font-family:Pretendard,sans-serif">데이터 없음</div>';
      return;
    }

    const CAT_COLOR = { 'DRAM Spot': '#1B4F8A', 'DRAM Contract': '#0F6E56', 'Module Spot': '#6A3D7C' };
    const chgColor  = s => s && s.includes('▲') ? '#1A6B3A' : s && s.includes('▼') ? '#A32D2D' : '#555';
    const showCat   = _selCat === 'all';
    const FS = "font-family:Pretendard,sans-serif;font-size:12px";
    const FM = "font-family:'DM Mono',monospace;font-size:12px";
    const thS = `padding:7px 10px;text-align:center;${FS};font-weight:700;color:#222;background:#F0F0F0;border-bottom:2px solid #CCC;border-right:1px solid #DDD;white-space:nowrap`;
    const tdB = `padding:7px 10px;border-bottom:1px solid #E8E8E8;border-right:1px solid #E8E8E8`;

    const trs = rows.map((r, i) => {
      const cc = CAT_COLOR[r[C.cat]] || '#555';
      const catCell = showCat
        ? `<td style="${tdB}"><span style="padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;${FS};color:${cc};border:1px solid ${cc}22;background:${cc}11">${r[C.cat]}</span></td>`
        : '';
      return `<tr style="${i%2===1 ? 'background:#FAFAFA' : ''}">
        <td style="${tdB};${FS};color:#888;white-space:nowrap">${r[C.date]}</td>
        <td style="${tdB};${FS};color:#aaa;white-space:nowrap;font-size:11px">${r[C.lastUpdate]||'—'}</td>
        ${catCell}
        <td style="${tdB};${FS};white-space:nowrap">${r[C.item]}</td>
        <td style="${tdB};${FM};text-align:right">${r[C.dHigh]||'—'}</td>
        <td style="${tdB};${FM};text-align:right">${r[C.dLow]||'—'}</td>
        <td style="${tdB};${FM};text-align:right;font-weight:600">${r[C.sAvg]||'—'}</td>
        <td style="${tdB};${FM};text-align:center;color:${chgColor(r[C.sChg])};font-weight:600">${r[C.sChg]||'—'}</td>
      </tr>`;
    }).join('');

    el.innerHTML = `<div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="${thS}">날짜</th>
          <th style="${thS}">Last Update</th>
          ${showCat ? `<th style="${thS}">카테고리</th>` : ''}
          <th style="${thS}">제품</th>
          <th style="${thS}">Daily High</th>
          <th style="${thS}">Daily Low</th>
          <th style="${thS}">Session Avg</th>
          <th style="${thS}">Session Change</th>
        </tr></thead>
        <tbody>${trs}</tbody>
      </table></div>`;
  }

  // ── 카테고리 탭 버튼 스타일 업데이트 ─────────────────────
  function _updateCatTabs() {
    document.querySelectorAll('.dp-cat-btn').forEach(b => {
      const cat  = CATEGORIES.find(c => c.key === b.dataset.cat);
      const isOn = b.dataset.cat === _selCat;
      b.style.background  = isOn ? (cat ? cat.color : '#1D1D1F') : '#fff';
      b.style.color       = isOn ? '#fff' : (cat ? cat.color : '#333');
    });
  }

  // ── Public ────────────────────────────────────────────────
  return {

    setMetric(m) {
      _metric = m;
      document.querySelectorAll('.dp-metric-btn').forEach(b => {
        b.style.background = b.dataset.m === m ? '#1D1D1F' : '#fff';
        b.style.color      = b.dataset.m === m ? '#fff' : '#333';
      });
      _refreshChart();
    },

    selectCat(cat) {
      _selCat   = cat;
      _selProds = new Set();
      _updateCatTabs();
      _renderProdBtns();
      _refreshChart();
      _renderTable();
    },

    toggleProduct(prod) {
      if (_selProds.has(prod)) _selProds.delete(prod);
      else _selProds.add(prod);
      _renderProdBtns();
      _refreshChart();
      _renderTable();
    },

    async render() {
      const el = document.getElementById('dp-root');
      if (!el) return;
      el.innerHTML = `<div class="page-wrap"><div style="padding:40px;text-align:center;color:#999;font-family:Pretendard,sans-serif">데이터 불러오는 중...</div></div>`;

      // 3개 시트 병렬 fetch
      const [spotRows, contractRows, moduleRows] = await Promise.all([
        _fetchSheet(SHEET_MAP.spot),
        _fetchSheet(SHEET_MAP.contract),
        _fetchSheet(SHEET_MAP.module),
      ]);

      _allData = { spot: spotRows, contract: contractRows, module: moduleRows };

      const allRows   = [...spotRows, ...contractRows, ...moduleRows];
      const sorted    = [...allRows].sort((a, b) => b[C.date].localeCompare(a[C.date]));
      const lastDate  = sorted.length ? sorted[0][C.date] : '—';
      const totalDays = new Set(allRows.map(r => r[C.date])).size;

      const catBtns = CATEGORIES.map(c => {
        const data = c.key === 'all' ? allRows : (_allData[c.key] || []);
        const days = new Set(data.map(r => r[C.date])).size;
        const isOn = c.key === _selCat;
        return `<button class="dp-cat-btn" data-cat="${c.key}"
          onclick="Pages.DramPrice.selectCat('${c.key}')"
          style="padding:5px 16px;border:1.5px solid ${c.color};border-radius:7px;
                 font-size:12px;font-weight:600;font-family:Pretendard,sans-serif;cursor:pointer;
                 background:${isOn ? c.color : '#fff'};color:${isOn ? '#fff' : c.color};transition:.15s">
          ${c.label}&nbsp;<span style="font-size:10px;opacity:.7">(${days}일)</span>
        </button>`;
      }).join('');

      el.innerHTML = `
        <div class="page-wrap">
          <div class="ph-row">
            <div class="ph">
              <h1>DRAM Price Tracking</h1>
              <p>TrendForce · 최근 수집일: ${lastDate} · 총 ${totalDays}일 누적 · 3개 카테고리</p>
            </div>
          </div>

          <div class="page-card" style="margin-bottom:12px;padding:12px 16px">
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">${catBtns}</div>
          </div>

          <div class="page-card" style="margin-bottom:12px">
            <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start">
              <div>
                <div style="font-size:11px;color:#888;margin-bottom:6px;font-family:Pretendard,sans-serif;font-weight:600">지표</div>
                <div style="display:flex;gap:4px">
                  <button class="dp-metric-btn" data-m="avg" onclick="Pages.DramPrice.setMetric('avg')"
                    style="padding:3px 10px;border:1px solid #CCC;border-radius:4px;font-size:11px;font-family:Pretendard,sans-serif;cursor:pointer;background:#1D1D1F;color:#fff">Session Avg</button>
                  <button class="dp-metric-btn" data-m="high" onclick="Pages.DramPrice.setMetric('high')"
                    style="padding:3px 10px;border:1px solid #CCC;border-radius:4px;font-size:11px;font-family:Pretendard,sans-serif;cursor:pointer;background:#fff;color:#333">Daily High</button>
                  <button class="dp-metric-btn" data-m="low" onclick="Pages.DramPrice.setMetric('low')"
                    style="padding:3px 10px;border:1px solid #CCC;border-radius:4px;font-size:11px;font-family:Pretendard,sans-serif;cursor:pointer;background:#fff;color:#333">Daily Low</button>
                </div>
              </div>
              <div style="flex:1;min-width:200px">
                <div style="font-size:11px;color:#888;margin-bottom:6px;font-family:Pretendard,sans-serif;font-weight:600">제품 필터</div>
                <div id="dp-prod-wrap"></div>
              </div>
            </div>
          </div>

          <div class="page-card" style="margin-bottom:12px">
            <div style="position:relative;height:420px"><canvas id="dp-chart"></canvas></div>
          </div>

          <div class="page-card" style="padding:0;overflow:hidden">
            <div style="padding:10px 14px;font-size:13px;font-weight:600;font-family:Pretendard,sans-serif;border-bottom:1px solid #E8E8E8">
              데이터 (최근 500건)
            </div>
            <div id="dp-table"></div>
          </div>
        </div>`;

      _renderProdBtns();
      _refreshChart();
      _renderTable();
    },
  };
})();
