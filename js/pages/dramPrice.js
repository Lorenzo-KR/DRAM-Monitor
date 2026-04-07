/**
 * pages/dramPrice.js
 * DRAM Price Tracking (TrendForce)
 * 컬럼: Date | Category | Item | Daily High | Daily Low | Session High | Session Low | Session Average | Session Change | Source
 */
Pages.DramPrice = (() => {

  const GAS_URL    = 'https://script.google.com/macros/s/AKfycbw0gy7SOKjWTH3hvMJ-U3Tf2l4ritMDR8iDMaN8uW0HxsguopMvkDCBDs7I5nJTJnEV/exec';

  let _data     = null;
  let _chart    = null;
  let _selProds = new Set();
  let _selCats  = new Set(['Spot', 'Contract', 'Module', 'Graphics']);
  let _metric   = 'avg';

  const COLORS = [
    '#1B4F8A','#0F6E56','#6A3D7C','#B45309','#0C6B8A',
    '#2D7D46','#8B3A3A','#555','#C05621','#1A6B3A','#7B3F00','#003366',
  ];

  const CAT_COLOR = { Spot:'#1B4F8A', Contract:'#0F6E56', Module:'#6A3D7C', Graphics:'#B45309' };

  // ── GAS API fetch ────────────────────────────────────
  async function _fetch() {
    try {
      const res = await fetch(`${GAS_URL}?action=getDramPrices`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) return { error: json.error };
      if (!Array.isArray(json) || json.length === 0) return { headers: [], rows: [] };
      // JSON 배열 → rows 배열로 변환
      const KEYS = ['Date','Category','Item','Daily High','Daily Low','Session High','Session Low','Session Average','Session Change','Source'];
      const rows = json.map(obj => KEYS.map(k => obj[k] || ''));
      return { headers: KEYS, rows };
    } catch (e) {
      return { error: '데이터 로드 실패: ' + e.message };
    }
  }

  // Date=0 Category=1 Item=2 DailyHigh=3 DailyLow=4 SessHigh=5 SessLow=6 SessAvg=7 SessChg=8
  const C = { date:0, cat:1, item:2, dHigh:3, dLow:4, sHigh:5, sLow:6, sAvg:7, sChg:8 };

  const pn = s => { const n = parseFloat(String(s||'').replace(/[^0-9.-]/g,'')); return isNaN(n)?null:n; };

  function _getCategories(rows) { return [...new Set(rows.map(r=>r[C.cat]).filter(Boolean))]; }
  function _getItems(rows) {
    return [...new Set(
      rows.filter(r => _selCats.size===0 || _selCats.has(r[C.cat]))
          .map(r => r[C.item]).filter(Boolean)
    )];
  }

  function _buildChart(rows, items) {
    const byDate = {};
    rows.filter(r => _selCats.size===0 || _selCats.has(r[C.cat]))
        .forEach(r => {
          const d = r[C.date], item = r[C.item];
          if (!byDate[d]) byDate[d] = {};
          const val = _metric==='high' ? pn(r[C.dHigh])
                    : _metric==='low'  ? pn(r[C.dLow])
                    : pn(r[C.sAvg]);
          byDate[d][item] = val;
        });
    const dates   = Object.keys(byDate).sort();
    const filtered = items.filter(i => _selProds.size===0 || _selProds.has(i));
    const datasets = filtered.map((item, i) => ({
      label: item,
      data: dates.map(d => byDate[d][item] ?? null),
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + '15',
      tension: 0.3,
      pointRadius: dates.length > 30 ? 2 : 4,
      spanGaps: true,
    }));
    return { labels: dates, datasets };
  }

  function _refreshChart() {
    if (!_data) return;
    const items = _getItems(_data.rows);
    const canvas = document.getElementById('dp-chart');
    if (!canvas) return;
    if (_chart) { _chart.destroy(); _chart = null; }
    const cd = _buildChart(_data.rows, items);
    _chart = new Chart(canvas, {
      type: 'line', data: cd,
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode:'index', intersect:false },
        plugins: {
          legend: { position:'top', labels:{ font:{family:'Pretendard',size:11}, boxWidth:10, padding:6 } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: $${ctx.parsed.y?.toFixed(3)??'—'}` } },
        },
        scales: {
          x: { ticks:{ font:{family:'Pretendard',size:11}, maxTicksLimit:14 }, grid:{color:'#F0F0F0'} },
          y: { ticks:{ font:{family:'Pretendard',size:11}, callback: v=>'$'+v.toFixed(2) }, grid:{color:'#F0F0F0'} },
        },
      },
    });
  }

  function _renderTable(rows) {
    const filtered = rows
      .filter(r => _selCats.size===0 || _selCats.has(r[C.cat]))
      .sort((a,b) => b[C.date].localeCompare(a[C.date]))
      .slice(0, 300);
    if (!filtered.length) return '<div style="padding:20px;text-align:center;color:#999">데이터 없음</div>';

    const chgColor = s => s?.includes('▲') ? '#1A6B3A' : s?.includes('▼') ? '#A32D2D' : '#555';
    const catBadge = cat => `<span style="padding:1px 7px;border-radius:10px;font-size:10px;font-weight:600;
      border:1px solid ${CAT_COLOR[cat]||'#999'};color:${CAT_COLOR[cat]||'#999'}">${cat||'—'}</span>`;

    const trs = filtered.map((r,i) => `
      <tr style="${i%2===1?'background:#FAFAFA':''}">
        <td class="td-c" style="font-size:11px;color:#888;white-space:nowrap">${r[C.date]}</td>
        <td class="td-c">${catBadge(r[C.cat])}</td>
        <td class="td-l" style="white-space:nowrap;font-size:12px">${r[C.item]}</td>
        <td class="td-r" style="font-family:'DM Mono',monospace;font-size:12px">${r[C.dHigh]||'—'}</td>
        <td class="td-r" style="font-family:'DM Mono',monospace;font-size:12px">${r[C.dLow]||'—'}</td>
        <td class="td-r" style="font-family:'DM Mono',monospace;font-size:12px;font-weight:600">${r[C.sAvg]||'—'}</td>
        <td class="td-c" style="font-family:'DM Mono',monospace;font-size:12px;color:${chgColor(r[C.sChg])};font-weight:600">${r[C.sChg]||'—'}</td>
      </tr>`).join('');

    return `<div style="overflow-x:auto"><table class="std-table">
      <thead><tr><th>날짜</th><th>구분</th><th>제품</th>
        <th>Daily High</th><th>Daily Low</th><th>Session Avg</th><th>Session Change</th>
      </tr></thead><tbody>${trs}</tbody></table></div>`;
  }

  return {

    setMetric(m) {
      _metric = m;
      document.querySelectorAll('.dp-metric-btn').forEach(b => {
        b.style.background = b.dataset.m===m ? '#1D1D1F' : '#fff';
        b.style.color      = b.dataset.m===m ? '#fff' : '#333';
      });
      _refreshChart();
    },

    toggleCat(cat) {
      if (_selCats.has(cat)) _selCats.delete(cat);
      else _selCats.add(cat);
      document.querySelectorAll('.dp-cat-btn').forEach(b => {
        const on = _selCats.has(b.dataset.cat);
        b.style.opacity    = on ? '1' : '0.3';
        b.style.fontWeight = on ? '700' : '400';
      });
      _selProds.clear(); // 카테고리 바뀌면 제품 선택 초기화
      document.querySelectorAll('.dp-prod-btn').forEach(b => { b.style.opacity='1'; b.style.fontWeight='400'; });
      _refreshChart();
      // 표 업데이트
      const tableEl = document.getElementById('dp-table');
      if (tableEl && _data) tableEl.innerHTML = _renderTable(_data.rows);
    },

    toggleProduct(prod) {
      if (_selProds.has(prod)) _selProds.delete(prod);
      else _selProds.add(prod);
      document.querySelectorAll('.dp-prod-btn').forEach(b => {
        const on = _selProds.size===0 || _selProds.has(b.dataset.prod);
        b.style.opacity    = on ? '1' : '0.3';
        b.style.fontWeight = _selProds.has(b.dataset.prod) ? '700' : '400';
      });
      _refreshChart();
    },

    async render() {
      const el = document.getElementById('dp-root');
      if (!el) return;
      el.innerHTML = `<div class="page-wrap"><div style="padding:40px;text-align:center;color:#999;font-family:Pretendard,sans-serif">데이터 불러오는 중...</div></div>`;

      const result = await _fetch();
      if (result.error) {
        el.innerHTML = `<div class="page-wrap"><div class="page-card" style="color:#A32D2D">
          ⚠ ${result.error}<br>
          <span style="font-size:12px;color:#888;margin-top:8px;display:block">Google Sheets → 공유 → 링크 있는 모든 사용자 → 뷰어 설정 필요</span>
        </div></div>`;
        return;
      }

      _data = result;
      const cats      = _getCategories(result.rows);
      const items     = _getItems(result.rows);
      const lastDate  = result.rows.length ? [...result.rows].sort((a,b)=>b[C.date].localeCompare(a[C.date]))[0][C.date] : '—';
      const totalDays = new Set(result.rows.map(r=>r[C.date])).size;

      const catBtns = cats.map(cat => `
        <button class="dp-cat-btn" data-cat="${cat}" onclick="Pages.DramPrice.toggleCat('${cat}')"
          style="padding:3px 12px;border:1px solid ${CAT_COLOR[cat]||'#999'};border-radius:4px;
                 font-size:11px;font-family:Pretendard,sans-serif;cursor:pointer;
                 background:${CAT_COLOR[cat]||'#999'};color:#fff;margin:2px;font-weight:700">${cat}</button>`).join('');

      const prodBtns = items.map((p,i) => `
        <button class="dp-prod-btn" data-prod="${p}" onclick="Pages.DramPrice.toggleProduct('${p}')"
          style="padding:2px 8px;border:1px solid ${COLORS[i%COLORS.length]};border-radius:20px;
                 font-size:11px;font-family:Pretendard,sans-serif;cursor:pointer;
                 background:#fff;color:${COLORS[i%COLORS.length]};margin:2px 2px 2px 0">${p}</button>`).join('');

      el.innerHTML = `
        <div class="page-wrap">
          <div class="ph-row">
            <div class="ph"><h1>DRAM Price Tracking</h1>
              <p>TrendForce Spot Price · 최종: ${lastDate} · ${totalDays}일 누적 · ${result.rows.length}건</p>
            </div>
          </div>

          <div class="page-card" style="margin-bottom:12px">
            <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start">
              <div>
                <div style="font-size:11px;color:#888;margin-bottom:6px;font-family:Pretendard,sans-serif;font-weight:600">카테고리</div>
                <div>${catBtns}</div>
              </div>
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
                <div>${prodBtns}</div>
              </div>
            </div>
          </div>

          <div class="page-card" style="margin-bottom:12px">
            <div style="position:relative;height:400px"><canvas id="dp-chart"></canvas></div>
          </div>

          <div class="page-card" style="padding:0;overflow:hidden">
            <div style="padding:10px 14px;font-size:13px;font-weight:600;font-family:Pretendard,sans-serif;border-bottom:1px solid #E8E8E8">
              전체 데이터 (최근 300건)
            </div>
            <div id="dp-table">${_renderTable(result.rows)}</div>
          </div>
        </div>`;

      _refreshChart();
    },
  };
})();
