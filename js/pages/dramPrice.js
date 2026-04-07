/**
 * pages/dramPrice.js
 * DRAM Price Tracking (TrendForce Spot Price)
 * 컬럼: Date | Item | Daily High | Daily Low | Session High | Session Low | Session Average | Session Change | Source
 */

Pages.DramPrice = (() => {

  const SHEET_ID   = CONFIG.DRAM_PRICE_SHEET_ID || '';
  const SHEET_NAME = 'spot_prices';

  let _data    = null;
  let _chart   = null;
  let _selProds = new Set();
  let _metric   = 'avg'; // avg | high | low

  const COLORS = [
    '#1B4F8A','#0F6E56','#6A3D7C','#B45309',
    '#0C6B8A','#2D7D46','#8B3A3A','#888','#C05621','#1A6B3A',
  ];

  // ── CSV fetch (공개 Sheets) ───────────────────────────
  async function _fetch() {
    if (!SHEET_ID) return { error: 'SHEET_ID 미설정' };
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
    try {
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return _parseCSV(text);
    } catch (e) {
      return { error: '데이터 로드 실패: ' + e.message };
    }
  }

  function _parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return { headers: [], rows: [] };
    const parse = line => {
      const r = []; let cur = '', q = false;
      for (const c of line) {
        if (c === '"') { q = !q; continue; }
        if (c === ',' && !q) { r.push(cur.trim()); cur = ''; continue; }
        cur += c;
      }
      r.push(cur.trim()); return r;
    };
    const headers = parse(lines[0]);
    const rows    = lines.slice(1).map(parse).filter(r => r[0] && r[1]);
    return { headers, rows };
  }

  // 컬럼 인덱스: Date=0 Item=1 DailyHigh=2 DailyLow=3 SessHigh=4 SessLow=5 SessAvg=6 SessChg=7
  const COL = { date:0, item:1, dHigh:2, dLow:3, sHigh:4, sLow:5, sAvg:6, sChg:7 };

  function _getItems(rows) {
    return [...new Set(rows.map(r => r[COL.item]).filter(Boolean))];
  }

  function _parseNum(s) {
    if (!s) return null;
    const n = parseFloat(String(s).replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? null : n;
  }

  function _buildChart(rows, items) {
    const byDate = {};
    rows.forEach(r => {
      const d = r[COL.date], item = r[COL.item];
      if (!byDate[d]) byDate[d] = {};
      const val = _metric === 'high' ? _parseNum(r[COL.dHigh])
                : _metric === 'low'  ? _parseNum(r[COL.dLow])
                : _parseNum(r[COL.sAvg]);
      byDate[d][item] = val;
    });
    const dates = Object.keys(byDate).sort();
    const filtered = items.filter(i => _selProds.size === 0 || _selProds.has(i));
    const datasets = filtered.map((item, i) => ({
      label: item,
      data: dates.map(d => byDate[d][item] ?? null),
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + '18',
      tension: 0.3,
      pointRadius: dates.length > 30 ? 2 : 4,
      spanGaps: true,
    }));
    return { labels: dates, datasets };
  }

  function _renderChart(chartData) {
    const canvas = document.getElementById('dp-chart');
    if (!canvas) return;
    if (_chart) { _chart.destroy(); _chart = null; }
    _chart = new Chart(canvas, {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { family: 'Pretendard', size: 11 }, boxWidth: 10, padding: 8 },
          },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: $${ctx.parsed.y?.toFixed(3) ?? '—'}`,
            },
          },
        },
        scales: {
          x: { ticks: { font: { family: 'Pretendard', size: 11 }, maxTicksLimit: 14 }, grid: { color: '#F0F0F0' } },
          y: {
            ticks: { font: { family: 'Pretendard', size: 11 }, callback: v => '$' + v.toFixed(2) },
            grid: { color: '#F0F0F0' },
          },
        },
      },
    });
  }

  function _renderTable(rows) {
    if (!rows.length) return '<div style="padding:20px;text-align:center;color:#999">데이터 없음</div>';
    const recent = [...rows].sort((a,b) => b[COL.date].localeCompare(a[COL.date])).slice(0, 300);

    // 변동률 색상
    const chgColor = s => {
      if (!s) return '#333';
      if (s.includes('▲')) return '#1A6B3A';
      if (s.includes('▼')) return '#A32D2D';
      return '#555';
    };

    const trs = recent.map((r, i) => {
      const bg = i % 2 === 1 ? 'background:#FAFAFA' : '';
      return `<tr style="${bg}">
        <td class="td-c" style="font-size:11px;color:#888">${r[COL.date]}</td>
        <td class="td-l" style="white-space:nowrap">${r[COL.item]}</td>
        <td class="td-r" style="font-family:'DM Mono',monospace">${r[COL.dHigh] || '—'}</td>
        <td class="td-r" style="font-family:'DM Mono',monospace">${r[COL.dLow] || '—'}</td>
        <td class="td-r" style="font-family:'DM Mono',monospace">${r[COL.sAvg] || '—'}</td>
        <td class="td-c" style="font-family:'DM Mono',monospace;color:${chgColor(r[COL.sChg])};font-weight:600">${r[COL.sChg] || '—'}</td>
      </tr>`;
    }).join('');

    return `<div style="overflow-x:auto">
      <table class="std-table">
        <thead><tr>
          <th>날짜</th><th>제품</th>
          <th>Daily High</th><th>Daily Low</th>
          <th>Session Avg</th><th>Session Change</th>
        </tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>`;
  }

  // ── Public ────────────────────────────────────────────
  return {

    setMetric(m) {
      _metric = m;
      document.querySelectorAll('.dp-metric-btn').forEach(b => {
        b.style.background = b.dataset.m === m ? '#1D1D1F' : '#fff';
        b.style.color      = b.dataset.m === m ? '#fff' : '#333';
      });
      if (_data) {
        const items = _getItems(_data.rows);
        _renderChart(_buildChart(_data.rows, items));
      }
    },

    toggleProduct(prod) {
      if (_selProds.has(prod)) _selProds.delete(prod);
      else _selProds.add(prod);
      document.querySelectorAll('.dp-prod-btn').forEach(b => {
        const on = _selProds.size === 0 || _selProds.has(b.dataset.prod);
        b.style.opacity    = on ? '1' : '0.3';
        b.style.fontWeight = _selProds.has(b.dataset.prod) ? '700' : '400';
      });
      if (_data) {
        const items = _getItems(_data.rows);
        _renderChart(_buildChart(_data.rows, items));
      }
    },

    async render() {
      const el = document.getElementById('dp-root');
      if (!el) return;

      el.innerHTML = `<div class="page-wrap"><div style="padding:40px;text-align:center;color:#999;font-family:Pretendard,sans-serif">데이터 불러오는 중...</div></div>`;

      const result = await _fetch();

      if (result.error) {
        el.innerHTML = `<div class="page-wrap"><div class="page-card" style="color:#A32D2D">⚠ ${result.error}<br>
          <span style="font-size:12px;color:#888;margin-top:8px;display:block">Google Sheets를 <b>링크 있는 모든 사용자 → 뷰어</b>로 공개 설정해주세요.</span></div></div>`;
        return;
      }

      _data = result;
      const items       = _getItems(result.rows);
      const lastUpdated = result.rows.length
        ? [...result.rows].sort((a,b) => b[COL.date].localeCompare(a[COL.date]))[0][COL.date]
        : '—';
      const totalDays = new Set(result.rows.map(r => r[COL.date])).size;

      const prodBtns = items.map((p, i) => `
        <button class="dp-prod-btn" data-prod="${p}"
          onclick="Pages.DramPrice.toggleProduct('${p}')"
          style="padding:3px 10px;border:1px solid ${COLORS[i%COLORS.length]};border-radius:20px;
                 font-size:11px;font-family:Pretendard,sans-serif;cursor:pointer;background:#fff;
                 color:${COLORS[i%COLORS.length]};margin:2px 2px 2px 0">${p}</button>`).join('');

      el.innerHTML = `
        <div class="page-wrap">
          <div class="ph-row">
            <div class="ph">
              <h1>DRAM Price Tracking</h1>
              <p>TrendForce Spot Price · 최종: ${lastUpdated} · ${totalDays}일 · ${items.length}개 제품</p>
            </div>
          </div>

          <div class="page-card" style="margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
              <div>
                <div style="font-size:11px;color:#888;margin-bottom:6px;font-family:Pretendard,sans-serif">지표</div>
                <div style="display:flex;gap:4px">
                  <button class="dp-metric-btn" data-m="avg" onclick="Pages.DramPrice.setMetric('avg')"
                    style="padding:3px 10px;border:1px solid #CCC;border-radius:4px;font-size:11px;font-family:Pretendard,sans-serif;cursor:pointer;background:#1D1D1F;color:#fff">Session Avg</button>
                  <button class="dp-metric-btn" data-m="high" onclick="Pages.DramPrice.setMetric('high')"
                    style="padding:3px 10px;border:1px solid #CCC;border-radius:4px;font-size:11px;font-family:Pretendard,sans-serif;cursor:pointer;background:#fff;color:#333">Daily High</button>
                  <button class="dp-metric-btn" data-m="low" onclick="Pages.DramPrice.setMetric('low')"
                    style="padding:3px 10px;border:1px solid #CCC;border-radius:4px;font-size:11px;font-family:Pretendard,sans-serif;cursor:pointer;background:#fff;color:#333">Daily Low</button>
                </div>
              </div>
              <div style="flex:1">
                <div style="font-size:11px;color:#888;margin-bottom:6px;font-family:Pretendard,sans-serif">제품 필터 (전체 선택 시 모두 표시)</div>
                <div>${prodBtns}</div>
              </div>
            </div>
          </div>

          <div class="page-card" style="margin-bottom:12px">
            <div style="position:relative;height:400px">
              <canvas id="dp-chart"></canvas>
            </div>
          </div>

          <div class="page-card" style="padding:0;overflow:hidden">
            <div style="padding:10px 14px;font-size:13px;font-weight:600;font-family:Pretendard,sans-serif;border-bottom:1px solid #E8E8E8">
              전체 데이터 (최근 300건)
            </div>
            ${_renderTable(result.rows)}
          </div>
        </div>`;

      _renderChart(_buildChart(result.rows, items));
    },
  };

})();
