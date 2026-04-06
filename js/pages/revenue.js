/**
 * pages/revenue.js
 * 매출 현황 — 월별/연도별/전체 + 사업별 병렬 그래프
 */

Pages.Revenue = (() => {

  let _mode   = 'year';
  let _biz    = '';
  let _co     = '';
  let _charts = {};

  function setMode(m) {
    _mode = m;
    ['month','year','all'].forEach(x => {
      const btn = document.getElementById('rv-mode-' + x); if (!btn) return;
      btn.style.background = x === m ? '#1D1D1F' : 'var(--card)';
      btn.style.color      = x === m ? '#fff' : 'var(--tx)';
      btn.style.fontWeight = x === m ? '500' : '400';
    });
    document.getElementById('rv-mo').style.display = m === 'month' ? '' : 'none';
    document.getElementById('rv-yr').style.display = m === 'year'  ? '' : 'none';
    render();
  }
  function setBiz(el, val) {
    _biz = val;
    ['rv-biz-all','rv-biz-dram','rv-biz-ssd','rv-biz-mid'].forEach(id => {
      const b = document.getElementById(id); if (!b) return;
      b.classList.remove('on');
    });
    el.classList.add('on');
    render();
  }

  function setCo(el, val) {
    _co = val;
    ['rv-co-all','rv-co-hk','rv-co-sg'].forEach(id => {
      const b = document.getElementById(id); if (!b) return;
      b.classList.remove('on');
    });
    el.classList.add('on');
    render();
  }

  function _buildMonthSelect() {
    const sel = document.getElementById('rv-mo'); if (!sel) return;
    const ms  = new Set([currentMonth()]);
    Store.getLots().forEach(l => { if (l.inDate) ms.add(String(l.inDate).slice(0, 7)); });
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
    const biz  = _biz;
    const co   = _co;
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

    // ── 하단 LOT 기반 테이블 ───────────────────────────────────
    const tbody = document.getElementById('rv-tbody'); if (!tbody) return;

    // 전체 LOT를 입고일 내림차순으로
    let lots = Store.getLots();
    if (biz) lots = lots.filter(l => l.biz === biz);
    if (co)  lots = lots.filter(l => l.country === co);
    lots = [...lots].sort((a, b) => String(b.inDate || '').localeCompare(String(a.inDate || '')));

    const dailies  = Store.getDailies();
    const invoices = Store.getInvoices();

    const CO_STYLE  = {
      HK: 'border:1px solid #9DC3F0;color:#1B4F8A;background:#EBF2FB',
      SG: 'border:1px solid #8DCFBC;color:#0F6E56;background:#E8F5F0',
    };
    const BIZ_STYLE = {
      DRAM: 'border:1px solid #9DC3F0;color:#1B4F8A;background:#EBF2FB',
      SSD:  'border:1px solid #8DCFBC;color:#0F6E56;background:#E8F5F0',
      MID:  'border:1px solid #C4A8DC;color:#6A3D7C;background:#F3EEF8',
    };

    function bdg(txt, style) { return `<span style="display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:1px 6px;border-radius:2px;white-space:nowrap;border:1px solid;${style}">${txt}</span>`; }

    if (!lots.length) {
      tbody.innerHTML = `<tr><td colspan="14" style="padding:20px;text-align:center;color:#000">데이터 없음</td></tr>`;
    } else {
      let totalAmt = 0;
      const rows = lots.map((lot, i) => {
        const inv      = invoices.find(r => String(r.lotId) === String(lot.id));
        const amt      = inv ? parseNumber(inv.amount) : 0;
        const hasInv   = !!inv;
        const st       = lot.inDate > today() ? 'upcoming' : getLotStatus(lot);
        const pct      = st === 'upcoming' ? 0 : getLotProgress(lot, dailies);
        const qty      = parseNumber(lot.qty);
        const barColor = st === 'done' ? '#1D9E75' : st === 'overdue' ? '#E24B4A' : st === 'upcoming' ? '#378ADD' : pct >= 80 ? '#EF9F27' : '#185FA5';
        const pctColor = st === 'done' ? '#085041' : st === 'overdue' ? '#A32D2D' : st === 'upcoming' ? '#185FA5' : pct >= 80 ? '#BA7517' : '#0C447C';

        const stStyle = st === 'upcoming' ? 'border:1px solid var(--bd);color:var(--tx2);background:transparent'
          : st === 'done'    ? 'border:1px solid var(--bd);color:var(--tx2);background:transparent'
          : st === 'overdue' ? 'border:1px solid #FECACA;color:#dc2626;background:#FEF2F2'
          : 'border:1px solid #34C759;color:#1A7F37;background:#F0FBF3';
        const stLabel = st === 'upcoming' ? '입고예정' : st === 'done' ? '완료' : st === 'overdue' ? '지연' : '진행중';

        // ── 인보이스 청구 상태 결정 ─────────────────────────────
        const isDone    = st === 'done';
        const isWorking = !isDone && st !== 'upcoming';
        // 청구 상태 라벨 & 스타일
        let claimLabel, claimStyle, rowBg, rowBorder;
        if (!isDone && st !== 'upcoming') {
          claimLabel = '작업 진행중';
          claimStyle = 'color:#888';
          rowBg      = '';
          rowBorder  = '';
        } else if (isDone && !hasInv) {
          claimLabel = '입력 대기';
          claimStyle = 'color:#B45309;font-weight:600';
          rowBg      = 'background:#FFFBF0';
          rowBorder  = '';
        } else if (isDone && hasInv) {
          claimLabel = '청구 완료';
          claimStyle = 'color:#1A6B3A;font-weight:600';
          rowBg      = '';
          rowBorder  = '';
        } else {
          claimLabel = '—'; claimStyle = 'color:#999'; rowBg = ''; rowBorder = '';
        }

        // 청구일 (인보이스 date)
        const invDate = inv?.date || '';

        // 작업 완료일
        const doneDate      = isDone ? (lot.actualDone || lot.targetDate || '—') : st === 'upcoming' ? '—' : '진행중';
        const doneDateColor = isDone ? '#1D1D1F' : (st==='upcoming' ? 'var(--tx3)' : '#3A3A3C');

        totalAmt += amt;

        const finalRowBg = rowBg || '';
        const P = '';
        return `
          <tr>
            <td class="td-c">${i + 1}</td>
            <td class="td-c td-ellipsis">${lot.inDate || '—'}</td>
            <td class="td-c td-ellipsis" style="color:${doneDateColor};font-weight:${isDone?'500':'400'}">${doneDate}</td>
            <td class="td-c td-ellipsis" style="font-family:'DM Mono',monospace">${lot.lotNo || lot.id}</td>
            <td class="td-c">${bdg(lot.biz, BIZ_STYLE[lot.biz] || '')}</td>
            <td class="td-c">${bdg(lot.country, CO_STYLE[lot.country] || '')}</td>
            <td class="td-l td-ellipsis">${lot.customerName || '—'}</td>
            <td class="td-num">${formatNumber(qty)}</td>
            <td class="td-r" style="color:${barColor};font-weight:600">
              ${st === 'upcoming' ? '입고예정' : pct + '%'}
            </td>
            <td class="td-num" style="width:120px">
              ${hasInv
                ? `<div style="display:flex;align-items:center;justify-content:flex-end;gap:4px">
                    <span id="rv-amt-display-${lot.id}" style="font-family:'DM Mono',monospace;font-size:12px;font-weight:600;color:#000">$${formatNumber(Math.round(amt))}</span>
                    <input type="number" id="rv-amt-${lot.id}" value="${amt}"
                      style="display:none;width:80px;padding:3px 6px;border:1px solid #999;font-size:12px;text-align:right;font-family:'DM Mono',monospace;background:#fff;color:#000">
                  </div>`
                : isDone
                  ? `<input type="number" placeholder="금액" id="rv-amt-${lot.id}"
                      style="width:80px;padding:3px 6px;border:1px solid #F59E0B;font-size:12px;text-align:right;font-family:'DM Mono',monospace;background:#FFFBF0;color:#000">`
                  : `<span style="font-size:12px;color:#999">—</span>`}
            </td>
            <td class="td-c" style="width:100px">
              ${hasInv
                ? `<div style="display:flex;align-items:center;justify-content:center;gap:3px">
                    <span id="rv-date-display-${lot.id}" style="font-size:12px;color:#000">${invDate||'—'}</span>
                    <input type="date" id="rv-date-edit-${lot.id}" value="${invDate}"
                      style="display:none;padding:3px 5px;border:1px solid #999;font-size:11px;color:#000;background:#fff">
                  </div>`
                : isDone
                  ? `<input type="date" id="rv-date-${lot.id}"
                      style="padding:3px 5px;border:1px solid #F59E0B;font-size:11px;background:#FFFBF0;color:#000">`
                  : `<span style="color:#999">—</span>`}
            </td>
            <td class="td-num">
              ${hasInv && qty > 0
                ? '<span style="color:#1D1D1F;font-weight:500">$' + (amt / qty).toFixed(1) + '</span>'
                : '<span style="color:#999">—</span>'}
            </td>

            <td class="td-c" style="${claimStyle}">${claimLabel}</td>
            <td class="td-c" style="width:50px">
              ${hasInv
                ? `<button style="font-size:11px;padding:2px 8px;border:1px solid #999;border-radius:2px;background:#fff;cursor:pointer;font-family:Pretendard,sans-serif;color:#000"
                    onclick="(function(){
                      var d=document.getElementById('rv-amt-display-${lot.id}');
                      var dd=document.getElementById('rv-date-display-${lot.id}');
                      var ai=document.getElementById('rv-amt-${lot.id}');
                      var di=document.getElementById('rv-date-edit-${lot.id}');
                      var b=this;
                      if(ai.style.display==='none'){
                        if(d)d.style.display='none';if(dd)dd.style.display='none';
                        ai.style.display='inline-block';if(di)di.style.display='inline-block';
                        b.textContent='저장';b.style.background='#1D1D1F';b.style.color='#fff';
                      } else {
                        Pages.Revenue.saveInvoice(${lot.id}, ai.value, di?di.value:'');
                      }
                    }).call(this)">수정</button>`
                : isDone
                  ? `<button style="font-size:11px;padding:2px 8px;border:1px solid #F59E0B;border-radius:2px;background:#FFFBF0;cursor:pointer;font-family:Pretendard,sans-serif;color:#B45309"
                      onclick="Pages.Revenue.saveInvoice(${lot.id}, document.getElementById('rv-amt-${lot.id}')?.value, document.getElementById('rv-date-${lot.id}')?.value)">저장</button>`
                  : ''}
            </td>
          </tr>`;
      }).join('');

      // 합계 행
      const totalRow = `
        <tr>
          <td colspan="9" class="td-sum td-l">합계 (${lots.length}건)</td>
          <td class="td-sum td-num">$${formatNumber(Math.round(totalAmt))}</td>
          <td colspan="3" class="td-sum"></td>
        </tr>`;

      tbody.innerHTML = rows + totalRow;
    }

    _renderCharts(fi, tick);
  }

  // ── 차트 렌더 ──────────────────────────────────────────────
  function _renderCharts(fi, tick) {
    Object.keys(_charts).forEach(k => { if (_charts[k]) { _charts[k].destroy(); _charts[k] = null; } });

    const chartWrap = document.getElementById('rv-chart-wrap'); if (!chartWrap) return;
    const biz  = _biz;
    const co   = _co;   // ← 지역 필터 추가
    const grid = 'rgba(0,0,0,0.05)';

    // 연도별 모드 → 병렬 그래프
    if (_mode === 'year') {
      const yr = document.getElementById('rv-yr')?.value || String(new Date().getFullYear());
      const months = [];
      for (let m = 1; m <= 12; m++) months.push(yr + '-' + String(m).padStart(2, '0'));
      const labels = months.map(m => m.slice(5) + '월');

      const bizList = biz ? [biz] : CONFIG.BIZ_LIST;

      // 사업별 데이터 — 지역 필터 적용
      const bizData = {};
      bizList.forEach(b => {
        bizData[b] = months.map(m =>
          Store.getInvoices().filter(r =>
            r.biz === b &&
            (!co || r.country === co) &&
            String(r.date || '').startsWith(m)
          ).reduce((s, r) => s + parseNumber(r.amount), 0)
        );
      });
      const totalData = months.map((_, i) => bizList.reduce((s, b) => s + bizData[b][i], 0));

      // 요약 카드 — 지역 필터 적용
      const bizTotals = {};
      bizList.forEach(b => { bizTotals[b] = bizData[b].reduce((s, v) => s + v, 0); });
      const grandTotal = Object.values(bizTotals).reduce((s, v) => s + v, 0);

      const summaryCards = [
        `<div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:10px 14px;text-align:center">
          <div style="font-size:12px;color:#000;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">전체</div>
          <div style="font-size:18px;font-weight:600">$${formatNumber(Math.round(grandTotal))}</div>
        </div>`,
        ...bizList.map(b => `
        <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:10px 14px;text-align:center;border-top:2px solid ${CONFIG.BIZ_COLORS[b]}">
          <div style="font-size:12px;color:${CONFIG.BIZ_COLORS[b]};text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">${CONFIG.BIZ_LABELS[b]}</div>
          <div style="font-size:18px;font-weight:600;color:${CONFIG.BIZ_COLORS[b]}">$${formatNumber(Math.round(bizTotals[b]))}</div>
        </div>`),
      ].join('');

      chartWrap.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(${bizList.length + 1},1fr);gap:8px;margin-bottom:14px">
          ${summaryCards}
        </div>
        <div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px">
          <div style="font-size:12px;font-weight:500;color:var(--tx2);margin-bottom:10px">월별 사업별 매출 (병렬)</div>
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
      // 월별/전체 모드 → 사업별 합계 카드 + 단일 차트 + 도넛
      const bizList    = _biz ? [_biz] : CONFIG.BIZ_LIST;
      const bizTotals  = {};
      bizList.forEach(b => { bizTotals[b] = fi.filter(r => r.biz === b).reduce((s, r) => s + parseNumber(r.amount), 0); });
      const grandTotal = Object.values(bizTotals).reduce((s, v) => s + v, 0);

      const summaryCards = [
        `<div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:10px 14px;text-align:center">
          <div style="font-size:12px;color:#000;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">전체</div>
          <div style="font-size:18px;font-weight:600">$${formatNumber(Math.round(grandTotal))}</div>
        </div>`,
        ...bizList.map(b => `
        <div style="background:var(--tbl-sum-bg);border-radius:var(--rs);padding:10px 14px;text-align:center;border-top:2px solid ${CONFIG.BIZ_COLORS[b]}">
          <div style="font-size:12px;color:${CONFIG.BIZ_COLORS[b]};text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">${CONFIG.BIZ_LABELS[b]}</div>
          <div style="font-size:18px;font-weight:600;color:${CONFIG.BIZ_COLORS[b]}">$${formatNumber(Math.round(bizTotals[b]))}</div>
        </div>`),
      ].join('');

      chartWrap.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(${bizList.length + 1},1fr);gap:8px;margin-bottom:14px">
          ${summaryCards}
        </div>
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

  // ── 인라인 인보이스 저장 ─────────────────────────────────────
  async function saveInvoice(lotId, overrideAmt, overrideDate) {
    const lot = Store.getLots().find(l => l.id === lotId || String(l.id) === String(lotId));
    if (!lot) return;
    const amtEl     = document.getElementById('rv-amt-' + lotId);
    const dateEl    = document.getElementById('rv-date-' + lotId);
    const rawVal    = overrideAmt  !== undefined ? String(overrideAmt)  : (amtEl?.value  || '');
    const rawDate   = overrideDate !== undefined ? String(overrideDate) : (dateEl?.value || '');
    const amount    = parseNumber(rawVal);
    const isEmpty   = rawVal.trim() === '' || amount === 0;
    const invDate   = rawDate || lot.actualDone || today();

    const existing = Store.getInvoices().find(r => String(r.lotId) === String(lotId));

    if (isEmpty) {
      if (existing) {
        Store.deleteInvoice(existing.id);
        Api.delete(CONFIG.SHEETS.INVOICES, existing.id);
        Api.log('인보이스', '삭제', lot.lotNo || String(lotId), '인보이스 초기화');
        UI.toast('입력 초기화됨');
        render();
      }
      return;
    }

    const record = {
      id:           existing ? existing.id : Date.now(),
      no:           existing?.no || ('INV-' + Date.now()),
      date:         invDate,
      lotId:        lot.id,
      lotNo:        lot.lotNo || lot.id,
      biz:          lot.biz,
      country:      lot.country,
      customerName: lot.customerName || '',
      amount,
      vat:          existing?.vat || 0,
      total:        amount,
      currency:     lot.currency || 'USD',
      status:       'paid',
      paidDate:     invDate,
      paidAmt:      amount,
      due:          existing?.due || '',
      note:         existing?.note || '',
    };

    Store.upsertInvoice(record);
    if (existing) {
      Api.update(CONFIG.SHEETS.INVOICES, existing.id, record);
      Api.log('인보이스', '수정', lot.lotNo || String(lotId), `매출액 $${amount.toLocaleString()} · 청구일 ${invDate}`);
    } else {
      Api.append(CONFIG.SHEETS.INVOICES, record);
      Api.log('인보이스', '등록', lot.lotNo || String(lotId), `매출액 $${amount.toLocaleString()} · 청구일 ${invDate}`);
    }
    UI.toast('청구 완료 저장됨');
    render();
  }

  function exportExcel() {
    const lots     = Store.getLots();
    const invoices = Store.getInvoices();
    const dailies  = Store.getDailies();

    const data = lots.map((lot, i) => {
      const inv = invoices.find(r => String(r.lotId) === String(lot.id));
      const amt = inv ? parseNumber(inv.amount) : 0;
      const pct = getLotProgress(lot, dailies);
      const st  = lot.inDate > today() ? '입고예정' : getLotStatus(lot) === 'done' ? '완료' : getLotStatus(lot) === 'overdue' ? '지연' : '진행중';
      return {
        'No':         i + 1,
        '입고일':      lot.inDate     || '',
        '작업완료일':  lot.actualDone || '',
        'LOT번호':     lot.lotNo      || '',
        '사업':        CONFIG.BIZ_LABELS[lot.biz] || lot.biz,
        '지역':        lot.country    || '',
        '고객사':      lot.customerName || '',
        '수량':        parseNumber(lot.qty),
        '진행률(%)':   pct,
        '상태':        st,
        '매출액(USD)': amt > 0 ? amt : '',
        '입력상태':    inv ? (inv.status === 'paid' ? '입력완료' : inv.status === 'partial' ? '부분입력' : '미입력') : '입력대기',
      };
    });
    _xlsxExport(data, '매출현황_' + today() + '.xlsx', '매출현황');
  }

  return { render, setMode, setBiz, setCo, saveInvoice };

})();
