/**
 * pages/progress.js
 * LOT 진행 현황 — 월별 처리량 차트 + LOT 카드 목록
 */

Pages.Progress = (() => {

  let _chart      = null;
  let _openLotId  = null;

  // ── 차트 연도/지역/사업 필터 (Store에 위임) ─────────────────
  function setChartBiz(el) {
    document.querySelectorAll('[data-chart-biz]').forEach(e => e.classList.remove('on'));
    el.classList.add('on');
    Store.setChartFilter({ biz: el.dataset.chartBiz });
    renderChart();
  }

  function setChartCountry(el) {
    document.querySelectorAll('[data-chart-co]').forEach(e => e.classList.remove('on'));
    el.classList.add('on');
    Store.setChartFilter({ country: el.dataset.chartCo });
    renderChart();
  }

  function setChartYear(el, year) {
    Store.setChartFilter({ year });
    document.querySelectorAll('[data-chart-year]').forEach(e => {
      const active = Number(e.dataset.chartYear) === year;
      e.style.background    = active ? 'var(--navy)' : 'none';
      e.style.color         = active ? '#fff' : 'var(--tx2)';
      e.style.borderColor   = active ? 'var(--navy)' : 'var(--bd2)';
    });
    renderChart();
  }

  function initYearTabs() {
    const tabs = document.getElementById('chart-year-tabs');
    if (!tabs) return;
    const curYear  = new Date().getFullYear();
    const endYear  = Math.max(curYear, CONFIG.CHART_START_YEAR);
    const selYear  = Store.getChartFilter().year;
    let html = '';
    for (let y = CONFIG.CHART_START_YEAR; y <= endYear; y++) {
      const active = y === selYear;
      html += `<button onclick="Pages.Progress.setChartYear(this,${y})" data-chart-year="${y}"
        style="padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid;transition:.15s;font-family:'DM Sans',sans-serif;
        ${active ? 'background:var(--navy);color:#fff;border-color:var(--navy)' : 'background:none;color:var(--tx2);border-color:var(--bd2)'}">${y}년</button>`;
    }
    tabs.innerHTML = html;
  }

  function renderChart() {
    const canvas = document.getElementById('monthly-chart');
    if (!canvas) return;
    const { biz: chartBiz, country: chartCo, year: chartYear } = Store.getChartFilter();
    const dailies = Store.getDailies();

    const months = [];
    for (let m = 1; m <= 12; m++) {
      months.push(chartYear + '-' + (m < 10 ? '0' : '') + m);
    }
    const labels = months.map(m => m.split('-')[1] + '월');

    const BIZ_COLORS = CONFIG.BIZ_COLORS;
    const CO_COLORS  = { HK: '#B45309', SG: '#0F6E56' };
    const CO_NAMES   = CONFIG.COUNTRY_LABELS;

    let datasets = [];

    if (chartCo) {
      // 특정 지역 고정 → 사업별 분리
      const list = chartBiz ? [chartBiz] : CONFIG.BIZ_LIST;
      datasets = list.map(b => ({
        label: CONFIG.BIZ_LABELS[b],
        data:  months.map(m => dailies.filter(r => String(r.date || '').startsWith(m) && r.biz === b && r.country === chartCo).reduce((s, r) => s + parseNumber(r.proc), 0)),
        backgroundColor: BIZ_COLORS[b] + '55',
        borderColor: BIZ_COLORS[b],
        borderWidth: 2, borderRadius: 3, borderSkipped: false,
      }));
    } else if (chartBiz) {
      // 특정 사업 고정 → 지역별 분리
      datasets = ['HK', 'SG'].map(co => ({
        label: CO_NAMES[co],
        data:  months.map(m => dailies.filter(r => String(r.date || '').startsWith(m) && r.biz === chartBiz && r.country === co).reduce((s, r) => s + parseNumber(r.proc), 0)),
        backgroundColor: CO_COLORS[co] + '55',
        borderColor: CO_COLORS[co],
        borderWidth: 2, borderRadius: 3, borderSkipped: false,
      }));
    } else {
      // 전체 → 사업별
      datasets = CONFIG.BIZ_LIST.map(b => ({
        label: CONFIG.BIZ_LABELS[b],
        data:  months.map(m => dailies.filter(r => String(r.date || '').startsWith(m) && r.biz === b).reduce((s, r) => s + parseNumber(r.proc), 0)),
        backgroundColor: BIZ_COLORS[b] + '55',
        borderColor: BIZ_COLORS[b],
        borderWidth: 2, borderRadius: 3, borderSkipped: false,
      }));
    }

    if (_chart) { _chart.destroy(); _chart = null; }

    const datalabelsPlugin = window.ChartDataLabels ? [window.ChartDataLabels] : [];
    _chart = new Chart(canvas, {
      type: 'bar',
      plugins: datalabelsPlugin,
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: datasets.length > 1, labels: { font: { size: 11 }, color: '#888', boxWidth: 10, padding: 12 } },
          tooltip: { mode: 'index', intersect: false, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw)}` } },
          datalabels: {
            display: ctx => { const v = ctx.dataset.data[ctx.dataIndex]; const mx = Math.max(...ctx.dataset.data); return v > 0 && (mx === 0 || v / mx > 0.03); },
            anchor: 'end', align: 'end',
            color: '#555', font: { size: 10, weight: '600', family: 'DM Mono, monospace' },
            formatter: v => v > 0 ? formatNumber(v) : '', offset: 2, clip: false,
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#888', font: { size: 11 } } },
          y: { grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: '#888', font: { size: 11 }, callback: v => formatNumber(v) }, beginAtZero: true, grace: '15%' },
        },
        layout: { padding: { top: 20 } },
      },
    });

    // 총계 카드
    const yearStr = String(chartYear);
    let summaryItems = [];
    if (chartBiz) {
      const coList = chartCo ? [chartCo] : ['HK', 'SG'];
      summaryItems = coList.map(co => ({
        label: CO_NAMES[co], color: CO_COLORS[co],
        yearTotal: dailies.filter(r => r.biz === chartBiz && r.country === co && String(r.date || '').startsWith(yearStr)).reduce((s, r) => s + parseNumber(r.proc), 0),
        thisM:     dailies.filter(r => r.biz === chartBiz && r.country === co && String(r.date || '').startsWith(currentMonth())).reduce((s, r) => s + parseNumber(r.proc), 0),
      }));
    } else {
      const bizList = chartBiz ? [chartBiz] : CONFIG.BIZ_LIST;
      summaryItems = bizList.map(b => ({
        label: CONFIG.BIZ_LABELS[b], color: BIZ_COLORS[b],
        yearTotal: dailies.filter(r => r.biz === b && (chartCo ? r.country === chartCo : true) && String(r.date || '').startsWith(yearStr)).reduce((s, r) => s + parseNumber(r.proc), 0),
        thisM:     dailies.filter(r => r.biz === b && (chartCo ? r.country === chartCo : true) && String(r.date || '').startsWith(currentMonth())).reduce((s, r) => s + parseNumber(r.proc), 0),
      }));
    }

    const totEl = document.getElementById('monthly-totals');
    if (totEl) {
      totEl.style.gridTemplateColumns = `repeat(${summaryItems.length},1fr)`;
      totEl.innerHTML = summaryItems.map(it => `
        <div style="background:var(--bg);border-radius:8px;padding:10px 12px;text-align:center">
          <div style="font-size:11px;font-weight:600;color:${it.color};margin-bottom:4px">${it.label}</div>
          <div style="font-size:16px;font-weight:600;font-family:var(--font-mono)">${formatNumber(it.yearTotal)}</div>
          <div style="font-size:10px;color:var(--tx3);margin-top:2px">${chartYear}년 누적</div>
          <div style="font-size:12px;font-weight:500;color:var(--tx2);margin-top:4px">이달 ${formatNumber(it.thisM)}</div>
        </div>`).join('');
    }
  }

  // ── LOT 필터 ────────────────────────────────────────────────
  function setFilter(el, key) {
    const val = el.dataset.v || el.dataset.k && '';
    Store.setLotFilter({ [key === 'biz' ? 'biz' : key === 'co' ? 'country' : 'status']: el.dataset.v });
    document.querySelectorAll(`[data-k="${el.dataset.k}"]`).forEach(e => e.classList.remove('on'));
    el.classList.add('on');
    render();
  }

  // ── LOT 카드 목록 ────────────────────────────────────────────
  function render() {
    const filter  = Store.getLotFilter();
    const dailies = Store.getDailies();
    let lots      = Store.getLots();

    if (filter.biz)    lots = lots.filter(l => l.biz === filter.biz);
    if (filter.country) lots = lots.filter(l => l.country === filter.country);
    if (filter.status) {
      lots = lots.filter(l =>
        filter.status === 'done'    ? getLotStatus(l) === 'done'    :
        filter.status === 'overdue' ? getLotStatus(l) === 'overdue' :
                                      getLotStatus(l) === 'inprog');
    }
    lots.sort((a, b) => String(b.inDate || '').localeCompare(String(a.inDate || '')));

    const cntEl = document.getElementById('pr-cnt');
    if (cntEl) cntEl.textContent = lots.length + '건';

    const el = document.getElementById('pr-cards');
    if (!el) return;
    if (!lots.length) { el.innerHTML = '<div class="empty">LOT가 없습니다</div>'; return; }

    el.innerHTML = lots.map(lot => {
      if (!lot || !lot.id) return '';
      const st     = getLotStatus(lot);
      const cum    = getLotCumulative(lot.id, dailies);
      const rem    = getLotRemaining(lot, dailies);
      const pct    = getLotProgress(lot, dailies);
      const pbC    = st === 'done' ? '#16a34a' : st === 'overdue' ? '#dc2626' : pct >= 70 ? CONFIG.BIZ_COLORS.SSD : CONFIG.BIZ_COLORS.DRAM;
      const dd     = lot.targetDate ? diffDays(today(), lot.targetDate) : null;
      const isOpen = _openLotId === lot.id;
      const isDram = lot.biz === 'DRAM';
      const hist   = dailies.filter(r => String(r.lotId) === String(lot.id)).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

      const histHTML = isOpen ? _renderHistory(lot, hist, isDram) : '';

      return `
        <div class="lc ${(lot.biz || 'dram').toLowerCase()}" id="prog-${lot.id}">
          <div onclick="Pages.Progress.toggleCard(${lot.id})" style="cursor:pointer">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
              <div>
                <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">
                  <span style="font-size:14px;font-weight:600;font-family:var(--font-mono)">${lot.lotNo || lot.id}</span>
                  ${renderBizTag(lot.biz)} ${renderCountryTag(lot.country)} ${renderStatusBadge(st)}
                </div>
                <div style="font-size:12px;color:var(--tx2)">${lot.customerName || ''} ${lot.product ? '· ' + lot.product : ''}</div>
              </div>
              <div style="display:flex;align-items:flex-start;gap:10px">
                <div style="text-align:right;font-size:12px">
                  <div style="color:var(--tx2)">입고 ${lot.inDate || ''}</div>
                  <div style="font-weight:500;color:${st === 'overdue' ? '#dc2626' : 'var(--tx)'};margin-top:2px">목표 ${lot.targetDate || ''}</div>
                  ${lot.actualDone ? `<div style="color:#16a34a;margin-top:2px">완료 ${lot.actualDone}</div>` : ''}
                </div>
                <svg width="14" height="14" fill="none" viewBox="0 0 16 16" style="margin-top:3px;flex-shrink:0;transition:transform .2s;transform:${isOpen ? 'rotate(180deg)' : 'rotate(0)'}"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-bottom:7px">
              <div><div style="font-size:10px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">총 입고</div><div style="font-size:13px;font-weight:500">${formatNumber(parseNumber(lot.qty))} ${lot.unit || '개'}</div></div>
              <div><div style="font-size:10px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">누적 처리</div><div style="font-size:13px;font-weight:500">${formatNumber(cum)}</div></div>
              <div><div style="font-size:10px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">잔량</div><div style="font-size:13px;font-weight:500;color:${rem > 0 ? '#92400e' : '#166534'}">${formatNumber(rem)}</div></div>
              <div><div style="font-size:10px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">진행률</div><div style="font-size:13px;font-weight:500;color:${pbC}">${pct}%</div></div>
              <div><div style="font-size:10px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">${st === 'done' ? '상태' : '남은 일수'}</div><div style="font-size:13px;font-weight:500;color:${dd !== null && dd < 0 ? '#dc2626' : dd !== null && dd <= 3 ? '#92400e' : 'var(--tx)'}"> ${st === 'done' ? '✓' : dd !== null ? dd + '일' : '-'}</div></div>
            </div>
            <div class="lot-w"><div class="lot-b" style="width:${pct}%;background:${pbC}"></div></div>
            <div style="font-size:11px;color:var(--tx3);margin-top:5px;display:flex;justify-content:space-between">
              <span>처리 기록 ${hist.length}건</span>
              <span style="color:${CONFIG.BIZ_COLORS[lot.biz] || 'var(--tx3)'}">▼ ${isOpen ? '닫기' : '이력 보기'}</span>
            </div>
          </div>
          ${histHTML}
        </div>`;
    }).join('');
  }

  function _renderHistory(lot, hist, isDram) {
    const rows = hist.length === 0
      ? '<div style="font-size:12px;color:var(--tx3);text-align:center;padding:12px 0">처리 기록 없음</div>'
      : '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
        + '<thead><tr style="background:var(--bg)">'
        + '<th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;border-bottom:1px solid var(--bd);white-space:nowrap">날짜</th>'
        + (isDram ? '<th style="padding:6px 10px;text-align:right;font-size:10px;font-weight:600;color:#166534;border-bottom:1px solid var(--bd)">Normal</th>'
          + '<th style="padding:6px 10px;text-align:right;font-size:10px;font-weight:600;color:#92400e;border-bottom:1px solid var(--bd)">No Boot</th>'
          + '<th style="padding:6px 10px;text-align:right;font-size:10px;font-weight:600;color:#991b1b;border-bottom:1px solid var(--bd)">Abnormal</th>' : '')
        + '<th style="padding:6px 10px;text-align:right;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bd)">처리</th>'
        + '<th style="padding:6px 10px;text-align:right;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bd)">누적</th>'
        + '<th style="padding:6px 10px;text-align:right;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bd)">잔량</th>'
        + '<th style="padding:6px 10px;text-align:right;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bd)">진행률</th>'
        + '<th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:600;color:var(--tx3);border-bottom:1px solid var(--bd)">비고</th>'
        + '</tr></thead><tbody>'
        + hist.map((r, i) => {
            const tot    = isDram ? (parseNumber(r.normal) + parseNumber(r.noBoot) + parseNumber(r.abnormal)) || parseNumber(r.proc) : parseNumber(r.proc);
            const rowPct = parseNumber(lot.qty) > 0 ? Math.min(100, Math.round(parseNumber(r.cumul) / parseNumber(lot.qty) * 100)) : 0;
            return `<tr style="${i % 2 === 0 ? '' : 'background:var(--bg)'}">
              <td style="padding:6px 10px;font-family:var(--font-mono)">${r.date}</td>
              ${isDram ? `<td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);color:#166534">${formatNumber(parseNumber(r.normal))}</td>
                <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);color:#92400e">${formatNumber(parseNumber(r.noBoot))}</td>
                <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);color:#991b1b">${formatNumber(parseNumber(r.abnormal))}</td>` : ''}
              <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-weight:600">${formatNumber(tot)}</td>
              <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);color:var(--tx2)">${formatNumber(parseNumber(r.cumul))}</td>
              <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);color:${parseNumber(r.remain) > 0 ? '#92400e' : '#166534'}">${formatNumber(parseNumber(r.remain))}</td>
              <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);color:${CONFIG.BIZ_COLORS[lot.biz] || 'var(--tx)'}">${rowPct}%</td>
              <td style="padding:6px 10px;font-size:11px;color:var(--tx3)">${r.note || ''}</td>
            </tr>`;
          }).join('')
        + '</tbody></table></div>';

    return `
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--bd)">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:8px">일별 처리 이력 (${hist.length}건)</div>
        ${rows}
      </div>`;
  }

  function exportExcel() {
    const dailies = Store.getDailies();
    const data = Store.getLots().map(l => ({
      'LOT번호': l.lotNo || l.id, '사업': CONFIG.BIZ_LABELS[l.biz] || l.biz,
      '국가': CONFIG.COUNTRY_LABELS[l.country] || l.country, '고객사': l.customerName || '',
      '입고일': l.inDate, '목표완료일': l.targetDate, '실완료일': l.actualDone || '',
      '총수량': parseNumber(l.qty), '단위': l.unit || '개',
      '누적처리': getLotCumulative(l.id, dailies),
      '잔량': getLotRemaining(l, dailies),
      '진행률(%)': getLotProgress(l, dailies),
      '상태': getLotStatus(l) === 'done' ? '완료' : getLotStatus(l) === 'overdue' ? '지연' : '진행중',
      '단가': parseNumber(l.price), '통화': l.currency || '', '제품': l.product || '',
    }));
    _xlsxExport(data, 'LOT현황_' + today() + '.xlsx', 'LOT현황');
  }

  function toggleCard(lotId) {
    _openLotId = _openLotId === lotId ? null : lotId;
    render();
    if (_openLotId) {
      const el = document.getElementById('prog-' + lotId);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
  }

  function currentMonth() { return new Date().toISOString().slice(0, 7); }

  return { render, renderChart, initYearTabs, setFilter, setChartBiz, setChartCountry, setChartYear, toggleCard, exportExcel };

})();
