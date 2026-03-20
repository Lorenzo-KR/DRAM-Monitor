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

  // ── 상태 헬퍼 (입고예정 추가) ──────────────────────────────
  function _status(lot) {
    if (lot.inDate > today()) return 'upcoming';
    return getLotStatus(lot); // done / overdue / inprog
  }

  const ST_LABEL = { upcoming: '입고예정', inprog: '진행중', overdue: '지연', done: '완료' };
  const ST_STYLE = {
    upcoming: 'background:#E6F1FB;color:#0C447C',
    inprog:   'background:#E1F5EE;color:#085041',
    overdue:  'background:#FCEBEB;color:#791F1F',
    done:     'background:#E1F5EE;color:#085041',
  };
  const CO_STYLE  = { HK: 'background:#FAEEDA;color:#633806', SG: 'background:#E1F5EE;color:#085041' };
  const BIZ_STYLE = { DRAM: 'background:#E6F1FB;color:#0C447C', SSD: 'background:#E1F5EE;color:#085041', MID: 'background:#EEEDFE;color:#3C3489' };
  const BAR_COLOR = { upcoming: '#378ADD', inprog: '#185FA5', overdue: '#E24B4A', done: '#1D9E75' };

  function _badge(text, style) {
    return `<span style="display:inline-flex;align-items:center;font-size:10px;font-weight:500;padding:1px 6px;border-radius:3px;white-space:nowrap;${style}">${text}</span>`;
  }

  // ── 차트 ───────────────────────────────────────────────────
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
        style="padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid;transition:.15s;
        ${active ? 'background:var(--navy);color:#fff;border-color:var(--navy)' : 'background:none;color:var(--tx2);border-color:var(--bd2)'}">${y}년</button>`;
    }
    tabs.innerHTML = html;
  }

  function renderChart() {
    const canvas = document.getElementById('monthly-chart'); if (!canvas) return;
    const { biz: chartBiz, country: chartCo, year: chartYear } = Store.getChartFilter();
    const dailies = Store.getDailies();
    const months  = [];
    for (let m = 1; m <= 12; m++) months.push(chartYear + '-' + String(m).padStart(2, '0'));
    const labels = months.map(m => m.slice(5) + '월');

    let datasets = [];
    if (chartCo) {
      const list = chartBiz ? [chartBiz] : CONFIG.BIZ_LIST;
      datasets = list.map(b => ({
        label: CONFIG.BIZ_LABELS[b],
        data: months.map(m => dailies.filter(r => String(r.date||'').startsWith(m) && r.biz===b && r.country===chartCo).reduce((s,r)=>s+parseNumber(r.proc),0)),
        backgroundColor: CONFIG.BIZ_COLORS[b]+'55', borderColor: CONFIG.BIZ_COLORS[b], borderWidth:2, borderRadius:3, borderSkipped:false,
      }));
    } else if (chartBiz) {
      datasets = ['HK','SG'].map(co => ({
        label: CONFIG.COUNTRY_LABELS[co],
        data: months.map(m => dailies.filter(r => String(r.date||'').startsWith(m) && r.biz===chartBiz && r.country===co).reduce((s,r)=>s+parseNumber(r.proc),0)),
        backgroundColor: (co==='HK'?'#B45309':'#0F6E56')+'55', borderColor: co==='HK'?'#B45309':'#0F6E56', borderWidth:2, borderRadius:3, borderSkipped:false,
      }));
    } else {
      datasets = CONFIG.BIZ_LIST.map(b => ({
        label: CONFIG.BIZ_LABELS[b],
        data: months.map(m => dailies.filter(r => String(r.date||'').startsWith(m) && r.biz===b).reduce((s,r)=>s+parseNumber(r.proc),0)),
        backgroundColor: CONFIG.BIZ_COLORS[b]+'55', borderColor: CONFIG.BIZ_COLORS[b], borderWidth:2, borderRadius:3, borderSkipped:false,
      }));
    }

    if (_chart) { _chart.destroy(); _chart = null; }
    const datalabelsPlugin = window.ChartDataLabels ? [window.ChartDataLabels] : [];
    _chart = new Chart(canvas, {
      type: 'bar', plugins: datalabelsPlugin,
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: datasets.length > 1, labels: { font:{size:11}, color:'#888', boxWidth:10, padding:12 } },
          tooltip: { mode:'index', intersect:false, callbacks:{ label: ctx => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw)}` } },
          datalabels: {
            display: ctx => { const v=ctx.dataset.data[ctx.dataIndex]; const mx=Math.max(...ctx.dataset.data); return v>0&&(mx===0||v/mx>0.03); },
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

    // 요약 카드
    const yearStr = String(chartYear);
    const items = CONFIG.BIZ_LIST.map(b => ({
      label: CONFIG.BIZ_LABELS[b], color: CONFIG.BIZ_COLORS[b],
      yearTotal: dailies.filter(r=>r.biz===b&&(chartCo?r.country===chartCo:true)&&String(r.date||'').startsWith(yearStr)).reduce((s,r)=>s+parseNumber(r.proc),0),
      thisM: dailies.filter(r=>r.biz===b&&(chartCo?r.country===chartCo:true)&&String(r.date||'').startsWith(currentMonth())).reduce((s,r)=>s+parseNumber(r.proc),0),
    }));
    const totEl = document.getElementById('monthly-totals');
    if (totEl) {
      totEl.style.gridTemplateColumns = `repeat(${items.length},1fr)`;
      totEl.innerHTML = items.map(it => `
        <div style="background:var(--bg);border-radius:8px;padding:10px 12px;text-align:center">
          <div style="font-size:11px;font-weight:600;color:${it.color};margin-bottom:4px">${it.label}</div>
          <div style="font-size:16px;font-weight:600;font-family:var(--font-mono)">${formatNumber(it.yearTotal)}</div>
          <div style="font-size:10px;color:var(--tx3);margin-top:2px">${chartYear}년 누적</div>
          <div style="font-size:12px;font-weight:500;color:var(--tx2);margin-top:4px">이달 ${formatNumber(it.thisM)}</div>
        </div>`).join('');
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
    const tdS = 'padding:5px 6px;background:#EAF3DE;border-bottom:0.5px solid #C0DD97';
    return `
      <tr id="new-lot-row">
        <td style="${tdS};text-align:center;color:#3B6D11;font-size:18px;font-weight:500">+</td>
        <td style="${tdS}">
          <select id="nl-co" style="width:60px;padding:4px 5px;border:1px solid #C0DD97;border-radius:4px;font-size:11px;background:#fff">
            <option value="HK">HK</option><option value="SG">SG</option>
          </select>
        </td>
        <td style="${tdS}">
          <select id="nl-biz" style="width:62px;padding:4px 5px;border:1px solid #C0DD97;border-radius:4px;font-size:11px;background:#fff">
            <option>DRAM</option><option>SSD</option><option>MID</option>
          </select>
        </td>
        <td style="${tdS}"><input id="nl-lot" placeholder="LOT 번호" style="width:130px;padding:4px 7px;border:1px solid #C0DD97;border-radius:4px;font-size:12px;font-family:var(--font-mono)"></td>
        <td style="${tdS}">
          <select id="nl-cust" style="width:110px;padding:4px 5px;border:1px solid #C0DD97;border-radius:4px;font-size:11px;background:#fff">
            <option value="">-- 고객사 --</option>${custOpts}<option value="__manual__">직접 입력...</option>
          </select>
          <input id="nl-cust-manual" placeholder="직접 입력" style="display:none;width:110px;padding:4px 7px;border:1px solid #C0DD97;border-radius:4px;font-size:11px;margin-top:2px" onblur="Pages.Progress.handleNewCust(this)">
        </td>
        <td style="${tdS}" colspan="3">
          <input id="nl-indate" type="date" style="width:130px;padding:4px 7px;border:1px solid #C0DD97;border-radius:4px;font-size:12px" onchange="Pages.Progress.calcNewTgt()">
        </td>
        <td style="${tdS}"><input id="nl-qty" type="number" placeholder="수량" min="0" style="width:80px;padding:4px 7px;border:1px solid #C0DD97;border-radius:4px;font-size:12px"></td>
        <td style="${tdS}"><input id="nl-tgt" type="date" style="width:130px;padding:4px 7px;border:1px solid #C0DD97;border-radius:4px;font-size:12px"></td>
        <td style="${tdS}" colspan="2">
          <button onclick="Pages.Progress.saveLot()" style="padding:5px 14px;background:#3B6D11;color:#fff;border:none;border-radius:5px;font-size:11px;font-weight:500;cursor:pointer">+ 등록</button>
          <span id="nl-ok" style="display:none;font-size:11px;color:#3B6D11;font-weight:500;margin-left:6px">✓ 등록됨</span>
        </td>
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
      qty, unit: '개', price: 0, currency: 'USD', product: '', note: '', done: '0', actualDone: '',
    };
    Store.upsertLot(record);
    const ok = document.getElementById('nl-ok');
    if (ok) { ok.style.display = 'inline'; setTimeout(() => ok.style.display = 'none', 1500); }
    ['nl-lot','nl-qty','nl-indate','nl-tgt'].forEach(id => { const e=document.getElementById(id); if(e) e.value=''; });
    if (sel) sel.selectedIndex = 0;
    UI.toast(lotNo + ' 등록됨');
    render();
    Api.append(CONFIG.SHEETS.LOTS, record);
  }

  // ── 메인 렌더 ──────────────────────────────────────────────
  function render() {
    const filter  = Store.getLotFilter();
    const dailies = Store.getDailies();
    let lots      = Store.getLots();

    if (filter.biz)     lots = lots.filter(l => l.biz === filter.biz);
    if (filter.country) lots = lots.filter(l => l.country === filter.country);
    if (filter.status) {
      lots = lots.filter(l => {
        const st = _status(l);
        if (filter.status === 'upcoming') return st === 'upcoming';
        if (filter.status === 'done')     return st === 'done';
        if (filter.status === 'overdue')  return st === 'overdue';
        if (filter.status === 'inprog')   return st === 'inprog';
        return true;
      });
    }
    lots.sort((a, b) => String(b.inDate||'').localeCompare(String(a.inDate||'')));

    const cntEl = document.getElementById('pr-cnt');
    if (cntEl) cntEl.textContent = lots.length + '건';

    const el = document.getElementById('pr-cards'); if (!el) return;

    const TH = (label, align='left', extra='') =>
      `<th style="padding:8px 10px;text-align:${align};font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;background:var(--bg);border-bottom:0.5px solid var(--bd);white-space:nowrap;${extra}">${label}</th>`;

    const rows = lots.map(lot => {
      if (!lot?.id) return '';
      const st    = _status(lot);
      const cum   = st === 'upcoming' ? 0 : getLotCumulative(lot.id, dailies);
      const qty   = parseNumber(lot.qty);
      const rem   = Math.max(0, qty - cum);
      const pct   = (qty > 0 && st !== 'upcoming') ? Math.min(100, Math.round(cum/qty*100)) : 0;
      const dd    = lot.targetDate ? diffDays(today(), lot.targetDate) : null;
      const pctColor  = st==='overdue'?'#A32D2D': st==='done'?'#085041': pct>=80?'#BA7517':'#0C447C';
      const barColor  = BAR_COLOR[st] || '#185FA5';
      const isOpen    = _openLotId === lot.id;

      const lotRow = `
        <tr class="lot-data-row" onclick="Pages.Progress.toggleCard(${lot.id})" style="border-bottom:${isOpen?'0':'0.5px'} solid var(--bd);cursor:pointer;${isOpen?'background:var(--bg)':''}">
          <td style="padding:8px 10px;text-align:center">
            <svg width="11" height="11" fill="none" viewBox="0 0 16 16" style="transition:transform .2s;transform:${isOpen?'rotate(180deg)':'rotate(0)'}"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </td>
          <td style="padding:8px 10px">${_badge(lot.country, CO_STYLE[lot.country]||'')}</td>
          <td style="padding:8px 10px">${_badge(lot.biz, BIZ_STYLE[lot.biz]||'')}</td>
          <td style="padding:8px 10px;font-family:var(--font-mono);font-size:11px;font-weight:500">${lot.lotNo||lot.id}</td>
          <td style="padding:8px 10px;font-size:12px;color:var(--tx2)">${lot.customerName||'—'}</td>
          <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-size:11px">${formatNumber(qty)}</td>
          <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-size:11px;color:${CONFIG.BIZ_COLORS[lot.biz]||'var(--tx)'}">${st==='upcoming'?'—':formatNumber(cum)}</td>
          <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-size:11px;color:${rem>0?'#BA7517':'var(--tx3)'}">${formatNumber(rem)}</td>
          <td style="padding:8px 10px;min-width:110px">
            ${st==='upcoming'
              ? `<span style="font-size:11px;color:#0C447C">입고 ${diffDays(today(),lot.inDate)}일 후</span>`
              : `<div style="display:flex;align-items:center;gap:6px">
                  <div style="flex:1;height:4px;background:var(--bd);border-radius:2px;overflow:hidden"><div style="height:100%;border-radius:2px;background:${barColor};width:${pct}%"></div></div>
                  <span style="font-size:11px;font-weight:500;color:${pctColor};min-width:26px;text-align:right">${pct}%</span>
                </div>`}
          </td>
          <td style="padding:8px 10px;font-size:11px;color:${st==='upcoming'?'#0C447C':'var(--tx3)'}${st==='upcoming'?';font-weight:500':''}">${lot.inDate||'—'}</td>
          <td style="padding:8px 10px;font-size:11px;color:${st==='overdue'?'#A32D2D':'var(--tx3)'}">
            ${lot.targetDate||'—'}${dd!==null&&st!=='done'&&st!=='upcoming'?`<span style="font-size:10px;margin-left:3px;color:${dd<0?'#A32D2D':dd<=3?'#BA7517':'var(--tx3)'}">(${dd<0?'D+'+Math.abs(dd):'D-'+dd})</span>`:''}
          </td>
          <td style="padding:8px 10px">${_badge(ST_LABEL[st], ST_STYLE[st]||'')}</td>
          <td style="padding:4px 8px"><button class="btn del sm" style="font-size:10px;padding:2px 7px" onclick="event.stopPropagation();Pages.Progress.deleteLot(${lot.id})">삭제</button></td>
        </tr>`;

      const expandRow = isOpen ? `
        <tr><td colspan="13" style="padding:0;border-bottom:0.5px solid var(--bd)">
          ${_renderExpand(lot, dailies)}
        </td></tr>` : '';

      return lotRow + expandRow;
    }).join('');

    el.innerHTML = `
      <div style="background:var(--card);border:0.5px solid var(--bd);border-radius:var(--r);overflow:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr>
            ${TH('','left','width:32px')}${TH('지역')}${TH('사업')}${TH('LOT 번호')}${TH('고객사')}
            ${TH('수량','right')}${TH('처리','right')}${TH('잔량','right')}
            ${TH('진행률','left','min-width:110px')}
            ${TH('입고일')}${TH('목표완료')}${TH('상태')}${TH('','left','width:60px')}
          </tr></thead>
          <tbody>
            ${_newRowHTML()}
            ${rows || '<tr><td colspan="13" style="padding:24px;text-align:center;color:var(--tx3)">LOT가 없습니다</td></tr>'}
          </tbody>
        </table>
      </div>`;
  }

  // ── 펼침 영역 (처리 이력 + 입력) ───────────────────────────
  function _renderExpand(lot, dailies) {
    const isDram = lot.biz === 'DRAM';
    const cum    = getLotCumulative(lot.id, dailies);
    const hist   = dailies.filter(r => String(r.lotId)===String(lot.id)).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));

    const colGrid = isDram ? '90px 60px 60px 60px 70px 70px 70px 1fr 30px' : '90px 70px 70px 70px 1fr 30px';

    const histRows = hist.length === 0
      ? `<div style="font-size:12px;color:var(--tx3);padding:10px 0;text-align:center">처리 기록 없음</div>`
      : hist.map(r => {
          const tot = isDram ? (parseNumber(r.normal)+parseNumber(r.noBoot)+parseNumber(r.abnormal))||parseNumber(r.proc) : parseNumber(r.proc);
          return `<div style="display:grid;grid-template-columns:${colGrid};gap:6px;padding:5px 0;border-bottom:0.5px solid var(--bd);font-size:12px;align-items:center">
            <span style="font-family:var(--font-mono)">${r.date}</span>
            ${isDram?`<span style="font-family:var(--font-mono);color:#085041;text-align:right">${formatNumber(parseNumber(r.normal))}</span><span style="font-family:var(--font-mono);color:#633806;text-align:right">${formatNumber(parseNumber(r.noBoot))}</span><span style="font-family:var(--font-mono);color:#791F1F;text-align:right">${formatNumber(parseNumber(r.abnormal))}</span>`:''}
            <span style="font-family:var(--font-mono);font-weight:500;text-align:right">${formatNumber(tot)}</span>
            <span style="font-family:var(--font-mono);color:var(--tx2);text-align:right">${formatNumber(parseNumber(r.cumul))}</span>
            <span style="font-family:var(--font-mono);color:${parseNumber(r.remain)>0?'#BA7517':'#085041'};text-align:right">${formatNumber(parseNumber(r.remain))}</span>
            <span style="font-size:11px;color:var(--tx3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.note||''}</span>
            <button class="btn del sm" style="padding:2px 6px;font-size:10px" onclick="Pages.Progress.deleteDaily(${r.id},${lot.id})">✕</button>
          </div>`;
        }).join('');

    const histHeader = `
      <div style="display:grid;grid-template-columns:${colGrid};gap:6px;padding:5px 0;border-bottom:1.5px solid var(--bd);font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em">
        <span>날짜</span>${isDram?'<span style="text-align:right;color:#085041">Normal</span><span style="text-align:right;color:#633806">NoBoot</span><span style="text-align:right;color:#791F1F">Abnor.</span>':''}
        <span style="text-align:right">처리</span><span style="text-align:right">누적</span><span style="text-align:right">잔량</span><span>비고</span><span></span>
      </div>`;

    const remNow = Math.max(0, parseNumber(lot.qty) - cum);

    return `
      <div style="padding:14px 16px;background:var(--bg)">
        <div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:8px">처리 이력 (${hist.length}건)</div>
        ${histHeader}${histRows}

        <div style="margin-top:14px;background:var(--card);border:0.5px solid var(--bd);border-radius:var(--rs);padding:12px">
          <div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:10px">새 처리 기록</div>
          <div style="display:grid;grid-template-columns:${isDram?'110px 120px 100px auto':'110px 120px auto'};gap:10px;margin-bottom:${isDram?'10px':'0'}">
            <div class="fld"><label>날짜</label><input type="date" id="dp-date-${lot.id}" value="${today()}"></div>
            <div class="fld"><label>처리량</label><input type="number" id="dp-proc-${lot.id}" placeholder="0" min="0" oninput="Pages.Progress.calcRem(${lot.id})"></div>
            <div class="fld"><label>잔량 (자동)</label><input type="number" id="dp-rem-${lot.id}" readonly style="color:var(--tx2)" value="${remNow}"></div>
            <div class="fld"><label>완료 여부</label>
              <select id="dp-done-${lot.id}"><option value="0">진행 중</option><option value="1">완료 처리</option></select>
            </div>
          </div>
          ${isDram?`
          <div style="margin-bottom:10px">
            <div style="font-size:10px;font-weight:600;color:#1e40af;margin-bottom:6px">DRAM 분류 <span style="font-weight:400;color:var(--tx3)">(합계 자동 계산)</span></div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
              <div class="fld"><label style="color:#085041">Normal</label><input type="number" id="dp-normal-${lot.id}" placeholder="0" min="0" oninput="Pages.Progress.calcDram(${lot.id})" style="border-color:#bbf7d0;background:#f0fdf4"></div>
              <div class="fld"><label style="color:#633806">No Boot</label><input type="number" id="dp-noboot-${lot.id}" placeholder="0" min="0" oninput="Pages.Progress.calcDram(${lot.id})" style="border-color:#fde68a;background:#fefce8"></div>
              <div class="fld"><label style="color:#791F1F">Abnormal</label><input type="number" id="dp-abnormal-${lot.id}" placeholder="0" min="0" oninput="Pages.Progress.calcDram(${lot.id})" style="border-color:#fca5a5;background:#fef2f2"></div>
            </div>
          </div>`:''}
          <div class="fld" style="margin-bottom:10px"><label>비고</label><input type="text" id="dp-note-${lot.id}" placeholder="이슈, 특이사항 등"></div>
          <div class="br">
            <button class="btn pri sm" onclick="Pages.Progress.saveDaily(${lot.id})">저장</button>
            <span id="dp-ok-${lot.id}" style="font-size:12px;color:#085041;display:none;font-weight:500">✓ 저장됨</span>
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
    const el = document.getElementById('dp-proc-'+lotId);
    if (el) { el.value = (nm+nb+ab)||''; calcRem(lotId); }
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
    Api.append(CONFIG.SHEETS.DAILY, record);
  }

  // ── 삭제 ───────────────────────────────────────────────────
  async function deleteLot(id) {
    if (!confirm('삭제하시겠습니까?')) return;
    Store.deleteLot(id);
    if (_openLotId===id) _openLotId=null;
    render();
    UI.toast('삭제됨');
    Api.delete(CONFIG.SHEETS.LOTS, id);
  }

  async function deleteDaily(id, lotId) {
    if (!confirm('삭제하시겠습니까?')) return;
    Store.deleteDaily(id);
    render();
    UI.toast('삭제됨');
    Api.delete(CONFIG.SHEETS.DAILY, id);
  }

  // ── 엑셀 내보내기 ──────────────────────────────────────────
  function exportExcel() {
    const dailies = Store.getDailies();
    const data = Store.getLots().map(l => ({
      'LOT번호': l.lotNo||l.id, '사업': CONFIG.BIZ_LABELS[l.biz]||l.biz,
      '국가': CONFIG.COUNTRY_LABELS[l.country]||l.country, '고객사': l.customerName||'',
      '입고일': l.inDate, '목표완료일': l.targetDate, '실완료일': l.actualDone||'',
      '총수량': parseNumber(l.qty), '누적처리': getLotCumulative(l.id,dailies),
      '잔량': getLotRemaining(l,dailies), '진행률(%)': getLotProgress(l,dailies),
      '상태': _status(l)==='upcoming'?'입고예정':getLotStatus(l)==='done'?'완료':getLotStatus(l)==='overdue'?'지연':'진행중',
      '단가': parseNumber(l.price), '통화': l.currency||'',
    }));
    _xlsxExport(data, 'LOT현황_'+today()+'.xlsx', 'LOT현황');
  }

  function currentMonth() { return new Date().toISOString().slice(0,7); }

  return { render, renderChart, initYearTabs, setFilter, setChartBiz, setChartCountry, setChartYear, toggleCard, calcDram, calcRem, saveLot, saveDaily, deleteLot, deleteDaily, handleNewCust, calcNewTgt, exportExcel };

})();
