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

  // ── LOT 목록 테이블 ─────────────────────────────────────────
  function render() {
    const filter  = Store.getLotFilter();
    const dailies = Store.getDailies();
    let lots      = Store.getLots();

    if (filter.biz)     lots = lots.filter(l => l.biz === filter.biz);
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

    const BAR_COLOR = { done: '#1D9E75', inprog: '#185FA5', overdue: '#E24B4A' };
    const ST_LABEL  = { done: '완료', inprog: '진행중', overdue: '지연' };
    const ST_BADGE  = {
      done:    'background:#E1F5EE;color:#085041',
      inprog:  'background:#E6F1FB;color:#0C447C',
      overdue: 'background:#FCEBEB;color:#791F1F',
    };
    const BIZ_BADGE = {
      DRAM: 'background:#E6F1FB;color:#0C447C',
      SSD:  'background:#E1F5EE;color:#085041',
      MID:  'background:#EEEDFE;color:#3C3489',
    };
    const CO_BADGE = {
      HK: 'background:#FAEEDA;color:#633806',
      SG: 'background:#E1F5EE;color:#085041',
    };

    const TH = (label, align = 'left', extra = '') =>
      `<th style="padding:9px 12px;text-align:${align};font-size:11px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;background:var(--bg);border-bottom:0.5px solid var(--bd);white-space:nowrap;${extra}">${label}</th>`;

    const rows = lots.map(lot => {
      const st  = getLotStatus(lot);
      const cum = getLotCumulative(lot.id, dailies);
      const rem = getLotRemaining(lot, dailies);
      const pct = getLotProgress(lot, dailies);
      const dd  = lot.targetDate ? diffDays(today(), lot.targetDate) : null;
      const pctColor = st === 'done' ? '#1D9E75' : st === 'overdue' ? '#A32D2D' : pct >= 70 ? '#185FA5' : '#BA7517';

      return `
        <tr style="border-bottom:0.5px solid var(--bd);cursor:pointer" onclick="Pages.Progress.toggleCard(${lot.id})" title="클릭하여 이력 보기">
          <td style="padding:9px 12px;font-family:var(--font-mono);font-size:12px;font-weight:500">${lot.lotNo || lot.id}</td>
          <td style="padding:9px 12px"><span class="bdg" style="${CO_BADGE[lot.country] || ''}">${lot.country}</span></td>
          <td style="padding:9px 12px"><span class="bdg" style="${BIZ_BADGE[lot.biz] || ''}">${lot.biz}</span></td>
          <td style="padding:9px 12px;font-size:12px;color:var(--tx2)">${lot.customerName || '—'}</td>
          <td style="padding:9px 12px;text-align:right;font-family:var(--font-mono);font-size:12px">${formatNumber(parseNumber(lot.qty))}</td>
          <td style="padding:9px 12px;text-align:right;font-family:var(--font-mono);font-size:12px;color:${CONFIG.BIZ_COLORS[lot.biz] || 'var(--tx)'}">${formatNumber(cum)}</td>
          <td style="padding:9px 12px;text-align:right;font-family:var(--font-mono);font-size:12px;color:${rem > 0 ? '#BA7517' : 'var(--tx3)'}">${formatNumber(rem)}</td>
          <td style="padding:9px 12px;min-width:130px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;height:5px;background:var(--bd);border-radius:3px;overflow:hidden">
                <div style="height:100%;border-radius:3px;background:${BAR_COLOR[st]};width:${pct}%"></div>
              </div>
              <span style="font-size:11px;font-weight:500;color:${pctColor};min-width:28px;text-align:right">${pct}%</span>
            </div>
          </td>
          <td style="padding:9px 12px;font-size:11px;color:var(--tx3)">${lot.inDate || '—'}</td>
          <td style="padding:9px 12px;font-size:11px;color:${st === 'overdue' ? '#A32D2D' : 'var(--tx3)'};font-weight:${st === 'overdue' ? '500' : '400'}">${lot.targetDate || '—'}${dd !== null && st !== 'done' ? ` <span style="font-size:10px;color:${dd < 0 ? '#A32D2D' : dd <= 3 ? '#BA7517' : 'var(--tx3)'}">(${dd < 0 ? 'D+' + Math.abs(dd) : 'D-' + dd})</span>` : ''}</td>
          <td style="padding:9px 12px"><span class="bdg" style="${ST_BADGE[st]}">${ST_LABEL[st]}</span></td>
        </tr>
        ${_openLotId === lot.id ? `<tr><td colspan="11" style="padding:0;background:var(--bg)">${_renderHistoryRow(lot, dailies)}</td></tr>` : ''}`;
    }).join('');

    el.innerHTML = `
      <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);overflow:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr>
              ${TH('LOT 번호')}${TH('지역')}${TH('사업')}${TH('고객사')}
              ${TH('입고량','right')}${TH('처리량','right')}${TH('잔량','right')}
              ${TH('진행률','left','min-width:130px')}
              ${TH('입고일')}${TH('목표완료')}${TH('상태')}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function _renderHistoryRow(lot, dailies) {
    const isDram = lot.biz === 'DRAM';
    const hist   = dailies.filter(r => String(r.lotId) === String(lot.id)).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return _renderHistory(lot, hist, isDram);
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
  }

  function currentMonth() { return new Date().toISOString().slice(0, 7); }

  return { render, renderChart, initYearTabs, setFilter, setChartBiz, setChartCountry, setChartYear, toggleCard, exportExcel };

})();
