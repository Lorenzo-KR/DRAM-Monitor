/**
 * pages/revenue.js
 * 매출 현황 — 월별/연도별/전체 + 사업별 병렬 그래프
 */

Pages.Revenue = (() => {

  let _mode   = 'month';
  let _charts = {};

  function setMode(m) {
    _mode = m;
    ['month','year','all'].forEach(x => {
      const btn = document.getElementById('rv-mode-' + x); if (!btn) return;
      btn.style.background = x === m ? 'var(--navy)' : 'var(--card)';
      btn.style.color      = x === m ? '#fff' : 'var(--tx)';
    });
    document.getElementById('rv-mo').style.display = m === 'month' ? '' : 'none';
    document.getElementById('rv-yr').style.display = m === 'year'  ? '' : 'none';
    render();
  }

  function _buildMonthSelect() {
    const sel = document.getElementById('rv-mo'); if (!sel) return;
    const ms  = new Set([currentMonth()]);
    Store.getInvoices().forEach(r => { if (r.date) ms.add(String(r.date).slice(0, 7)); });
    sel.innerHTML = [...ms].sort().reverse().map(m => `<option value="${m}"${m === currentMonth() ? ' selected' : ''}>${m}</option>`).join('');
  }

  function _buildYearSelect() {
    const sel = document.getElementById('rv-yr'); if (!sel) return;
    const ys  = new Set([String(new Date().getFullYear())]);
    Store.getInvoices().forEach(r => { if (r.date) ys.add(String(r.date).slice(0, 4)); });
    sel.innerHTML = [...ys].sort().reverse().map(y => `<option value="${y}"${y === String(new Date().getFullYear()) ? ' selected' : ''}>${y}년</option>`).join('');
  }

  function currentMonth() { return new Date().toISOString().slice(0, 7); }

  // ── 메인 렌더 ──────────────────────────────────────────────
  function render() {
    _buildMonthSelect(); _buildYearSelect();
    const biz = document.getElementById('rv-biz')?.value || '';
    const co  = document.getElementById('rv-co')?.value  || '';
    const tick = '#9aa0ad';

    let fi, periodLabel;
    if (_mode === 'month') {
      const mo = document.getElementById('rv-mo')?.value || currentMonth();
      fi = Store.getInvoices().filter(r => String(r.date || '').startsWith(mo) && (!biz || r.biz === biz) && (!co || r.country === co));
      periodLabel = mo;
    } else if (_mode === 'year') {
      const yr = document.getElementById('rv-yr')?.value || String(new Date().getFullYear());
      fi = Store.getInvoices().filter(r => String(r.date || '').startsWith(yr) && (!biz || r.biz === biz) && (!co || r.country === co));
      periodLabel = yr + '년';
    } else {
      fi = Store.getInvoices().filter(r => (!biz || r.biz === biz) && (!co || r.country === co));
      periodLabel = '전체 누적';
    }

    const totB = fi.reduce((s, r) => s + parseNumber(r.amount), 0);
    const hkB  = fi.filter(r => r.country === 'HK').reduce((s, r) => s + parseNumber(r.amount), 0);
    const sgB  = fi.filter(r => r.country === 'SG').reduce((s, r) => s + parseNumber(r.amount), 0);

    const topEl = document.getElementById('rv-top'); if (!topEl) return;
    topEl.innerHTML =
      renderMetricCard('총 매출액', '$' + formatNumber(Math.round(totB)), periodLabel + ' · ' + fi.length + '건', CONFIG.BIZ_COLORS.DRAM) +
      renderMetricCard('홍콩', '$' + formatNumber(Math.round(hkB)), fi.filter(r => r.country === 'HK').length + '건', CONFIG.COUNTRY_COLORS?.HK || '#B45309') +
      renderMetricCard('싱가포르', '$' + formatNumber(Math.round(sgB)), fi.filter(r => r.country === 'SG').length + '건', CONFIG.COUNTRY_COLORS?.SG || '#0F6E56') +
      renderMetricCard('건수', fi.length + '건', '인보이스');

    // 테이블
    const tbody = document.getElementById('rv-tbody'); if (!tbody) return;
    const sorted = [...fi].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    if (!sorted.length) { tbody.innerHTML = `<tr><td colspan="11"><div class="empty">데이터 없음</div></td></tr>`; }
    else {
      tbody.innerHTML = sorted.map(r => {
        const due      = r.due ? diffDays(today(), r.due) : null;
        const dueColor = r.status === 'paid' ? '#085041' : due !== null && due < 0 ? '#dc2626' : due !== null && due <= 7 ? '#92400e' : 'var(--tx2)';
        const dueText  = r.status === 'paid' ? '수금완료' : due === null ? '-' : due < 0 ? 'D+' + Math.abs(due) : 'D-' + due;
        const stBadge  = r.status === 'paid' ? '<span class="bdg b-ok">수금완료</span>' : r.status === 'partial' ? '<span class="bdg b-warn">부분수금</span>' : '<span class="bdg b-warn">미수금</span>';
        return `<tr>
          <td style="padding:8px 10px;font-size:12px">${r.date || '-'}</td>
          <td style="padding:8px 10px;font-family:var(--font-mono);font-size:11px">${r.no || '-'}</td>
          <td style="padding:8px 10px;font-size:12px">${r.lotNo || '-'}</td>
          <td style="padding:8px 10px">${renderBizTag(r.biz)}</td>
          <td style="padding:8px 10px">${renderCountryTag(r.country)}</td>
          <td style="padding:8px 10px;font-size:12px">${r.customerName || '-'}</td>
          <td style="padding:8px 10px;text-align:right;font-weight:600;font-family:var(--font-mono)">$${formatNumber(Math.round(parseNumber(r.amount)))}</td>
          <td style="padding:8px 10px;font-size:12px">${r.currency || 'USD'}</td>
          <td style="padding:8px 10px;font-size:12px;color:${dueColor}">${r.due || '-'}${due !== null ? ' (' + dueText + ')' : ''}</td>
          <td style="padding:8px 10px">${stBadge}</td>
          <td style="padding:4px 8px">
            ${r.status !== 'paid' ? `<button class="btn sm" style="font-size:11px" onclick="Pages.Invoice.quickPaid(${r.id})">수금</button>` : ''}
          </td>
        </tr>`;
      }).join('');
    }

    _renderCharts(fi, tick);
  }

  // ── 차트 렌더 ──────────────────────────────────────────────
  function _renderCharts(fi, tick) {
    Object.keys(_charts).forEach(k => { if (_charts[k]) { _charts[k].destroy(); _charts[k] = null; } });

    const chartWrap = document.getElementById('rv-chart-wrap'); if (!chartWrap) return;
    const biz = document.getElementById('rv-biz')?.value || '';
    const grid = 'rgba(0,0,0,0.05)';

    // 연도별 모드 → 병렬 그래프
    if (_mode === 'year') {
      const yr = document.getElementById('rv-yr')?.value || String(new Date().getFullYear());
      const months = [];
      for (let m = 1; m <= 12; m++) months.push(yr + '-' + String(m).padStart(2, '0'));
      const labels = months.map(m => m.slice(5) + '월');

      const bizList = biz ? [biz] : CONFIG.BIZ_LIST;

      // 사업별 데이터
      const bizData = {};
      bizList.forEach(b => {
        bizData[b] = months.map(m =>
          Store.getInvoices().filter(r => r.biz === b && String(r.date || '').startsWith(m)).reduce((s, r) => s + parseNumber(r.amount), 0)
        );
      });
      const totalData = months.map((_, i) => bizList.reduce((s, b) => s + bizData[b][i], 0));

      // 요약 카드
      const bizTotals = {};
      bizList.forEach(b => { bizTotals[b] = bizData[b].reduce((s, v) => s + v, 0); });
      const grandTotal = Object.values(bizTotals).reduce((s, v) => s + v, 0);

      const summaryCards = [
        `<div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px;text-align:center">
          <div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">전체</div>
          <div style="font-size:18px;font-weight:600">$${formatNumber(Math.round(grandTotal))}</div>
        </div>`,
        ...bizList.map(b => `
        <div style="background:var(--bg);border-radius:var(--rs);padding:10px 14px;text-align:center;border-top:2px solid ${CONFIG.BIZ_COLORS[b]}">
          <div style="font-size:10px;color:${CONFIG.BIZ_COLORS[b]};text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">${CONFIG.BIZ_LABELS[b]}</div>
          <div style="font-size:18px;font-weight:600;color:${CONFIG.BIZ_COLORS[b]}">$${formatNumber(Math.round(bizTotals[b]))}</div>
        </div>`),
      ].join('');

      chartWrap.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(${bizList.length + 1},1fr);gap:8px;margin-bottom:14px">
          ${summaryCards}
        </div>
        <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);padding:14px">
          <div style="font-size:11px;font-weight:500;color:var(--tx2);margin-bottom:10px">월별 사업별 매출 (병렬)</div>
          <div style="position:relative;height:260px"><canvas id="cv-year-main"></canvas></div>
        </div>`;

      const datasets = [
        ...bizList.map(b => ({
          label: CONFIG.BIZ_LABELS[b],
          data: bizData[b],
          backgroundColor: CONFIG.BIZ_COLORS[b] + '55',
          borderColor: CONFIG.BIZ_COLORS[b],
          borderWidth: 2,
          borderRadius: 3,
          borderSkipped: false,
        })),
        {
          label: '월 합계',
          data: totalData,
          type: 'line',
          borderColor: '#2C2C2A55',
          borderWidth: 1.5,
          borderDash: [4, 3],
          pointRadius: totalData.map(v => v > 0 ? 4 : 0),
          pointBackgroundColor: '#2C2C2A88',
          fill: false,
          tension: 0.3,
          datalabels: { display: false },
        },
      ];

      const datalabelsPlugin = window.ChartDataLabels ? [ChartDataLabels] : [];
      _charts.yearMain = new Chart(document.getElementById('cv-year-main'), {
        type: 'bar',
        plugins: datalabelsPlugin,
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: bizList.length > 1, position: 'top', labels: { font: { size: 11 }, color: tick, boxWidth: 10, padding: 14 } },
            tooltip: {
              mode: 'index', intersect: false,
              callbacks: {
                label: ctx => ` ${ctx.dataset.label}: $${Math.round(ctx.raw).toLocaleString()}`,
                footer: items => {
                  const sum = items.filter(i => i.dataset.label !== '월 합계').reduce((s, i) => s + i.raw, 0);
                  return sum > 0 ? `합계: $${Math.round(sum).toLocaleString()}` : '';
                },
              },
            },
            datalabels: window.ChartDataLabels ? {
              display: ctx => ctx.dataset.label !== '월 합계' && ctx.dataset.data[ctx.dataIndex] > 0,
              anchor: 'end', align: 'end', offset: 2,
              color: ctx => CONFIG.BIZ_COLORS[Object.keys(CONFIG.BIZ_LABELS).find(k => CONFIG.BIZ_LABELS[k] === ctx.dataset.label)] || tick,
              font: { size: 10, weight: '600', family: 'DM Mono, monospace' },
              formatter: v => v > 0 ? '$' + Math.round(v / 1000) + 'K' : '',
              clip: false,
            } : false,
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: tick, font: { size: 11 } }, stacked: false },
            y: { grid: { color: grid }, ticks: { color: tick, font: { size: 11 }, callback: v => v > 0 ? '$' + Math.round(v / 1000) + 'K' : '$0' }, beginAtZero: true, grace: '20%' },
          },
          layout: { padding: { top: 24 } },
        },
      });

    } else {
      // 월별/전체 모드 → 기존 단일 차트 + 도넛
      chartWrap.innerHTML = `
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px">
          <div class="cw"><div class="ct">매출 추이</div><div style="position:relative;height:190px"><canvas id="cv-rev"></canvas></div></div>
          <div class="cw"><div class="ct">사업별 비중</div><div style="position:relative;height:190px"><canvas id="cv-biz"></canvas></div></div>
        </div>`;

      const months = [...new Set(fi.map(r => String(r.date || '').slice(0, 7)))].sort();
      const revCanvas = document.getElementById('cv-rev');
      if (revCanvas && months.length) {
        _charts.rev = new Chart(revCanvas, {
          type: 'bar',
          plugins: window.ChartDataLabels ? [ChartDataLabels] : [],
          data: {
            labels: months.map(m => m.slice(5) + '월'),
            datasets: [{
              label: '매출액',
              data: months.map(m => fi.filter(r => String(r.date || '').startsWith(m)).reduce((s, r) => s + parseNumber(r.amount), 0)),
              backgroundColor: CONFIG.BIZ_COLORS.DRAM + '44',
              borderColor: CONFIG.BIZ_COLORS.DRAM,
              borderWidth: 2, borderRadius: 3,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              datalabels: window.ChartDataLabels ? {
                display: ctx => ctx.dataset.data[ctx.dataIndex] > 0,
                anchor: 'end', align: 'end', offset: 2,
                color: CONFIG.BIZ_COLORS.DRAM,
                font: { size: 10, weight: '600' },
                formatter: v => v > 0 ? '$' + Math.round(v / 1000) + 'K' : '',
                clip: false,
              } : false,
            },
            scales: {
              x: { grid: { display: false }, ticks: { color: tick, font: { size: 11 } } },
              y: { grid: { color: grid }, ticks: { color: tick, font: { size: 11 }, callback: v => '$' + Math.round(v / 1000) + 'K' }, beginAtZero: true, grace: '20%' },
            },
            layout: { padding: { top: 20 } },
          },
        });
      }

      const bizCanvas = document.getElementById('cv-biz');
      const bizData   = CONFIG.BIZ_LIST.map(b => fi.filter(r => r.biz === b).reduce((s, r) => s + parseNumber(r.amount), 0));
      if (bizCanvas && bizData.some(v => v > 0)) {
        _charts.biz = new Chart(bizCanvas, {
          type: 'doughnut',
          data: { labels: CONFIG.BIZ_LIST.map(b => CONFIG.BIZ_LABELS[b]), datasets: [{ data: bizData, backgroundColor: CONFIG.BIZ_LIST.map(b => CONFIG.BIZ_COLORS[b] + 'cc'), borderWidth: 0 }] },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, color: tick, boxWidth: 10, padding: 10 } } },
          },
        });
      }
    }
  }

  function exportExcel() { Pages.Invoice.exportExcel(); }

  return { render, setMode };

})();
