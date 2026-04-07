/**
 * pages/dramPrice.js
 * DRAM Price Tracking (TrendForce) — 가격 트렌드 조회
 */

Pages.DramPrice = (() => {

  const SHEET_ID  = CONFIG.DRAM_PRICE_SHEET_ID || '';
  const SHEET_NAME = 'spot_prices';

  let _data = null;
  let _chart = null;
  let _selectedProducts = new Set();

  // ── 색상 팔레트 ───────────────────────────────────────
  const COLORS = [
    '#1B4F8A','#0F6E56','#6A3D7C','#B45309',
    '#0C6B8A','#2D7D46','#8B3A3A','#555',
  ];

  // ── Google Sheets 공개 CSV fetch ──────────────────────
  async function _fetchData() {
    if (!SHEET_ID) {
      return { error: 'SHEET_ID가 config.js에 설정되지 않았습니다.' };
    }
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
    try {
      const res  = await fetch(url);
      const text = await res.text();
      return _parseCSV(text);
    } catch (e) {
      return { error: '데이터 로드 실패: ' + e.message };
    }
  }

  // ── CSV 파싱 ─────────────────────────────────────────
  function _parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return { headers: [], rows: [] };

    const parse = (line) => {
      const result = [];
      let cur = '', inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; continue; }
        if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      result.push(cur.trim());
      return result;
    };

    const headers = parse(lines[0]);
    const rows    = lines.slice(1).map(parse).filter(r => r[0]);
    return { headers, rows };
  }

  // ── 제품 목록 추출 ────────────────────────────────────
  function _getProducts(rows) {
    const products = new Set();
    rows.forEach(r => { if (r[1]) products.add(r[1]); });
    return [...products];
  }

  // ── 날짜별 제품 가격 그룹핑 ───────────────────────────
  function _buildChartData(rows, products) {
    const byDate = {};
    rows.forEach(r => {
      const date = r[0];
      const prod = r[1];
      const price = parseFloat(r[4]) || 0;
      if (!byDate[date]) byDate[date] = {};
      byDate[date][prod] = price;
    });

    const dates = Object.keys(byDate).sort();
    const datasets = products.map((prod, i) => ({
      label: prod,
      data: dates.map(d => byDate[d][prod] || null),
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + '22',
      tension: 0.3,
      pointRadius: 3,
      spanGaps: true,
    }));

    return { labels: dates, datasets };
  }

  // ── 차트 렌더 ─────────────────────────────────────────
  function _renderChart(chartData) {
    const canvas = document.getElementById('dp-chart');
    if (!canvas) return;

    if (_chart) { _chart.destroy(); _chart = null; }

    const filtered = {
      labels: chartData.labels,
      datasets: chartData.datasets.filter(d =>
        _selectedProducts.size === 0 || _selectedProducts.has(d.label)
      ),
    };

    _chart = new Chart(canvas, {
      type: 'line',
      data: filtered,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { family: 'Pretendard', size: 12 }, boxWidth: 12 },
          },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: $${ctx.parsed.y?.toFixed(4) ?? '—'}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { font: { family: 'Pretendard', size: 11 }, maxTicksLimit: 12 },
            grid: { color: '#F0F0F0' },
          },
          y: {
            ticks: {
              font: { family: 'Pretendard', size: 11 },
              callback: v => '$' + v.toFixed(3),
            },
            grid: { color: '#F0F0F0' },
          },
        },
      },
    });
  }

  // ── 표 렌더 ───────────────────────────────────────────
  function _renderTable(headers, rows) {
    if (!rows.length) return '<div style="padding:20px;text-align:center;color:#999">데이터 없음</div>';

    const recent = [...rows].sort((a,b) => b[0].localeCompare(a[0])).slice(0, 200);
    const ths = headers.map(h => `<th>${h}</th>`).join('');
    const trs = recent.map((r, i) => {
      const bg = i % 2 === 1 ? 'background:#FAFAFA' : '';
      const tds = r.map((c, ci) => {
        const align = ci >= 4 ? 'text-align:right;font-family:"DM Mono",monospace' : '';
        return `<td style="${align}">${c || '—'}</td>`;
      }).join('');
      return `<tr style="${bg}">${tds}</tr>`;
    }).join('');

    return `
      <div style="overflow-x:auto">
        <table class="std-table">
          <thead><tr>${ths}</tr></thead>
          <tbody>${trs}</tbody>
        </table>
      </div>`;
  }

  // ── Public ────────────────────────────────────────────
  return {

    toggleProduct(prod) {
      if (_selectedProducts.has(prod)) _selectedProducts.delete(prod);
      else _selectedProducts.add(prod);

      // 버튼 활성화 토글
      document.querySelectorAll('.dp-prod-btn').forEach(btn => {
        const active = _selectedProducts.size === 0 || _selectedProducts.has(btn.dataset.prod);
        btn.style.opacity = active ? '1' : '0.35';
        btn.style.fontWeight = _selectedProducts.has(btn.dataset.prod) ? '700' : '400';
      });

      if (_data) {
        const products = _getProducts(_data.rows);
        _renderChart(_buildChartData(_data.rows, products));
      }
    },

    async render() {
      const el = document.getElementById('dp-root');
      if (!el) return;

      el.innerHTML = `
        <div class="page-wrap">
          <div class="ph-row">
            <div class="ph"><h1>DRAM Price Tracking</h1><p>TrendForce Spot Price</p></div>
          </div>
          <div style="padding:40px;text-align:center;color:#999;font-family:Pretendard,sans-serif">
            데이터 불러오는 중...
          </div>
        </div>`;

      const result = await _fetchData();

      if (result.error) {
        el.innerHTML = `
          <div class="page-wrap">
            <div class="ph"><h1>DRAM Price Tracking</h1></div>
            <div class="page-card" style="color:#A32D2D;padding:20px">
              ⚠ ${result.error}<br>
              <span style="font-size:12px;color:#888;margin-top:8px;display:block">
                config.js에 DRAM_PRICE_SHEET_ID를 설정하고, Google Sheets를 공개(링크 있는 사람 보기)로 설정해주세요.
              </span>
            </div>
          </div>`;
        return;
      }

      _data = result;
      const products    = _getProducts(result.rows);
      const chartData   = _buildChartData(result.rows, products);
      const lastUpdated = result.rows.length ? [...result.rows].sort((a,b) => b[0].localeCompare(a[0]))[0][0] : '—';

      // 제품 필터 버튼
      const prodBtns = products.map((p, i) => `
        <button class="dp-prod-btn" data-prod="${p}"
          onclick="Pages.DramPrice.toggleProduct('${p}')"
          style="padding:4px 12px;border:1px solid ${COLORS[i%COLORS.length]};border-radius:20px;
                 font-size:12px;font-family:Pretendard,sans-serif;cursor:pointer;background:#fff;
                 color:${COLORS[i%COLORS.length]};margin:2px">${p}</button>
      `).join('');

      el.innerHTML = `
        <div class="page-wrap">
          <div class="ph-row">
            <div class="ph"><h1>DRAM Price Tracking</h1><p>TrendForce Spot Price · 최종 업데이트: ${lastUpdated}</p></div>
          </div>

          <div class="page-card" style="margin-bottom:16px">
            <div style="font-size:12px;color:#888;margin-bottom:10px;font-family:Pretendard,sans-serif">제품 필터</div>
            <div>${prodBtns}</div>
          </div>

          <div class="page-card" style="margin-bottom:16px">
            <div style="position:relative;height:360px">
              <canvas id="dp-chart"></canvas>
            </div>
          </div>

          <div class="page-card" style="padding:0;overflow:hidden">
            <div style="padding:12px 16px;font-size:13px;font-weight:600;font-family:Pretendard,sans-serif;border-bottom:1px solid #E8E8E8">
              전체 데이터 (최근 200건)
            </div>
            ${_renderTable(result.headers, result.rows)}
          </div>
        </div>`;

      _renderChart(chartData);
    },
  };

})();
