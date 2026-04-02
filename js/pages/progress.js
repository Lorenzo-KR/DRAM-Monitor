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

  const ST_LABEL = { upcoming: '입고예정', inprog: '🟢 진행중', overdue: '🔴 지연', done: '완료' };
  const ST_STYLE = {
    upcoming: 'border:1px solid #B0B0B8;color:#6E6E73;background:transparent',
    inprog:   'border:1.5px solid #34C759;color:#1A7F37;background:#F0FBF3;font-weight:700',
    overdue:  'border:1.5px solid #dc2626;color:#dc2626;background:#FEF2F2;font-weight:700',
    done:     'border:1px solid #D2D2D7;color:#C7C7CC;background:#F5F5F7',
  };
  const CO_STYLE  = { HK: 'border:1px solid var(--bd);color:var(--tx2);background:transparent', SG: 'border:1px solid var(--bd);color:var(--tx2);background:transparent' };
  const BIZ_STYLE = { DRAM: 'border:1px solid var(--bd);color:var(--tx2);background:transparent', SSD: 'border:1px solid var(--bd);color:var(--tx2);background:transparent', MID: 'border:1px solid var(--bd);color:var(--tx2);background:transparent' };
  const BAR_COLOR = { upcoming: 'var(--tx3)', inprog: 'var(--tx2)', overdue: '#dc2626', done: 'var(--tx)' };

  function _badge(text, style) {
    return `<span style="display:inline-flex;align-items:center;font-size:13px;font-weight:500;padding:1px 6px;border-radius:3px;white-space:nowrap;${style}">${text}</span>`;
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
        style="padding:3px 12px;border-radius:20px;font-size:14px;font-weight:600;cursor:pointer;border:1.5px solid;transition:.15s;
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
        <div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--rs);padding:12px 14px;text-align:center">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:6px">${it.label}</div>
          <div style="font-size:18px;font-weight:600;font-family:var(--font-mono);color:var(--tx)">${formatNumber(it.yearTotal)}</div>
          <div style="font-size:11px;color:var(--tx3);margin-top:3px">${chartYear}년 누적</div>
          <div style="font-size:12px;color:var(--tx2);margin-top:4px">이달 <span style="font-family:var(--font-mono);font-weight:600">${formatNumber(it.thisM)}</span></div>
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
    const tdS = 'padding:5px 8px;background:var(--tbl-hd-bg);border-bottom:1px solid var(--tbl-hd-bd);vertical-align:middle';
    const inp = 'border:1px solid var(--tbl-wrap-bd);border-radius:4px;background:#fff;font-size:14px';
    return `
      <tr id="new-lot-row">
        <td style="${tdS};text-align:center;color:var(--tx2);font-size:14px;font-weight:400">+</td>
        <td style="${tdS}">
          <select id="nl-co" style="${inp};width:100%;padding:4px 3px">
            <option value="HK">HK</option><option value="SG">SG</option>
          </select>
        </td>
        <td style="${tdS}">
          <select id="nl-biz" style="${inp};width:100%;padding:4px 3px">
            <option>DRAM</option><option>SSD</option><option>MID</option>
          </select>
        </td>
        <td style="${tdS}">
          <input id="nl-lot" placeholder="LOT 번호" style="${inp};width:100%;padding:5px 7px;font-family:var(--font-mono)">
        </td>
        <td style="${tdS}">
          <select id="nl-cust" style="${inp};width:100%;padding:4px 3px" onchange="if(this.value==='__manual__'){document.getElementById('nl-cust-manual').style.display='block'}else{document.getElementById('nl-cust-manual').style.display='none'}">
            <option value="">-- 고객사 --</option>${custOpts}<option value="__manual__">직접 입력...</option>
          </select>
          <input id="nl-cust-manual" placeholder="직접 입력" style="display:none;${inp};width:100%;padding:4px 6px;margin-top:2px">
        </td>
        <td style="${tdS}">
          <input id="nl-qty" type="number" placeholder="수량" min="0" style="${inp};width:100%;padding:5px 7px;text-align:right">
        </td>
        <td style="${tdS};color:var(--tx3);font-size:14px;text-align:right">—</td>
        <td style="${tdS};color:var(--tx3);font-size:14px;text-align:right">—</td>
        <td style="${tdS};color:var(--tx3);font-size:14px">—</td>
        <td style="${tdS}">
          <input id="nl-indate" type="date" style="${inp};width:100%;padding:5px 6px" onchange="Pages.Progress.calcNewTgt()">
        </td>
        <td style="${tdS}">
          <input id="nl-tgt" type="date" style="${inp};width:100%;padding:5px 6px">
        </td>
        <td style="${tdS}"></td>
        <td style="${tdS}">
          <button onclick="Pages.Progress.saveLot()" style="width:100%;padding:6px 4px;background:var(--tx);color:#fff;border:none;border-radius:var(--rs);font-size:13px;font-weight:500;cursor:pointer">+ 등록</button>
          <span id="nl-ok" style="display:none;font-size:13px;color:#3B6D11;font-weight:500">✓</span>
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
    Api.log('LOT', '등록', record.lotNo || String(record.id), `${CONFIG.BIZ_LABELS[record.biz]||record.biz} · ${CONFIG.COUNTRY_LABELS[record.country]||record.country} · ${record.customerName||''} · ${record.qty}개 · 입고 ${record.inDate}`);
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
      `<th style="padding:10px 14px;text-align:${align};font-size:12px;font-weight:600;color:var(--tx2);background:var(--tbl-hd-bg);border-bottom:1px solid var(--tbl-hd-bd);white-space:nowrap;${extra}">${label}</th>`;

    const rows = lots.map(lot => {
      if (!lot?.id) return '';
      const st    = _status(lot);
      const cum   = st === 'upcoming' ? 0 : getLotCumulative(lot.id, dailies);
      const qty   = parseNumber(lot.qty);
      const rem   = Math.max(0, qty - cum);
      const pct   = (qty > 0 && st !== 'upcoming') ? Math.min(100, Math.round(cum/qty*100)) : 0;
      const dd    = lot.targetDate ? diffDays(today(), lot.targetDate) : null;
      const pctColor  = st==='overdue'?'#dc2626': st==='done'?'#C7C7CC': pct>=80?'#EF9F27':'var(--tx2)';
      const barColor  = BAR_COLOR[st] || 'var(--tx2)';
      const isOpen    = _openLotId === lot.id;

      const lotRow = `
        <tr class="lot-data-row" onclick="Pages.Progress.toggleCard(${lot.id})" style="border-bottom:${isOpen?'0':'0.5px'} solid var(--bd);cursor:pointer;${
          st==='done'    ? 'background:#F9F9F9;opacity:0.45;border-left:4px solid transparent' :
          st==='overdue' ? 'background:#FFF5F5;border-left:4px solid #E24B4A;box-shadow:inset 0 0 0 0.5px #FECACA' :
          st==='inprog'  ? 'background:#F5F9FF;border-left:4px solid #378ADD;box-shadow:inset 0 0 0 0.5px #B5D4F4' :
          isOpen         ? 'background:var(--bg);border-left:4px solid transparent' :
                           'border-left:4px solid transparent'
        }">
          <td style="padding:10px 14px;text-align:center">
            <svg width="11" height="11" fill="none" viewBox="0 0 16 16" style="transition:transform .2s;transform:${isOpen?'rotate(180deg)':'rotate(0)'}"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </td>
          <td style="padding:10px 14px">${_badge(lot.country, CO_STYLE[lot.country]||'')}</td>
          <td style="padding:10px 14px">${_badge(lot.biz, BIZ_STYLE[lot.biz]||'')}</td>
          <td style="padding:11px 14px;font-family:var(--font-mono);font-size:13px;font-weight:${st==='done'?'400':'700'};color:${st==='done'?'#A0A0A8':'#1D1D1F'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${lot.lotNo||lot.id}</td>
          <td style="padding:11px 14px;font-size:13px;color:${st==='done'?'#C7C7CC':'#1D1D1F'};font-weight:${st==='done'?'400':'500'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${lot.customerName||'—'}</td>
          <td style="padding:11px 14px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:${st==='done'?'400':'600'};color:${st==='done'?'#C7C7CC':'#1D1D1F'}">${formatNumber(qty)}</td>
          <td style="padding:11px 14px;text-align:right;font-family:var(--font-mono);font-size:13px;color:${CONFIG.BIZ_COLORS[lot.biz]||'var(--tx)'}">${st==='upcoming'?'—':formatNumber(cum)}</td>
          <td style="padding:11px 14px;text-align:right;font-family:var(--font-mono);font-size:13px;color:${rem>0?'var(--tx3)':'var(--tx3)'}">${formatNumber(rem)}</td>
          <td style="padding:10px 14px">
            ${st==='upcoming'
              ? `<span style="font-size:13px;color:#0C447C">D-${diffDays(today(),lot.inDate)}</span>`
              : `<div style="display:flex;align-items:center;gap:6px">
                  <div style="flex:1;height:${st==='done'?4:6}px;background:${st==='overdue'?'#FECACA':st==='inprog'?'#D1FAE5':'var(--bd)'};border-radius:3px;overflow:hidden"><div style="height:100%;border-radius:3px;background:${barColor};width:${pct}%"></div></div>
                  <span style="font-size:12px;font-weight:${st==='done'?'400':'700'};color:${pctColor};min-width:28px;text-align:right">${pct}%</span>
                </div>`}
          </td>
          <td style="padding:11px 14px;font-size:13px;color:${st==='done'?'#C7C7CC':st==='upcoming'?'var(--tx2)':'#1D1D1F'};font-weight:${st==='inprog'||st==='overdue'?'600':'400'}">${lot.inDate||'—'}</td>
          <td style="padding:11px 14px;font-size:13px;${st==='done'?'color:#085041;font-weight:500':st==='overdue'?'color:#A32D2D;font-weight:700':st==='inprog'?'color:#1D1D1F;font-weight:600':'color:var(--tx3)'}">
            ${st==='done'
              ? (lot.actualDone || lot.targetDate || '—')
              : st==='upcoming'
                ? (lot.targetDate || '—')
                : `${lot.targetDate||'—'}${dd!==null?`<span style="font-size:13px;margin-left:3px;color:${dd<0?'#dc2626':dd<=3?'var(--tx3)':'var(--tx3)'}">(${dd<0?'D+'+Math.abs(dd):'D-'+dd})</span>`:''}`}
          </td>
          <td style="padding:10px 14px">${_badge(ST_LABEL[st], ST_STYLE[st]||'')}</td>
          <td style="padding:6px 8px;white-space:nowrap">
            <button class="btn sm" style="font-size:12px;padding:3px 8px;${st==='inprog'?'font-weight:700;color:#185FA5;border-color:#378ADD':st==='overdue'?'font-weight:700;color:#A32D2D;border-color:#E24B4A':''}" onclick="event.stopPropagation();Pages.Progress.openEditPanel(${lot.id})">수정</button>
            <button class="btn del sm" style="font-size:12px;padding:3px 8px" onclick="event.stopPropagation();Pages.Progress.deleteLot(${lot.id})">삭제</button>
          </td>
        </tr>`;

      const expandRow = isOpen ? `
        <tr><td colspan="13" style="padding:0;border-bottom:1px solid var(--bd)">
          ${_renderExpand(lot, dailies)}
        </td></tr>` : '';

      return lotRow + expandRow;
    }).join('');

    el.innerHTML = `
      <div style="background:var(--tbl-bg);border:1px solid var(--tbl-wrap-bd);border-radius:10px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed">
          <colgroup>
            <col style="width:36px">
            <col style="width:56px">
            <col style="width:66px">
            <col style="width:150px">
            <col style="width:120px">
            <col style="width:80px">
            <col style="width:80px">
            <col style="width:80px">
            <col style="width:130px">
            <col style="width:100px">
            <col style="width:120px">
            <col style="width:80px">
            <col style="width:100px">
          </colgroup>
          <thead><tr>
            ${TH('','left')}${TH('지역')}${TH('사업')}${TH('LOT 번호')}${TH('고객사')}
            ${TH('수량','right')}${TH('처리','right')}${TH('잔량','right')}
            ${TH('진행률','left')}
            ${TH('입고일')}${TH('완료일')}${TH('상태')}${TH('','left')}
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
      ? `<div style="font-size:13px;color:var(--tx3);padding:10px 0;text-align:center">처리 기록 없음</div>`
      : hist.map(r => {
          const tot = isDram ? (parseNumber(r.normal)+parseNumber(r.noBoot)+parseNumber(r.abnormal))||parseNumber(r.proc) : parseNumber(r.proc);
          return `<div style="display:grid;grid-template-columns:${colGrid};gap:6px;padding:5px 0;border-bottom:1px solid var(--bd);font-size:14px;align-items:center">
            <span style="font-family:var(--font-mono)">${r.date}</span>
            ${isDram?`<span style="font-family:var(--font-mono);color:var(--tx);text-align:right">${formatNumber(parseNumber(r.normal))}</span><span style="font-family:var(--font-mono);color:var(--tx2);text-align:right">${formatNumber(parseNumber(r.noBoot))}</span><span style="font-family:var(--font-mono);color:var(--tx2);text-align:right">${formatNumber(parseNumber(r.abnormal))}</span>`:''}
            <span style="font-family:var(--font-mono);font-weight:500;text-align:right">${formatNumber(tot)}</span>
            <span style="font-family:var(--font-mono);color:var(--tx2);text-align:right">${formatNumber(parseNumber(r.cumul))}</span>
            <span style="font-family:var(--font-mono);color:${parseNumber(r.remain)>0?'var(--tx3)':'var(--tx)'};text-align:right">${formatNumber(parseNumber(r.remain))}</span>
            <span style="font-size:13px;color:var(--tx3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.note||''}</span>
            <button class="btn del sm" style="padding:2px 6px;font-size:14px" onclick="Pages.Progress.deleteDaily(${r.id},${lot.id})">✕</button>
          </div>`;
        }).join('');

    const histHeader = `
      <div style="display:grid;grid-template-columns:${colGrid};gap:6px;padding:5px 0;border-bottom:1.5px solid var(--bd);font-size:13px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em">
        <span>날짜</span>${isDram?'<span style="text-align:right;color:#085041">Normal</span><span style="text-align:right;color:#633806">NoBoot</span><span style="text-align:right;color:#791F1F">Abnor.</span>':''}
        <span style="text-align:right">처리</span><span style="text-align:right">누적</span><span style="text-align:right">잔량</span><span>비고</span><span></span>
      </div>`;

    const remNow = Math.max(0, parseNumber(lot.qty) - cum);

    return `
      <div style="padding:14px 16px;background:var(--bg)">
        <div style="font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:.07em;color:var(--tx3);margin-bottom:8px">처리 이력 (${hist.length}건)</div>
        ${histHeader}${histRows}

        <div style="margin-top:14px;background:var(--card);border:1px solid var(--bd);border-radius:var(--rs);overflow:hidden">
          <!-- 탭 헤더 -->
          <div style="display:flex;border-bottom:1px solid var(--bd);background:var(--bg)">
            <button id="dp-tab-manual-${lot.id}" onclick="Pages.Progress.switchTab(${lot.id},'manual')"
              style="padding:9px 18px;font-size:13px;font-weight:500;border:none;background:var(--card);color:var(--tx);cursor:pointer;border-bottom:2px solid var(--navy)">
              직접 입력
            </button>
            <button id="dp-tab-paste-${lot.id}" onclick="Pages.Progress.switchTab(${lot.id},'paste')"
              style="padding:9px 18px;font-size:13px;font-weight:500;border:none;background:none;color:var(--tx3);cursor:pointer;border-bottom:2px solid transparent">
              붙여넣기
            </button>
          </div>

          <!-- 직접 입력 탭 -->
          <div id="dp-panel-manual-${lot.id}" style="padding:14px">

            <!-- 1행: 날짜 · 처리량 · 잔량 · 완료여부 -->
            <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px">
              <div class="fld" style="margin:0"><label style="font-size:11px">날짜</label>
                <input type="date" id="dp-date-${lot.id}" value="${today()}" style="width:130px;padding:5px 8px">
              </div>
              <div class="fld" style="margin:0"><label style="font-size:11px">처리량</label>
                <input type="number" id="dp-proc-${lot.id}" placeholder="0" min="0"
                  oninput="Pages.Progress.calcRem(${lot.id})"
                  style="width:80px;padding:5px 8px;text-align:right">
              </div>
              <div class="fld" style="margin:0"><label style="font-size:11px">잔량 (자동)</label>
                <input type="number" id="dp-rem-${lot.id}" readonly value="${remNow}"
                  style="width:80px;padding:5px 8px;text-align:right;color:var(--tx2);background:var(--bg)">
              </div>
              <div class="fld" style="margin:0"><label style="font-size:11px">완료 여부</label>
                <select id="dp-done-${lot.id}" style="width:90px;padding:5px 8px">
                  <option value="0">진행 중</option><option value="1">완료 처리</option>
                </select>
              </div>
            </div>

            <!-- 2행: DRAM 분류 (DRAM만) -->
            ${isDram?`
            <div style="margin-bottom:12px">
              <div style="font-size:11px;font-weight:600;color:var(--tx2);margin-bottom:6px">DRAM 분류 <span style="font-weight:400;color:var(--tx3)">(합계 자동계산)</span></div>
              <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
                <div class="fld" style="margin:0"><label style="font-size:11px;color:#1A7F37">Normal</label>
                  <input type="number" id="dp-normal-${lot.id}" placeholder="0" min="0"
                    oninput="Pages.Progress.calcDram(${lot.id})"
                    style="width:80px;padding:5px 8px;text-align:right;border-color:var(--bd);background:var(--bg)">
                </div>
                <div class="fld" style="margin:0"><label style="font-size:11px;color:#B45309">No Boot</label>
                  <input type="number" id="dp-noboot-${lot.id}" placeholder="0" min="0"
                    oninput="Pages.Progress.calcDram(${lot.id})"
                    style="width:80px;padding:5px 8px;text-align:right;border-color:var(--bd);background:var(--bg)">
                </div>
                <div class="fld" style="margin:0"><label style="font-size:11px;color:#dc2626">Abnormal</label>
                  <input type="number" id="dp-abnormal-${lot.id}" placeholder="0" min="0"
                    oninput="Pages.Progress.calcDram(${lot.id})"
                    style="width:80px;padding:5px 8px;text-align:right;border-color:var(--bd);background:var(--bg)">
                </div>
                <div class="fld" style="margin:0"><label style="font-size:11px;color:var(--tx3)">합계 확인</label>
                  <div id="dp-dram-sum-${lot.id}"
                    style="width:80px;padding:5px 10px;border:1px solid var(--bd);border-radius:var(--rs);font-size:12px;text-align:right;background:var(--bg);color:var(--tx2);font-family:var(--font-mono)">0</div>
                </div>
              </div>
            </div>`:''}
            <!-- 3행: 비고 + 저장 -->
            <div style="display:flex;gap:10px;align-items:flex-end">
              <div class="fld" style="margin:0;flex:1"><label style="font-size:11px">비고</label>
                <input type="text" id="dp-note-${lot.id}" placeholder="이슈, 특이사항 등" style="width:100%;padding:5px 8px">
              </div>
              <button class="btn pri sm" onclick="Pages.Progress.saveDaily(${lot.id})" style="height:30px;white-space:nowrap">저장</button>
              <span id="dp-ok-${lot.id}" style="font-size:13px;color:#085041;display:none;font-weight:500;align-self:center">✓ 저장됨</span>
            </div>

          </div>

          <!-- 붙여넣기 탭 -->
          <div id="dp-panel-paste-${lot.id}" style="padding:14px;display:none">
            <div style="font-size:13px;color:var(--tx3);margin-bottom:8px">
              엑셀/표에서 헤더 포함해서 복사 후 붙여넣기 하세요.<br>
              <span style="color:var(--tx2);font-weight:500">날짜, 처리량, Normal, No Boot, Abnormal</span> 컬럼을 자동으로 인식합니다.
            </div>
            <textarea id="dp-paste-${lot.id}" placeholder="Date&#9;Qty&#9;Normal&#9;No Boot&#9;Abnormal
2026-03-18&#9;280&#9;210&#9;40&#9;30
2026-03-17&#9;320&#9;280&#9;25&#9;15"
              style="width:100%;height:130px;padding:9px 12px;border:1px solid var(--bd2);border-radius:var(--rs);font-size:13px;font-family:var(--font-mono);background:var(--bg);color:var(--tx);resize:vertical;line-height:1.6"></textarea>
            <div id="dp-paste-preview-${lot.id}" style="margin-top:10px;display:none"></div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <button class="btn sm" onclick="Pages.Progress.parsePaste(${lot.id})">데이터 확인</button>
              <button class="btn pri sm" id="dp-paste-save-${lot.id}" onclick="Pages.Progress.savePaste(${lot.id})" style="display:none">전체 저장</button>
              <span id="dp-paste-ok-${lot.id}" style="font-size:13px;color:#085041;display:none;font-weight:500;align-self:center">✓ 저장됨</span>
            </div>
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
    const total = nm + nb + ab;
    const el = document.getElementById('dp-proc-'+lotId);
    if (el) { el.value = total || ''; calcRem(lotId); }
    // 합계 확인 div 업데이트
    const sumEl = document.getElementById('dp-dram-sum-'+lotId);
    if (sumEl) {
      sumEl.textContent = total > 0 ? total.toLocaleString() : '0';
      sumEl.style.color = total > 0 ? 'var(--tx)' : 'var(--tx3)';
    }
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
  // ── LOT 삭제 확인 모달 ─────────────────────────────────────
  let _deleteLotId = null;

  function openDeleteModal(id) {
    const lot  = Store.getLotById(id); if (!lot) return;
    _deleteLotId = id;
    const nameEl = document.getElementById('lot-delete-name');
    if (nameEl) nameEl.textContent = lot.lotNo || lot.id;
    const modal = document.getElementById('lot-delete-modal');
    if (modal) { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
  }

  function cancelDelete() {
    _deleteLotId = null;
    const modal = document.getElementById('lot-delete-modal');
    if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
  }

  async function confirmDelete() {
    if (!_deleteLotId) return;
    const id  = _deleteLotId;
    const lot = Store.getLotById(id);
    cancelDelete();
    Store.deleteLot(id);
    if (_openLotId === id) _openLotId = null;
    render();
    UI.toast('삭제됨');
    Api.delete(CONFIG.SHEETS.LOTS, id);
    Api.log('LOT', '삭제', lot?.lotNo || String(id), `${CONFIG.BIZ_LABELS[lot?.biz]||lot?.biz||''} · ${CONFIG.COUNTRY_LABELS[lot?.country]||lot?.country||''} · ${lot?.customerName||''} LOT 삭제`);
  }

  async function deleteLot(id) {
    openDeleteModal(id);
  }

  async function deleteDaily(id, lotId) {
    if (!confirm('삭제하시겠습니까?')) return;
    const rec = Store.getDailies().find(d => String(d.id) === String(id));
    Store.deleteDaily(id);
    render();
    UI.toast('삭제됨');
    Api.delete(CONFIG.SHEETS.DAILY, id);
    Api.log('일별처리', '삭제', rec?.lotNo || String(lotId), `${rec?.date || ''} 처리 ${Number(rec?.proc||0).toLocaleString()}개${rec?.biz==='DRAM' ? ` (N:${Number(rec?.normal||0).toLocaleString()} / NB:${Number(rec?.noBoot||0).toLocaleString()} / AB:${Number(rec?.abnormal||0).toLocaleString()})` : ''} 삭제`);
  }

  // ── 엑셀 내보내기 ──────────────────────────────────────────
  function exportExcel() {
    const dailies = Store.getDailies();
    const lots    = Store.getLots();

    // ── 시트 ①: LOT 요약 ─────────────────────────────────
    const lotData = lots.map(l => ({
      'LOT번호':    l.lotNo || l.id,
      '사업':       CONFIG.BIZ_LABELS[l.biz] || l.biz,
      '국가':       CONFIG.COUNTRY_LABELS[l.country] || l.country,
      '고객사':     l.customerName || '',
      '입고일':     l.inDate || '',
      '목표완료일': l.targetDate || '',
      '실완료일':   l.actualDone || '',
      '총수량':     parseNumber(l.qty),
      '누적처리':   getLotCumulative(l.id, dailies),
      '잔량':       getLotRemaining(l, dailies),
      '진행률(%)':  getLotProgress(l, dailies),
      '상태':       _status(l)==='upcoming' ? '입고예정' : getLotStatus(l)==='done' ? '완료' : getLotStatus(l)==='overdue' ? '지연' : '진행중',
      '단가(USD)':  parseNumber(l.price),
      '통화':       l.currency || '',
    }));

    // ── 시트 ②: 일별 처리 이력 ───────────────────────────
    // LOT번호 기준 그룹화 → 날짜 오름차순
    const lotMap = {};
    lots.forEach(l => { lotMap[String(l.id)] = l; });

    const dailyData = [...dailies]
      .sort((a, b) => {
        const la = lotMap[String(a.lotId)]?.lotNo || a.lotNo || a.lotId || '';
        const lb = lotMap[String(b.lotId)]?.lotNo || b.lotNo || b.lotId || '';
        if (la !== lb) return String(la).localeCompare(String(lb));
        return String(a.date || '').localeCompare(String(b.date || ''));
      })
      .map(d => {
        const lot = lotMap[String(d.lotId)];
        return {
          'LOT번호':   lot?.lotNo || d.lotNo || d.lotId || '',
          '사업':      CONFIG.BIZ_LABELS[d.biz] || d.biz || '',
          '국가':      CONFIG.COUNTRY_LABELS[d.country] || d.country || '',
          '고객사':    d.customerName || lot?.customerName || '',
          '날짜':      d.date || '',
          '처리량':    parseNumber(d.proc),
          'Normal':    parseNumber(d.normal),
          'No Boot':   parseNumber(d.noBoot),
          'Abnormal':  parseNumber(d.abnormal),
          '누적':      parseNumber(d.cumul),
          '잔량':      parseNumber(d.remain),
          '비고':      d.note || '',
        };
      });

    if (!lotData.length && !dailyData.length) {
      UI.toast('데이터 없음', true);
      return;
    }

    // ── 멀티 시트 엑셀 생성 ──────────────────────────────
    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(lotData);
    XLSX.utils.book_append_sheet(wb, ws1, 'LOT 요약');

    if (dailyData.length) {
      const ws2 = XLSX.utils.json_to_sheet(dailyData);
      XLSX.utils.book_append_sheet(wb, ws2, '일별 처리 이력');
    }

    XLSX.writeFile(wb, 'LOT현황_' + today() + '.xlsx');
    UI.toast('다운로드 완료 — 시트 ' + (dailyData.length ? 2 : 1) + '개');
  }

  function currentMonth() { return new Date().toISOString().slice(0,7); }

  // ── LOT 수정 패널 ──────────────────────────────────────────
  let _editLotId = null;

  function openEditPanel(lotId) {
    const lot = Store.getLotById(lotId); if (!lot) return;
    _editLotId = lotId;

    document.getElementById('ep-lot').value          = lot.lotNo       || '';
    document.getElementById('ep-co').value           = lot.country     || 'HK';
    document.getElementById('ep-biz').value          = lot.biz         || 'DRAM';
    document.getElementById('ep-cust').value         = lot.customerName|| '';
    document.getElementById('ep-indate').value       = lot.inDate      || '';
    document.getElementById('ep-tgt').value          = lot.targetDate  || '';
    document.getElementById('ep-qty').value          = lot.qty         || '';
    document.getElementById('ep-price').value        = lot.price       || '';
    document.getElementById('ep-cur').value          = lot.currency    || 'USD';
    document.getElementById('ep-prod').value         = lot.product     || '';
    document.getElementById('ep-note').value         = lot.note        || '';
    document.getElementById('ep-done').value         = lot.done        || '0';
    document.getElementById('ep-actual-done').value  = lot.actualDone  || '';

    const ok = document.getElementById('ep-ok'); if (ok) ok.style.display = 'none';
    document.getElementById('lot-edit-panel').style.display   = 'block';
    document.getElementById('lot-edit-overlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  function closeEditPanel() {
    document.getElementById('lot-edit-panel').style.display   = 'none';
    document.getElementById('lot-edit-overlay').style.display = 'none';
    document.body.style.overflow = '';
    _editLotId = null;
  }

  function calcEditTgt() {
    const d = document.getElementById('ep-indate')?.value;
    if (d) { const el = document.getElementById('ep-tgt'); if (el && !el.value) el.value = addDays(d, CONFIG.LOT_DEFAULT_TARGET_DAYS); }
  }

  async function saveLotEdit() {
    const lot = Store.getLotById(_editLotId); if (!lot) return;
    const doneVal      = document.getElementById('ep-done')?.value || '0';
    const actualDone   = document.getElementById('ep-actual-done')?.value || '';
    const updated = {
      ...lot,
      lotNo:        document.getElementById('ep-lot').value.trim()   || lot.lotNo,
      country:      document.getElementById('ep-co').value,
      biz:          document.getElementById('ep-biz').value,
      customerName: document.getElementById('ep-cust').value.trim(),
      inDate:       document.getElementById('ep-indate').value       || lot.inDate,
      targetDate:   document.getElementById('ep-tgt').value          || lot.targetDate,
      qty:          parseNumber(document.getElementById('ep-qty').value) || lot.qty,
      price:        parseNumber(document.getElementById('ep-price').value),
      currency:     document.getElementById('ep-cur').value,
      product:      document.getElementById('ep-prod').value.trim(),
      note:         document.getElementById('ep-note').value.trim(),
      done:         doneVal,
      actualDone:   doneVal === '1' ? (actualDone || today()) : actualDone,
    };
    Store.upsertLot(updated);
    Api.update(CONFIG.SHEETS.LOTS, _editLotId, updated);
    Api.log('LOT', '수정', updated.lotNo || String(_editLotId), `${CONFIG.BIZ_LABELS[updated.biz]||updated.biz} 수정`);
    const ok = document.getElementById('ep-ok');
    if (ok) { ok.style.display = 'block'; setTimeout(() => { ok.style.display = 'none'; closeEditPanel(); }, 1000); }
    UI.toast('LOT 수정됨');
    render();
  }

  // ── 탭 전환 ────────────────────────────────────────────────
  function switchTab(lotId, tab) {
    ['manual','paste'].forEach(t => {
      const btn   = document.getElementById(`dp-tab-${t}-${lotId}`);
      const panel = document.getElementById(`dp-panel-${t}-${lotId}`);
      if (!btn || !panel) return;
      const active = t === tab;
      btn.style.background    = active ? 'var(--card)' : 'transparent';
      btn.style.color         = active ? 'var(--tx)'   : 'var(--tx3)';
      btn.style.borderBottom  = active ? '2px solid var(--tx)' : '2px solid transparent';
      panel.style.display     = active ? 'block' : 'none';
    });
  }

  // ── 붙여넣기 파싱 ──────────────────────────────────────────
  function parsePaste(lotId) {
    const raw = document.getElementById('dp-paste-' + lotId)?.value.trim();
    if (!raw) { UI.toast('데이터를 붙여넣어 주세요', true); return; }

    const lines = raw.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) { UI.toast('헤더와 데이터 행이 필요합니다', true); return; }

    // 헤더 매핑 — 다양한 표현 허용
    const header = lines[0].split('\t').map(h => h.trim().toLowerCase());
    const COL = {
      date:     header.findIndex(h => /date|날짜|일자|day/.test(h)),
      proc:     header.findIndex(h => /qty|합계|total|처리량|proc|quantity|수량/.test(h)),
      normal:   header.findIndex(h => /normal|정상/.test(h)),
      noBoot:   header.findIndex(h => /no.?boot|noboot/.test(h)),
      abnormal: header.findIndex(h => /abnormal|불량|이상/.test(h)),
    };

    if (COL.date === -1) { UI.toast('날짜 컬럼을 찾을 수 없습니다 (Date, 날짜, 일자)', true); return; }

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t').map(c => c.trim());
      const dateVal = cols[COL.date] || '';
      if (!dateVal) continue;

      // 날짜 정규화
      let date = dateVal.replace(/\//g, '-');
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) { /* ok */ }
      else {
        const d = new Date(dateVal);
        if (!isNaN(d)) date = d.toISOString().split('T')[0];
        else continue;
      }

      const normal   = COL.normal   >= 0 ? parseNumber(cols[COL.normal])   : 0;
      const noBoot   = COL.noBoot   >= 0 ? parseNumber(cols[COL.noBoot])   : 0;
      const abnormal = COL.abnormal >= 0 ? parseNumber(cols[COL.abnormal]) : 0;
      const proc     = COL.proc >= 0
        ? parseNumber(cols[COL.proc])
        : (normal + noBoot + abnormal) || 0;

      if (!proc && !normal && !noBoot && !abnormal) continue;
      parsed.push({ date, proc, normal, noBoot, abnormal });
    }

    if (!parsed.length) { UI.toast('파싱된 데이터가 없습니다', true); return; }

    // 미리보기 렌더
    const previewEl = document.getElementById('dp-paste-preview-' + lotId);
    const saveBtn   = document.getElementById('dp-paste-save-' + lotId);
    if (!previewEl) return;

    const lot     = Store.getLotById(lotId);
    const isDram  = lot?.biz === 'DRAM';
    const dailies = Store.getDailies();
    const existing = new Set(dailies.filter(r => String(r.lotId) === String(lotId)).map(r => r.date));

    const rows = parsed.map(r => {
      const dup = existing.has(r.date);
      return `<tr style="${dup ? 'background:#FAEEDA' : ''}">
        <td style="padding:6px 10px;font-family:var(--font-mono);font-size:13px">${r.date}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:500">${formatNumber(r.proc)}</td>
        ${isDram ? `
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:#085041">${formatNumber(r.normal)}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:#633806">${formatNumber(r.noBoot)}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:13px;color:#791F1F">${formatNumber(r.abnormal)}</td>
        ` : ''}
        <td style="padding:6px 10px;font-size:12px">${dup ? '<span style="border:1px solid var(--bd);color:var(--tx2);background:transparent;padding:1px 6px;border-radius:3px;font-size:12px">중복 (덮어씀)</span>' : ''}</td>
      </tr>`;
    }).join('');

    const thStyle = 'padding:7px 10px;text-align:left;font-size:12px;font-weight:600;color:var(--tx3);text-transform:uppercase;background:var(--tbl-hd-bg);border-bottom:1px solid var(--tbl-hd-bd)';
    previewEl.innerHTML = `
      <div style="font-size:13px;font-weight:500;color:var(--tx2);margin-bottom:6px">${parsed.length}건 인식됨 ${existing.size > 0 && parsed.some(r => existing.has(r.date)) ? '· <span style="color:#BA7517">노란색: 날짜 중복 (덮어쓰기)</span>' : ''}</div>
      <div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--rs);overflow:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr>
            <th style="${thStyle}">날짜</th>
            <th style="${thStyle};text-align:right">처리량</th>
            ${isDram ? `<th style="${thStyle};text-align:right;color:#085041">Normal</th><th style="${thStyle};text-align:right;color:#633806">No Boot</th><th style="${thStyle};text-align:right;color:#791F1F">Abnormal</th>` : ''}
            <th style="${thStyle}"></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    previewEl.style.display = 'block';
    previewEl.dataset.parsed = JSON.stringify(parsed);
    if (saveBtn) saveBtn.style.display = 'inline-block';
  }

  // ── 붙여넣기 일괄 저장 ─────────────────────────────────────
  async function savePaste(lotId) {
    const previewEl = document.getElementById('dp-paste-preview-' + lotId);
    if (!previewEl?.dataset.parsed) return;

    const parsed  = JSON.parse(previewEl.dataset.parsed);
    const lot     = Store.getLotById(lotId); if (!lot) return;
    const dailies = Store.getDailies();

    let cum = getLotCumulative(lot.id, dailies);
    let cnt = 0;

    // 날짜 오름차순으로 처리
    const sorted = [...parsed].sort((a, b) => a.date.localeCompare(b.date));

    for (const r of sorted) {
      // 중복이면 기존 삭제
      const dup = dailies.find(d => String(d.lotId) === String(lotId) && d.date === r.date);
      if (dup) {
        Store.deleteDaily(dup.id);
        Api.delete(CONFIG.SHEETS.DAILY, dup.id);
        cum -= parseNumber(dup.proc);
      }

      cum += r.proc;
      const remNew = Math.max(0, parseNumber(lot.qty) - cum);
      const record = {
        id: Date.now() + Math.random(),
        date: r.date, lotId: lot.id, lotNo: lot.lotNo || lot.id,
        biz: lot.biz, country: lot.country, customerName: lot.customerName || '',
        proc: r.proc, normal: r.normal, noBoot: r.noBoot, abnormal: r.abnormal,
        cumul: cum, remain: remNew, note: '', done: remNew === 0 ? '1' : '0',
      };
      Store.upsertDaily(record);
      await Api.append(CONFIG.SHEETS.DAILY, record);
      Api.log('일별처리', '등록', record.lotNo || String(record.lotId), `${record.date} 처리 ${Number(record.proc).toLocaleString()}개${record.biz==='DRAM' ? ` (N:${Number(record.normal).toLocaleString()} / NB:${Number(record.noBoot).toLocaleString()} / AB:${Number(record.abnormal).toLocaleString()})` : ''} | 누적 ${Number(record.cumul).toLocaleString()} / 잔여 ${Number(record.remain).toLocaleString()}`);
      cnt++;
    }

    const okEl = document.getElementById('dp-paste-ok-' + lotId);
    if (okEl) { okEl.style.display = 'inline'; setTimeout(() => okEl.style.display = 'none', 2000); }
    const saveBtn = document.getElementById('dp-paste-save-' + lotId);
    if (saveBtn) saveBtn.style.display = 'none';
    previewEl.style.display = 'none';
    previewEl.dataset.parsed = '';
    const pasteEl = document.getElementById('dp-paste-' + lotId);
    if (pasteEl) pasteEl.value = '';
    UI.toast(cnt + '건 저장됨');
    render();
  }

  return { render, renderChart, initYearTabs, setFilter, setChartBiz, setChartCountry, setChartYear, toggleCard, calcDram, calcRem, saveLot, saveDaily, deleteLot, deleteDaily, handleNewCust, calcNewTgt, exportExcel, openEditPanel, closeEditPanel, calcEditTgt, saveLotEdit, switchTab, parsePaste, savePaste, openDeleteModal, cancelDelete, confirmDelete };

})();
